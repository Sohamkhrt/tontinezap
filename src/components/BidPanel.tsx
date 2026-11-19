import { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Avatar, Button, Card, useToast } from "./ui";
import { fmtSats, useT } from "../lib/i18n";
import { money } from "../lib/money";
import type { Rate } from "../lib/rates";
import { applyBid, circleCurrency, currentRound, eligibleBidders, memberById, type Circle } from "../lib/circle";
import { auctionQuote, fairnessNote } from "../lib/advisor";

export function BidPanel({ circle, rate, onApplied }: { circle: Circle; rate: Rate; onApplied: (c: Circle) => Promise<void> }) {
  const { t, lang } = useT();
  const toast = useToast();
  const bidders = eligibleBidders(circle);
  const [bidder, setBidder] = useState(bidders[0]?.id ?? "");
  const [pct, setPct] = useState(5);
  const [busy, setBusy] = useState(false);
  const round = currentRound(circle);
  const locked = round.payments.length > 0;
  const live = circle.payoutMode === "auction";
  const q = auctionQuote(circle, pct);
  const note = fairnessNote(pct, lang);
  const both = (s: number) => (
    <span className="num">
      <strong>{money(s, rate, circleCurrency(circle), lang)}</strong> <span className="text-muted">({fmtSats(s, lang)})</span>
    </span>
  );
  const name = memberById(circle, bidder)?.name ?? "—";
  const current = memberById(circle, round.recipientId)?.name;

  async function accept() {
    setBusy(true);
    try {
      await onApplied(applyBid(circle, bidder, pct));
      toast("good", `${name} — −${pct}%`);
    } catch {
      toast("risk", t("bidLocked"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl ">{t("bidTitle")}</h2>
        <p className="mt-2 text-base">{t("bidIntro")}</p>
        {!live && <p className="mt-2 rounded-lg bg-paper p-2 text-sm font-semibold text-muted">{t("bidRotationOnly")}</p>}
      </Card>

      {bidders.length === 0 ? (
        <Card><p>{t("noBidders")}</p></Card>
      ) : (
        <Card className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{t("bidder")}</legend>
            <div className="flex flex-wrap gap-2">
              {bidders.map((m) => (
                <button key={m.id} aria-pressed={bidder === m.id} onClick={() => setBidder(m.id)} className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 ${bidder === m.id ? "border-ink bg-sun-soft" : "border-line bg-white"}`}>
                  <Avatar name={m.name} /> <span className="font-semibold">{m.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-semibold">
              {t("discount")} <span className="num text-2xl font-extrabold text-route">{pct}%</span>
            </span>
            <input type="range" min={0} max={20} step={1} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="mt-2 h-3 w-full accent-[#1c3faa]" />
          </label>

          <dl className="divide-y divide-line rounded-xl border border-line">
            <div className="flex justify-between gap-2 p-3"><dt>{t("normalPot")} ({current})</dt><dd>{both(q.normalPot)}</dd></div>
            <div className="flex justify-between gap-2 bg-sun-soft p-3"><dt className="font-semibold">{name} {t("bidderGets")}</dt><dd>{both(q.recipientGets)}</dd></div>
            <div className="flex justify-between gap-2 p-3"><dt>{t("eachPays")}</dt><dd>{both(q.perMemberPays)}</dd></div>
            <div className="flex justify-between gap-2 p-3"><dt>{t("eachSaves")}</dt><dd>{both(q.perMemberSaves)}</dd></div>
            <div className="flex justify-between gap-2 p-3"><dt>{t("totalDividend")}</dt><dd>{both(q.totalDividend)}</dd></div>
          </dl>

          <p className={`flex items-start gap-2 rounded-xl p-3 text-sm font-medium ${note.level === "good" ? "bg-paid-soft" : note.level === "warn" ? "bg-sun-soft" : "bg-signal-soft text-signal"}`}>
            {note.level === "good" ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden /> : note.level === "warn" ? <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden /> : <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden />}
            {note.text}
          </p>

          {locked ? (
            <p className="text-sm font-semibold text-signal">{t("bidLocked")}</p>
          ) : (
            live && <Button className="w-full" onClick={accept} loading={busy} disabled={!bidder}>{t("acceptBid")} — {name}, −{pct}%</Button>
          )}
        </Card>
      )}
    </div>
  );
}
