/** Explicit, allowlisted analytics. Never pass wallet data or raw errors here. */
export const ROUTES = ["/", "/home", "/shield", "/send", "/payroll", "/escrow", "/auditor", "/verify", "/profile", "/docs", "/about", "/stats", "/privacy"] as const;
export const EVENTS = [
  "wallet_connect_started", "wallet_connected", "wallet_ready", "wallet_connect_failed",
  "action_started", "action_failed", "registration_confirmed", "deposit_confirmed",
  "merge_confirmed", "transfer_confirmed", "withdrawal_confirmed", "payroll_confirmed",
  "disclosure_created", "disclosure_verified",
] as const;
export type AnalyticsEvent = typeof EVENTS[number];
export const ACTIONS = ["registration", "deposit", "merge", "transfer", "withdrawal", "payroll"] as const;
export type AnalyticsAction = typeof ACTIONS[number];
const SOURCES = ["stellar", "scf", "twitter", "telegram", "discord", "github", "newsletter", "community"] as const;
const CAMPAIGNS = ["testnet-pilot", "scf46"] as const;
const OPT_OUT = "lucent:analytics:disabled";
const INTERNAL = "lucent:analytics:internal";
const CHANGE_EVENT = "lucent:analytics:preferences";
export const ANALYTICS_CHANGE_EVENT = CHANGE_EVENT;

export interface AnalyticsProperties {
  action?: AnalyticsAction;
  mode?: "manual" | "auto";
  direction?: "sent" | "received";
}
export interface AnalyticsConfig { website: string; hostname: string; script: string }
export interface AnalyticsPayload {
  website: string;
  hostname: string;
  url: string;
  title: string;
  referrer: string;
  name?: AnalyticsEvent;
  data: Record<string, string>;
}
declare global {
  interface Window { umami?: { track: (payload: AnalyticsPayload) => unknown } }
}

export function analyticsConfig(): AnalyticsConfig | null {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return null;
  const website = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";
  const hostname = process.env.NEXT_PUBLIC_ANALYTICS_HOSTNAME ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(website)) return null;
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname) || !hostname.includes(".") || /^(localhost|127\.)/.test(hostname)) return null;
  try {
    const script = new URL(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || "https://cloud.umami.is/script.js");
    if (script.protocol !== "https:" || script.username || script.password || script.search || script.hash) return null;
    return { website, hostname: hostname.toLowerCase(), script: script.href };
  } catch { return null; }
}

export function analyticsPreferences() {
  if (typeof window === "undefined") return { disabled: true, internal: false, browserOptOut: false };
  const browserOptOut = navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  try {
    return { disabled: localStorage.getItem(OPT_OUT) === "1" || localStorage.getItem("umami.disabled") === "1", internal: localStorage.getItem(INTERNAL) === "1", browserOptOut };
  } catch { return { disabled: true, internal: false, browserOptOut }; }
}
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return false;
  const cfg = analyticsConfig();
  const prefs = analyticsPreferences();
  return !!cfg && location.protocol === "https:" && location.hostname === cfg.hostname && !prefs.disabled && !prefs.internal && !prefs.browserOptOut;
}

let queue: AnalyticsPayload[] = [];
let lastPage = "";
export function setAnalyticsPreference(kind: "disabled" | "internal", value: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = kind === "disabled" ? OPT_OUT : INTERNAL;
    if (value) localStorage.setItem(key, "1"); else localStorage.removeItem(key);
    queue = []; lastPage = "";
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch { return false; }
}

/** Unknown paths, hashes, query strings, referrers and titles cannot leak data. */
export function safePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  return (ROUTES as readonly string[]).includes(path) ? path : "/other";
}
export function safeAttribution(search: string): Record<string, string> {
  const query = new URLSearchParams(search);
  const data: Record<string, string> = {};
  const source = query.get("utm_source") ?? "";
  const campaign = query.get("utm_campaign") ?? "";
  if ((SOURCES as readonly string[]).includes(source)) data.source = source;
  if ((CAMPAIGNS as readonly string[]).includes(campaign)) data.campaign = campaign;
  return data;
}
export function buildAnalyticsPayload(cfg: AnalyticsConfig, pathname: string, search: string, name?: AnalyticsEvent, properties: AnalyticsProperties = {}): AnalyticsPayload | null {
  if (name !== undefined && !(EVENTS as readonly string[]).includes(name)) return null;
  const url = safePath(pathname);
  const data: Record<string, string> = { network: "testnet", ...safeAttribution(search) };
  if (properties.action && (ACTIONS as readonly string[]).includes(properties.action)) data.action = properties.action;
  if (properties.mode === "manual" || properties.mode === "auto") data.mode = properties.mode;
  if (properties.direction === "sent" || properties.direction === "received") data.direction = properties.direction;
  return { website: cfg.website, hostname: cfg.hostname, url, title: url === "/" ? "Lucent" : `Lucent ${url}`, referrer: "", ...(name ? { name } : {}), data };
}

function deliver(payload: AnalyticsPayload) {
  try {
    // Object form sends only these fields, rather than merging browser defaults.
    void Promise.resolve(window.umami?.track(payload)).catch(() => {});
  } catch { /* Analytics must never interrupt a wallet action. */ }
}
export function flushAnalytics() {
  if (!analyticsAllowed()) { queue = []; return; }
  if (!window.umami) return;
  const pending = queue; queue = [];
  for (const payload of pending) deliver(payload);
}
function enqueue(name?: AnalyticsEvent, properties?: AnalyticsProperties) {
  if (!analyticsAllowed()) return;
  const cfg = analyticsConfig()!;
  const payload = buildAnalyticsPayload(cfg, location.pathname, location.search, name, properties);
  if (!payload) return;
  if (window.umami) deliver(payload);
  else if (queue.length < 32) queue.push(payload);
}
export function trackEvent(name: AnalyticsEvent, properties?: AnalyticsProperties) { enqueue(name, properties); }
export function trackPageview(pathname: string) {
  if (!analyticsAllowed()) return;
  // Strict Mode / Script onReady must not double-count the same navigation.
  const key = safePath(pathname);
  if (key === lastPage) return;
  lastPage = key;
  enqueue();
}

/** Only known payment actions; no dynamic IDs, admin actions or arbitrary labels. */
export function trackedAction(pathname: string, key: string): AnalyticsAction | null {
  if (pathname === "/send" && key === "send") return "transfer";
  if (pathname === "/shield") {
    if (key === "deposit") return "deposit";
    if (key === "withdraw") return "withdrawal";
    if (key === "merge") return "merge";
  }
  if (pathname === "/payroll" && key === "execute") return "payroll";
  return null;
}

/** Emit only after the SDK reports success, independent of later UI persistence. */
export async function trackConfirmed<T>(name: Extract<AnalyticsEvent, `${string}_confirmed`>, submit: () => Promise<T>): Promise<T> {
  const result = await submit();
  trackEvent(name);
  return result;
}
