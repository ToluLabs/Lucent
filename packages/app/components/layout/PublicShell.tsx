import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import Link from "next/link";
export function PublicShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`public-shell min-h-dvh ${wide ? "public-shell-wide" : ""}`}
    >
      <a href="#public-content" className="skip-link">
        Skip to content
      </a>
      <header className="public-header">
        <nav
          aria-label="Public navigation"
          className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8"
        >
          <Link href="/" className="flex items-center gap-3">
            <LucentLogoMark size={28} />
            <span className="text-xl font-semibold">
              Lucent<span className="text-accent">.</span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm sm:gap-7">
            <Link
              href="/about"
              className="text-text-secondary hover:text-text-primary"
            >
              Product
            </Link>
            <Link
              href="/docs"
              className="text-text-secondary hover:text-text-primary"
            >
              Docs
            </Link>
            <a
              href="https://github.com/ToluLabs/Lucent"
              target="_blank"
              rel="noreferrer"
              className="hidden text-text-secondary hover:text-text-primary sm:inline"
            >
              GitHub ↗
            </a>
            <Link
              prefetch={false}
              href="/home"
              className="rounded-lg bg-accent px-4 py-3 font-semibold text-black hover:bg-accent-hover"
            >
              Try Testnet →
            </Link>
          </div>
        </nav>
      </header>
      <main id="public-content">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-2">
          <div>
            <Link href="/" className="text-lg font-semibold">
              Lucent.
            </Link>
            <p className="mt-3 max-w-md text-sm leading-7 text-text-muted">
              Confidential payments on Stellar. Experimental Testnet software;
              use test funds only. Not audited for production use.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap content-start gap-x-7 gap-y-4 text-sm text-text-secondary"
          >
            <Link href="/docs">Documentation</Link>
            <Link href="/about">About</Link>
            <Link prefetch={false} href="/stats">
              Testnet activity
            </Link>
            <Link href="/privacy">Privacy & analytics</Link>
            <a
              href="https://github.com/ToluLabs/Lucent"
              target="_blank"
              rel="noreferrer"
            >
              Source code ↗
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
