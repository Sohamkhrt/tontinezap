import { AlertTriangle, Brain, CheckCircle2, ShieldAlert } from "lucide-react";
import { Card } from "./ui";
import { useT } from "../lib/i18n";
import { analyze } from "../lib/advisor";
import type { Circle } from "../lib/circle";

const gradeLabel = {
  excellent: { fr: "Excellente", en: "Excellent" },
  good: { fr: "Bonne", en: "Good" },
  fragile: { fr: "Fragile", en: "Fragile" },
  atRisk: { fr: "À risque", en: "At risk" },
};

export function AdvisorPanel({ circle }: { circle: Circle }) {
  const { t, lang } = useT();
  const a = analyze(circle, lang);
  const color = a.score >= 85 ? "#0f8a4b" : a.score >= 70 ? "#1c3faa" : a.score >= 50 ? "#8a5a0b" : "#d7261e";
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg ">{t("health")}</h2>
        <p className="mt-1 flex items-baseline gap-3">
          <span className="num sign text-5xl" style={{ color }}>{a.score}</span>
          <span className="text-base text-muted">/ 100 · <strong className="font-bold" style={{ color }}>{gradeLabel[a.grade][lang]}</strong></span>
        </p>
        <div className="mt-3 grid grid-cols-4 gap-1" role="img" aria-label={`${t("health")} ${a.score}/100`}>
          {[50, 70, 85, 100].map((cut, i) => {
            const lo = [0, 50, 70, 85][i];
            const fill = Math.max(0, Math.min(1, (a.score - lo) / (cut - lo)));
            return (
              <span key={cut} className="h-2 overflow-hidden rounded-full bg-paper ring-1 ring-line">
                <span className="block h-full rounded-full" style={{ width: `${fill * 100}%`, background: color }} />
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">
          {lang === "fr" ? "Calculé sur ce téléphone, sans envoyer vos données." : "Computed on this phone — your data never leaves it."}
        </p>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 text-lg "><Brain className="h-5 w-5 text-route" aria-hidden /> {t("insights")}</h2>
        <ul className="mt-3 space-y-2">
          {a.insights.map((i, n) => (
            <li key={n} className={`flex items-start gap-2 rounded-xl p-3 text-base ${i.level === "good" ? "bg-paid-soft" : i.level === "warn" ? "bg-sun-soft" : "bg-signal-soft text-signal"}`}>
              {i.level === "good" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-paid" aria-hidden /> : i.level === "warn" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />}
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg ">{t("punctuality")}</h2>
        <ul className="mt-3 space-y-3">
          {a.stats.map((s) => (
            <li key={s.memberId}>
              <div className="num flex justify-between text-base">
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted">{s.paid}/{s.expected} · {Math.round(s.onTimeRate * 100)}% {t("onTime")}</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper ring-1 ring-line">
                <div className="h-full rounded-full" style={{ width: `${Math.round(s.onTimeRate * 100)}%`, background: s.onTimeRate >= 0.8 ? "#0f8a4b" : s.onTimeRate >= 0.5 ? "#8a5a0b" : "#d7261e" }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
