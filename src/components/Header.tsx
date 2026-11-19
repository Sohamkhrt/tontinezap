import { WifiOff } from "lucide-react";
import { useT } from "../lib/i18n";
import { money } from "../lib/money";
import type { Fiat, Rate } from "../lib/rates";

/** The painted body panel: car-rapide yellow with sign-writer wordmark. */
export function Header({ rate, online, onHome, currency, wide = false }: { rate: Rate; online: boolean; onHome: () => void; currency: Fiat; wide?: boolean }) {
  const { t, lang, setLang } = useT();
  const srcLabel = rate.source === "live" ? t("rateLive") : rate.source === "cached" ? t("rateCached") : t("rateOffline");
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-sun text-ink">
      <div className={`mx-auto flex h-16 items-center gap-3 px-4 ${wide ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl"}`}>
        <button onClick={onHome} className="rounded-lg text-left" aria-label="TontineZap — accueil / home">
          <span className="sign block text-[1.4rem] leading-none text-route">
            TONTINE<span className="text-signal">ZAP</span>
          </span>
          <span className="amt mt-1 block text-xs font-semibold text-ink" title={srcLabel}>
            1 000 sats ≈ {money(1000, rate, currency, lang)}
            <span
              className={`ml-1.5 inline-block h-2 w-2 rounded-full border border-ink align-middle ${rate.source === "live" ? "bg-paid" : "bg-cream"}`}
              aria-label={srcLabel}
            />
          </span>
        </button>
        <div className="ml-auto flex items-center gap-3">
          {!online && <WifiOff className="h-5 w-5 text-ink" aria-label="offline" />}
          <div role="group" aria-label="Langue / Language" className="on-dark flex rounded-lg bg-ink p-0.5">
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`min-h-10 min-w-11 rounded-md px-2.5 text-sm font-bold transition-colors ${lang === l ? "bg-sun text-ink" : "text-cream hover:text-sun"}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
