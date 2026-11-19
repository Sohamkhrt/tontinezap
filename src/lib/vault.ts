/**
 * Passphrase vault (Web Crypto only, no dependencies).
 * PBKDF2-SHA256 (600k iterations, OWASP 2023) -> AES-256-GCM.
 * Used to optionally persist NWC connection strings across reloads.
 * Plaintext secrets never touch storage.
 */
export interface SealedBox {
  v: 1;
  alg: "PBKDF2-SHA256/AES-256-GCM";
  iter: number;
  salt: string;
  iv: string;
  ct: string;
}

const ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(plaintext: string, passphrase: string): Promise<SealedBox> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)));
  return { v: 1, alg: "PBKDF2-SHA256/AES-256-GCM", iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

/** Throws on wrong passphrase (GCM auth tag failure). */
export async function unseal(box: SealedBox, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, unb64(box.salt), box.iter);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(box.iv) as BufferSource },
    key,
    unb64(box.ct) as BufferSource,
  );
  return dec.decode(pt);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return bytesToHex(d);
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]*$/i.test(hex) || hex.length % 2) throw new Error("bad hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(u: Uint8Array): string {
  return Array.from(u, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomId(bytes = 8): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}
