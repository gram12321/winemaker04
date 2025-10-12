import { useEffect, useState } from "react"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast"
import { getToasts } from "@/lib/utils/toast"
import { Button } from "@/components/ui"
import { Filter, Shield } from "lucide-react"
import { toast } from "@/lib/utils/toast"
import { NotificationCategory } from "@/lib/types/types"
import { getTailwindClasses } from "@/lib/utils/colorMapping"
import { cn } from "@/lib/utils/utils"

export function Toaster() {
  const [toasts, setToasts] = useState(getToasts())
  
  // Update toasts when they change
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts(getToasts())
    }, 100) // Check for toast updates every 100ms
    
    return () => clearInterval(interval)
  }, [])

  const handleBlockOrigin = (origin: string, userFriendlyOrigin?: string) => {
    // Import notification service dynamically to avoid circular dependency
    import('@/components/layout/NotificationCenter').then(({ notificationService }) => {
      notificationService.blockNotificationOrigin(origin);
      toast({
        title: "Filter Added",
        description: `Notifications from ${userFriendlyOrigin || origin} will be blocked`,
        variant: "default"
      });
    });
  };

  const handleBlockCategory = (category: string) => {
    // Import notification service dynamically to avoid circular dependency
    import('@/components/layout/NotificationCenter').then(({ notificationService }) => {
      notificationService.blockNotificationCategory(category);
      const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      toast({
        title: "Filter Added",
        description: `All ${capitalizedCategory} notifications will be blocked`,
        variant: "default"
      });
    });
  };

  return (
    <ToastProvider>
      <ToastViewport />
      {toasts.map(function ({ id, title, description, action, origin, userFriendlyOrigin, category, ...props }) {
        // Get category colors for styling using new system
        const classes = getTailwindClasses(category);
        
        return (
          <Toast 
            key={id} 
            {...props}
            className={cn(
              props.className,
              classes.background,
              classes.border,
              classes.text
            )}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            <div className="flex items-center gap-1">
              {action}
              {origin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBlockOrigin(origin, userFriendlyOrigin)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                  title={`Block notifications from ${origin}`}
                >
                  <Shield className="h-3 w-3" />
                </Button>
              )}
              {category && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBlockCategory(category)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-purple-600"
                  title={`Block all ${category} notifications`}
                >
                  <Filter className="h-3 w-3" />
                </Button>
              )}
              <ToastClose />
            </div>
          </Toast>
        )
      })}
    </ToastProvider>
  )
}
