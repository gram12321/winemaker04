import * as React from "react"
import { useState } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn, getColorClass, getBadgeColorClasses, formatNumber } from "@/lib/utils/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./dialog"
import { useIsMobile } from "@/hooks/use-mobile"


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
      {label && <span className={cn(tooltipStyles.text, tooltipStyles.muted)}>{label}</span>}
      <span className={cn(
        tooltipStyles.text,
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
  const triggerDivRef = React.useRef<HTMLDivElement | null>(null);

  if (isMobile) {
    // Extract onClick from rest to merge with our handler
    const { onClick: restOnClick, onPointerDown: restOnPointerDown, onMouseDown: restOnMouseDown, ...restProps } = rest as any;

    const handleMobileClick = (event: React.MouseEvent<HTMLDivElement>) => {
      // Stop propagation immediately to prevent bubbling to parent row/card
      // This must happen before any other handlers to ensure the row click doesn't fire
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation?.(); // Also stop on native event if available
      
      // Call any onClick handler from props first
      restOnClick?.(event);
      onClick?.(event);
      if (!event.defaultPrevented) {
        setOpen(true);
      }
    };

    const handleMobilePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation(); // Stop propagation at capture phase
      restOnPointerDown?.(event);
    };

    const handleMobileMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation(); // Stop propagation at capture phase
      restOnMouseDown?.(event);
    };

    const handleDialogContentClick = (event: React.MouseEvent) => {
      event.stopPropagation(); // Prevent clicks inside dialog (including close button) from propagating to parent row/card
    };

    const handleInteractOutside = (event: Event) => {
      event.stopPropagation(); // Prevent clicks outside dialog (on overlay/backdrop) from propagating to parent row/card
      // Note: We don't call preventDefault() so the dialog still closes normally
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <div
            ref={(node) => {
              triggerDivRef.current = node;
              if (typeof ref === 'function') ref(node as any);
              else if (ref && 'current' in (ref as any)) (ref as any).current = node;
            }}
            className={combinedClassName}
            onClick={handleMobileClick}
            onPointerDown={handleMobilePointerDown}
            onMouseDown={handleMobileMouseDown}
            style={{ position: 'relative', zIndex: 1 }} // Ensure wrapper is on top for event handling
            tabIndex={-1}
            {...restProps}
          >
            {children}
          </div>
        </DialogTrigger>
        <DialogContent
          className={contentClassName}
          onClick={handleDialogContentClick}
          onInteractOutside={handleInteractOutside}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // Restore focus to trigger to avoid focus remaining inside aria-hidden content during exit
            triggerDivRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className={title ? undefined : "sr-only"}>
              {title || "Tooltip Information"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {title ? `Details about ${title}` : "Additional information"}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm" onClick={handleDialogContentClick}>{content}</div>
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

// =============================
// UNIFIED TOOLTIP COMPONENT
// =============================

export type UnifiedTooltipProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  title?: string;
  // Tooltip positioning
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  // Styling
  variant?: 'default' | 'panel';
  density?: 'normal' | 'compact';
  scrollable?: boolean;
  maxHeight?: string;
  className?: string;
  contentClassName?: string;
  // Mobile hints
  showMobileHint?: boolean;
  mobileHintVariant?: 'underline' | 'corner-dot';
  mobileHintDotPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  mobileHintClassName?: string;
  mobileHintDotClassName?: string;
  // Trigger styling
  triggerClassName?: string;
  // Event handling
  onClick?: (event: React.MouseEvent) => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  onMouseDown?: (event: React.MouseEvent) => void;
};

/**
 * UnifiedTooltip - A single component that handles both desktop (hover) and mobile (click dialog) tooltips
 * 
 * This component replaces the complex TooltipProvider/Tooltip/TooltipTrigger/TooltipContent/MobileDialogWrapper pattern
 * with a single, simpler component that handles all event propagation correctly.
 * 
 * @example
 * <UnifiedTooltip content={<div>Tooltip content</div>} title="Tooltip Title">
 *   <div>Hover/click me</div>
 * </UnifiedTooltip>
 */
export const UnifiedTooltip = React.forwardRef<HTMLDivElement, UnifiedTooltipProps>(
  function UnifiedTooltip(
    {
      children,
      content,
      title,
      side = 'top',
      sideOffset = 4,
      variant = 'panel',
      density = 'compact',
      scrollable = false,
      maxHeight = 'max-h-60',
      className,
      contentClassName,
      showMobileHint = true,
      mobileHintVariant = 'underline',
      mobileHintDotPosition = 'top-right',
      mobileHintClassName,
      mobileHintDotClassName,
      triggerClassName,
      onClick,
      onPointerDown,
      onMouseDown,
      ...rest
    },
    ref
  ) {
  const isMobile = useIsMobile();
    const [dialogOpen, setDialogOpen] = useState(false);
    const triggerRef = React.useRef<HTMLDivElement | null>(null);

    // Mobile: Handle click events with proper propagation stopping
    if (isMobile) {
      const handleMobileClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // Stop propagation immediately to prevent bubbling to parent row/card
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        
        // Call any onClick handler from props
        onClick?.(event);
        
        if (!event.defaultPrevented) {
          setDialogOpen(true);
        }
      };

      const handleMobilePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onPointerDown?.(event);
      };

      const handleMobileMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onMouseDown?.(event);
      };

      const handleDialogContentClick = (event: React.MouseEvent) => {
        event.stopPropagation();
      };

      const handleInteractOutside = (event: Event) => {
        event.stopPropagation();
      };

      // Apply mobile hint styling to children
      const hintedChildren = showMobileHint
        ? (
            mobileHintVariant === 'corner-dot'
              ? (
                  <span className={cn('relative block md:hidden w-full', mobileHintClassName)}>
                    {children}
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-gray-400/70 shadow-sm z-10',
                        mobileHintDotPosition === 'top-right' && 'right-0 -top-0.5 translate-x-1/4',
                        mobileHintDotPosition === 'top-left' && 'left-0 -top-0.5 -translate-x-1/4',
                        mobileHintDotPosition === 'bottom-right' && 'right-0 -bottom-0.5 translate-x-1/4',
                        mobileHintDotPosition === 'bottom-left' && 'left-0 -bottom-0.5 -translate-x-1/4',
                        mobileHintDotClassName
                      )}
                    />
                  </span>
                )
              : (
                  <span className={cn(
                    'relative cursor-help after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:border-b after:border-dotted after:border-gray-400/70 md:after:border-b-0',
                    mobileHintClassName
                  )}>
                    {children}
                  </span>
                )
          )
        : children;

    return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div
              ref={(node) => {
                triggerRef.current = node;
                if (typeof ref === 'function') ref(node as any);
                else if (ref && 'current' in (ref as any)) (ref as any).current = node;
              }}
              className={cn('w-full', triggerClassName)}
              onClick={handleMobileClick}
              onPointerDown={handleMobilePointerDown}
              onMouseDown={handleMobileMouseDown}
              style={{ position: 'relative', zIndex: 1 }}
              tabIndex={-1}
              data-tooltip-trigger="true"
              {...rest}
            >
              {hintedChildren}
            </div>
          </DialogTrigger>
          <DialogContent
            className={cn(contentClassName || "max-w-sm")}
            onClick={handleDialogContentClick}
            onInteractOutside={handleInteractOutside}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle className={title ? undefined : "sr-only"}>
                {title || "Tooltip Information"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {title ? `Details about ${title}` : "Additional information"}
              </DialogDescription>
            </DialogHeader>
            <div className="text-xs" onClick={handleDialogContentClick}>{content}</div>
          </DialogContent>
        </Dialog>
      );
    }

    // Desktop: Use Radix UI tooltip directly
  return (
      <TooltipPrimitive.Provider>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild className={triggerClassName}>
            {children}
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              ref={ref}
              side={side}
              sideOffset={sideOffset}
              className={cn(
                "z-[110] rounded-md text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
                density === 'compact' ? 'px-2 py-1' : 'px-3 py-1.5',
                variant === 'panel'
                  ? 'bg-gray-900 text-white border border-gray-700 shadow-lg'
                  : 'bg-primary text-primary-foreground',
                scrollable && cn('overflow-y-auto', maxHeight, 'scrollbar-styled'),
                contentClassName
              )}
              {...rest}
            >
            {content}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }
);