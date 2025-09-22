import { useEffect, useState } from "react"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast"
import { getToasts } from "@/lib/toast"

export function Toaster() {
  const [toasts, setToasts] = useState(getToasts())
  
  // Update toasts when they change
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts(getToasts())
    }, 100) // Check for toast updates every 100ms
    
    return () => clearInterval(interval)
  }, [])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
