// Utility to check if extension context is still valid
export function isExtensionContextValid(): boolean {
  try {
    // Try to access chrome.runtime - this will throw if context is invalidated
    return !!chrome?.runtime?.id
  } catch (error) {
    console.log("Extension context invalidated")
    return false
  }
}

// Wrapper for operations that require valid extension context
export async function withValidContext<T>(
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  if (!isExtensionContextValid()) {
    console.log("Skipping operation - extension context invalid")
    return fallback
  }

  try {
    return await operation()
  } catch (error) {
    if (error.message?.includes("Extension context invalidated")) {
      console.log("Extension context invalidated during operation")
      return fallback
    }
    throw error
  }
}

// Graceful cleanup when context becomes invalid
export function setupContextMonitoring(cleanupCallback: () => void) {
  // Check context periodically
  const checkInterval = setInterval(() => {
    if (!isExtensionContextValid()) {
      console.log("Extension context lost, cleaning up...")
      cleanupCallback()
      clearInterval(checkInterval)
    }
  }, 5000)

  // Listen for disconnect events
  try {
    chrome.runtime?.onConnect?.addListener((port) => {
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
          console.log("Port disconnected, cleaning up...")
          cleanupCallback()
        }
      })
    })
  } catch (error) {
    // Ignore if chrome.runtime is not available
  }

  return () => clearInterval(checkInterval)
}
