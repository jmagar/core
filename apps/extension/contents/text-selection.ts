import { addEpisode } from "~utils/api"
import { isExtensionContextValid } from "~utils/context"
import { createRoot, type Root } from "react-dom/client"
import { createElement } from "react"
import TextSelectionPopup from "~components/TextSelectionPopup"

let selectionDot: HTMLDivElement | null = null
let selectionPopup: HTMLDivElement | null = null
let selectionRoot: Root | null = null
let autoHideTimer: NodeJS.Timeout | null = null
let isHoveringElements = false

// Logo dot for text selection
function createSelectionDot(rect: DOMRect) {
  removeSelectionElements()

  selectionDot = document.createElement("div")
  selectionDot.style.cssText = `
    position: absolute;
    width: 54px;
    height: 20px;
    cursor: pointer;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.2s ease;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    background: #c15e50;
    border-radius: 6px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `

  // Add the logo SVG with white color and Core text
  selectionDot.innerHTML = `
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

  const top = rect.bottom + window.scrollY + 5
  const left = Math.min(
    rect.right + window.scrollX - 16,
    window.innerWidth - 40
  )

  selectionDot.style.top = `${top}px`
  selectionDot.style.left = `${left}px`

  selectionDot.addEventListener("click", showSelectionPopup)
  selectionDot.addEventListener("mouseenter", showSelectionPopup)

  document.body.appendChild(selectionDot)

  setTimeout(() => {
    if (selectionDot) {
      selectionDot.style.opacity = "1"
    }
  }, 10)

  // Start auto-hide timer
  startAutoHideTimer(8000) // Longer initial timer

  // Handle hover events
  selectionDot.addEventListener("mouseenter", () => {
    isHoveringElements = true
    clearAutoHideTimer()
  })

  selectionDot.addEventListener("mouseleave", () => {
    isHoveringElements = false
    if (!selectionPopup) {
      startAutoHideTimer(3000) // Shorter timer when leaving dot
    }
  })
}

// Timer management functions
function startAutoHideTimer(delay: number) {
  clearAutoHideTimer()
  autoHideTimer = setTimeout(() => {
    if (!isHoveringElements) {
      removeSelectionElements()
    }
  }, delay)
}

function clearAutoHideTimer() {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
    autoHideTimer = null
  }
}

// Popup for text selection with React
function showSelectionPopup() {
  const selectedText = window.getSelection()?.toString().trim()
  if (!selectedText || !selectionDot) return

  removeSelectionPopup()

  // Create popup container
  selectionPopup = document.createElement("div")
  selectionPopup.style.cssText = `
    position: fixed;
    z-index: 10002;
    opacity: 0;
    transition: opacity 0.2s ease;
  `

  // Position popup
  const dotRect = selectionDot.getBoundingClientRect()
  let top = dotRect.bottom + 5
  let left = dotRect.left

  // Keep popup within viewport bounds
  if (left + 350 > window.innerWidth) {
    left = window.innerWidth - 360
  }
  if (left < 10) {
    left = 10
  }

  // If popup would go below viewport, show above the dot
  if (top + 250 > window.innerHeight) {
    top = dotRect.top - 255
  }

  // Ensure popup doesn't go above viewport
  if (top < 10) {
    top = 10
  }

  selectionPopup.style.top = `${top}px`
  selectionPopup.style.left = `${left}px`

  document.body.appendChild(selectionPopup)

  // Handle popup hover events
  selectionPopup.addEventListener("mouseenter", () => {
    isHoveringElements = true
    clearAutoHideTimer()
  })

  selectionPopup.addEventListener("mouseleave", () => {
    isHoveringElements = false
    startAutoHideTimer(5000) // Auto-hide after leaving popup
  })

  // Prevent popup from closing when clicking inside it
  selectionPopup.addEventListener("click", (e) => {
    e.stopPropagation()
  })

  // Create React root
  selectionRoot = createRoot(selectionPopup)

  // State management for the component
  let saveStatus: 'idle' | 'saving' | 'success' | 'error' | 'empty' = 'idle'
  let isSaving = false

  // Handle save
  const handleSave = async (text: string) => {
    if (!isExtensionContextValid()) {
      saveStatus = 'error'
      renderPopup()
      return
    }

    if (!text.trim()) {
      saveStatus = 'empty'
      renderPopup()
      setTimeout(() => {
        saveStatus = 'idle'
        renderPopup()
      }, 2000)
      return
    }

    isSaving = true
    saveStatus = 'saving'
    renderPopup()

    try {
      const success = await addEpisode(text)
      
      if (success) {
        saveStatus = 'success'
        renderPopup()
        setTimeout(() => removeSelectionElements(), 1500)
      } else {
        saveStatus = 'error'
        renderPopup()
        setTimeout(() => {
          saveStatus = 'idle'
          isSaving = false
          renderPopup()
        }, 2000)
      }
    } catch (error) {
      saveStatus = 'error'
      renderPopup()
      setTimeout(() => {
        saveStatus = 'idle'
        isSaving = false
        renderPopup()
      }, 2000)
    }
  }

  // Handle close
  const handleClose = () => {
    removeSelectionElements()
  }

  // Render function
  const renderPopup = () => {
    if (selectionRoot) {
      selectionRoot.render(
        createElement(TextSelectionPopup, {
          selectedText,
          onSave: handleSave,
          onClose: handleClose,
          isSaving,
          saveStatus
        })
      )
    }
  }

  // Initial render
  renderPopup()

  // Show popup
  setTimeout(() => {
    if (selectionPopup) {
      selectionPopup.style.opacity = "1"
    }
  }, 10)
}

// Text selection handler
export function handleTextSelection() {
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim()

  if (
    selectedText &&
    selectedText.length > 0 &&
    selection &&
    selection.rangeCount > 0
  ) {
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    createSelectionDot(rect)
  } else {
    removeSelectionElements()
  }
}

// Cleanup functions
export function removeSelectionElements() {
  clearAutoHideTimer()
  isHoveringElements = false
  
  if (selectionDot) {
    selectionDot.remove()
    selectionDot = null
  }
  removeSelectionPopup()
}

function removeSelectionPopup() {
  // Clean up React root first
  if (selectionRoot) {
    selectionRoot.unmount()
    selectionRoot = null
  }
  
  // Remove DOM element
  if (selectionPopup) {
    selectionPopup.remove()
    selectionPopup = null
  }
}

// Check if click is on selection elements
export function isSelectionElement(target: HTMLElement): boolean {
  // Check if clicking on the dot
  if (selectionDot && selectionDot.contains(target)) {
    return true
  }
  
  // Check if clicking on the popup (including textarea and buttons)
  if (selectionPopup && selectionPopup.contains(target)) {
    return true
  }
  
  // Check if clicking on specific popup elements by ID
  if (target.id === 'memory-text' || target.id === 'save-btn' || target.id === 'close-btn') {
    return true
  }
  
  // Check if target is within any element with our popup z-index
  if (target.closest('[style*="z-index: 10002"]')) {
    return true
  }
  
  return false
}

// Close selection popup if clicking elsewhere
export function handleSelectionClickOutside(target: HTMLElement) {
  // Only close if we're not clicking on any selection elements
  if (selectionPopup && !isSelectionElement(target)) {
    removeSelectionElements()
  }
}
