"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useShellWide } from "./AppShell";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, showBack = true, onBack, right, className }: PageHeaderProps) {
  const router = useRouter();
  const wide = useShellWide();

  return (
    <header
      className={cn(
        "flex items-center gap-3 px-4 pb-5 pt-6 md:px-8 md:pt-10",
        !wide && "md:mx-auto md:max-w-2xl",
        className,
      )}
    >
      {showBack && (
        <button
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Go back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
