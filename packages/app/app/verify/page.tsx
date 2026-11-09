"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { VerifyPanel } from "./verify-panel";

export default function VerifyPage() {
  return (
    <AppShell>
      <PageHeader title="Verification" showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8  md:px-8">
        <GlassCard padding="md" className="border-encrypted/20">
          <SectionLabel>How it works</SectionLabel>
          <p className="mt-3 text-sm leading-7 text-text-muted">
            Create a one-time request below and send it to whoever needs to
            prove a transfer to you — the sender or the recipient. They generate
            the disclosure bundle from their own account&apos;s Overview
            activity and send it back to you. Paste it here to verify it against
            the chain — the event and its binding are checked independently
            against the chain.
          </p>
        </GlassCard>

        <VerifyPanel />
      </div>
    </AppShell>
  );
}
