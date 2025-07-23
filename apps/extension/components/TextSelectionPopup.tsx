import { useEffect, useRef, useState } from "react"

interface TextSelectionPopupProps {
  selectedText: string
  onSave: (text: string) => Promise<void>
  onClose: () => void
  isSaving: boolean
  saveStatus: "idle" | "saving" | "success" | "error" | "empty"
}

export default function TextSelectionPopup({
  selectedText,
  onSave,
  onClose,
  isSaving,
  saveStatus
}: TextSelectionPopupProps) {
  const [text, setText] = useState(selectedText)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      )
    }
  }, [])

  const handleSave = async () => {
    const textToSave = text.trim()
    if (!textToSave) {
      return
    }
    await onSave(textToSave)
  }

  const getButtonText = () => {
    switch (saveStatus) {
      case "saving":
        return "Saving..."
      case "success":
        return "Saved!"
      case "error":
        return "Error"
      case "empty":
        return "No text to save"
      default:
        return "Add to Memory"
    }
  }

  const getButtonColor = () => {
    switch (saveStatus) {
      case "success":
        return "#10B981"
      case "error":
      case "empty":
        return "#EF4444"
      default:
        return "#c15e50"
    }
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: "14px",
        width: "350px"
      }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "12px",
          fontWeight: "500",
          color: "#333",
          borderBottom: "1px solid #eee",
          paddingBottom: "8px"
        }}>
        Add to Core Memory
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => {
          e.stopPropagation()
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}
        onFocus={(e) => {
          e.stopPropagation()
        }}
        placeholder="Edit the text you want to save to memory..."
        style={{
          width: "100%",
          minHeight: "80px",
          maxHeight: "150px",
          resize: "vertical",
          border: "none",
          outline: "none",
          background: "#f8f9fa",
          borderRadius: "4px",
          padding: "8px",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: "13px",
          lineHeight: "1.4",
          color: "#333",
          marginBottom: "12px",
          boxSizing: "border-box"
        }}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleSave}
          disabled={isSaving || !text.trim()}
          style={{
            flex: 1,
            background: getButtonColor(),
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: isSaving || !text.trim() ? "not-allowed" : "pointer",
            fontSize: "13px",
            opacity: isSaving || !text.trim() ? 0.6 : 1
          }}>
          {getButtonText()}
        </button>
        <button
          onClick={onClose}
          style={{
            background: "#6B7280",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "13px"
          }}>
          Close
        </button>
      </div>
    </div>
  )
}
