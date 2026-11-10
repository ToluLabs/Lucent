"use client";

import { cn } from "@/lib/cn";
import { HTMLMotionProps, motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

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
  (
    {
      hover = false,
      glow = false,
      padding = "md",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <motion.div
        ref={ref}
        transition={{ duration: 0.15 }}
        onPointerMove={(event) => {
          if (
            event.pointerType !== "mouse" ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
          )
            return;
          const box = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--spot-x",
            `${event.clientX - box.left}px`,
          );
          event.currentTarget.style.setProperty(
            "--spot-y",
            `${event.clientY - box.top}px`,
          );
        }}
        className={cn(
          "glass-card relative overflow-hidden group",
          paddings[padding],

          hover && "hover:border-border-hover",
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
