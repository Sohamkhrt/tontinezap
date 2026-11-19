/** Circle kinds (local names for the same rotating-savings ritual) and money formatting. */
import { fmtNum, locale, type Lang } from "./i18n";
import { satsToFiat, type Fiat, type Rate } from "./rates";

export const CIRCLE_KINDS = ["tontine", "bhishi", "kameti", "chit", "tanda", "susu", "hui", "gye"] as const;
export type CircleKind = (typeof CIRCLE_KINDS)[number];

export const KIND_LABEL: Record<CircleKind, string> = {
  tontine: "Tontine",
  bhishi: "Bhishi",
  kameti: "Kameti",
  chit: "Chit fund",
  tanda: "Tanda",
  susu: "Susu",
  hui: "Hui",
  gye: "Gye",
};

export const KIND_HOME: Record<CircleKind, { fr: string; en: string }> = {
  tontine: { fr: "Afrique de l'Ouest", en: "West Africa" },
  bhishi: { fr: "Inde", en: "India" },
  kameti: { fr: "Inde, Pakistan", en: "India, Pakistan" },
  chit: { fr: "Inde du Sud", en: "South India" },
  tanda: { fr: "Mexique", en: "Mexico" },
  susu: { fr: "Ghana, Caraïbes", en: "Ghana, Caribbean" },
  hui: { fr: "Chine", en: "China" },
  gye: { fr: "Corée", en: "Korea" },
};

export const FIAT_LABEL: Record<Fiat, { fr: string; en: string }> = {
  XOF: { fr: "Franc CFA (FCFA)", en: "CFA franc (XOF)" },
  INR: { fr: "Roupie (₹)", en: "Rupee (₹)" },
};

export function fmtFiat(n: number, cur: Fiat, lang: Lang): string {
  if (cur === "INR") return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
  return `${fmtNum(Math.round(n), lang)} ${lang === "fr" ? "FCFA" : "CFA"}`;
}

/** Just the number part, for big sign numerals where the unit is set smaller. */
export function fiatParts(n: number, cur: Fiat, lang: Lang): { pre: string; num: string; post: string } {
  if (cur === "INR") return { pre: "₹", num: new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n)), post: "" };
  return { pre: "", num: new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 0 }).format(Math.round(n)), post: lang === "fr" ? "FCFA" : "CFA" };
}

export const money = (sats: number, rate: Rate, cur: Fiat, lang: Lang) => fmtFiat(satsToFiat(sats, rate, cur), cur, lang);
