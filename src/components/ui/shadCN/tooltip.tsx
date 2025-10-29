import * as React from "react"
import { useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn, getColorClass, getBadgeColorClasses, formatNumber } from "@/lib/utils/utils"
import { Button } from "./button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog"
import { Info } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

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
  const isMobile = useIsMobile();

  if (isMobile && tooltipContent) {
    return (
      <div className="inline-flex items-center">
        <TooltipPrimitive.Trigger {...props} ref={ref}>
          {children}
        </TooltipPrimitive.Trigger>
        <MobileDialogWrapper 
          content={tooltipContent} 
          title={tooltipTitle}
          triggerClassName="inline-block"
          contentClassName="max-w-sm"
        >
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-auto p-1 ml-1 hover:bg-gray-100", iconClassName)}
          >
            <Info size={iconSize} className="text-gray-500" />
          </Button>
        </MobileDialogWrapper>
      </div>
    );
  }

  return (
    <TooltipPrimitive.Trigger {...props} ref={ref}>
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
  variant?: 'default' | 'panel';
  density?: 'normal' | 'compact';
  scrollable?: boolean;
  maxHeight?: string;
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
        "z-50 rounded-md text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        density === 'compact' ? 'px-2 py-1' : 'px-3 py-1.5',
        variant === 'panel' 
          ? 'bg-gray-900 text-white border border-gray-700 shadow-lg'
          : 'bg-primary text-primary-foreground',
        scrollable && cn('overflow-y-auto', maxHeight, 'scrollbar-styled'),
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

// =============================
// DESIGN TOKENS & STYLES
// =============================

export const tooltipStyles = {
  text: 'text-xs',
  title: 'font-semibold',
  subtitle: 'font-medium',
  muted: 'text-gray-300',
  warning: 'text-yellow-400',
  sectionDivider: 'border-t border-gray-600 pt-2',
  pillBase: 'px-1.5 py-0.5 rounded text-xs',
  pillPositive: 'bg-green-100 text-green-700',
  pillNegative: 'bg-red-100 text-red-600'
} as const;

// =============================
// TOOLTIP BUILDING BLOCKS
// =============================

export function TooltipSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="text-xs space-y-1 border-t first:border-t-0 border-gray-600 pt-2 first:pt-0">
      {title && <p className="font-medium">{title}</p>}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function TooltipHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className={tooltipStyles.title}>{title}</p>
      <p className={tooltipStyles.muted}>{description}</p>
    </div>
  );
}

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
  if (!items?.length) return null;
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
  valueRating,
  icon, 
  monospaced = false,
  badge = false
}: { 
  label?: string; 
  value: React.ReactNode; 
  valueRating?: number;
  icon?: React.ReactNode; 
  monospaced?: boolean;
  badge?: boolean;
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
// UTILITY COMPONENTS
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

// =============================
// MOBILE DIALOG WRAPPER
// =============================

type MobileDialogWrapperProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'content'> & {
  children: React.ReactNode;
  content: React.ReactNode;
  title?: string;
  triggerClassName?: string;
  contentClassName?: string;
};

export const MobileDialogWrapper = React.forwardRef<HTMLDivElement, MobileDialogWrapperProps>(function MobileDialogWrapper(
  {
    children,
    content,
    title,
    triggerClassName,
    contentClassName = "max-w-sm",
    className,
    onClick,
    ...rest
  },
  ref
) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const combinedClassName = cn(triggerClassName, className);

  if (isMobile) {
    const handleMobileClick = (event: React.MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(true);
      }
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <div
            ref={ref}
            className={combinedClassName}
            onClick={handleMobileClick}
            {...rest}
          >
            {children}
          </div>
        </DialogTrigger>
        <DialogContent className={contentClassName} aria-describedby={title ? undefined : "dialog-description"}>
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
          </DialogHeader>
          <div className="text-sm" id={title ? undefined : "dialog-description"}>{content}</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (React.isValidElement(children)) {
    const child = children as React.ReactElement<any>;
    const existingOnClick = child.props?.onClick as ((event: React.MouseEvent<any>) => void) | undefined;

    const handleDesktopClick = (event: React.MouseEvent<any>) => {
      existingOnClick?.(event);
      if (!event.defaultPrevented) {
        onClick?.(event);
      }
    };

    const mergedProps: Record<string, any> = {
      ...rest,
      ref,
      className: cn(child.props?.className, combinedClassName),
    };

    if (existingOnClick || onClick) {
      mergedProps.onClick = handleDesktopClick;
    }

    return React.cloneElement(child, mergedProps);
  }

  return (
    <div ref={ref} className={combinedClassName} onClick={onClick} {...rest}>
      {children}
    </div>
  );
});

// Info icon that shows tooltip/dialog content. Useful when no trigger child exists.
export function InfoTooltip({ title, content, size = 14, className }: { title?: string; content: React.ReactNode; size?: number; className?: string }) {
  const isMobile = useIsMobile();
  
  const triggerButton = (
    <Button variant="ghost" size="sm" className={cn('h-auto p-1 hover:bg-gray-100', className)}>
      <Info size={size} className="text-gray-500" />
    </Button>
  );

  if (isMobile) {
    return (
      <MobileDialogWrapper 
        content={content} 
        title={title}
        triggerClassName="inline-block"
        contentClassName="max-w-sm"
      >
        {triggerButton}
      </MobileDialogWrapper>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {triggerButton}
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


