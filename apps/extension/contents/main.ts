import type { PlasmoCSConfig } from "plasmo"

import {
  checkInputFields,
  clearAllInputElements,
  closeAllInputPopups,
  handleInputClickOutside,
  isInputElement
} from "~contents/input-suggestions"
import {
  handleSelectionClickOutside,
  handleTextSelection,
  isSelectionElement,
  removeSelectionElements
} from "~contents/text-selection"
import { setupContextMonitoring } from "~utils/context"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

// Global cleanup function
function globalCleanup() {
  console.log("Performing global cleanup...")
  removeSelectionElements()
  clearAllInputElements()
}

// Event handlers
function initializeExtension() {
  try {
    console.log("Core extension initialized")

    // Setup context monitoring with cleanup
    const stopMonitoring = setupContextMonitoring(globalCleanup)

    // Text selection handler
    document.addEventListener("mouseup", handleTextSelection)

    // Keyboard event handlers
    document.addEventListener("keyup", (e) => {
      if (e.key === "Escape") {
        removeSelectionElements()
        closeAllInputPopups()
      }
    })

    // Monitor input fields
    setInterval(checkInputFields, 1000)

    // Initial check
    setTimeout(checkInputFields, 1000)

    // Click outside to close popups
    document.addEventListener("click", (e) => {
      const target = e.target as HTMLElement

      // Don't close if clicking on extension elements
      if (isSelectionElement(target) || isInputElement(target)) {
        return
      }

      // Handle click outside for both features
      handleSelectionClickOutside(target)
      handleInputClickOutside(target)
    })

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      stopMonitoring()
      globalCleanup()
    })
  } catch (error) {
    console.error("Extension initialization error:", error)
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension)
} else {
  initializeExtension()
}
