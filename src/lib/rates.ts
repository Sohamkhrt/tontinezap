/**
 * Display-currency rates. Payments are ALWAYS denominated in sats; fiat is
 * informational. Supported display currencies: XOF (CFA franc, pegged to the
 * euro at 655.957) and INR.
 * Fallback chain: CoinGecko (XOF+INR in one call) -> mempool.space (EUR→XOF via
 * the peg, USD→INR via an approximate FX) -> last cached -> offline constants.
 */
export type Fiat = "XOF" | "INR";
export const FIATS: Fiat[] = ["XOF", "INR"];
export const XOF_PER_EUR = 655.957;
const INR_PER_USD_APPROX = 85; // fallback only, when CoinGecko is unreachable
/** Offline fallbacks (Nov 2026 ≈ 57,700 EUR / 63,300 USD per BTC). */
export const OFFLINE_XOF_PER_BTC = 37_900_000;
export const OFFLINE_INR_PER_BTC = 5_400_000;
const CACHE_KEY = "tz.rate.v2"; // public price data, fine in localStorage

export type RateSource = "live" | "cached" | "offline";
export interface Rate {
  xofPerBtc: number;
  inrPerBtc: number;
  source: RateSource;
  at: number;
}

const perBtc = (r: Rate, cur: Fiat) => (cur === "INR" ? r.inrPerBtc : r.xofPerBtc);
export const satsToFiat = (sats: number, r: Rate, cur: Fiat) => (sats * perBtc(r, cur)) / 1e8;
export const fiatToSats = (amount: number, r: Rate, cur: Fiat) => Math.max(1, Math.round((amount * 1e8) / perBtc(r, cur)));
/** Back-compat helpers (XOF). */
export const satsToXof = (sats: number, r: Rate) => satsToFiat(sats, r, "XOF");
export const xofToSats = (xof: number, r: Rate) => fiatToSats(xof, r, "XOF");

async function fetchJson(url: string, ms = 5000): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const sane = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x > lo && x < hi;
const saneXof = (x: unknown): x is number => sane(x, 1_000_000, 1e12);
const saneInr = (x: unknown): x is number => sane(x, 100_000, 1e11);

export function cachedRate(): Rate {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Rate;
      if (saneXof(p.xofPerBtc) && saneInr(p.inrPerBtc)) return { ...p, source: "cached" };
    }
  } catch {
    /* ignore */
  }
  return { xofPerBtc: OFFLINE_XOF_PER_BTC, inrPerBtc: OFFLINE_INR_PER_BTC, source: "offline", at: 0 };
}

export async function fetchLiveRate(): Promise<Rate> {
  let xof: number | undefined;
  let inr: number | undefined;
  try {
    const j = (await fetchJson("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=xof,inr")) as {
      bitcoin?: { xof?: number; inr?: number };
    };
    if (saneXof(j.bitcoin?.xof)) xof = j.bitcoin!.xof;
    if (saneInr(j.bitcoin?.inr)) inr = j.bitcoin!.inr;
  } catch {
    /* fall through */
  }
  if (xof === undefined || inr === undefined) {
    try {
      const j = (await fetchJson("https://mempool.space/api/v1/prices")) as { EUR?: number; USD?: number };
      if (xof === undefined && typeof j.EUR === "number" && saneXof(j.EUR * XOF_PER_EUR)) xof = j.EUR * XOF_PER_EUR;
      if (inr === undefined && typeof j.USD === "number" && saneInr(j.USD * INR_PER_USD_APPROX)) inr = j.USD * INR_PER_USD_APPROX;
    } catch {
      /* fall through */
    }
  }
  const base = cachedRate();
  if (xof === undefined && inr === undefined) return base;
  const rate: Rate = { xofPerBtc: xof ?? base.xofPerBtc, inrPerBtc: inr ?? base.inrPerBtc, source: "live", at: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rate));
  } catch {
    /* ignore */
  }
  return rate;
}
