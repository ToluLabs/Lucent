"use client";
import { cn } from "@/lib/cn";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
const descriptions: Record<string, string> = {
  Overview: "Your balances, payments and recent account activity.",
  Payments: "Send USDC with confidential amounts on Stellar Testnet.",
  Payroll: "Prepare recipient templates and execute confidential payment runs.",
  Escrow: "Manage experimental agreements, delivery and settlement.",
  Funding: "Move between public USDC and your confidential account.",
  Verification: "Request and verify a specific payment disclosure.",
  "Auditor access": "View covered amounts using an auditor viewing key.",
  "Account settings": "Manage your connection and inspect account health.",
};
interface Props {
  title: string;
  description?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}
export function PageHeader({
  title,
  description,
  showBack = false,
  onBack,
  right,
  className,
}: Props) {
  const router = useRouter();
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-4 px-5 pb-7 pt-8 md:px-8 md:pt-10",
        className,
      )}
    >
      {showBack && (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => (onBack ? onBack() : router.back())}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
          {title}
        </h1>
        {(description || descriptions[title]) && (
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            {description || descriptions[title]}
          </p>
        )}
      </div>
      {right}
    </header>
  );
}
