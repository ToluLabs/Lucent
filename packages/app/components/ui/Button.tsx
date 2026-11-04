"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";
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
  primary: "bg-accent-solid text-on-accent hover:bg-accent-solid-hover shadow-none",
  secondary: "bg-panel border border-border text-text-primary shadow-card hover:border-border-hover hover:bg-card",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-fg/[0.06]",
  danger: "bg-error/10 border border-error/25 text-error hover:bg-error/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 text-sm px-4",
  md: "h-11 text-sm font-semibold px-5",
  lg: "h-[52px] text-[15px] font-semibold px-6",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", isLoading, fullWidth, className, children, disabled, ...props }, ref) => {
    const isPrimary = variant === "primary";
    const MotionButton = motion.button;
    return (
      <MotionButton
        ref={ref}
        whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
        className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
        disabled={disabled || isLoading}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      </MotionButton>
    );
  },
);
Button.displayName = "Button";
