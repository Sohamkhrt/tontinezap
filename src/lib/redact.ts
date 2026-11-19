/**
 * Secret redaction. Every string that can reach a log, an error boundary or a
 * toast MUST pass through `redact()` first. Patterns are deliberately greedy:
 * we would rather hide a harmless payment hash than leak a wallet secret.
 */
const PATTERNS: Array<[RegExp, string]> = [
  // Full NWC connection strings (contain the spending secret)
  [/nostr\+walletconnect:\/\/[^\s"'<>`]+/gi, "nostr+walletconnect://[REDACTED]"],
  // Any query-style secret parameter
  [/(secret=)[^&\s"'<>]+/gi, "$1[REDACTED]"],
  // Bech32 private keys / encrypted keys
  [/\bnsec1[02-9ac-hj-np-z]{20,}\b/gi, "nsec1[REDACTED]"],
  [/\bncryptsec1[02-9ac-hj-np-z]{20,}\b/gi, "ncryptsec1[REDACTED]"],
  // BOLT11 invoices
  [/\bln(bc|tb|bcrt|tbs)[0-9a-z]{20,}\b/gi, "ln$1…[INVOICE]"],
  // 32-byte hex blobs: preimages, secret keys, hashes
  [/\b[0-9a-f]{64}\b/gi, "[HEX64]"],
  // Phone numbers (PII) — 8+ digits with optional +, spaces, dashes
  [/\+?\d[\d\s-]{7,}\d/g, "[PHONE]"],
];

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

export function redact(input: unknown, maxLen = 400): string {
  let s =
    typeof input === "string"
      ? input
      : input instanceof Error
        ? `${input.name}: ${input.message}`
        : safeStringify(input);
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

/** Dev-only, redacted logger. Production builds stay silent. */
export const log = {
  warn: (...args: unknown[]) => {
    if (import.meta.env?.DEV) console.warn("[tontinezap]", ...args.map((a) => redact(a)));
  },
  error: (...args: unknown[]) => {
    if (import.meta.env?.DEV) console.error("[tontinezap]", ...args.map((a) => redact(a)));
  },
};

/** Silent logger handed to third-party SDKs so they can never print secrets. */
export const silentLogger = { debug: () => {} };

export type ErrorKind =
  | "insufficient"
  | "timeout"
  | "network"
  | "wallet_rejected"
  | "invalid_uri"
  | "no_wallet"
  | "proof_mismatch"
  | "unknown";

/** Map any thrown value to a user-facing category (no raw messages shown). */
export function classifyError(e: unknown): ErrorKind {
  const err = e as { code?: string; message?: string; name?: string; kind?: ErrorKind } | undefined;
  if (err?.kind) return err.kind;
  const code = (err?.code ?? "").toUpperCase();
  const msg = (err?.message ?? String(e)).toLowerCase();
  if (code === "INSUFFICIENT_BALANCE" || msg.includes("insufficient")) return "insufficient";
  if (err?.name?.includes("Timeout") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("websocket")) return "network";
  if (code === "RESTRICTED" || code === "UNAUTHORIZED" || code === "QUOTA_EXCEEDED" || code === "NOT_IMPLEMENTED")
    return "wallet_rejected";
  return "unknown";
}

export class AppError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string = kind,
  ) {
    super(message);
    this.name = "AppError";
  }
}
