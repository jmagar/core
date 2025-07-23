import { useEffect, useState } from "react"

interface InputSuggestionsPopupProps {
  facts: string[]
  isLoading: boolean
  onFactSelect: (fact: string) => void
  onClose: () => void
}

export default function InputSuggestionsPopup({
  facts,
  isLoading,
  onFactSelect,
  onClose
}: InputSuggestionsPopupProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Auto-hide after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, 10000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "14px",
        maxWidth: "400px",
        maxHeight: "300px",
        overflowY: "auto"
      }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "12px",
          fontWeight: "500",
          color: "#333",
          borderBottom: "1px solid #eee",
          paddingBottom: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
        <span>AI Suggestions</span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onClose()
          }}
          style={{
            background: "none",
            border: "none",
            color: "#6B7280",
            cursor: "pointer",
            fontSize: "20px",
            padding: "0",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ marginBottom: "12px" }}>
        {isLoading ? (
          <div
            style={{
              color: "#666",
              fontSize: "13px",
              textAlign: "center",
              padding: "20px"
            }}>
            Searching for relevant facts...
          </div>
        ) : facts.length > 0 ? (
          facts.slice(0, 5).map((fact, index) => (
            <div
              key={index}
              onClick={() => onFactSelect(fact)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                padding: "8px 12px",
                margin: "4px 0",
                background: hoveredIndex === index ? "#e9ecef" : "#f8f9fa",
                borderRadius: "4px",
                cursor: "pointer",
                border: "1px solid #e9ecef",
                transition: "background-color 0.2s"
              }}>
              <div
                style={{
                  fontSize: "13px",
                  color: "#333",
                  lineHeight: "1.4"
                }}>
                {fact}
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              color: "#666",
              fontSize: "13px",
              textAlign: "center",
              padding: "20px"
            }}>
            No relevant suggestions found
          </div>
        )}
      </div>
    </div>
  )
}
