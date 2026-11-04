"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";

/** Reads the theme the inline script in layout.tsx already applied. */
function current(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(current()), []);

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", next === "dark" ? "#08080A" : "#F6F5F1");
    try {
      localStorage.setItem("lucent-theme", next);
    } catch {}
    setTheme(next);
  }

  const Icon = theme === "light" ? Moon : Sun;
  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary",
        withLabel ? "px-3 text-sm font-medium" : "w-9",
        className,
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      {withLabel && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
