# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: the circle organizer.** The trusted person who already runs a rotating savings circle by hand: the market "présidente" of a Dakar tontine, the auntie who runs the neighbourhood bhishi, the shop owner who keeps the kameti book. She creates the circle, runs each round, makes sure everyone has paid, and reports back to the group (today on paper and WhatsApp). In the demo, one organizer phone runs every member's payment.
- **Secondary: circle members.** Market vendors, tailors, small traders, salaried neighbours. They join through an invite code mostly to verify that their payment is recorded and to see whose turn is next.
- **Evaluators:** Dakar Bitcoin Hack (Btrust) judges, who meet the product through a phone-recorded 3-minute demo video and the deployed URL on a laptop.

## Product Purpose

TontineZap runs rotating savings circles (ROSCAs) on Bitcoin Lightning without anyone holding the pot. Each round, members pay the round's recipient directly from their own wallets (NWC). Every payment carries a cryptographic proof, and the circle's ledger is signed, encrypted and stored on Nostr. Success means an organizer can run a full round, prove who paid, and share a clear report to the group, without carrying cash or the group's trust alone.

## Positioning

Every culture has a savings circle: tontine/natt (West Africa), bhishi/kameti/chit (India), tanda (Mexico), susu (Ghana, Caribbean), hui (China), gye (Korea). TontineZap is the zero-custody version of that shared ritual: money moves peer-to-peer, proof replaces trust in one treasurer, and the ledger can't be lost or quietly edited. Global by design, with **Dakar as its first home** and demo story.

## Operating Context

- Used on mid-range Android phones over 3G, often outdoors in markets in bright daylight; also on laptops by evaluators.
- The ritual: a weekly or monthly collection, a fixed turn order (or an emergency bid to take the pot early at a discount), a handwritten ledger, and an update posted to the group's WhatsApp.
- Hybrid reality: some members still pay cash; the organizer records it, marked as unproven.
- Demo mode provisions 4 disposable test wallets (Awa, Moussa, Fatou, Ibrahima) from the Alby NWC faucet.

## Capabilities and Constraints

- Static client-side PWA (Vite + React + TypeScript + Tailwind 4), $0 hosting, < 200 KB gzipped JS+CSS, offline-first (IndexedDB + outbox).
- Lightning via `@getalby/sdk` NWCClient (make_invoice, pay_invoice, lookup_invoice, get_balance); Nostr via `nostr-tools` (kind 30078, NIP-44 v2).
- Flows: instant demo circle, create circle (own NWC wallets, test wallets, or cash), round dashboard with pay/proof states, emergency bid simulator, on-device treasurer advisor (health score, insights), bilingual audit report + QR receipt, invite/sync, passphrase vault.
- **Circle type label:** the organizer chooses the circle's local name (Tontine, Bhishi, Kameti, Chit, Tanda, Susu, …) and the app uses it in copy.
- **Display currency:** amounts show in a chosen local currency, at minimum XOF (CFA franc, default) and INR, alongside sats. Payments are always denominated in sats.
- Languages: Français and English. Hindi and Wolof are undecided future work.
- Terminology: "circle", "round", "contribution/cotisation", "pot/cagnotte", "recipient/bénéficiaire", "proof".

## Brand Commitments

- Name: **TontineZap** (binding).
- No binding colours, logo or visual style; the previous green/yellow look is replaceable.
- Primary buttons stay jargon-free and money-first ("Contribute 5,000 CFA (13,200 sats)", not "Pay BOLT11").

## Evidence on Hand

- Working end-to-end Lightning flow (verified live: faucet wallets, real payments, proofs, Nostr ledger round-trip).
- No real users, testimonials, partner organizations, usage numbers, or press exist. Never fabricate them.
- Demo names (Awa, Moussa, Fatou, Ibrahima) and demo amounts are synthetic and labelled as test sats.

## Product Principles

1. **Nobody holds the pot.** Every design choice reinforces direct, peer-to-peer payment; never imply custody.
2. **Proof over trust.** Paid status is shown as something verified, and unverified cash is visibly different.
3. **The organizer's ritual, made lighter.** Respect the existing ritual (turn order, the ledger, the WhatsApp update) rather than inventing a new one.
4. **Money in the member's own language.** Local circle name, local currency first, plain words; crypto vocabulary stays out of primary actions.
5. **Works on a cheap phone in the sun.** High contrast, large targets, small bundle, offline-tolerant.

## Accessibility & Inclusion

WCAG 2.2 AA contrast and target sizes; legible in direct sunlight; low-literacy-friendly (icons + plain words, numbers large); bilingual FR/EN; respects reduced motion.
