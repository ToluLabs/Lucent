"use client";
import { PrivacyVisual } from "@/components/brand/PrivacyVisual";
import { Modal } from "./Modal";
import { useEffect, useState } from "react";
interface Props {
  open: boolean;
  estSeconds?: number;
  message?: string;
  fullScreen?: boolean;
  className?: string;
}
export function ProofLoadingOverlay({
  open,
  message,
  fullScreen,
  className,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!open) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  const content = (
    <div role="status" aria-live="polite" className={className}>
      <PrivacyVisual compact />
      <p className="text-sm leading-relaxed text-text-secondary">
        {message ||
          "Generating a proof locally in your browser. Duration depends on your device. Keep this tab open; no transaction is confirmed yet."}
      </p>
      <p className="mt-3 text-xs leading-6 text-text-muted">
        {elapsed}s elapsed. The first proof also loads proving files and can
        take a few minutes. Varial approval comes after proof generation.
      </p>
    </div>
  );
  return fullScreen ? (
    <Modal open={open} busy onClose={() => {}} title="Preparing your proof">
      {content}
    </Modal>
  ) : open ? (
    content
  ) : null;
}
