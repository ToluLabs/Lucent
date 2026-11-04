"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  hover?: boolean;
  glow?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children?: ReactNode;
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ hover = false, glow = false, padding = "md", className, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "glass-card relative overflow-hidden group",
          paddings[padding],
          glow && "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent-solid/70 before:to-transparent",
          hover && "cursor-pointer hover:border-border-hover",
          className,
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);
GlassCard.displayName = "GlassCard";
