"use client";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  primaryNavigation,
  resourceNavigation,
  supportingNavigation,
} from "./navigation";
export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-[220px] flex-col border-r border-border bg-surface xl:w-[240px]">
      <Link href="/" className="flex h-[76px] shrink-0 items-center gap-3 px-6">
        <LucentLogoMark size={28} />
        <span className="text-xl font-semibold tracking-tight">
          Lucent<span className="text-accent">.</span>
        </span>
      </Link>
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-5">
        {[
          { title: "Workspace", items: primaryNavigation },
          { title: "Tools", items: supportingNavigation },
        ].map((group) => (
          <div key={group.title} className="mb-8">
            <p className="mb-3 px-3 text-xs font-medium text-text-muted">
              {group.title}
            </p>
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                className={cn(
                  "mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  path === href
                    ? "bg-accent-bg font-semibold text-accent"
                    : "text-text-secondary hover:bg-card hover:text-text-primary",
                )}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-6 py-5">
        {resourceNavigation.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block py-2 text-xs text-text-secondary hover:text-accent"
          >
            {label}
          </Link>
        ))}
        <p className="mt-4 text-xs leading-relaxed text-text-muted">
          Testnet preview
          <br />
          Use test funds only.
        </p>
      </div>
    </aside>
  );
}
