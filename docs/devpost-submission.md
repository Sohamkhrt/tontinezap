# Devpost submission: TontineZap

## Project name
TontineZap

## Elevator pitch (≤200 chars)
Every culture has a savings circle. TontineZap runs tontines, bhishis and tandas on Lightning: members pay each other directly, every payment is proven, and nobody holds the pot.

## Try it out (links)
- Live demo: https://tontinezap.vercel.app
- Source code: https://github.com/<your-username>/tontinezap

## Video demo link
<YouTube unlisted URL>

---

## Inspiration
In Dakar's markets, vendors save together through **tontines**: every week each member puts in the same amount, and each week one member takes home the whole pot. It is how a tailor buys a sewing machine or a fish seller restocks before Tabaski. India has the same ritual (the *bhishi*, *kameti* and chit fund), and so do Mexico (*tanda*), Ghana (*susu*), China (*hui*) and Korea (*gye*).

The ritual works, but its tools don't. Records are kept in a paper notebook, money changes hands in cash in a busy market, and one treasurer holds everyone's savings. When a tontine fails, it is usually because the pot was lost, stolen, or quietly disputed: "I paid you last Tuesday!"

We asked what this ritual looks like when **nobody has to hold the pot**.

## What it does
TontineZap is a phone-first web app for the person who already runs the circle, the organizer.

- **Zero custody.** Each round, members pay the round's recipient **directly** over Bitcoin Lightning, wallet to wallet, through Nostr Wallet Connect (NWC). The app never touches funds and has no server.
- **Proof instead of trust.** A payment is marked paid only when `sha256(preimage) == payment_hash` is verified on the phone and the recipient's wallet confirms settlement. Every payment gets a receipt number (N°0001…).
- **A ledger that can't be lost or quietly edited.** Every change is signed and NIP-44 encrypted, then published to three Nostr relays (kind 30078). It also stays on the phone in IndexedDB, so it works offline. Another member's phone can join with an invite code and verify the same ledger.
- **Emergency bid.** A member with an urgent business need can take this round's pot early at a small discount. Everyone else pays less, and the discount is their dividend. The app warns when a discount gets predatory.
- **AI Group Treasurer.** It runs on the phone, so no data leaves it. It gives a health score, flags late payers and the #1 tontine risk (a member who got paid and stopped contributing), and writes **French/English audit reports** you can send on WhatsApp in one tap, with a QR receipt card.
- **Global by design.** The organizer picks the circle's local name (Tontine, Bhishi, Kameti, Chit fund, Tanda, Susu, Hui, Gye) and display currency (CFA franc or Indian rupee). Payments are always in sats.
- **Hybrid reality.** Members without Lightning yet can pay cash. The organizer records it, and it is visibly marked "unproven".
- **One-tap demo for judges.** "Demo: Dakar tontine" or "Demo: Mumbai bhishi (₹)" creates 4 real, disposable Lightning test wallets and lets you run a full round of real payments in seconds.

## How we built it
- **Frontend:** Vite + React 18 + TypeScript + Tailwind 4, shipped as a PWA. About 178 KB gzipped, built for mid-range Android phones on 3G.
- **Lightning:** `@getalby/sdk` `NWCClient` for `make_invoice`, `pay_invoice`, `lookup_invoice` and `get_balance`. Demo wallets come from Alby's NWC faucet.
- **Nostr:** `nostr-tools` for Schnorr-signed kind-30078 events, NIP-44 v2 group encryption, and a SimplePool across relay.damus.io, nos.lol and relay.primal.net. A persistent signed outbox retries when the phone comes back online.
- **Security:**
  - Wallet connection strings live only in memory, validated with `zod`.
  - An optional passphrase vault (PBKDF2-SHA256 600k → AES-256-GCM).
  - Every error and log line is redacted, and a strict Content-Security-Policy is applied.
  - Threat model in README, policy in SECURITY.md.
- **Design: "Painted Route Board".**
  - The look borrows from the hand-painted transport art that Dakar and India share: Dakar's *car rapide* buses and India's "Horn OK Please" trucks.
  - The circle is drawn as a route with each member as a stop; a yellow pot disc slides to the next stop when a round closes.
  - High-contrast yellow, ultramarine and ink keep it legible in market sunlight.
- **Testing:**
  - 35 unit tests: redaction, URI validation, proofs, vault, NIP-44, rotation, auction, advisor, multi-device merge, currencies.
  - A live end-to-end test: real faucet wallets → real Lightning payments → ledger read back from Nostr.

## Challenges we ran into
- **Making the bid fair, not just possible.** Reverse-auction tontines can exploit a member in distress. We capped and flagged steep discounts, and only allow a bid before anyone has paid.
- **Keeping secrets secret in a browser.** Wallet connection strings can spend money. We keep them in memory only, redact them from every log and error, and encrypt them only when the user chooses to keep them.
- **Offline markets.** Relays and networks drop. We made the phone the source of truth and Nostr the tamper-evident backup, with an outbox that publishes later.
- **One design for two continents.** We looked for a visual language that Dakar and Mumbai vendors both know by heart, and found it in hand-painted buses and trucks.

## Accomplishments that we're proud of
- Real Lightning payments between members settle in about 1–2 seconds with zero fees on test wallets, each with a verified cryptographic proof.
- A full 4-member circle runs end to end: 4 rounds, 12 proven payments, a ledger recoverable from Nostr.
- No custody, no backend, no accounts: it is a static site that costs nothing to host.

## What we learned
- Wallet-to-wallet payments over NWC make "no one holds the pot" an architectural fact, not a promise.
- NIP-44 plus replaceable kind-30078 events make a good tamper-evident, multi-device ledger.
- The best UX for a savings circle respects the ritual people already have: the turn order, the notebook and the WhatsApp update.

## What's next for TontineZap
- Per-member Nostr identities (NIP-07/NIP-46) and private groups (NIP-29/MLS), instead of one shared circle key.
- Hold invoices, so a pot only settles when every member has paid (atomic rounds).
- Reminders over Nostr DMs and WhatsApp on due dates.
- More currencies (KES, NGN, GHS, MXN) and languages (Wolof, Hindi), plus voice prompts.
- Bridges to mobile money (Wave, Orange Money, UPI) for members not yet on Bitcoin.

## Built with
react, typescript, vite, tailwindcss, bitcoin, lightning-network, nostr, nostr-wallet-connect, alby, nip-44, indexeddb, pwa, zod, vercel

## Image gallery
- docs/screenshots/mobile-round.png: round in progress, phone
- docs/screenshots/mobile-complete.png: round complete, the pot moves to the next stop
- docs/screenshots/mobile-home.png: home screen with the route plate
- docs/screenshots/desktop.png: laptop dashboard
