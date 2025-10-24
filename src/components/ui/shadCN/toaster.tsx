import { useEffect, useState } from "react"
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast"
import { getToasts } from "@/lib/utils/toast"
import { Button } from "@/components/ui"
import { Filter, Shield, VolumeX } from "lucide-react"
import { toast } from "@/lib/utils/toast"
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
    import('@/lib/services/core/notificationService').then(({ notificationService }) => {
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
    import('@/lib/services/core/notificationService').then(({ notificationService }) => {
      notificationService.blockNotificationCategory(category);
      const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      toast({
        title: "Filter Added",
        description: `All ${capitalizedCategory} notifications will be blocked`,
        variant: "default"
      });
    });
  };

  const handleBlockOriginFromHistory = (origin: string, userFriendlyOrigin?: string) => {
    // Import notification service dynamically to avoid circular dependency
    import('@/lib/services/core/notificationService').then(({ notificationService }) => {
      notificationService.blockNotificationOrigin(origin, true);
      toast({
        title: "Filter Added",
        description: `Notifications from ${userFriendlyOrigin || origin} will be completely silenced`,
        variant: "default"
      });
    });
  };

  const handleBlockCategoryFromHistory = (category: string) => {
    // Import notification service dynamically to avoid circular dependency
    import('@/lib/services/core/notificationService').then(({ notificationService }) => {
      notificationService.blockNotificationCategory(category, true);
      const capitalizedCategory = category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      toast({
        title: "Filter Added",
        description: `All ${capitalizedCategory} notifications will be completely silenced`,
        variant: "default"
      });
    });
  };

  return (
    <ToastProvider>
      <ToastViewport />
      {toasts.map(function ({ id, title, description, action, origin, userFriendlyOrigin, category, ...props }) {
        // Get category colors for styling using new system
        const classes = getTailwindClasses(category || '');
        
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
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBlockOrigin(origin, userFriendlyOrigin)}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-orange-600"
                    title={`Block notifications from ${origin} (save to history)`}
                  >
                    <Shield className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBlockOriginFromHistory(origin, userFriendlyOrigin)}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                    title={`Completely silence notifications from ${origin} (no history)`}
                  >
                    <VolumeX className="h-3 w-3" />
                  </Button>
                </>
              )}
              {category && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBlockCategory(category)}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-purple-600"
                    title={`Block all ${category} notifications (save to history)`}
                  >
                    <Filter className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBlockCategoryFromHistory(category)}
                    className="h-6 w-6 p-0 text-gray-500 hover:text-red-600"
                    title={`Completely silence all ${category} notifications (no history)`}
                  >
                    <VolumeX className="h-3 w-3" />
                  </Button>
                </>
              )}
              <ToastClose />
            </div>
          </Toast>
        )
      })}
    </ToastProvider>
  )
}
