import { cn } from "@/lib/cn";

export type PillTone = "neutral" | "amber" | "green" | "red" | "sky" | "violet";

const TONE: Record<PillTone, string> = {
  neutral: "bg-fg/[0.08] text-text-secondary",
  amber: "bg-accent-bg text-accent",
  green: "bg-success/10 text-success",
  red: "bg-error/10 text-error",
  sky: "bg-info/10 text-info",
  violet: "bg-encrypted-bg text-encrypted",
};

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  return <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium tracking-wide", TONE[tone])}>{children}</span>;
}
