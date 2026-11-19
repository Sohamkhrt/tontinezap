import { describe, expect, it } from "vitest";
import { redact, classifyError } from "./redact";
import { seal, unseal, bytesToHex } from "./vault";
import {
  applyBid,
  createCircle,
  currentRound,
  eligibleBidders,
  isCircleComplete,
  isRoundComplete,
  mergeCircle,
  potTarget,
  publicSnapshot,
  recordPayment,
  shareFor,
  startNextRound,
  type Circle,
} from "./circle";
import { analyze, auctionQuote, auditSummary } from "./advisor";
import { inspectNwcUri, NwcUriSchema, verifyPreimage } from "../services/nwcService";
import { decryptFor, encryptFor, makeInvite, newCircleKeys, parseInvite } from "../services/nostrLedger";

const PK = "d99638ba7a8ca19fe5eb7721a3541c47b515b4e21e0d5fd38fba1cb48350cce2";
const SECRET = "a".repeat(64);
const URI = `nostr+walletconnect://${PK}?relay=wss://relay.getalby.com&secret=${SECRET}&lud16=x@getalby.com`;
const RATE = { xofPerBtc: 37_900_000, inrPerBtc: 5_400_000, source: "offline" as const, at: 0 };

function demo(): Circle {
  return createCircle(
    {
      name: "Sandaga",
      contributionSats: 1000,
      contributionFiat: 379,
      frequency: "weekly",
      payoutMode: "auction",
      members: ["Awa", "Moussa", "Fatou", "Ibrahima"].map((name) => ({ name })),
      demo: true,
    },
    newCircleKeys(),
    1_000_000,
  );
}
const pay = (c: Circle, memberId: string, at = 1_000_100) =>
  recordPayment(c, currentRound(c).index, { memberId, amountSats: shareFor(c, currentRound(c)), method: "lightning", paidAt: at, verified: true, paymentHash: "ab".repeat(32) });

describe("redaction", () => {
  it("never leaks NWC secrets, invoices or preimages", () => {
    const out = redact(new Error(`failed ${URI} paying lnbc10u1pjqqqqqpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypq preimage ${"f".repeat(64)}`));
    expect(out).not.toContain(SECRET);
    expect(out).not.toContain(PK);
    expect(out).not.toContain("f".repeat(64));
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("[INVOICE]");
  });
  it("redacts bare secret params and phone numbers", () => {
    expect(redact("x?secret=deadbeef&y=1")).toBe("x?secret=[REDACTED]&y=1");
    expect(redact("call +221 77 123 45 67")).not.toMatch(/77 123/);
  });
  it("classifies wallet errors", () => {
    expect(classifyError({ code: "INSUFFICIENT_BALANCE", message: "x" })).toBe("insufficient");
    expect(classifyError(new Error("reply timeout"))).toBe("timeout");
  });
});

describe("NWC URI validation", () => {
  it("accepts a valid URI and returns only public parts", () => {
    const info = inspectNwcUri(URI);
    expect(info.walletPubkey).toBe(PK);
    expect(JSON.stringify(info)).not.toContain(SECRET);
  });
  it.each([
    ["wrong scheme", URI.replace("nostr+walletconnect", "https")],
    ["short pubkey", URI.replace(PK, "abc")],
    ["no secret", URI.replace(`&secret=${SECRET}`, "")],
    ["short secret", URI.replace(SECRET, "abc")],
    ["insecure relay", URI.replace("wss://relay.getalby.com", "ws://evil.example")],
    ["no relay", `nostr+walletconnect://${PK}?secret=${SECRET}`],
    ["javascript", "javascript:alert(1)"],
  ])("rejects %s", (_, bad) => {
    expect(NwcUriSchema.safeParse(bad).success).toBe(false);
  });
});

describe("proof of payment", () => {
  it("verifies sha256(preimage) == payment_hash", async () => {
    const preimage = "00".repeat(32);
    const hash = "66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925"; // sha256(32 zero bytes)
    expect(await verifyPreimage(preimage, hash)).toBe(true);
    expect(await verifyPreimage("01".repeat(32), hash)).toBe(false);
    expect(await verifyPreimage("nothex", hash)).toBe(false);
  });
});

describe("vault", () => {
  it("round-trips and rejects a wrong passphrase", async () => {
    const box = await seal(URI, "correct horse");
    expect(JSON.stringify(box)).not.toContain(SECRET);
    expect(await unseal(box, "correct horse")).toBe(URI);
    await expect(unseal(box, "wrong horse!")).rejects.toBeTruthy();
  }, 20_000);
});

describe("NIP-44 ledger encryption + invites", () => {
  it("encrypts with the circle key and decrypts", () => {
    const k = newCircleKeys();
    const ct = encryptFor(k.skHex, { hello: "Dakar" });
    expect(ct).not.toContain("Dakar");
    expect(decryptFor<{ hello: string }>(k.skHex, ct).hello).toBe("Dakar");
    expect(() => decryptFor(newCircleKeys().skHex, ct)).toThrow();
  });
  it("publicSnapshot strips the circle secret key and wallet handles", () => {
    const c = { ...demo(), members: demo().members.map((m) => ({ ...m, walletId: "w_secret" })) };
    const s = JSON.stringify(publicSnapshot(c));
    expect(s).not.toContain(c.nostr.skHex);
    expect(s).not.toContain("w_secret");
  });
  it("invite round-trip", () => {
    const c = demo();
    expect(parseInvite(makeInvite(c))).toEqual({ circleId: c.id, skHex: c.nostr.skHex });
    expect(() => parseInvite("tontinezap:nope")).toThrow();
  });
  it("ships a valid hex circle key", () => {
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe("00ff");
  });
});

describe("rotation", () => {
  it("runs a full 4-round circle", () => {
    let c = demo();
    for (let round = 0; round < 4; round++) {
      const r = currentRound(c);
      expect(r.recipientId).toBe(c.rotation[round]);
      expect(potTarget(c, r)).toBe(3000);
      for (const m of c.members) if (m.id !== r.recipientId) c = pay(c, m.id);
      expect(isRoundComplete(c, currentRound(c))).toBe(true);
      c = startNextRound(c);
    }
    expect(isCircleComplete(c)).toBe(true);
    expect(new Set(c.rounds.map((r) => r.recipientId)).size).toBe(4); // everyone received exactly once
  });
});

describe("emergency bid (reverse auction)", () => {
  it("lets a member take the pot early at a discount shared by the others", () => {
    const c = demo();
    const fatou = c.members[2];
    const q = auctionQuote(c, 5);
    expect(q).toMatchObject({ normalPot: 3000, recipientGets: 2850, perMemberPays: 950, perMemberSaves: 50, totalDividend: 150 });
    const b = applyBid(c, fatou.id, 5);
    expect(currentRound(b).recipientId).toBe(fatou.id);
    expect(shareFor(b, currentRound(b))).toBe(950);
    expect(b.rotation[0]).toBe(fatou.id);
    expect(b.rotation).toContain(c.members[0].id); // Awa is still in the queue
  });
  it("blocks bids after payments start and from already-served members", () => {
    const c = pay(demo(), demo().members[1].id);
    expect(() => applyBid(c, c.members[2].id, 5)).toThrow("round_started");
    let d = demo();
    for (const m of d.members.slice(1)) d = pay(d, m.id);
    d = startNextRound(d);
    expect(eligibleBidders(d).map((m) => m.name)).not.toContain("Awa");
  });
});

describe("treasurer advisor", () => {
  it("scores a punctual all-Lightning circle highly", () => {
    let c = demo();
    for (const m of c.members.slice(1)) c = pay(c, m.id);
    c = { ...c, ledgerAcks: 3 };
    const a = analyze(c, "en", 1_000_200);
    expect(a.score).toBeGreaterThanOrEqual(90);
    expect(a.insights.some((i) => i.level === "good")).toBe(true);
  });
  it("flags post-payout default risk", () => {
    let c = demo();
    for (const m of c.members.slice(1)) c = pay(c, m.id);
    c = startNextRound(c, 1_000_300);
    const later = currentRound(c).dueAt + 1;
    const a = analyze(c, "fr", later);
    expect(a.insights.some((i) => i.level === "risk" && i.text.includes("Awa"))).toBe(true);
  });
  it("writes bilingual WhatsApp summaries", () => {
    let c = demo();
    c = pay(c, c.members[1].id);
    const fr = auditSummary(c, currentRound(c), "fr", RATE);
    const en = auditSummary(c, currentRound(c), "en", RATE);
    expect(fr).toContain("Bénéficiaire : Awa");
    expect(en).toContain("Recipient : Awa");
    expect(en).toMatch(/Moussa — paid/);
    expect(en).toMatch(/Fatou — pending/);
  });
});

describe("multi-device merge", () => {
  it("unions payments and keeps local secrets", () => {
    const base = demo();
    const a = pay(base, base.members[1].id, 1_000_100);
    const b = { ...pay(base, base.members[2].id, 1_000_200), updatedAt: a.updatedAt + 1, nostr: { pubkey: base.nostr.pubkey, skHex: "" } };
    const m = mergeCircle(a, b);
    expect(currentRound(m).payments).toHaveLength(2);
    expect(m.nostr.skHex).toBe(base.nostr.skHex);
  });
});
