"use client";

import { PublicShell } from "@/components/layout/PublicShell";
import {
  ANALYTICS_CHANGE_EVENT,
  analyticsConfig,
  analyticsPreferences,
  setAnalyticsPreference,
} from "@/lib/analytics";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function PrivacyPage() {
  const [prefs, setPrefs] = useState<ReturnType<
    typeof analyticsPreferences
  > | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const update = () => setPrefs(analyticsPreferences());
    update();
    window.addEventListener(ANALYTICS_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ANALYTICS_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  function toggle(kind: "disabled" | "internal", value: boolean) {
    setError(!setAnalyticsPreference(kind, value));
  }
  return (
    <PublicShell>
      <article className="mx-auto max-w-2xl px-6 py-12 text-sm leading-relaxed text-text-secondary">
        <Link href="/" className="text-accent">
          ← Back to Lucent
        </Link>
        <h1 className="mb-6 mt-8 text-3xl font-semibold text-text-primary">
          Privacy & analytics
        </h1>
        <p>
          Lucent is an unaudited Stellar Testnet application. Our demo auditor
          key is public. Use disposable test accounts and test assets.
        </p>
        <h2 className="mb-2 mt-7 text-lg font-semibold text-text-primary">
          What we measure
        </h2>
        <p>
          When configured for the public deployment, Umami measures page visits
          and named actions such as connecting a wallet, completing a Testnet
          transfer, or verifying a disclosure. This helps us improve onboarding
          and report early testing results. Visitor estimates are not verified
          people or customer counts.
        </p>
        <p className="mt-3">
          Our analytics payload contains a known page name, event name, Testnet
          label, and optional allowlisted campaign source. We do not send wallet
          addresses, amounts, balances, transaction hashes, auditor keys,
          proofs, form input, raw errors, query strings, URL fragments, or
          referrer URLs. We do not enable session recording, autocapture or
          wallet-based identification.
        </p>
        <p className="mt-3">
          Umami receives the network request and processes IP/browser
          information to estimate visitors using rotating identifiers. We do not
          add a persistent user ID. This is aggregate product analytics, not
          anonymity from the analytics service. See{" "}
          <a
            href="https://umami.is/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Umami&apos;s privacy policy
          </a>
          . Retention depends on the selected plan; the initial rollout is
          intended to use the six-month Hobby plan.
        </p>
        <h2 className="mb-2 mt-7 text-lg font-semibold text-text-primary">
          Your controls
        </h2>
        <p>
          Opting out affects this browser only. Do Not Track and Global Privacy
          Control are also respected when exposed by your browser. Clearing
          browser storage resets these preferences and can also destroy
          confidential wallet recovery state—do not clear it just to change
          analytics settings.
        </p>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border p-4">
          <p>
            {analyticsConfig()
              ? "Analytics is configured for the production hostname."
              : "Analytics is not configured in this build."}
          </p>
          {prefs && (
            <>
              {prefs.browserOptOut && (
                <p>Your browser privacy signal currently disables analytics.</p>
              )}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={prefs.disabled}
                  onChange={(e) => toggle("disabled", e.target.checked)}
                />
                Disable analytics in this browser
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={prefs.internal}
                  onChange={(e) => toggle("internal", e.target.checked)}
                />
                Exclude this browser as team/internal testing
              </label>
            </>
          )}
          {error && (
            <p role="alert">
              This browser could not save the preference. Analytics stays
              disabled when storage is unavailable.
            </p>
          )}
        </div>
        <h2 className="mb-2 mt-7 text-lg font-semibold text-text-primary">
          Separate network services
        </h2>
        <p>
          Your wallet, Stellar RPC, hosting provider and public blockchain
          process their own requests. Public transactions still expose
          participants and metadata. Turning off product analytics does not hide
          blockchain activity or remove infrastructure logs.
        </p>
      </article>
    </PublicShell>
  );
}
