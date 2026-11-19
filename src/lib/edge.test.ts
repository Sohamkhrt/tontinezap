import { describe, expect, it } from "vitest";
import {
  applyBid,
  circleCurrency,
  circleKind,
  createCircle,
  currentRound,
  fmtReceipt,
  isCircleComplete,
  receiptNo,
  recordPayment,
  shareFor,
  startNextRound,
  type Circle,
} from "./circle";
import { fiatParts, fmtFiat, money } from "./money";
import { fiatToSats, satsToFiat, type Rate } from "./rates";
import { auditSummary } from "./advisor";
import { stopsFor } from "../components/Home";
import { newCircleKeys } from "../services/nostrLedger";

const RATE: Rate = { xofPerBtc: 37_900_000, inrPerBtc: 5_400_000, source: "offline", at: 0 };

function circle(n = 4, extra: Partial<Parameters<typeof createCircle>[0]> = {}): Circle {
  return createCircle(
    {
      name: "Edge",
      contributionSats: 1000,
      contributionFiat: 379,
      frequency: "weekly",
      payoutMode: "auction",
      members: Array.from({ length: n }, (_, i) => ({ name: `M${i + 1}` })),
      demo: true,
      ...extra,
    },
    newCircleKeys(),
    1_000_000,
  );
}
const payAll = (c: Circle, at = 1_000_100) => {
  const r = currentRound(c);
  for (const m of c.members) if (m.id !== r.recipientId) c = recordPayment(c, r.index, { memberId: m.id, amountSats: shareFor(c, r), method: "lightning", paidAt: at++, verified: true });
  return c;
};

describe("route plate states", () => {
  it("open round: recipient is the current stop, nobody done", () => {
    const c = circle();
    expect(stopsFor(c).map((s) => s.state)).toEqual(["now", "next", "next", "next"]);
  });
  it("closed round: recipient done, pot moves to the next stop", () => {
    const c = payAll(circle());
    expect(stopsFor(c).map((s) => s.state)).toEqual(["done", "now", "next", "next"]);
  });
  it("next round started: previous recipients done", () => {
    const c = startNextRound(payAll(circle()));
    expect(stopsFor(c).map((s) => s.state)).toEqual(["done", "now", "next", "next"]);
  });
  it("whole circle finished: every stop done, no current stop", () => {
    let c = circle(3);
    for (let i = 0; i < 3; i++) {
      c = payAll(c, 1_000_100 + i * 10);
      if (i < 2) c = startNextRound(c);
    }
    expect(isCircleComplete(c)).toBe(true);
    expect(stopsFor(c).every((s) => s.state === "done")).toBe(true);
  });
  it("bid moves the bidder onto the current stop", () => {
    const c = circle();
    const b = applyBid(c, c.members[2].id, 5);
    expect(stopsFor(b)[0]).toMatchObject({ id: c.members[2].id, state: "now" });
  });
  it("12-member circle produces 12 stops", () => {
    expect(stopsFor(circle(12))).toHaveLength(12);
  });
});

describe("receipt numbers", () => {
  it("number payments in time order across rounds, padded", () => {
    let c = payAll(circle(3));
    c = startNextRound(c);
    c = payAll(c, 2_000_000);
    const r0 = c.rounds[0];
    const nums = c.rounds.flatMap((r) => r.payments.map((p) => receiptNo(c, r.index, p.memberId)));
    expect(nums).toEqual([1, 2, 3, 4]);
    expect(receiptNo(c, 0, r0.recipientId)).toBeUndefined(); // recipient never pays themselves
    expect(fmtReceipt(7)).toBe("N°0007");
  });
});

describe("money", () => {
  it("formats XOF and INR in each language", () => {
    expect(fmtFiat(1137, "XOF", "fr")).toMatch(/^1\s?137 FCFA$/);
    expect(fmtFiat(1137, "XOF", "en")).toBe("1,137 CFA");
    expect(fmtFiat(123456, "INR", "en")).toBe("₹1,23,456"); // Indian grouping
    expect(fmtFiat(59.4, "INR", "fr")).toBe("₹59");
    expect(fiatParts(2500, "INR", "fr")).toEqual({ pre: "₹", num: "2,500", post: "" });
  });
  it("round-trips fiat ↔ sats and never returns 0 sats", () => {
    expect(fiatToSats(5000, RATE, "XOF")).toBe(13193);
    expect(Math.round(satsToFiat(13193, RATE, "XOF"))).toBe(5000);
    expect(fiatToSats(500, RATE, "INR")).toBe(9259);
    expect(fiatToSats(0, RATE, "INR")).toBe(1);
    expect(money(1000, RATE, "INR", "en")).toBe("₹54");
  });
});

describe("backward compatibility (v0.1 circles saved before kind/currency existed)", () => {
  it("defaults to tontine + XOF", () => {
    const legacy = { ...circle(), kind: undefined, currency: undefined, contributionFiat: undefined, contributionXof: 379 } as unknown as Circle;
    expect(circleKind(legacy)).toBe("tontine");
    expect(circleCurrency(legacy)).toBe("XOF");
    expect(auditSummary(legacy, currentRound(legacy), "fr", RATE)).toContain("Tontine « Edge »");
  });
  it("bhishi in INR flows into the audit summary", () => {
    const c = payAll(circle(4, { kind: "bhishi", currency: "INR" }));
    const s = auditSummary(c, currentRound(c), "en", RATE);
    expect(s).toContain("Bhishi « Edge »");
    expect(s).toContain("₹54 (1,000 sats)");
  });
});
