// End-to-end smoke test: 2 faucet wallets -> invoice -> pay -> verify preimage.
// Never prints secrets.
import { NWCClient } from "@getalby/sdk/nwc";
import { createHash } from "node:crypto";

const faucet = async () => {
  const r = await fetch("https://faucet.nwc.dev?balance=10000", { method: "POST" });
  if (!r.ok) throw new Error("faucet HTTP " + r.status);
  return (await r.text()).trim();
};
const t0 = Date.now();
const [a, b] = await Promise.all([faucet(), faucet()]);
const recipient = new NWCClient({ nostrWalletConnectUrl: a });
const payer = new NWCClient({ nostrWalletConnectUrl: b });
console.log("provisioned in", Date.now() - t0, "ms");
console.log("balances (msat):", (await recipient.getBalance()).balance, (await payer.getBalance()).balance);
const t1 = Date.now();
const inv = await recipient.makeInvoice({ amount: 1000 * 1000, description: "TontineZap smoke" });
const paid = await payer.payInvoice({ invoice: inv.invoice });
const ok = createHash("sha256").update(Buffer.from(paid.preimage, "hex")).digest("hex") === inv.payment_hash;
console.log("paid in", Date.now() - t1, "ms; fees", paid.fees_paid, "; preimage verifies:", ok);
const look = await recipient.lookupInvoice({ payment_hash: inv.payment_hash });
console.log("recipient sees state:", look.state, "settled_at:", look.settled_at);
console.log("balances after:", (await recipient.getBalance()).balance, (await payer.getBalance()).balance);
recipient.close(); payer.close();
process.exit(0);
