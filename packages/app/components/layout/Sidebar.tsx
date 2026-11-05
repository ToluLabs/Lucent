"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowDownUp, Send, Briefcase, Lock, ScanEye, ScanLine, Settings, LogOut } from "lucide-react";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const GROUPS = [
  {
    label: "Money",
    items: [
      { href: "/home", icon: LayoutDashboard, label: "Home" },
      { href: "/shield", icon: ArrowDownUp, label: "Shield" },
      { href: "/send", icon: Send, label: "Send" },
    ],
  },
  {
    label: "Programs",
    items: [
      { href: "/payroll", icon: Briefcase, label: "Payroll" },
      { href: "/escrow", icon: Lock, label: "Escrow" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/auditor", icon: ScanEye, label: "Auditor" },
      { href: "/verify", icon: ScanLine, label: "Verify" },
    ],
  },
];

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: typeof Send; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        active ? "bg-accent-bg text-accent" : "text-text-secondary hover:bg-fg/[0.05] hover:text-text-primary",
      )}
    >
      {active && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-accent-solid" />}
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.8} />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { wallet, disconnect } = useWallet();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="fixed inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface">
      <Link href="/" className="flex h-16 items-center gap-2.5 px-6 transition-opacity hover:opacity-80">
        <LucentLogoMark size={28} />
        <span className="font-display text-lg font-semibold tracking-tight text-text-primary">Lucent</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-3">
        {GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-1">
            <span className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
              {g.label}
            </span>
            {g.items.map((it) => (
              <NavLink key={it.href} {...it} active={isActive(it.href)} />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border px-6 py-4">
        {wallet ? (
          <>
            <Link
              href="/profile"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150",
                pathname === "/profile" ? "bg-accent-bg text-accent" : "text-text-secondary hover:bg-fg/[0.05] hover:text-text-primary",
              )}
            >
              <Settings className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium leading-none">Profile</span>
                <span className={cn("mt-1 truncate font-mono text-[11px]", pathname === "/profile" ? "text-accent" : "text-text-muted")}>{shortAddress(wallet.address, 5)}</span>
              </div>
            </Link>
            <button
              onClick={disconnect}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition-colors duration-150 hover:bg-error/10 hover:text-error"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              Disconnect
            </button>
          </>
        ) : (
          <p className="px-3 text-xs leading-relaxed text-text-muted">Connect your wallet to start using Lucent.</p>
        )}
      </div>
    </aside>
  );
}
