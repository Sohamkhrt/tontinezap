# Security Policy — TontineZap

TontineZap handles wallet connection secrets for community savings groups. We treat security as a core feature, not an add-on.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report privately through GitHub Security Advisories ("Report a vulnerability" on the repository). We aim to acknowledge reports within 72 hours. Please include reproduction steps, and **never include real wallet secrets** in a report.

## Security principles

1. **Zero custody.** TontineZap never receives, pools or forwards funds. Each payment is a direct Lightning payment from the contributor's wallet to the round recipient's wallet via NIP-47 (Nostr Wallet Connect). There is no backend.
2. **Secrets stay in memory.** NWC connection strings (`nostr+walletconnect://…?secret=…`) live only in an in-memory `Map` inside `src/services/nwcService.ts`. They are never written to `localStorage`, `sessionStorage` or IndexedDB in plaintext, never logged, and never rendered back to the UI.
3. **Opt-in encrypted persistence.** If a user chooses "Keep wallets", connection strings are sealed with **PBKDF2-SHA256 (600,000 iterations) → AES-256-GCM** using the Web Crypto API with a random 16-byte salt and 12-byte IV. A wrong passphrase fails GCM authentication, and the plaintext never reaches storage.
4. **Strict input validation.** Every NWC URI is validated with `zod`: the `nostr+walletconnect://` scheme, a 64-hex wallet pubkey, 1–8 `wss://` relays (plain `ws://` only for `localhost`), a 64-hex secret, and a 2048-character cap. Faucet responses go through the same schema. Decrypted ledger snapshots are schema-checked and signature-verified (`verifyEvent`) before use.
5. **Modern encryption.** Ledger, receipt and audit payloads use **NIP-44 v2** (secp256k1 ECDH → HKDF-SHA256 → ChaCha20 + HMAC-SHA256 with length padding) via `nostr-tools/nip44`. Deprecated NIP-04 is not used by the app.
6. **Proof, not trust.** A Lightning contribution is marked paid only after `SHA-256(preimage) === payment_hash` is verified locally. The recipient's wallet is also queried with `lookup_invoice`. Cash payments are explicitly labelled *unverified*.
7. **Redaction everywhere.** `src/lib/redact.ts` strips NWC URIs, `secret=` parameters, `nsec`/`ncryptsec` keys, BOLT11 invoices, 64-hex blobs (preimages and keys) and phone numbers from anything that can reach a log, error boundary or toast. Third-party SDKs receive a silent logger. Production builds do not log.
8. **Hardened delivery.** Deployments send a strict Content-Security-Policy (`script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`), HSTS, `Referrer-Policy: no-referrer`, `nosniff`, a restrictive `Permissions-Policy` and COOP. The app uses no `innerHTML` and no `eval`. Outbound fetches use `credentials: "omit"`.

## Data inventory

| Data | Where | Protection |
|---|---|---|
| NWC connection secret | RAM only (optionally the vault) | AES-256-GCM vault, redaction, never persisted in plaintext |
| Circle key (signs + derives group key) | IndexedDB on member devices; shared by invite | Never published; stripped from snapshots (`publicSnapshot`) |
| Member names, amounts, payment hashes, preimages | IndexedDB + Nostr | Nostr copies are NIP-44 encrypted. Preimages of *settled* invoices are receipts, not spendable secrets. |
| Exchange rate, language | localStorage | Public, non-sensitive |

## Known limitations (v1)

- **Shared circle key.** Anyone with the invite code can read *and* write the ledger. Treat it like a group password. Roadmap: per-member keys and NIP-29/MLS groups.
- **Metadata.** Relays can observe the circle pubkey, event timing and counts, but not contents.
- **Demo faucet wallets** are custodial test wallets with no real value. Never send real funds to them.
- **`connect-src wss:`** stays open in the CSP because users can bring NWC wallets on any relay.
- Use **budget-limited NWC connections** (e.g. Alby Hub "max amount / budget renewal") for real money.

## Testing

`npm test` runs security-relevant unit tests: redaction, URI rejection cases (wrong scheme, short keys, insecure relays, `javascript:`), preimage verification, vault round-trip and wrong-passphrase rejection, NIP-44 cross-key failure, and secret stripping from published snapshots.
