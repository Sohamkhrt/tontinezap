/**
 * Tontine Health & Fairness Advisor — the "AI Group Treasurer".
 *
 * Deliberately deterministic and on-device: no data ever leaves the phone, it
 * runs offline on a 3G handset, and every recommendation is explainable to a
 * non-technical member. The scoring model encodes classic ROSCA risk research:
 *   - punctuality (late contributions are the #1 early warning sign),
 *   - post-payout default risk (members who already got the pot and stop paying),
 *   - proof quality (cryptographically verified Lightning vs. cash on trust),
 *   - auction fairness (excessive discounts become predatory for urgent borrowers).
 * The same interface could later be backed by an LLM summarizer at the edge.
 */
import {
  collected,
  contributorsFor,
  currentRound,
  isRoundComplete,
  memberById,
  paymentOf,
  potTarget,
  shareFor,
  type Circle,
  type Round,
  circleCurrency,
  circleKind,
} from "./circle";
import { fmtDate, fmtNum, fmtSats, type Lang } from "./i18n";
import { KIND_LABEL, money } from "./money";
import type { Rate } from "./rates";

export type InsightLevel = "good" | "warn" | "risk";
export interface Insight {
  level: InsightLevel;
  text: string;
}

export interface MemberStats {
  memberId: string;
  name: string;
  expected: number;
  paid: number;
  onTime: number;
  late: number;
  overdue: number; // unpaid & past due right now
  lightning: number;
  onTimeRate: number; // 0..1
}

export interface Analysis {
  score: number; // 0..100
  grade: "excellent" | "good" | "fragile" | "atRisk";
  stats: MemberStats[];
  insights: Insight[];
}

const L = (lang: Lang, fr: string, en: string) => (lang === "fr" ? fr : en);

export function memberStats(c: Circle, now = Date.now()): MemberStats[] {
  return c.members.map((m) => {
    const s: MemberStats = { memberId: m.id, name: m.name, expected: 0, paid: 0, onTime: 0, late: 0, overdue: 0, lightning: 0, onTimeRate: 1 };
    for (const r of c.rounds) {
      if (r.recipientId === m.id) continue;
      s.expected++;
      const p = paymentOf(r, m.id);
      if (p) {
        s.paid++;
        if (p.paidAt <= r.dueAt) s.onTime++;
        else s.late++;
        if (p.method === "lightning" && p.verified) s.lightning++;
      } else if (now > r.dueAt) s.overdue++;
    }
    const judged = s.paid + s.overdue;
    s.onTimeRate = judged ? s.onTime / judged : 1;
    return s;
  });
}

export function analyze(c: Circle, lang: Lang, now = Date.now()): Analysis {
  const stats = memberStats(c, now);
  const insights: Insight[] = [];
  const totalPaid = stats.reduce((a, s) => a + s.paid, 0);
  const totalJudged = stats.reduce((a, s) => a + s.paid + s.overdue, 0);
  const onTimeAll = totalJudged ? stats.reduce((a, s) => a + s.onTime, 0) / totalJudged : 1;
  const lnRatio = totalPaid ? stats.reduce((a, s) => a + s.lightning, 0) / totalPaid : 1;
  const r = currentRound(c);
  const progress = potTarget(c, r) ? collected(r) / potTarget(c, r) : 0;
  const synced = c.ledgerAcks && c.ledgerAcks > 0 ? 1 : 0;

  // Post-payout default risk: already received a pot but now overdue.
  const served = new Set(c.rounds.slice(0, -1).map((x) => x.recipientId));
  const postPayoutDefaulters = stats.filter((s) => served.has(s.memberId) && s.overdue > 0);

  let score = 100 * (0.5 * onTimeAll + 0.25 * lnRatio + 0.15 * (r.dueAt < now ? progress : 1) + 0.1 * synced);
  score -= postPayoutDefaulters.length * 15;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade: Analysis["grade"] = score >= 85 ? "excellent" : score >= 70 ? "good" : score >= 50 ? "fragile" : "atRisk";

  // ── Insights ──
  const recipient = memberById(c, r.recipientId)?.name ?? "?";
  const pending = contributorsFor(c, r).filter((m) => !paymentOf(r, m.id));
  if (isRoundComplete(c, r)) {
    insights.push({
      level: "good",
      text: L(lang, `Tour ${r.index + 1} complet : ${recipient} a reçu toute la cagnotte.`, `Round ${r.index + 1} complete: ${recipient} received the full pot.`),
    });
  } else if (pending.length) {
    const daysLeft = Math.ceil((r.dueAt - now) / 86_400_000);
    const names = pending.map((m) => m.name).join(", ");
    insights.push(
      daysLeft >= 0
        ? {
            level: "warn",
            text: L(lang, `${pending.length} cotisation(s) attendue(s) (${names}) — ${daysLeft} jour(s) avant l'échéance. Un rappel amical sur WhatsApp suffit souvent.`,
              `${pending.length} contribution(s) still pending (${names}) — ${daysLeft} day(s) to the deadline. A friendly WhatsApp reminder usually works.`),
          }
        : {
            level: "risk",
            text: L(lang, `Échéance dépassée : ${names} n'ont pas encore payé. Contactez-les avant de lancer le tour suivant.`,
              `Deadline passed: ${names} have not paid yet. Reach out before starting the next round.`),
          },
    );
  }
  for (const s of postPayoutDefaulters) {
    insights.push({
      level: "risk",
      text: L(lang, `Attention : ${s.name} a déjà reçu sa cagnotte mais a ${s.overdue} cotisation(s) en retard. C'est le risque n°1 d'une tontine — discutez-en avec le groupe.`,
        `Warning: ${s.name} already received their pot but has ${s.overdue} overdue contribution(s). This is the #1 tontine risk — discuss it with the group.`),
    });
  }
  const chronicLate = stats.filter((s) => s.late >= 2 && s.onTimeRate < 0.6);
  for (const s of chronicLate)
    insights.push({
      level: "warn",
      text: L(lang, `${s.name} paie souvent en retard (${Math.round(s.onTimeRate * 100)} % à l'heure). Proposez-lui un tour plus tardif.`,
        `${s.name} often pays late (${Math.round(s.onTimeRate * 100)}% on time). Consider giving them a later turn.`),
    });
  const cashCount = c.rounds.flatMap((x) => x.payments).filter((p) => p.method === "cash").length;
  if (cashCount > 0)
    insights.push({
      level: "warn",
      text: L(lang, `${cashCount} paiement(s) en espèces n'ont pas de preuve cryptographique. Le Lightning protège tout le monde, y compris l'organisatrice.`,
        `${cashCount} cash payment(s) have no cryptographic proof. Lightning protects everyone — including the organizer.`),
    });
  else if (totalPaid > 0)
    insights.push({
      level: "good",
      text: L(lang, `100 % des paiements sont prouvés par Lightning : aucune dispute possible sur « qui a payé ».`,
        `100% of payments are proven over Lightning: no possible dispute about "who paid".`),
    });
  if (r.bid && r.bid.discountPct > 10)
    insights.push({
      level: "warn",
      text: L(lang, `Remise de ${r.bid.discountPct} % élevée : au-delà de 10 %, l'enchère devient coûteuse pour un membre en difficulté.`,
        `A ${r.bid.discountPct}% discount is steep: above 10%, bidding becomes costly for a member in distress.`),
    });
  if (!synced)
    insights.push({
      level: "warn",
      text: L(lang, `Registre pas encore confirmé par un relais Nostr. Il est gardé sur ce téléphone et sera envoyé dès que possible.`,
        `Ledger not yet confirmed by a Nostr relay. It is safe on this phone and will be sent as soon as possible.`),
    });

  return { score, grade, stats, insights };
}

// ───────────────────────── Reverse auction ─────────────────────────

export interface AuctionQuote {
  contributors: number;
  normalPot: number;
  recipientGets: number;
  perMemberPays: number;
  perMemberSaves: number;
  totalDividend: number;
}

export function auctionQuote(c: Circle, discountPct: number): AuctionQuote {
  const r = currentRound(c);
  const contributors = contributorsFor(c, r).length;
  const normal = c.contributionSats;
  const perMemberPays = Math.max(1, Math.round(normal * (1 - discountPct / 100)));
  return {
    contributors,
    normalPot: normal * contributors,
    recipientGets: perMemberPays * contributors,
    perMemberPays,
    perMemberSaves: normal - perMemberPays,
    totalDividend: (normal - perMemberPays) * contributors,
  };
}

export function fairnessNote(discountPct: number, lang: Lang): Insight {
  if (discountPct <= 5) return { level: "good", text: L(lang, "Remise modérée : équitable pour tous.", "Moderate discount: fair for everyone.") };
  if (discountPct <= 10)
    return { level: "warn", text: L(lang, "Remise acceptable, mais vérifiez que le membre est d'accord sans pression.", "Acceptable, but make sure the member agrees without pressure.") };
  return { level: "risk", text: L(lang, "Remise élevée : risque d'exploiter un membre en urgence. Le groupe devrait plafonner à 10 %.", "Steep discount: risks exploiting a member in distress. The group should cap at 10%.") };
}

// ───────────────────────── Audit summary (WhatsApp-ready) ─────────────────────────

export function auditSummary(c: Circle, round: Round, lang: Lang, rate: Rate, ledgerRef?: string, now = Date.now()): string {
  const recipient = memberById(c, round.recipientId)?.name ?? "?";
  const share = shareFor(c, round);
  const contributors = contributorsFor(c, round);
  const sats = (n: number) => `${money(n, rate, circleCurrency(c), lang)} (${fmtSats(n, lang)})`;
  const a = analyze(c, lang, now);
  const lines: string[] = [];
  lines.push(`📒 ${KIND_LABEL[circleKind(c)]} « ${c.name} » — ${L(lang, "Tour", "Round")} ${round.index + 1}/${c.members.length}`);
  if (c.demo) lines.push(L(lang, "⚠️ Démo — sats de test sans valeur", "⚠️ Demo — test sats, no real value"));
  lines.push(`🎁 ${L(lang, "Bénéficiaire", "Recipient")} : ${recipient}`);
  lines.push(`💰 ${L(lang, "Cotisation", "Contribution")} : ${sats(share)} ${L(lang, "par membre", "per member")}`);
  if (round.discountPct > 0)
    lines.push(`🤝 ${L(lang, "Enchère", "Bid")} : ${recipient} ${L(lang, "a pris la cagnotte avec", "took the pot early at")} ${fmtNum(round.discountPct, lang)} % ${L(lang, "de remise", "discount")} — ${L(lang, "chacun économise", "everyone saves")} ${sats(c.contributionSats - share)}`);
  const paidCount = contributors.filter((m) => paymentOf(round, m.id)).length;
  lines.push(`📊 ${L(lang, "Collecté", "Collected")} : ${paidCount}/${contributors.length} ${L(lang, "membres", "members")} — ${sats(collected(round))}`);
  lines.push("");
  for (const m of contributors) {
    const p = paymentOf(round, m.id);
    if (!p) lines.push(`⏳ ${m.name} — ${L(lang, "en attente", "pending")}${now > round.dueAt ? L(lang, " (en retard)", " (late)") : ""}`);
    else if (p.method === "cash") lines.push(`💵 ${m.name} — ${L(lang, "espèces, noté par l'organisatrice", "cash, recorded by organizer")}`);
    else
      lines.push(`✅ ${m.name} — ${L(lang, "payé", "paid")} ${p.paidAt <= round.dueAt ? L(lang, "à temps", "on time") : L(lang, "en retard", "late")}, ${L(lang, "preuve Lightning", "Lightning proof")} #${p.paymentHash?.slice(0, 8)}`);
  }
  lines.push("");
  lines.push(`❤️ ${L(lang, "Santé du groupe", "Circle health")} : ${a.score}/100`);
  const nextIdx = round.index + 1;
  if (nextIdx < c.members.length) {
    const nextName = memberById(c, c.rotation[nextIdx])?.name;
    if (nextName) lines.push(`➡️ ${L(lang, "Prochain tour", "Next round")} : ${nextName}${round.closedAt || isRoundComplete(c, round) ? "" : ` (${L(lang, "échéance du tour actuel", "current round due")} ${fmtDate(round.dueAt, lang)})`}`);
  }
  if (ledgerRef) lines.push(`🔐 ${L(lang, "Registre vérifiable (Nostr)", "Verifiable ledger (Nostr)")} : ${ledgerRef}`);
  lines.push(L(lang, "— TontineZap · personne ne garde l'argent", "— TontineZap · nobody holds the money"));
  return lines.join("\n");
}
