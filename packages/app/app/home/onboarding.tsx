"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { WalletView } from "@/lib/wallet";
import { cn } from "@/lib/cn";

interface Step {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  action?: { label: string; href?: string; external?: boolean; onClick?: () => void; loading?: boolean };
}

interface OnboardingProps {
  view: WalletView;
  address: string;
  /** Balances are still the saved copy, so completion state is not final. */
  provisional: boolean;
  onMerge: () => void;
  merging: boolean;
}

const dismissKey = (address: string) => `lucent:onboarding-dismissed:${address}`;

/**
 * "Get started" checklist for accounts that have not yet moved money through
 * Lucent. It is derived entirely from the wallet view, so it needs no storage
 * of its own except a per-address "hide" flag.
 */
export function Onboarding({ view, address, provisional, onMerge, merging }: OnboardingProps) {
  const [dismissed, setDismissed] = useState(true); // hidden until storage is read, avoids a flash

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(dismissKey(address)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [address]);

  const total = view.spendable + view.receiving;
  const steps: Step[] = [
    { id: "connect", title: "Connect your wallet", hint: "Done. Your keys are derived from one signature.", done: true },
    { id: "register", title: "Register your account", hint: "One proof that binds your confidential keys to your address.", done: view.registered },
    {
      id: "usdc",
      title: "Get testnet USDC",
      hint: "You need public USDC to shield. The Circle faucet is free.",
      done: view.publicUSDC > 0n || total > 0n,
      action: { label: "Open faucet", href: "https://faucet.circle.com", external: true },
    },
    {
      id: "deposit",
      title: "Deposit into Lucent",
      hint: "Move public USDC into your confidential receiving balance.",
      done: total > 0n,
      action: { label: "Deposit", href: "/shield" },
    },
    {
      id: "merge",
      title: "Merge into spendable",
      hint: "Fold your receiving balance in, so you can send or withdraw it.",
      done: view.spendable > 0n,
      action: { label: "Merge", onClick: onMerge, loading: merging },
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);

  // While balances are only the saved copy, the USDC step cannot be judged yet.
  if (dismissed || currentIdx === -1 || (provisional && total === 0n)) return null;

  return (
    <section className="glass-card overflow-hidden" aria-label="Getting started">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">Get started</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            {doneCount} of {steps.length} done
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-card sm:block" aria-hidden>
            <div
              className="h-full rounded-full bg-accent-solid transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <button
            onClick={() => {
              try {
                localStorage.setItem(dismissKey(address), "1");
              } catch {}
              setDismissed(true);
            }}
            className="text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
          >
            Hide
          </button>
        </div>
      </div>

      <ol className="grid divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
        {steps.map((step, i) => {
          const current = i === currentIdx;
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className={cn("flex flex-col gap-3 p-5 md:p-6", current && "bg-accent-bg")}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    step.done
                      ? "border-success bg-success text-void"
                      : current
                        ? "border-accent-solid text-accent"
                        : "border-border text-text-muted",
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("text-sm font-medium", !step.done && !current && "text-text-secondary")}>{step.title}</span>
              </div>
              {!step.done && <p className="text-xs leading-relaxed text-text-muted">{step.hint}</p>}
              {current && step.action && (
                <div className="mt-auto">
                  {step.action.href ? (
                    step.action.external ? (
                      <a
                        href={step.action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
                      >
                        {step.action.label} <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <Link
                        href={step.action.href}
                        className="inline-flex h-9 items-center rounded-lg bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
                      >
                        {step.action.label}
                      </Link>
                    )
                  ) : (
                    <Button size="sm" isLoading={step.action.loading} disabled={provisional} onClick={step.action.onClick}>
                      {step.action.label}
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
