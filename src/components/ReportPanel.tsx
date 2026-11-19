import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Copy, MessageCircle, Radio, Share2, ShieldCheck } from "lucide-react";
import { Button, Card, Chip, useToast } from "./ui";
import { QrCode } from "./QrCode";
import { fmtSats, useT, type Lang } from "../lib/i18n";
import type { Rate } from "../lib/rates";
import { collected, memberById, paymentOf, contributorsFor, type Circle } from "../lib/circle";
import { auditSummary } from "../lib/advisor";
import { nevent, publishAudit, saveCircle } from "../services/nostrLedger";

export function ReportPanel({ circle, rate, onChange }: { circle: Circle; rate: Rate; onChange: (c: Circle) => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const [roundIdx, setRoundIdx] = useState(circle.rounds.length - 1);
  const [reportLang, setReportLang] = useState<Lang>(lang);
  const [pub, setPub] = useState<{ busy: boolean; acks?: number }>({ busy: false });
  const round = circle.rounds[roundIdx] ?? circle.rounds[circle.rounds.length - 1];
  const ledgerRef = circle.ledgerEventId ? `nostr:${nevent(circle.ledgerEventId, circle.nostr.pubkey)}` : undefined;
  const text = auditSummary(circle, round, reportLang, rate, ledgerRef);
  const recipient = memberById(circle, round.recipientId)?.name ?? "?";

  // Compact, scannable receipt (fits a QR easily; full text goes to WhatsApp).
  const qrText = useMemo(() => {
    const lines = [
      `TontineZap ✓ ${circle.name}`,
      `R${round.index + 1}/${circle.members.length} → ${recipient}: ${collected(round)} sats`,
      ...contributorsFor(circle, round).map((m) => {
        const p = paymentOf(round, m.id);
        return `${m.name} ${p ? (p.method === "cash" ? "cash" : `⚡${p.paymentHash?.slice(0, 10)}`) : "…"}`;
      }),
    ];
    if (ledgerRef) lines.push(ledgerRef);
    return lines.join("\n");
  }, [circle, round, recipient, ledgerRef]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("good", t("copied"));
    } catch {
      toast("risk", t("err_unknown"));
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `TontineZap — ${circle.name}`, text });
      } catch {
        /* user cancelled */
      }
    } else void copy();
  }

  async function toNostr() {
    setPub({ busy: true });
    const r = await publishAudit(circle, round.index, text).catch(() => ({ acks: 0, eventId: "" }));
    setPub({ busy: false, acks: r.acks });
    toast(r.acks ? "good" : "warn", r.acks ? `${t("published")} · ${r.acks}/3 ${t("relays")}` : t("queued"));
    const next = { ...circle, updatedAt: circle.updatedAt };
    await saveCircle(next);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg ">{t("reportTitle")}</h2>
          <div className="flex gap-1" role="group" aria-label="report language">
            {(["fr", "en"] as const).map((l) => (
              <button key={l} aria-pressed={reportLang === l} onClick={() => setReportLang(l)} className={`min-h-10 rounded-lg px-3 text-sm font-bold ${reportLang === l ? "bg-ink text-white" : "bg-paper text-muted"}`}>
                {l === "fr" ? "Français" : "English"}
              </button>
            ))}
          </div>
        </div>
        {circle.rounds.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {circle.rounds.map((r) => (
              <button key={r.index} aria-pressed={roundIdx === r.index} onClick={() => setRoundIdx(r.index)} className={`num min-h-10 rounded-lg px-3 text-sm font-semibold ${roundIdx === r.index ? "bg-ink text-white" : "bg-paper"}`}>
                {t("round")} {r.index + 1}
              </button>
            ))}
          </div>
        )}
        <pre className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere] rounded-xl bg-paper p-3 font-sans text-base leading-relaxed">{text}</pre>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={copy}><Copy className="h-5 w-5" aria-hidden /> {t("copy")}</Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 font-bold text-sun">
            <MessageCircle className="h-5 w-5" aria-hidden /> WhatsApp
          </a>
          <Button variant="secondary" onClick={share}><Share2 className="h-5 w-5" aria-hidden /> Share</Button>
          <Button variant="secondary" onClick={toNostr} loading={pub.busy}><Radio className="h-5 w-5" aria-hidden /> Nostr</Button>
        </div>
        <p className="mt-2 text-sm text-muted">{t("toNostr")}{pub.acks !== undefined && ` — ${pub.acks}/3 ${t("relays")}`}</p>
      </Card>

      <Card className="border-2 border-ink">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg "><ShieldCheck className="h-5 w-5 text-route" aria-hidden /> {t("receiptCard")}</h2>
          {circle.demo && <Chip tone="warn">demo</Chip>}
        </div>
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="w-56 max-w-full shrink-0 rounded-xl bg-white p-2 ring-1 ring-line">
            <QrCode text={qrText} label={t("scanToVerify")} className="h-auto w-full" />
          </div>
          <div className="w-full text-base">
            <p className="font-bold">{circle.name}</p>
            <p className="num">{t("round")} {round.index + 1}/{circle.members.length} → <strong>{recipient}</strong></p>
            <p className="amt sign text-3xl text-route">{fmtSats(collected(round), lang)}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {contributorsFor(circle, round).map((m) => {
                const p = paymentOf(round, m.id);
                return (
                  <li key={m.id} className="num flex justify-between gap-2">
                    <span className="flex items-center gap-1.5">{p ? <CheckCircle2 className="h-4 w-4 text-route" aria-label={t("paid")} /> : <Clock className="h-4 w-4 text-muted" aria-label={t("pending")} />} {m.name}</span>
                    <span className="font-mono text-muted">{p?.paymentHash ? `#${p.paymentHash.slice(0, 8)}` : p ? t("cash") : ""}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-sm text-muted">{t("scanToVerify")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
