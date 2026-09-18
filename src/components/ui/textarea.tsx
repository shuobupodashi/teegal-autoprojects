
import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const [isResizing, setIsResizing] = useState(false)
    
    // Function to resize textarea based on content
    const resizeTextarea = (element: HTMLTextAreaElement | null) => {
      if (!element) return
      
      // Reset height to auto first to get the correct scrollHeight
      element.style.height = 'auto'
      
      // Calculate the height based on scrollHeight
      // Use Math.max to ensure minimum height
      // Use Math.min to cap the height to approximately 6 lines
      const minHeight = 38 // ~1 line height
      const maxHeight = 156 // ~6 lines height
      
      const newHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight)
      element.style.height = `${newHeight}px`
    }
    
    // Combine the refs
    React.useEffect(() => {
      if (ref && 'current' in ref) {
        textareaRef.current = ref.current
      }
    }, [ref])
    
    // Initialize the height of the textarea
    React.useEffect(() => {
      resizeTextarea(textareaRef.current)
    }, [])
    
    // Resize on content change
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      resizeTextarea(e.target)
      
      // Call the original onChange if provided
      onChange && onChange(e)
    }
    
    // Handle input to catch deletions, cuts, pastes, etc.
    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      resizeTextarea(e.currentTarget)
    }

    return (
      <textarea
        className={cn(
          "flex min-h-[38px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden resize-none transition-height ease-out",
          className
        )}
        ref={(element) => {
          textareaRef.current = element
          // Pass the ref to the forwardRef
          if (typeof ref === 'function') {
            ref(element)
          } else if (ref) {
            ref.current = element
          }
        }}
        onChange={handleChange}
        onInput={handleInput}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
