/**
 * NWC (Nostr Wallet Connect, NIP-47) service — the ONLY module that ever
 * sees a wallet connection string.
 *
 * Security model:
 *  - Zero custody: TontineZap never holds funds. Each member's own wallet
 *    creates invoices (recipient) or pays them (contributor).
 *  - Connection strings live in an in-memory Map (session only). They are
 *    never written to localStorage/IndexedDB in plaintext, never logged, and
 *    never leave this module except to the NWCClient constructor.
 *  - Optional persistence via passphrase vault (AES-256-GCM, see lib/vault).
 *  - Every URI is validated with zod before use (scheme, 32-byte pubkey,
 *    wss relays, 32-byte secret).
 */
import { NWCClient } from "@getalby/sdk/nwc";
import { z } from "zod";
import { get, set, del } from "idb-keyval";
import { AppError, classifyError, silentLogger } from "../lib/redact";
import { seal, unseal, sha256Hex, hexToBytes, randomId, type SealedBox } from "../lib/vault";

export const FAUCET_URL = "https://faucet.nwc.dev";
const VAULT_KEY = "tz.vault.v1";
const HEX64 = /^[0-9a-f]{64}$/i;

// ───────────────────────── Validation ─────────────────────────

function queryOf(uri: string): URLSearchParams {
  const i = uri.indexOf("?");
  return new URLSearchParams(i >= 0 ? uri.slice(i + 1) : "");
}

function isRelayUrl(r: string): boolean {
  try {
    const u = new URL(r);
    if (u.protocol === "wss:") return true;
    // plain ws only for local development relays
    return u.protocol === "ws:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    return false;
  }
}

export const NwcUriSchema = z
  .string()
  .trim()
  .max(2048, { message: "too_long" })
  .regex(/^nostr\+walletconnect:\/\/[0-9a-f]{64}\?/i, { message: "bad_prefix" })
  .refine((v) => {
    const relays = queryOf(v).getAll("relay");
    return relays.length > 0 && relays.length <= 8 && relays.every(isRelayUrl);
  }, { message: "bad_relay" })
  .refine((v) => HEX64.test(queryOf(v).get("secret") ?? ""), { message: "bad_secret" });

export const LabelSchema = z.string().trim().min(1).max(40);

export interface PublicWalletInfo {
  walletPubkey: string;
  relays: string[];
  lud16?: string;
}

/** Parse + validate. Returns ONLY public parts — the secret is never returned. */
export function inspectNwcUri(raw: string): PublicWalletInfo {
  const res = NwcUriSchema.safeParse(raw);
  if (!res.success) throw new AppError("invalid_uri", res.error.issues[0]?.message ?? "invalid");
  const q = queryOf(res.data);
  const pubkey = res.data.slice("nostr+walletconnect://".length, "nostr+walletconnect://".length + 64);
  const lud16 = q.get("lud16") ?? undefined;
  return { walletPubkey: pubkey.toLowerCase(), relays: q.getAll("relay"), lud16 };
}

// ───────────────────────── Session store ─────────────────────────

interface WalletEntry {
  uri: string; // secret — never expose
  label: string;
  demo: boolean;
  info: PublicWalletInfo;
  client?: NWCClient;
}

const wallets = new Map<string, WalletEntry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
/** Monotonic counter for React's useSyncExternalStore. */
export const walletsVersion = () => version;

export function subscribeWallets(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface WalletMeta {
  id: string;
  label: string;
  demo: boolean;
  lud16?: string;
}

export function listWallets(): WalletMeta[] {
  return [...wallets.entries()].map(([id, w]) => ({ id, label: w.label, demo: w.demo, lud16: w.info.lud16 }));
}

export const hasWallet = (id?: string): boolean => !!id && wallets.has(id);

export function registerWallet(uri: string, label: string, demo = false, id = `w_${randomId()}`): string {
  const info = inspectNwcUri(uri);
  const cleanLabel = LabelSchema.parse(label);
  wallets.set(id, { uri: uri.trim(), label: cleanLabel, demo, info });
  emit();
  return id;
}

export function forgetWallet(id: string): void {
  wallets.get(id)?.client?.close();
  wallets.delete(id);
  emit();
}

export function forgetAllWallets(): void {
  for (const w of wallets.values()) w.client?.close();
  wallets.clear();
  emit();
}

function client(id?: string): NWCClient {
  const w = id ? wallets.get(id) : undefined;
  if (!w) throw new AppError("no_wallet");
  if (!w.client) w.client = new NWCClient({ nostrWalletConnectUrl: w.uri, logger: silentLogger });
  return w.client;
}

// ───────────────────────── Helpers ─────────────────────────

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        t = setTimeout(() => rej(new AppError("timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(t);
  }
}

/** Re-throw any SDK error as a sanitized AppError (raw messages may embed secrets). */
async function guarded<T>(fn: () => Promise<T>, ms = 20_000): Promise<T> {
  try {
    return await withTimeout(fn(), ms);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(classifyError(e));
  }
}

// ───────────────────────── Faucet (demo) ─────────────────────────

/**
 * Provision a disposable test wallet from Alby's public NWC faucet.
 * Test sats only — no real value. Retries once on failure.
 */
export async function provisionFaucetWallet(label: string, balanceSats = 10_000): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15_000);
      const r = await fetch(`${FAUCET_URL}?balance=${Math.floor(balanceSats)}`, {
        method: "POST",
        signal: ctl.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      }).finally(() => clearTimeout(t));
      if (!r.ok) throw new AppError("network", `faucet ${r.status}`);
      const uri = (await r.text()).trim();
      return registerWallet(uri, label, true); // validates via zod
    } catch (e) {
      lastErr = e;
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  throw lastErr instanceof AppError ? lastErr : new AppError(classifyError(lastErr));
}

// ───────────────────────── Lightning ops ─────────────────────────

export async function checkWallet(id: string): Promise<{ canReceive: boolean; canPay: boolean; alias?: string }> {
  return guarded(async () => {
    const info = await client(id).getInfo();
    return {
      canReceive: info.methods.includes("make_invoice"),
      canPay: info.methods.includes("pay_invoice"),
      alias: info.alias?.slice(0, 40),
    };
  }, 12_000);
}

export async function getBalanceSats(id: string): Promise<number> {
  return guarded(async () => Math.floor((await client(id).getBalance()).balance / 1000), 12_000);
}

export interface Invoice {
  invoice: string;
  paymentHash: string;
  amountSats: number;
}

export async function createInvoice(recipientWalletId: string, amountSats: number, memo: string): Promise<Invoice> {
  if (!Number.isInteger(amountSats) || amountSats < 1 || amountSats > 10_000_000) throw new AppError("unknown", "amount");
  return guarded(async () => {
    const tx = await client(recipientWalletId).makeInvoice({
      amount: amountSats * 1000, // NIP-47 uses millisats
      description: memo.slice(0, 100),
      expiry: 600,
    });
    if (!HEX64.test(tx.payment_hash)) throw new AppError("wallet_rejected", "bad hash");
    return { invoice: tx.invoice, paymentHash: tx.payment_hash.toLowerCase(), amountSats };
  });
}

export async function payInvoice(payerWalletId: string, invoice: string): Promise<{ preimage: string; feesSats: number }> {
  return guarded(async () => {
    const r = await client(payerWalletId).payInvoice({ invoice });
    return { preimage: r.preimage.toLowerCase(), feesSats: Math.ceil((r.fees_paid ?? 0) / 1000) };
  }, 30_000);
}

export async function lookupSettled(walletId: string, paymentHash: string): Promise<boolean> {
  try {
    const tx = await guarded(() => client(walletId).lookupInvoice({ payment_hash: paymentHash }), 8_000);
    return tx.state === "settled" || !!tx.settled_at;
  } catch {
    return false;
  }
}

/** Proof of payment: SHA-256(preimage) must equal the invoice's payment hash. */
export async function verifyPreimage(preimage: string, paymentHash: string): Promise<boolean> {
  if (!HEX64.test(preimage) || !HEX64.test(paymentHash)) return false;
  return (await sha256Hex(hexToBytes(preimage))) === paymentHash.toLowerCase();
}

// ───────────────────────── Passphrase vault ─────────────────────────

export const PassphraseSchema = z.string().min(8, { message: "min8" }).max(256);

export async function hasVault(): Promise<boolean> {
  try {
    return !!(await get<SealedBox>(VAULT_KEY));
  } catch {
    return false;
  }
}

export async function lockToVault(passphrase: string): Promise<void> {
  PassphraseSchema.parse(passphrase);
  const payload = JSON.stringify(
    [...wallets.entries()].map(([id, w]) => ({ id, uri: w.uri, label: w.label, demo: w.demo })),
  );
  await set(VAULT_KEY, await seal(payload, passphrase));
}

/** Returns number of wallets restored. Throws AppError("wallet_rejected") on wrong passphrase. */
export async function unlockVault(passphrase: string): Promise<number> {
  const box = await get<SealedBox>(VAULT_KEY);
  if (!box) return 0;
  let plain: string;
  try {
    plain = await unseal(box, passphrase);
  } catch {
    throw new AppError("wallet_rejected", "bad passphrase");
  }
  const items = z
    .array(z.object({ id: z.string().max(64), uri: NwcUriSchema, label: LabelSchema, demo: z.boolean() }))
    .parse(JSON.parse(plain));
  for (const it of items) if (!wallets.has(it.id)) registerWallet(it.uri, it.label, it.demo, it.id);
  return items.length;
}

export async function destroyVault(): Promise<void> {
  await del(VAULT_KEY);
}
