import * as React from "react"
import { ReactNode } from "react"
import { cn } from "@/lib/utils/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Simplified card components for common use cases
interface SimpleCardProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

const SimpleCard = React.forwardRef<HTMLDivElement, SimpleCardProps>(
  ({ title, description, children, className = "" }, ref) => (
    <Card ref={ref} className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
)
SimpleCard.displayName = "SimpleCard"

interface GridCardProps {
  icon: string | ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  onClick?: () => void;
  iconBgColor?: string;
  iconTextColor?: string;
  className?: string;
}

interface FactorCardProps {
  title: string;
  description: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'gray' | 'red';
  children: ReactNode;
  className?: string;
}

const GridCard = React.forwardRef<HTMLDivElement, GridCardProps>(
  ({ 
    icon, 
    title, 
    description, 
    children, 
    onClick,
    iconBgColor = "bg-blue-100",
    iconTextColor = "text-blue-700",
    className = ""
  }, ref) => (
    <Card 
      ref={ref}
      className={cn(
        "hover:shadow-md transition-shadow",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className={cn("flex items-center justify-center", typeof icon === 'string' ? "w-12 h-12 rounded-full" : '', typeof icon === 'string' ? iconBgColor : '')}>
          {typeof icon === 'string' ? (
            <span className={cn("font-bold", iconTextColor)}>{icon}</span>
          ) : (
            icon
          )}
        </div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  )
)
GridCard.displayName = "GridCard"

const FactorCard = React.forwardRef<HTMLDivElement, FactorCardProps>(
  ({ title, description, color, children, className = "" }, ref) => (
    <Card ref={ref} className={`border-${color}-200 bg-${color}-50 ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-${color}-800 text-base`}>
          <div className={`w-2 h-2 bg-${color}-500 rounded-full`}></div>
          {title}
        </CardTitle>
        <CardDescription className={`text-${color}-700`}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {children}
      </CardContent>
    </Card>
  )
)
FactorCard.displayName = "FactorCard"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  SimpleCard,
  GridCard,
  FactorCard
}
