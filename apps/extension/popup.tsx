import { useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

function IndexPopup() {
  // useStorage returns [value, setValue, { remove }]
  const [apiKey, setApiKey, { remove }] = useStorage<string>("core_api_key")
  const [inputValue, setInputValue] = useState(apiKey ?? "")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")

  // Keep inputValue in sync with apiKey if apiKey changes externally
  // (e.g. from another tab)
  // This is optional, but helps UX
  if (apiKey !== undefined && inputValue !== apiKey) {
    setInputValue(apiKey)
  }

  const saveApiKey = async () => {
    if (!inputValue.trim()) {
      setMessage("Please enter an API key")
      return
    }
    setIsLoading(true)
    try {
      await setApiKey(inputValue.trim())
      setMessage("API key saved successfully!")
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      setMessage("Failed to save API key")
      console.error("Save error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearApiKey = async () => {
    try {
      await remove()
      setInputValue("")
      setMessage("API key cleared")
      setTimeout(() => setMessage(""), 3000)
    } catch (error) {
      setMessage("Failed to clear API key")
      console.error("Clear error:", error)
    }
  }

  return (
    <div style={{ padding: 20, minWidth: 300 }}>
      <h2 style={{ margin: "0 0 16px 0", fontSize: 18, color: "#333" }}>
        Core Memory Extension
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            display: "block",
            marginBottom: 8,
            fontSize: 14,
            color: "#555"
          }}>
          Core API Key:
        </label>
        <input
          type="password"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter your Core API key"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: 4,
            fontSize: 14,
            marginBottom: 8
          }}
        />

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={saveApiKey}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "8px 16px",
              background: "#c15e50",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: 14,
              opacity: isLoading ? 0.6 : 1
            }}>
            {isLoading ? "Saving..." : "Save"}
          </button>

          {apiKey && (
            <button
              onClick={clearApiKey}
              style={{
                padding: "8px 16px",
                background: "#EF4444",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 14
              }}>
              Clear
            </button>
          )}
        </div>

        {message && (
          <div
            style={{
              padding: 8,
              borderRadius: 4,
              fontSize: 13,
              backgroundColor: message.includes("success")
                ? "#10B981"
                : "#EF4444",
              color: "white",
              marginBottom: 12
            }}>
            {message}
          </div>
        )}

        {apiKey && (
          <div style={{ fontSize: 12, color: "#10B981", marginBottom: 16 }}>
            ✓ API key configured
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.4 }}>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>How to use:</strong>
        </p>
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>Select text on any page to save to Core</li>
          <li>Look for red dots in input fields for AI suggestions</li>
        </ul>
      </div>
    </div>
  )
}

export default IndexPopup
