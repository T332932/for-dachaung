import React from 'react';
import { cn } from './button';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, leftIcon, ...props }, ref) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-700 dark:text-gray-300">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={cn(
                            "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
                            leftIcon && "pl-10",
                            error && "border-destructive focus-visible:ring-destructive",
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1 fade-in duration-200">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
