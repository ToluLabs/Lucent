/**
 * Render an unknown thrown value as a human-readable string.
 *
 * Not everything thrown is an `Error`. The Stellar SDK's JSON-RPC client throws
 * the raw JSON-RPC error object (`throw response.data.error`), i.e. a plain
 * `{ code, message }`, `String(e)` on that yields the useless "[object
 * Object]". This unwraps the common shapes (Error, `{ message }`,
 * `{ code, message }`) so RPC failures surface their actual message.
 */
/**
 * Known failure shapes mapped to something a person can act on. Order matters:
 * the first match wins. Anything unrecognised falls through to the raw text.
 */
const FRIENDLY: [RegExp, string][] = [
  [/user (declined|rejected|denied)|declined access|rejected the request|request was rejected by the user/i, "You declined the request in your wallet. Nothing was sent."],
  [/wallet.*(locked|not (found|installed))|freighter.*(not|unavailable)/i, "Your wallet is locked or unavailable. Unlock or install it, then try again."],
  [/failed to fetch|networkerror|network request failed|fetch failed|econn|enotfound|etimedout|timed? ?out|load failed/i, "Could not reach the Stellar network. Check your connection and try again."],
  [/\b429\b|rate.?limit|too many requests/i, "The network is busy right now. Wait a few seconds and try again."],
  [/tx_bad_seq|bad.?seq/i, "Another transaction was still in flight. Try again in a moment."],
  [/insufficient|underfunded|not enough|exceeds? (your )?(spendable|balance)/i, "Your balance is too low for this. Check the amount and try again."],
  [/not registered|account not found|no account|unregistered/i, "That account is not registered with Lucent yet."],
  [/frozen/i, "This account is frozen by the compliance admin."],
  [/not (on|in) the allow ?list|not allowed|unauthori[sz]ed account/i, "This account is not on the allowlist, so the network rejected the transaction."],
  [/proof.*(invalid|rejected|failed|verification)|verif(y|ier|ication).*(fail|reject)/i, "The network rejected the proof. Sync your account and try again."],
  [/simulation failed|hosterror|contract.*(error|trap)/i, "The network rejected this transaction. Sync your account and try again."],
];

export function errMsg(e: unknown): string {
  const raw = rawMsg(e);
  const friendly = FRIENDLY.find(([rx]) => rx.test(raw));
  if (friendly) {
    // Keep the original for debugging without showing it to the user.
    console.error("[lucent]", raw);
    return friendly[1];
  }
  return raw;
}

function rawMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown };
    if (typeof o.message === "string") {
      return o.code !== undefined ? `${o.message} (code ${String(o.code)})` : o.message;
    }
    try {
      return JSON.stringify(e);
    } catch {
      /* fall through to String() */
    }
  }
  return String(e);
}
