/**
 * "Pay My Share" orchestration — the core end-to-end flow:
 *   1. recipient's wallet creates a BOLT11 invoice (make_invoice)
 *   2. contributor's wallet pays it directly (pay_invoice) — peer to peer, no pool custody
 *   3. we verify sha256(preimage) == payment_hash (cryptographic proof of payment)
 *   4. recipient's wallet confirms settlement (lookup_invoice)
 *   5. a signed, NIP-44-encrypted receipt + updated ledger go to Nostr (via outbox)
 */
import {
  createInvoice,
  payInvoice,
  verifyPreimage,
  lookupSettled,
  hasWallet,
} from "./nwcService";
import { publishLedger, publishReceipt, saveCircle } from "./nostrLedger";
import {
  currentRound,
  memberById,
  patchPayment,
  paymentOf,
  recordPayment,
  shareFor,
  type Circle,
  type Payment,
} from "../lib/circle";
import { AppError } from "../lib/redact";

export type PayStep = "invoice" | "paying" | "verifying" | "publishing" | "done";

export interface PayResult {
  circle: Circle;
  payment: Payment;
  ms: number;
}

export async function payShare(
  circle: Circle,
  memberId: string,
  onStep: (s: PayStep) => void,
  onUpdate: (c: Circle) => void,
): Promise<PayResult> {
  const t0 = performance.now();
  const round = currentRound(circle);
  const payer = memberById(circle, memberId);
  const recipient = memberById(circle, round.recipientId);
  if (!payer || !recipient) throw new AppError("unknown", "member");
  if (paymentOf(round, memberId)) throw new AppError("unknown", "already_paid");
  if (!hasWallet(recipient.walletId) || !hasWallet(payer.walletId)) throw new AppError("no_wallet");

  const amount = shareFor(circle, round);
  onStep("invoice");
  const inv = await createInvoice(recipient.walletId!, amount, `TontineZap R${round.index + 1} ${circle.id.slice(2, 8)}`);

  onStep("paying");
  const { preimage, feesSats } = await payInvoice(payer.walletId!, inv.invoice);

  onStep("verifying");
  const verified = await verifyPreimage(preimage, inv.paymentHash);
  if (!verified) throw new AppError("proof_mismatch");
  const recipientConfirmed = await lookupSettled(recipient.walletId!, inv.paymentHash);

  const payment: Payment = {
    memberId,
    amountSats: amount,
    method: "lightning",
    paidAt: Date.now(),
    paymentHash: inv.paymentHash,
    preimage,
    verified,
    recipientConfirmed,
    feesSats,
  };
  let next = recordPayment(circle, round.index, payment);
  await saveCircle(next);
  onUpdate(next);
  const ms = Math.round(performance.now() - t0);

  // Publishing is best-effort: the payment is already final and saved locally.
  onStep("publishing");
  try {
    const [rec, led] = await Promise.all([publishReceipt(next, round.index, payment), publishLedger(next)]);
    next = patchPayment(next, round.index, memberId, { receiptEventId: rec.eventId, relayAcks: rec.acks });
    next = { ...next, ledgerEventId: led.eventId, ledgerAcks: led.acks };
    await saveCircle(next);
    onUpdate(next);
  } catch {
    /* stays in outbox; retried on reconnect */
  }
  onStep("done");
  return { circle: next, payment: paymentOf(currentRound(next), memberId)!, ms };
}

/** Organizer records an off-chain cash handoff (common in markets). Marked unverified. */
export async function recordCash(circle: Circle, memberId: string): Promise<Circle> {
  const round = currentRound(circle);
  const payment: Payment = { memberId, amountSats: shareFor(circle, round), method: "cash", paidAt: Date.now(), verified: false };
  let next = recordPayment(circle, round.index, payment);
  await saveCircle(next);
  try {
    const [rec, led] = await Promise.all([publishReceipt(next, round.index, payment), publishLedger(next)]);
    next = patchPayment(next, round.index, memberId, { receiptEventId: rec.eventId, relayAcks: rec.acks });
    next = { ...next, ledgerEventId: led.eventId, ledgerAcks: led.acks };
    await saveCircle(next);
  } catch {
    /* outbox */
  }
  return next;
}

/** Persist + publish any structural change (bids, new round, etc). */
export async function commit(circle: Circle): Promise<Circle> {
  await saveCircle(circle);
  try {
    const led = await publishLedger(circle);
    const next = { ...circle, ledgerEventId: led.eventId, ledgerAcks: led.acks };
    await saveCircle(next);
    return next;
  } catch {
    return circle;
  }
}
