"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover",
  secondary: "bg-card border border-border text-text-primary hover:bg-card-hover hover:border-border-hover",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-white/5",
  danger: "bg-error/10 border border-error/25 text-error hover:bg-error/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 text-sm px-4",
  md: "h-11 text-sm px-5",
  lg: "min-h-12 text-sm px-6",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, fullWidth, className, children, disabled, ...props }, ref) => {
    return (
      <button
        type="button"
        ref={ref}
        aria-busy={!!isLoading}
        className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
