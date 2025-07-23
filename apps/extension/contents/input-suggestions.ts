import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"

import InputSuggestionsPopup from "~components/InputSuggestionsPopup"
import { searchFacts } from "~utils/api"
import { isExtensionContextValid } from "~utils/context"

let inputDots: Map<HTMLElement, HTMLDivElement> = new Map()
let inputPopups: Map<HTMLElement, HTMLDivElement> = new Map()
let reactRoots: Map<HTMLElement, Root> = new Map()
let currentUrl = window.location.href

// Track page navigation and reset popups
function checkPageNavigation() {
  if (window.location.href !== currentUrl) {
    console.log("Page navigation detected, resetting input popups")
    currentUrl = window.location.href
    clearAllInputElements()
  }
}

// Input field monitoring
function createInputDot(input: HTMLElement, rect: DOMRect) {
  if (inputDots.has(input)) return

  const dot = document.createElement("div")
  dot.style.cssText = `
    position: absolute;
    width: 54px;
    height: 20px;
    cursor: pointer;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.2s ease;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    background: #c15e50;
    border-radius: 4px;
    padding: 3px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `

  // Add the logo SVG with white color and Core text - smaller version for input fields
  dot.innerHTML = `
    <div style="display: flex; flex-direction: row; align-items: center; gap: 5px;">
      <svg width="16" height="16" viewBox="0 0 282 282" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M80.0827 34.974C92.7457 3.8081 120.792 17.7546 134.476 29.5676C135.325 30.301 135.792 31.3761 135.792 32.4985V250.806C135.792 251.98 135.258 253.117 134.349 253.858C103.339 279.155 85.2835 259.158 80.0827 245.771C44.9187 241.11 43.965 209.932 47.8837 194.925C15.173 187.722 17.5591 152.731 22.841 136.135C9.34813 107.747 33.9141 90.4097 47.8837 85.2899C40.524 50.5456 66.2831 37.2692 80.0827 34.974Z" stroke="white" stroke-width="5"/>
        <circle cx="103.955" cy="66.3968" r="11.0444" fill="white"/>
        <circle cx="90.4996" cy="129.403" r="11.5465" fill="white"/>
        <circle cx="103.955" cy="197.449" r="11.0444" fill="white"/>
        <circle cx="48.4992" cy="86.0547" r="8.53434" fill="white"/>
        <path d="M202.806 247.026C190.143 278.192 162.097 264.245 148.413 252.432C147.563 251.699 147.097 250.624 147.097 249.501V31.1935C147.097 30.0203 147.631 28.8833 148.54 28.1417C179.549 2.84476 197.605 22.8418 202.806 36.2294C237.97 40.8903 238.924 72.0684 235.005 87.0748C267.716 94.2779 265.33 129.269 260.048 145.865C273.541 174.253 248.975 191.59 235.005 196.71C242.365 231.454 216.606 244.731 202.806 247.026Z" stroke="white" stroke-width="5"/>
        <circle cx="178.934" cy="215.603" r="11.0444" transform="rotate(180 178.934 215.603)" fill="white"/>
        <circle cx="192.389" cy="152.597" r="11.5465" transform="rotate(180 192.389 152.597)" fill="white"/>
        <circle cx="178.934" cy="84.5506" r="11.0444" transform="rotate(180 178.934 84.5506)" fill="white"/>
        <circle cx="234.389" cy="195.945" r="8.53434" transform="rotate(180 234.389 195.945)" fill="white"/>
      </svg>
      <div style="
        color: white;
        font-size: 8px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 600;
        margin-right: 4px;
        text-align: center;
        line-height: 1;
      ">Core</div>
    </div>
  `

  dot.style.top = `${rect.top + window.scrollY + 2}px`
  dot.style.left = `${rect.right + window.scrollX - 24}px`

  dot.addEventListener("click", () => showInputPopup(input))
  dot.addEventListener("mouseenter", () => showInputPopup(input))

  document.body.appendChild(dot)
  inputDots.set(input, dot)

  setTimeout(() => {
    dot.style.opacity = "1"
  }, 10)
}

// Facts popup for input fields with React
async function showInputPopup(input: HTMLElement) {
  if (!isExtensionContextValid()) {
    console.log("Extension context invalid, skipping input popup")
    return
  }

  // Get value from input element, handling both input/textarea and contenteditable
  let query = ""
  if ("value" in input && (input as HTMLInputElement).value !== undefined) {
    query = (input as HTMLInputElement).value.trim()
  } else {
    query = input.textContent?.trim() || ""
  }

  if (!query || inputPopups.has(input)) return

  // Create popup container
  const popup = document.createElement("div")
  popup.style.cssText = `
    position: fixed;
    z-index: 10002;
    opacity: 0;
    transition: opacity 0.2s ease;
  `

  // Position popup
  const rect = input.getBoundingClientRect()
  let top = rect.bottom + 5
  let left = rect.left

  if (left + 400 > window.innerWidth) {
    left = window.innerWidth - 410
  }
  if (left < 10) {
    left = 10
  }

  if (top + 300 > window.innerHeight) {
    top = rect.top - 310
  }

  popup.style.top = `${top}px`
  popup.style.left = `${left}px`

  document.body.appendChild(popup)
  inputPopups.set(input, popup)

  // Create React root
  const root = createRoot(popup)
  reactRoots.set(input, root)

  // Handle fact selection
  const handleFactSelect = (factText: string) => {
    if (input) {
      // Handle both input/textarea and contenteditable elements
      if ("value" in input && (input as HTMLInputElement).value !== undefined) {
        const inputEl = input as HTMLInputElement
        inputEl.value += (inputEl.value ? " " : "") + factText
        inputEl.dispatchEvent(new Event("input", { bubbles: true }))
      } else {
        // For contenteditable elements
        const currentText = input.textContent || ""
        input.textContent = currentText + (currentText ? " " : "") + factText
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
      removeInputPopup(input)
    }
  }

  // Handle popup close
  const handleClose = () => {
    removeInputPopup(input)
  }

  // Render loading state initially
  root.render(
    createElement(InputSuggestionsPopup, {
      facts: [],
      isLoading: true,
      onFactSelect: handleFactSelect,
      onClose: handleClose
    })
  )

  // Show popup
  setTimeout(() => {
    popup.style.opacity = "1"
  }, 10)

  // Search for facts
  try {
    const searchResult = await searchFacts(query)
    const facts = searchResult?.facts || []

    // Update with search results
    root.render(
      createElement(InputSuggestionsPopup, {
        facts,
        isLoading: false,
        onFactSelect: handleFactSelect,
        onClose: handleClose
      })
    )
  } catch (error) {
    console.error("Error searching facts:", error)
    // Show error state
    root.render(
      createElement(InputSuggestionsPopup, {
        facts: [],
        isLoading: false,
        onFactSelect: handleFactSelect,
        onClose: handleClose
      })
    )
  }
}

// Input field monitoring
export function checkInputFields() {
  // Check for page navigation first
  checkPageNavigation()

  const inputs = document.querySelectorAll(
    "input[type='text'], input[type='search'], input[type='email'], input[type='url'], textarea, [contenteditable='true']"
  )

  inputs.forEach((input) => {
    const element = input as HTMLElement
    const inputElement = element as HTMLInputElement | HTMLTextAreaElement

    // Skip Core extension popup textarea
    if (
      element.id === "memory-text" ||
      element.closest('[style*="z-index: 10002"]')
    ) {
      return
    }

    let value = ""
    if (inputElement.value !== undefined) {
      value = inputElement.value.trim()
    } else {
      value = element.textContent?.trim() || ""
    }

    const words = value.split(/\s+/).filter((word) => word.length > 0)

    if (words.length > 1) {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        createInputDot(element, rect)
      }
    } else {
      removeInputDot(element)
      removeInputPopup(element)
    }
  })
}

// Cleanup functions
function removeInputDot(input: HTMLElement) {
  const dot = inputDots.get(input)
  if (dot) {
    dot.remove()
    inputDots.delete(input)
  }
}

export function removeInputPopup(input: HTMLElement) {
  // Clean up React root first
  const root = reactRoots.get(input)
  if (root) {
    root.unmount()
    reactRoots.delete(input)
  }

  // Remove DOM element
  const popup = inputPopups.get(input)
  if (popup) {
    popup.remove()
    inputPopups.delete(input)
  }
}

export function clearAllInputElements() {
  // Clean up React roots
  reactRoots.forEach((root) => root.unmount())
  reactRoots.clear()

  // Clean up DOM elements
  inputDots.forEach((dot) => dot.remove())
  inputPopups.forEach((popup) => popup.remove())
  inputDots.clear()
  inputPopups.clear()
}

// Check if click is on input elements
export function isInputElement(target: HTMLElement): boolean {
  // Check if target is within any popup or dot
  for (const popup of inputPopups.values()) {
    if (popup.contains(target)) return true
  }
  for (const dot of inputDots.values()) {
    if (dot.contains(target)) return true
  }
  return false
}

// Handle input popup click outside
export function handleInputClickOutside(target: HTMLElement) {
  inputPopups.forEach((popup, input) => {
    if (!popup.contains(target) && target !== input) {
      removeInputPopup(input)
    }
  })
}

// Close all input popups
export function closeAllInputPopups() {
  inputPopups.forEach((popup, input) => {
    removeInputPopup(input)
  })
}
