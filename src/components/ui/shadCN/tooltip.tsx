import * as React from "react"
import { useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils/utils"
import { Button } from "./button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { Info } from "lucide-react"

/**
 * Utility function to detect mobile devices
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check screen width (similar to your Flutter implementation)
  const screenWidth = window.innerWidth;
  
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  return hasTouch && (screenWidth < 768 || isMobileUA);
}

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root

// Enhanced TooltipTrigger with mobile detection
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger> & {
    tooltipContent?: React.ReactNode;
    tooltipTitle?: string;
    iconSize?: number;
    iconClassName?: string;
  }
>(({ children, tooltipContent, tooltipTitle, iconSize = 14, iconClassName, ...props }, ref) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isMobile = isMobileDevice();

  if (isMobile && tooltipContent) {
    // Mobile: Show info icon next to child, tap opens dialog
    return (
      <div className="inline-flex items-center">
        <TooltipPrimitive.Trigger {...props} ref={ref}>
          {children}
        </TooltipPrimitive.Trigger>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto p-1 ml-1 hover:bg-gray-100",
                iconClassName
              )}
              onClick={() => setIsDialogOpen(true)}
            >
              <Info 
                size={iconSize} 
                className="text-gray-500" 
              />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              {tooltipTitle && <DialogTitle>{tooltipTitle}</DialogTitle>}
            </DialogHeader>
            <div className="text-sm whitespace-pre-line">
              {tooltipContent}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  } else {
    // Desktop: Use native tooltip trigger
    return (
      <TooltipPrimitive.Trigger {...props} ref={ref}>
        {children}
      </TooltipPrimitive.Trigger>
    );
  }
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName


export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
