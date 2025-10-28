import * as React from "react"
import { useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn, getColorClass, getBadgeColorClasses, formatNumber } from "@/lib/utils/utils"
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
  
  // Check screen width
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

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
  variant?: 'default' | 'panel';
  density?: 'normal' | 'compact';
  scrollable?: boolean; // add overflow + maxHeight styling
  maxHeight?: string; // tailwind max-h-* class, default sensible
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, variant = 'default', density = 'normal', scrollable = false, maxHeight = 'max-h-60', ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // base
        "z-50 rounded-md text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        // density
        density === 'compact' ? 'px-2 py-1' : 'px-3 py-1.5',
        // variant styles
        variant === 'panel' 
          ? 'bg-gray-900 text-white border border-gray-700 shadow-lg'
          : 'bg-primary text-primary-foreground',
        // scrollable option
        scrollable && cn('overflow-y-auto', maxHeight, 'scrollbar-styled'),
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// =============================
// Enhanced TooltipContent with building blocks
// =============================

// =============================
// Design Tokens (generic, reusable)
// =============================

export const tooltipStyles = {
  // Typography
  text: 'text-xs',
  title: 'font-semibold',
  subtitle: 'font-medium',
  muted: 'text-gray-300',
  warning: 'text-yellow-400',
  // Spacing & separators
  sectionDivider: 'border-t border-gray-600 pt-2',
  // Badges (paired with getBadgeColorClasses when rating is available)
  pillBase: 'px-1.5 py-0.5 rounded text-xs',
  pillPositive: 'bg-green-100 text-green-700',
  pillNegative: 'bg-red-100 text-red-600'
} as const;

// Building blocks for consistent tooltip content
export function TooltipSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="text-xs space-y-1 border-t first:border-t-0 border-gray-600 pt-2 first:pt-0">
      {title && <p className="font-medium">{title}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// Generic building blocks for consistent tooltip content
export function TooltipHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className={tooltipStyles.title}>{title}</p>
      <p className={tooltipStyles.muted}>{description}</p>
    </div>
  );
}

// Optional convenience: Scrollable content wrapper
export function TooltipScrollableContent({ 
  children, 
  maxHeight = 'max-h-60',
  className
}: { 
  children: React.ReactNode; 
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-y-auto',
        maxHeight,
        'scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500',
        className
      )}
    >
      {children}
    </div>
  );
}

// Optional convenience: Key/value list with optional color coding via rating (0-1)
export function TooltipKeyValueList({
  items,
  title,
  showColors = false,
  className
}: {
  items: Array<{ label: string; value: React.ReactNode; rating?: number }>
  title?: string
  showColors?: boolean
  className?: string
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className={cn(title ? 'border-t border-gray-600 pt-2' : undefined, className)}>
      {title && <p className={tooltipStyles.subtitle}>{title}</p>}
      <div className={cn(tooltipStyles.text, tooltipStyles.muted, 'space-y-1')}>
        {items.map((item, idx) => {
          const colorClass = showColors && item.rating !== undefined ? getColorClass(item.rating) : '';
          return (
            <p key={`${item.label}-${idx}`}>
              • {item.label}: <span className={colorClass}>{item.value}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

// Optional convenience: Percentage value with color coding via rating (0-1) or sign
export function TooltipPercentage({
  value,
  label,
  showSign = true,
  rating,
  className
}: {
  value: number
  label?: string
  showSign?: boolean
  rating?: number
  className?: string
}) {
  const percent = Math.abs(value * 100);
  const colorClass = rating !== undefined ? getColorClass(rating) : value < 0 ? 'text-red-400' : 'text-green-400';
  const sign = showSign && value !== 0 ? (value > 0 ? '+' : '-') : '';
  return (
    <div className={cn(tooltipStyles.sectionDivider, className)}>
      {label && <p className={tooltipStyles.subtitle}>{label}</p>}
      <p className={cn(tooltipStyles.text, colorClass)}>
        {sign}{formatNumber(percent, { smartDecimals: true })}%
      </p>
    </div>
  );
}

export function TooltipRow({ 
  label, 
  value, 
  valueRating, // 0-1 rating for color class
  icon, 
  monospaced = false,
  badge = false
}: { 
  label?: string; 
  value: React.ReactNode; 
  valueRating?: number; // Use this with getColorClass for consistent colors
  icon?: React.ReactNode; 
  monospaced?: boolean;
  badge?: boolean; // Use badge styling
}) {
  const colorClass = valueRating !== undefined ? getColorClass(valueRating) : '';
  const badgeClasses = badge && valueRating !== undefined ? getBadgeColorClasses(valueRating) : { bg: '', text: '' };
  
  return (
    <div className="flex items-center justify-between gap-2">
      {label && <span className={tooltipStyles.muted}>{label}</span>}
      <span className={cn(
        colorClass,
        badge ? badgeClasses.bg : '',
        badge && valueRating !== undefined ? badgeClasses.text : '',
        badge && 'px-1.5 py-0.5 rounded text-xs',
        monospaced && 'font-mono'
      )}>
        {icon ? <span className="inline-flex items-center gap-1">{icon}{value}</span> : value}
      </span>
    </div>
  );
}

// =============================
// Generic, reusable helpers for consistent formatting
// =============================

export function TooltipTitle({ children }: { children: React.ReactNode }) {
  return <p className={tooltipStyles.title}>{children}</p>;
}

export function TooltipText({ children }: { children: React.ReactNode }) {
  return <div className={tooltipStyles.text}>{children}</div>;
}

export function TooltipMuted({ children }: { children: React.ReactNode }) {
  return <p className={tooltipStyles.muted}>{children}</p>;
}

export function TooltipDivider({ children }: { children?: React.ReactNode }) {
  return <div className={tooltipStyles.sectionDivider}>{children}</div>;
}

export function TooltipPill({ value, positive }: { value: React.ReactNode; positive?: boolean }) {
  return (
    <span className={cn(tooltipStyles.pillBase, positive ? tooltipStyles.pillPositive : tooltipStyles.pillNegative)}>
      {value}
    </span>
  );
}

// Info icon that shows tooltip/dialog content. Useful when no trigger child exists.
export function InfoTooltip({ title, content, size = 14, className }: { title?: string; content: React.ReactNode; size?: number; className?: string }) {
  const isMobile = isMobileDevice();
  const [open, setOpen] = useState(false);
  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('h-auto p-1 hover:bg-gray-100', className)} onClick={() => setOpen(true)}>
            <Info size={size} className="text-gray-500" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
          </DialogHeader>
          <div className="text-sm">{content}</div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('h-auto p-1 hover:bg-gray-100', className)}>
            <Info size={size} className="text-gray-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm" variant="panel" density="compact">
          <div className={tooltipStyles.text}>
            {title && <p className={cn(tooltipStyles.title, 'mb-1')}>{title}</p>}
            {content}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }


