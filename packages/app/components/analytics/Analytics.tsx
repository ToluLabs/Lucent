"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { ANALYTICS_CHANGE_EVENT, analyticsAllowed, analyticsConfig, flushAnalytics, trackPageview } from "@/lib/analytics";

export function Analytics() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const update = () => setEnabled(analyticsAllowed());
    update();
    window.addEventListener(ANALYTICS_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener(ANALYTICS_CHANGE_EVENT, update); window.removeEventListener("storage", update); };
  }, []);
  useEffect(() => {
    if (enabled) trackPageview(pathname);
  }, [pathname, enabled]);
  const cfg = analyticsConfig();
  if (!enabled || !cfg) return null;
  return <Script
    id="lucent-analytics"
    src={cfg.script}
    strategy="afterInteractive"
    referrerPolicy="no-referrer"
    data-website-id={cfg.website}
    data-domains={cfg.hostname}
    data-auto-track="false"
    data-do-not-track="true"
    data-exclude-search="true"
    data-exclude-hash="true"
    onReady={flushAnalytics}
  />;
}
