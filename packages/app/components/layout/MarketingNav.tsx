"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { GithubMark } from "@/components/icons/GithubMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/stats", label: "Stats" },
  { href: "/about", label: "About" },
];

export function MarketingNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-void/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <LucentLogoMark size={28} />
          <span className="font-display text-lg font-semibold tracking-tight">Lucent</span>
        </Link>
        <nav className="flex items-center gap-6">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "hidden text-sm transition-colors sm:block",
                pathname === l.href ? "text-text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            href="/home"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
          >
            Launch app <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="flex flex-col items-start justify-between gap-6 border-t border-border px-6 py-8 text-sm text-text-muted md:flex-row md:items-center lg:px-12">
      <div className="flex items-center gap-2.5">
        <LucentLogoMark size={22} />
        <span>Lucent. Testnet only, unaudited.</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/stats" className="transition-colors hover:text-text-primary">Stats</Link>
        <Link href="/docs" className="transition-colors hover:text-text-primary">Docs</Link>
        <Link href="/about" className="transition-colors hover:text-text-primary">About</Link>
        <a
          href="https://github.com/Psalmuel01/Lucent"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 transition-colors hover:text-text-primary"
        >
          <GithubMark className="h-4 w-4" /> GitHub
        </a>
      </div>
    </footer>
  );
}
