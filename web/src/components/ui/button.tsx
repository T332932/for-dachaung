import * as React from "react"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost'
    size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

        const variants = {
            default: "bg-blue-600 text-white hover:bg-blue-700",
            outline: "border border-gray-200 bg-white hover:bg-gray-100 text-gray-900",
            ghost: "hover:bg-gray-100 text-gray-900"
        }

        const sizes = {
            default: "h-10 px-4 py-2",
            sm: "h-9 rounded-md px-3",
            lg: "h-11 rounded-md px-8"
        }

        const combinedClassName = [
            baseStyles,
            variants[variant],
            sizes[size],
            className
        ].filter(Boolean).join(' ');

        return (
            <button
                className={combinedClassName}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
