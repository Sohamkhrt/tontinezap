/**
 * Live network E2E (opt-in): `npm run test:e2e`
 * Real faucet wallets → real Lightning payments → real Nostr relays.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getBalanceSats, provisionFaucetWallet } from "./nwcService";
import { fetchLedger, newCircleKeys } from "./nostrLedger";
import { payShare } from "./tontine";
import { applyBid, contributorsFor, createCircle, currentRound, isRoundComplete, type Circle } from "../lib/circle";

describe.runIf(process.env.E2E === "1" || process.env.npm_lifecycle_event === "test:e2e")("live tontine round", () => {
  it("4 members, emergency bid, 3 real Lightning payments, ledger on Nostr", async () => {
    const names = ["Awa", "Moussa", "Fatou", "Ibrahima"];
    const ids = await Promise.all(names.map((n) => provisionFaucetWallet(n)));
    let c: Circle = createCircle(
      { name: "E2E", contributionSats: 1000, contributionFiat: 379, frequency: "weekly", payoutMode: "auction", members: names.map((name, i) => ({ name, walletId: ids[i] })), demo: true },
      newCircleKeys(),
    );
    // Fatou bids 5% to take round 1 early
    c = applyBid(c, c.members[2].id, 5);
    const steps: string[] = [];
    const times: number[] = [];
    for (const m of contributorsFor(c, currentRound(c))) {
      const r = await payShare(c, m.id, (s) => steps.push(s), () => {});
      c = r.circle;
      times.push(r.ms);
      expect(r.payment.verified).toBe(true);
      expect(r.payment.amountSats).toBe(950);
    }
    console.log("payment latencies (ms):", times, "ledger acks:", c.ledgerAcks);
    expect(isRoundComplete(c, currentRound(c))).toBe(true);
    expect(await getBalanceSats(ids[2])).toBe(10_000 + 3 * 950); // Fatou received the discounted pot
    expect(await getBalanceSats(ids[1])).toBe(10_000 - 950);
    expect(c.ledgerAcks).toBeGreaterThan(0);
    const remote = await fetchLedger(c.id, c.nostr.skHex);
    expect(remote?.rounds[0].payments).toHaveLength(3);
    expect(remote?.rounds[0].recipientId).toBe(c.members[2].id);
  }, 120_000);
});
