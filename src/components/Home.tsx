import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, Check, ChevronRight, KeyRound, Loader2, Lock, ShieldCheck, WifiOff, X } from "lucide-react";
import { Button, Chip, inputCls, useToast } from "./ui";
import { RoutePlate, type Stop } from "./RoutePlate";
import { fmtSats, useT } from "../lib/i18n";
import { KIND_LABEL, money } from "../lib/money";
import { satsToFiat, type Fiat, type Rate } from "../lib/rates";
import { classifyError } from "../lib/redact";
import { circleCurrency, circleKind, createCircle, currentRound, isRoundComplete, mergeCircle, servedIds, type Circle } from "../lib/circle";
import type { CircleKind } from "../lib/money";
import { hasVault, listWallets, provisionFaucetWallet, subscribeWallets, unlockVault, walletsVersion } from "../services/nwcService";
import { fetchLedger, newCircleKeys, parseInvite, saveCircle } from "../services/nostrLedger";

const DEMO_SATS = 1000;

interface Demo {
  id: "dakar" | "mumbai";
  members: string[];
  kind: CircleKind;
  currency: Fiat;
  name: { fr: string; en: string };
  city: string;
}

const DEMOS: Record<Demo["id"], Demo> = {
  dakar: {
    id: "dakar",
    members: ["Awa", "Moussa", "Fatou", "Ibrahima"],
    kind: "tontine",
    currency: "XOF",
    name: { fr: "Tontine des vendeuses de Sandaga", en: "Sandaga Market Vendors' Tontine" },
    city: "DAKAR",
  },
  mumbai: {
    id: "mumbai",
    members: ["Priya", "Rahul", "Anjali", "Vikram"],
    kind: "bhishi",
    currency: "INR",
    name: { fr: "Bhishi de la résidence Andheri", en: "Andheri Housing Society Bhishi" },
    city: "MUMBAI",
  },
};

type ProvState = "pending" | "ok" | "fail";

/** Route plate stops for a circle (rotation order). */
export function stopsFor(c: Circle): Stop[] {
  const r = currentRound(c);
  const closed = isRoundComplete(c, r);
  const served = servedIds(c);
  // Once a round's pot is delivered, the recipient's stop is done and the pot heads to the next stop.
  const nextId = closed ? c.rotation[r.index + 1] : r.recipientId;
  return c.rotation.map((id) => {
    const m = c.members.find((x) => x.id === id);
    const state: Stop["state"] = id === nextId ? "now" : served.has(id) && !(id === r.recipientId && !closed) ? "done" : "next";
    return { id, name: m?.name ?? "?", state };
  });
}

export function Home({ circles, rate, onOpen, onCreate }: { circles: Circle[]; rate: Rate; onOpen: (c: Circle) => void; onCreate: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const [prov, setProv] = useState<{ demo: Demo; states: ProvState[] } | null>(null);
  const [invite, setInvite] = useState("");
  const [joining, setJoining] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [pass, setPass] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [preview, setPreview] = useState(0);
  useSyncExternalStore(subscribeWallets, walletsVersion);
  const walletCount = listWallets().length;
  const shown = prov?.demo ?? DEMOS.dakar;

  useEffect(() => {
    hasVault().then(setVaultExists);
    // The hero route demonstrates the mechanism: the pot moves one stop every few seconds.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const iv = setInterval(() => setPreview((p) => (p + 1) % 4), 2600);
    return () => clearInterval(iv);
  }, []);

  const previewStops: Stop[] = shown.members.map((name, i) => ({
    id: name,
    name,
    state: prov ? (prov.states[i] === "ok" ? "done" : i === prov.states.findIndex((s) => s === "pending") ? "now" : "next") : i < preview ? "done" : i === preview ? "now" : "next",
  }));

  async function launchDemo(demo: Demo) {
    setProv({ demo, states: demo.members.map(() => "pending") });
    const ids = await Promise.all(
      demo.members.map(async (name, i) => {
        await new Promise((r) => setTimeout(r, i * 200)); // be gentle with the public faucet
        try {
          const id = await provisionFaucetWallet(`${name} (test)`, 10_000);
          setProv((p) => p && { ...p, states: p.states.map((s, j) => (j === i ? "ok" : s)) });
          return id;
        } catch {
          setProv((p) => p && { ...p, states: p.states.map((s, j) => (j === i ? "fail" : s)) });
          return undefined;
        }
      }),
    );
    if (ids.every((x) => !x)) {
      toast("risk", t("err_network"));
      setProv(null);
      return;
    }
    const circle = createCircle(
      {
        name: demo.name[lang],
        contributionSats: DEMO_SATS,
        contributionFiat: Math.round(satsToFiat(DEMO_SATS, rate, demo.currency)),
        kind: demo.kind,
        currency: demo.currency,
        frequency: "weekly",
        payoutMode: "auction",
        members: demo.members.map((name, i) => ({ name, walletId: ids[i] })),
        demo: true,
      },
      newCircleKeys(),
    );
    await saveCircle(circle);
    setProv(null);
    onOpen(circle);
  }

  async function join() {
    setJoining(true);
    try {
      const { circleId, skHex } = parseInvite(invite);
      const remote = await fetchLedger(circleId, skHex);
      if (!remote) {
        toast("risk", t("err_not_found"));
        return;
      }
      const merged = mergeCircle(circles.find((c) => c.id === circleId), remote);
      const next = { ...merged, lastSyncedAt: Date.now() };
      await saveCircle(next);
      setInvite("");
      onOpen(next);
    } catch (e) {
      toast("risk", (e as Error).message === "bad_invite" ? t("err_bad_invite") : t(`err_${classifyError(e)}`));
    } finally {
      setJoining(false);
    }
  }

  async function unlock() {
    setUnlocking(true);
    try {
      const n = await unlockVault(pass);
      setPass("");
      toast("good", `${n}`);
    } catch {
      toast("risk", t("err_passphrase"));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div>
      {/* Painted body panel */}
      <section className="bg-sun">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-5">
          <h1 className="text-[2rem] leading-[1.08] text-ink sm:text-[2.75rem]">{t("appTagline")}</h1>
          <p className="mt-3 max-w-[46ch] text-[1.05rem] font-medium leading-snug text-ink">{t("heroSub")}</p>
        </div>
      </section>

      <RoutePlate
        className="border-y-2 border-ink"
        title={`${t("routeTitle")} · ${KIND_LABEL[shown.kind].toUpperCase()} · ${shown.city}`}
        stops={previewStops}
        caption={prov ? t("demoProvisioning") : t("routeDemo")}
      />

      <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6">
        <section aria-live="polite">
          {prov ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[14px] border-2 border-ink bg-white p-4">
              {prov.demo.members.map((n, i) => (
                <li key={n} className="flex items-center gap-2 text-base font-semibold">
                  {prov.states[i] === "ok" ? <Check className="pop h-5 w-5 text-paid" strokeWidth={3} aria-hidden /> : prov.states[i] === "fail" ? <X className="h-5 w-5 text-signal" aria-hidden /> : <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />}
                  {n}
                  <span className="sr-only">{prov.states[i] === "ok" ? t("ready") : prov.states[i] === "fail" ? t("failed") : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="min-h-14 flex-1 text-lg" onClick={() => launchDemo(DEMOS.dakar)}>
                {t("demoCta")} <ArrowRight className="h-5 w-5" aria-hidden />
              </Button>
              <Button variant="secondary" className="min-h-14 flex-1" onClick={() => launchDemo(DEMOS.mumbai)}>
                {t("demoCtaIndia")}
              </Button>
            </div>
          )}
          <p className="mt-2 text-sm text-muted">
            {t("demoDesc")} <span className="amt font-bold text-ink">{money(DEMO_SATS, rate, "XOF", lang)} · {money(DEMO_SATS, rate, "INR", lang)} ({fmtSats(DEMO_SATS, lang)})</span>
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-ink">
            <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-route" aria-hidden /> {t("trust1")}</li>
            <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-route" aria-hidden /> {t("trust2")}</li>
            <li className="flex items-center gap-1.5"><WifiOff className="h-4 w-4 text-route" aria-hidden /> {t("trust3")}</li>
          </ul>
        </section>

        {vaultExists && walletCount === 0 && (
          <section className="rounded-[14px] border-2 border-ink bg-sun-soft p-4">
            <h2 className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5" aria-hidden /> {t("unlockTitle")}</h2>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void unlock(); }}>
              <input type="password" autoComplete="current-password" className={inputCls} value={pass} onChange={(e) => setPass(e.target.value)} aria-label={t("passphrase")} placeholder={t("passphrase")} />
              <Button type="submit" loading={unlocking} disabled={pass.length < 8}>{t("unlock")}</Button>
            </form>
          </section>
        )}

        {circles.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg text-route">{t("myCircles")}</h2>
            <ul className="divide-y-2 divide-line overflow-hidden rounded-[14px] border-2 border-ink bg-white">
              {circles.map((c) => {
                const r = currentRound(c);
                const stops = stopsFor(c);
                return (
                  <li key={c.id}>
                    <button onClick={() => onOpen(c)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-sun-soft">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-base font-bold">{c.name}</span>
                          {c.demo && <Chip tone="warn">demo</Chip>}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">
                          {KIND_LABEL[circleKind(c)]} · <span className="num">{t("round")} {r.index + 1}/{c.members.length}</span> · <span className="amt">{money(c.contributionSats, rate, circleCurrency(c), lang)}</span>
                        </span>
                        {/* mini route: one dot per stop */}
                        <span className="mt-2 flex items-center gap-1" aria-hidden>
                          {stops.map((s) => (
                            <span key={s.id} className={`h-2.5 flex-1 rounded-full ${s.state === "done" ? "bg-paid" : s.state === "now" ? "bg-sun ring-2 ring-ink" : "bg-line"}`} />
                          ))}
                        </span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-route" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="divide-y-2 divide-line rounded-[14px] border-2 border-ink bg-white">
          <button onClick={onCreate} className="flex w-full items-center gap-3 rounded-t-[12px] px-4 py-4 text-left transition-colors hover:bg-sun-soft">
            <span className="flex-1">
              <span className="block text-lg font-bold">{t("createTitle")}</span>
              <span className="block text-sm text-muted">{t("createDesc")}</span>
            </span>
            <ArrowRight className="h-5 w-5 text-route" aria-hidden />
          </button>
          <form className="px-4 py-4" onSubmit={(e) => { e.preventDefault(); void join(); }}>
            <label htmlFor="invite" className="block text-lg font-bold">{t("joinTitle")}</label>
            <div className="mt-2 flex gap-2">
              <input id="invite" className={`${inputCls} font-mono text-sm`} value={invite} onChange={(e) => setInvite(e.target.value)} placeholder={t("joinPh")} autoComplete="off" spellCheck={false} autoCapitalize="none" />
              <Button type="submit" variant="secondary" className="shrink-0" loading={joining} disabled={!invite.trim()}>{t("join")}</Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
