/** Tontine domain model + pure state transitions (no I/O — easy to test). */
import { randomId } from "./vault";
import type { CircleKind } from "./money";
import type { Fiat } from "./rates";

export type PayoutMode = "rotation" | "auction";
export type Frequency = "weekly" | "monthly";

export interface Member {
  id: string;
  name: string;
  /** Handle into the in-memory wallet store (never the URI itself). Device-local. */
  walletId?: string;
}

export interface Payment {
  memberId: string;
  amountSats: number;
  method: "lightning" | "cash";
  paidAt: number;
  paymentHash?: string;
  preimage?: string; // settled preimage = proof of payment (receipt), not a spend secret
  verified: boolean; // sha256(preimage) === paymentHash
  recipientConfirmed?: boolean; // recipient wallet's lookup_invoice said "settled"
  feesSats?: number;
  receiptEventId?: string;
  relayAcks?: number;
}

export interface Bid {
  memberId: string;
  discountPct: number;
  at: number;
}

export interface Round {
  index: number;
  recipientId: string;
  discountPct: number;
  dueAt: number;
  startedAt: number;
  payments: Payment[];
  bid?: Bid;
  closedAt?: number;
}

export interface Circle {
  v: 1;
  id: string;
  name: string;
  contributionSats: number;
  /** Nominal amount agreed in the circle currency at creation (informational; payments are in sats). */
  contributionFiat?: number;
  /** Legacy (v0.1) nominal CFA amount. */
  contributionXof?: number;
  /** Local name of the ritual: tontine, bhishi, tanda, ... (defaults to tontine). */
  kind?: CircleKind;
  /** Display currency (defaults to XOF). */
  currency?: Fiat;
  frequency: Frequency;
  payoutMode: PayoutMode;
  members: Member[];
  rotation: string[]; // member ids; rotation[i] receives round i
  rounds: Round[];
  createdAt: number;
  updatedAt: number;
  demo: boolean;
  /** Circle key: signs ledger events + derives the NIP-44 group key. Device-local, never published. */
  nostr: { pubkey: string; skHex: string };
  ledgerEventId?: string;
  ledgerAcks?: number;
  lastSyncedAt?: number;
}

const DAY = 86_400_000;
export const periodMs = (f: Frequency) => (f === "weekly" ? 7 * DAY : 30 * DAY);

export interface NewCircleInput {
  name: string;
  contributionSats: number;
  contributionFiat: number;
  kind?: CircleKind;
  currency?: Fiat;
  frequency: Frequency;
  payoutMode: PayoutMode;
  members: Array<{ name: string; walletId?: string }>;
  demo: boolean;
}

export function createCircle(input: NewCircleInput, keys: { pubkey: string; skHex: string }, now = Date.now()): Circle {
  const members: Member[] = input.members.map((m) => ({ id: `m_${randomId(4)}`, name: m.name.trim(), walletId: m.walletId }));
  const rotation = members.map((m) => m.id);
  return {
    v: 1,
    id: `c_${randomId(8)}`,
    name: input.name.trim(),
    contributionSats: input.contributionSats,
    contributionFiat: input.contributionFiat,
    kind: input.kind ?? "tontine",
    currency: input.currency ?? "XOF",
    frequency: input.frequency,
    payoutMode: input.payoutMode,
    members,
    rotation,
    rounds: [
      { index: 0, recipientId: rotation[0], discountPct: 0, startedAt: now, dueAt: now + periodMs(input.frequency), payments: [] },
    ],
    createdAt: now,
    updatedAt: now,
    demo: input.demo,
    nostr: keys,
  };
}

export const circleKind = (c: Circle): CircleKind => c.kind ?? "tontine";
export const circleCurrency = (c: Circle): Fiat => c.currency ?? "XOF";

/** Honest ledger sequence: every payment ever recorded gets N° 1, 2, 3… in time order. */
export function receiptNo(c: Circle, roundIndex: number, memberId: string): number | undefined {
  const all = c.rounds.flatMap((r) => r.payments.map((p) => ({ r: r.index, m: p.memberId, t: p.paidAt })));
  all.sort((a, b) => a.t - b.t || a.r - b.r);
  const i = all.findIndex((x) => x.r === roundIndex && x.m === memberId);
  return i < 0 ? undefined : i + 1;
}
export const fmtReceipt = (n: number) => `N°${String(n).padStart(4, "0")}`;

export const memberById = (c: Circle, id: string) => c.members.find((m) => m.id === id);
export const currentRound = (c: Circle): Round => c.rounds[c.rounds.length - 1];
export const contributorsFor = (c: Circle, r: Round) => c.members.filter((m) => m.id !== r.recipientId);
export const shareFor = (c: Circle, r: Round) => Math.max(1, Math.round(c.contributionSats * (1 - r.discountPct / 100)));
export const potTarget = (c: Circle, r: Round) => shareFor(c, r) * contributorsFor(c, r).length;
export const collected = (r: Round) => r.payments.reduce((s, p) => s + p.amountSats, 0);
export const paymentOf = (r: Round, memberId: string) => r.payments.find((p) => p.memberId === memberId);
export const isRoundComplete = (c: Circle, r: Round) => contributorsFor(c, r).every((m) => paymentOf(r, m.id));
export const isCircleComplete = (c: Circle) =>
  c.rounds.length === c.members.length && isRoundComplete(c, currentRound(c));

/** Members who have received (or are receiving) a pot. */
export const servedIds = (c: Circle) => new Set(c.rounds.map((r) => r.recipientId));

/** Members who can still bid to take the current round's pot early. */
export function eligibleBidders(c: Circle): Member[] {
  const r = currentRound(c);
  const served = new Set(c.rounds.slice(0, -1).map((x) => x.recipientId));
  return c.members.filter((m) => !served.has(m.id) && m.id !== r.recipientId);
}

export function recordPayment(c: Circle, roundIndex: number, p: Payment, now = Date.now()): Circle {
  return {
    ...c,
    updatedAt: now,
    rounds: c.rounds.map((r) =>
      r.index === roundIndex ? { ...r, payments: [...r.payments.filter((x) => x.memberId !== p.memberId), p] } : r,
    ),
  };
}

export function patchPayment(c: Circle, roundIndex: number, memberId: string, patch: Partial<Payment>): Circle {
  return {
    ...c,
    rounds: c.rounds.map((r) =>
      r.index === roundIndex
        ? { ...r, payments: r.payments.map((p) => (p.memberId === memberId ? { ...p, ...patch } : p)) }
        : r,
    ),
  };
}

/**
 * Emergency bid (reverse auction): `memberId` takes the current pot now and
 * accepts `discountPct` less. Every other contributor pays that much less —
 * the discount is the dividend shared by the remaining members.
 * Only allowed before anyone has paid into the current round.
 */
export function applyBid(c: Circle, memberId: string, discountPct: number, now = Date.now()): Circle {
  const r = currentRound(c);
  if (r.payments.length > 0) throw new Error("round_started");
  if (!eligibleBidders(c).some((m) => m.id === memberId)) throw new Error("not_eligible");
  const pct = Math.min(30, Math.max(0, Math.round(discountPct * 10) / 10));
  // Move the bidder into this round's slot; everyone else keeps their relative order.
  const rotation = c.rotation.filter((id) => id !== memberId);
  rotation.splice(r.index, 0, memberId);
  return {
    ...c,
    rotation,
    updatedAt: now,
    rounds: c.rounds.map((x) =>
      x.index === r.index ? { ...x, recipientId: memberId, discountPct: pct, bid: { memberId, discountPct: pct, at: now } } : x,
    ),
  };
}

export function startNextRound(c: Circle, now = Date.now()): Circle {
  const r = currentRound(c);
  if (!isRoundComplete(c, r) || c.rounds.length >= c.members.length) return c;
  const idx = r.index + 1;
  return {
    ...c,
    updatedAt: now,
    rounds: [
      ...c.rounds.map((x) => (x.index === r.index ? { ...x, closedAt: now } : x)),
      { index: idx, recipientId: c.rotation[idx], discountPct: 0, startedAt: now, dueAt: now + periodMs(c.frequency), payments: [] },
    ],
  };
}

/**
 * Merge a ledger fetched from Nostr with the local copy.
 * Newest snapshot wins for structure; payments are unioned (verified beats unverified);
 * device-local secrets/handles (circle key, wallet ids) are always kept from local.
 */
export function mergeCircle(local: Circle | undefined, remote: Circle): Circle {
  if (!local) return remote;
  const base = remote.updatedAt > local.updatedAt ? remote : local;
  const other = base === remote ? local : remote;
  const rounds = base.rounds.map((r, i) => {
    const o = other.rounds[i];
    if (!o || o.recipientId !== r.recipientId) return r;
    const byMember = new Map(r.payments.map((p) => [p.memberId, p] as const));
    for (const p of o.payments) {
      const ex = byMember.get(p.memberId);
      if (!ex || (!ex.verified && p.verified)) byMember.set(p.memberId, p);
    }
    return { ...r, payments: [...byMember.values()] };
  });
  const members = base.members.map((m) => ({ ...m, walletId: local.members.find((x) => x.id === m.id)?.walletId }));
  return { ...base, rounds, members, nostr: local.nostr, updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
}

/** Strip device-local secrets before anything is serialized for publishing. */
export function publicSnapshot(c: Circle): Omit<Circle, "nostr"> & { nostr: { pubkey: string } } {
  return {
    ...c,
    nostr: { pubkey: c.nostr.pubkey },
    members: c.members.map(({ id, name }) => ({ id, name })),
  };
}
