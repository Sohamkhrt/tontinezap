/**
 * Local-first, tamper-evident tontine ledger.
 *
 *  ┌──────────────┐  save()   ┌────────────┐  publish()  ┌──────────────────────┐
 *  │ React state  │ ───────▶  │ IndexedDB  │ ──outbox──▶ │ Nostr relays (30078) │
 *  └──────────────┘ ◀─────────└────────────┘ ◀─fetch()── └──────────────────────┘
 *
 * - IndexedDB is the source of truth on-device, so the app works fully offline.
 * - Every state change is signed (Schnorr, NIP-01) by the circle key and
 *   NIP-44 v2 encrypted (secp256k1 ECDH + HKDF, ChaCha20, HMAC-SHA256, padded) with a
 *   group conversation key. Relays only see ciphertext + the circle pubkey.
 * - Events are parameterized-replaceable kind 30078 (NIP-78 app data):
 *     d = tontinezap:<circleId>                 → full ledger snapshot
 *     d = tontinezap:<circleId>:r<n>:<memberId> → per-payment receipt (preimage proof)
 *     d = tontinezap:<circleId>:audit:r<n>      → treasurer audit summary
 * - Signed events go to a persistent outbox first and are retried when the
 *   device comes back online, so a slow relay never blocks a payment.
 */
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from "nostr-tools/pure";
import * as nip44 from "nostr-tools/nip44";
import { neventEncode } from "nostr-tools/nip19";
import { createStore, get, set, del, entries } from "idb-keyval";
import { z } from "zod";
import { publicSnapshot, type Circle, type Payment } from "../lib/circle";
import { bytesToHex, hexToBytes } from "../lib/vault";
import { log } from "../lib/redact";

export const RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.primal.net"];
export const LEDGER_KIND = 30078;
const APP = "tontinezap";
const PUBLISH_TIMEOUT = 6000;

const store = createStore("tontinezap", "kv");

// ───────────────────────── Keys & crypto ─────────────────────────

export function newCircleKeys(): { pubkey: string; skHex: string } {
  const sk = generateSecretKey();
  return { pubkey: getPublicKey(sk), skHex: bytesToHex(sk) };
}

const keyCache = new Map<string, { sk: Uint8Array; ck: Uint8Array }>();
function keysFor(skHex: string) {
  let k = keyCache.get(skHex);
  if (!k) {
    const sk = hexToBytes(skHex);
    // Group key: conversation key of the circle key with itself — every holder of the invite can decrypt.
    k = { sk, ck: nip44.v2.utils.getConversationKey(sk, getPublicKey(sk)) };
    keyCache.set(skHex, k);
  }
  return k;
}

export const encryptFor = (skHex: string, data: unknown) => nip44.v2.encrypt(JSON.stringify(data), keysFor(skHex).ck);
export const decryptFor = <T>(skHex: string, payload: string): T => JSON.parse(nip44.v2.decrypt(payload, keysFor(skHex).ck)) as T;

function sign(skHex: string, d: string, data: unknown, altText: string): Event {
  return finalizeEvent(
    {
      kind: LEDGER_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["d", d], ["t", APP], ["alt", altText]],
      content: encryptFor(skHex, { app: APP, v: 1, ...((data as object) ?? {}) }),
    },
    keysFor(skHex).sk,
  );
}

// ───────────────────────── IndexedDB (local-first) ─────────────────────────

export async function saveCircle(c: Circle): Promise<void> {
  await set(`circle:${c.id}`, c, store);
}

export async function loadCircles(): Promise<Circle[]> {
  try {
    const all = await entries<string, Circle>(store);
    return all
      .filter(([k]) => String(k).startsWith("circle:"))
      .map(([, v]) => v)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (e) {
    log.warn("idb load failed", e);
    return [];
  }
}

export async function deleteCircle(id: string): Promise<void> {
  await del(`circle:${id}`, store);
}

// ───────────────────────── Outbox + relays ─────────────────────────

let pool: SimplePool | undefined;
const getPool = () => (pool ??= new SimplePool());

async function readOutbox(): Promise<Event[]> {
  return (await get<Event[]>("outbox", store)) ?? [];
}
async function writeOutbox(evts: Event[]): Promise<void> {
  await set("outbox", evts, store);
}

export async function outboxSize(): Promise<number> {
  return (await readOutbox()).length;
}

/** Publish one signed event to all relays; resolves with number of relays that accepted it. */
async function publishNow(ev: Event): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  const attempts = getPool().publish(RELAYS, ev);
  const results = await Promise.allSettled(
    attempts.map((p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), PUBLISH_TIMEOUT))])),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}

/** Queue then try to publish. Replaceable events with the same d-tag supersede older queued ones. */
export async function publish(ev: Event): Promise<{ eventId: string; acks: number }> {
  const d = ev.tags.find((t) => t[0] === "d")?.[1];
  const queue = (await readOutbox()).filter((e) => e.tags.find((t) => t[0] === "d")?.[1] !== d);
  await writeOutbox([...queue, ev]);
  const acks = await publishNow(ev);
  if (acks > 0) await writeOutbox((await readOutbox()).filter((e) => e.id !== ev.id));
  return { eventId: ev.id, acks };
}

/** Retry everything still queued (call on `online` events / app start). */
export async function flushOutbox(): Promise<number> {
  const queue = await readOutbox();
  if (!queue.length) return 0;
  const remaining: Event[] = [];
  for (const ev of queue) if ((await publishNow(ev)) === 0) remaining.push(ev);
  await writeOutbox(remaining);
  return queue.length - remaining.length;
}

// ───────────────────────── Ledger events ─────────────────────────

export const publishLedger = (c: Circle) =>
  publish(sign(c.nostr.skHex, `${APP}:${c.id}`, { type: "ledger", circle: publicSnapshot(c) }, "TontineZap encrypted savings-circle ledger"));

export const publishReceipt = (c: Circle, roundIndex: number, p: Payment) =>
  publish(
    sign(
      c.nostr.skHex,
      `${APP}:${c.id}:r${roundIndex}:${p.memberId}`,
      {
        type: "receipt",
        circleId: c.id,
        round: roundIndex,
        recipientId: c.rounds[roundIndex]?.recipientId,
        payment: p,
      },
      "TontineZap encrypted payment receipt",
    ),
  );

export const publishAudit = (c: Circle, roundIndex: number, text: string) =>
  publish(sign(c.nostr.skHex, `${APP}:${c.id}:audit:r${roundIndex}`, { type: "audit", round: roundIndex, text }, "TontineZap round audit summary"));

const SnapshotSchema = z.object({
  type: z.literal("ledger"),
  circle: z
    .object({
      v: z.literal(1),
      id: z.string().max(64),
      name: z.string().max(80),
      updatedAt: z.number(),
      members: z.array(z.object({ id: z.string(), name: z.string().max(40) })).max(30),
      rounds: z.array(z.any()).max(30),
    })
    .passthrough(),
});

/** Fetch + verify signature + decrypt the newest ledger snapshot for a circle. */
export async function fetchLedger(circleId: string, skHex: string): Promise<Circle | null> {
  const pubkey = getPublicKey(keysFor(skHex).sk);
  const evts = await getPool().querySync(RELAYS, { kinds: [LEDGER_KIND], authors: [pubkey], "#d": [`${APP}:${circleId}`] }, { maxWait: 5000 });
  const valid = evts.filter((e) => e.pubkey === pubkey && verifyEvent(e)).sort((a, b) => b.created_at - a.created_at);
  for (const ev of valid) {
    try {
      const parsed = SnapshotSchema.parse(decryptFor<unknown>(skHex, ev.content));
      return { ...(parsed.circle as unknown as Circle), nostr: { pubkey, skHex }, ledgerEventId: ev.id };
    } catch (e) {
      log.warn("ledger decode failed", e);
    }
  }
  return null;
}

export async function countReceipts(c: Circle): Promise<number> {
  const evts = await getPool().querySync(RELAYS, { kinds: [LEDGER_KIND], authors: [c.nostr.pubkey], "#t": [APP] }, { maxWait: 4000 });
  return new Set(evts.filter((e) => e.tags.some((t) => t[0] === "d" && /:r\d+:/.test(t[1]))).map((e) => e.id)).size;
}

export const nevent = (eventId: string, author: string) => neventEncode({ id: eventId, author, relays: RELAYS.slice(0, 2), kind: LEDGER_KIND });
export const njumpUrl = (eventId: string, author: string) => `https://njump.me/${nevent(eventId, author)}`;

// ───────────────────────── Invites (multi-device sync) ─────────────────────────

/** Invite = circle id + circle key. Anyone holding it can read AND write the ledger. */
export const makeInvite = (c: Circle) => `tontinezap:${c.id}:${c.nostr.skHex}`;

export function parseInvite(raw: string): { circleId: string; skHex: string } {
  const m = /^tontinezap:(c_[0-9a-f]{16}):([0-9a-f]{64})$/i.exec(raw.trim());
  if (!m) throw new Error("bad_invite");
  return { circleId: m[1], skHex: m[2].toLowerCase() };
}
