import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, Banknote, BarChart3, Brain, CalendarClock, Check, ExternalLink, FileText, Gavel, Loader2, ShieldCheck, Users, Zap } from "lucide-react";
import { Button, Chip, useToast } from "./ui";
import { RoutePlate } from "./RoutePlate";
import { stopsFor } from "./Home";
import { BidPanel } from "./BidPanel";
import { AdvisorPanel } from "./AdvisorPanel";
import { ReportPanel } from "./ReportPanel";
import { CirclePanel } from "./CirclePanel";
import { fmtDate, fmtDateTime, fmtSats, useT, type TKey } from "../lib/i18n";
import { fiatParts, KIND_LABEL, money } from "../lib/money";
import { satsToFiat, type Rate } from "../lib/rates";
import { classifyError } from "../lib/redact";
import {
  circleCurrency,
  circleKind,
  collected,
  contributorsFor,
  currentRound,
  fmtReceipt,
  isCircleComplete,
  isRoundComplete,
  memberById,
  paymentOf,
  potTarget,
  receiptNo,
  shareFor,
  startNextRound,
  type Circle,
} from "../lib/circle";
import { getBalanceSats, hasVault, hasWallet, provisionFaucetWallet, subscribeWallets, walletsVersion } from "../services/nwcService";
import { njumpUrl } from "../services/nostrLedger";
import { commit, payShare, recordCash, type PayStep } from "../services/tontine";

type Tab = "round" | "bid" | "advisor" | "report" | "circle";
const TABS: Array<{ id: Tab; label: TKey; icon: typeof Zap }> = [
  { id: "round", label: "tabRound", icon: BarChart3 },
  { id: "bid", label: "tabBid", icon: Gavel },
  { id: "advisor", label: "tabAdvisor", icon: Brain },
  { id: "report", label: "tabReport", icon: FileText },
  { id: "circle", label: "tabCircle", icon: Users },
];

const STEPS: Array<{ id: PayStep; label: TKey }> = [
  { id: "invoice", label: "stepInvoice" },
  { id: "paying", label: "stepPaying" },
  { id: "verifying", label: "stepVerifying" },
  { id: "publishing", label: "stepPublishing" },
];

export interface DashboardProps {
  circle: Circle;
  rate: Rate;
  onChange: (c: Circle) => void;
  onPersist: (c: Circle) => Promise<void>;
  onDelete: () => void;
  onBack: () => void;
}

export function Dashboard({ circle, rate, onChange, onPersist, onDelete, onBack }: DashboardProps) {
  const { t, lang } = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("round");
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [paying, setPaying] = useState<{ memberId: string; step: PayStep } | null>(null);
  const [batch, setBatch] = useState(false);
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [vaultExists, setVaultExists] = useState(true);
  const latest = useRef(circle);
  latest.current = circle;
  useSyncExternalStore(subscribeWallets, walletsVersion);

  const cur = circleCurrency(circle);
  const round = currentRound(circle);
  const recipient = memberById(circle, round.recipientId)!;
  const share = shareFor(circle, round);
  const target = potTarget(circle, round);
  const got = collected(round);
  const complete = isRoundComplete(circle, round);
  const allDone = isCircleComplete(circle);
  const contributors = contributorsFor(circle, round);
  const xs = (sats: number) => money(sats, rate, cur, lang);
  const pot = fiatParts(satsToFiat(got, rate, cur), cur, lang);
  const anyWallet = circle.members.some((m) => hasWallet(m.walletId));
  const overdue = !complete && Date.now() > round.dueAt;

  const refreshBalances = useCallback(async () => {
    const entries = await Promise.all(
      latest.current.members
        .filter((m) => hasWallet(m.walletId))
        .map(async (m) => [m.id, await getBalanceSats(m.walletId!).catch(() => NaN)] as const),
    );
    setBalances(Object.fromEntries(entries.filter(([, v]) => !Number.isNaN(v))));
  }, []);

  useEffect(() => {
    void refreshBalances();
    hasVault().then(setVaultExists);
    // First publish of a fresh circle (runs in background; never blocks the UI).
    if (!circle.ledgerEventId) commit(circle).then((c) => c.ledgerEventId && onChange({ ...latest.current, ledgerEventId: c.ledgerEventId, ledgerAcks: c.ledgerAcks }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pay(memberId: string): Promise<boolean> {
    setPaying({ memberId, step: "invoice" });
    try {
      const res = await payShare(latest.current, memberId, (step) => setPaying({ memberId, step }), onChange);
      const name = memberById(res.circle, memberId)?.name;
      toast("good", `${name} → ${recipient.name}: ${fmtSats(res.payment.amountSats, lang)} (${(res.ms / 1000).toFixed(1)} s)`);
      return true;
    } catch (e) {
      toast("risk", t(`err_${classifyError(e)}`));
      return false;
    } finally {
      setPaying(null);
      void refreshBalances();
    }
  }

  async function payAll() {
    setBatch(true);
    for (const m of contributorsFor(latest.current, currentRound(latest.current))) {
      if (paymentOf(currentRound(latest.current), m.id) || !hasWallet(m.walletId)) continue;
      if (!(await pay(m.id))) break;
    }
    setBatch(false);
  }

  /** Recover from a failed/missing wallet without leaving the round (demo: fresh faucet wallet). */
  async function attachTestWallet(memberId: string) {
    const m = memberById(latest.current, memberId);
    if (!m) return;
    setProvisioning(memberId);
    try {
      const walletId = await provisionFaucetWallet(`${m.name} (test)`.slice(0, 40), 10_000);
      const next = { ...latest.current, members: latest.current.members.map((x) => (x.id === memberId ? { ...x, walletId } : x)) };
      await onPersist(next);
      void refreshBalances();
    } catch (e) {
      toast("risk", t(`err_${classifyError(e)}`));
    } finally {
      setProvisioning(null);
    }
  }

  async function cash(memberId: string) {
    onChange(await recordCash(latest.current, memberId));
  }

  async function nextRound() {
    const next = startNextRound(latest.current);
    await onPersist(next);
    onChange(await commit(next));
  }

  return (
    <div>
      {/* Painted body panel: which circle this is */}
      <section className="bg-sun">
        <div className="mx-auto flex max-w-3xl items-start gap-2 px-4 pb-3 pt-2 lg:max-w-6xl">
          <button onClick={onBack} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-sun-deep" aria-label={t("back")}>
            <ArrowLeft className="h-6 w-6" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 pt-1.5">
            <h1 className="line-clamp-2 text-[1.2rem] leading-tight text-ink sm:text-[1.5rem]">{circle.name}</h1>
            <p className="mt-1 text-sm font-semibold text-ink">
              {KIND_LABEL[circleKind(circle)]} · {t(circle.frequency)} · <span className="amt">{xs(circle.contributionSats)}</span>
              {circle.demo && <> <Chip tone="info">{t("testShort")}</Chip></>}
            </p>
          </div>
        </div>
      </section>

      {/* The route plate: whose turn it is */}
      <RoutePlate
        wide
        className="border-y-2 border-ink"
        title={`${t("routeTitle")} · ${t("round").toUpperCase()} ${round.index + 1} / ${circle.members.length}`}
        stops={stopsFor(circle)}
        caption={complete && !allDone ? `${t("nextUp")} : ${memberById(circle, circle.rotation[round.index + 1])?.name ?? ""}` : undefined}
      />

      {/* Tabs: bottom bar on phones, sticky strip on wider screens */}
      <nav className="on-dark safe-bottom fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-ink px-2 pt-1.5 sm:sticky sm:top-16 sm:bottom-auto sm:border-t-0 sm:border-b-2 sm:pt-1.5 sm:pb-1.5" aria-label="sections">
        <div role="tablist" className="mx-auto grid max-w-3xl grid-cols-5 gap-1 lg:max-w-6xl">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-bold transition-colors ${tab === id ? "bg-sun text-ink" : "text-cream/80 hover:text-sun"}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {t(label)}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-4 lg:max-w-6xl">
        {anyWallet && !vaultExists && (
          <div className="flex items-center gap-3 rounded-[14px] border-2 border-ink bg-sun-soft p-3 text-sm font-medium">
            <ShieldCheck className="h-5 w-5 shrink-0 text-route" aria-hidden />
            <span className="flex-1">{t("memoryBanner")}</span>
            <button className="font-bold text-route underline decoration-2 underline-offset-4" onClick={() => setTab("circle")}>{t("keepThem")}</button>
          </div>
        )}

        {tab === "round" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <div className="space-y-5 lg:sticky lg:top-[8.5rem]">
            {/* The pot */}
            <section aria-labelledby="pot-h">
              <div className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
                <span id="pot-h">{complete ? `${t("round")} ${round.index + 1} : ${recipient.name} ${t("receivedPot")}` : `${t("nextStop")} : ${recipient.name} ${t("receivesPot")}`}</span>
                <span className={`flex shrink-0 items-center gap-1 ${overdue ? "text-signal" : "text-muted"}`}>
                  <CalendarClock className="h-4 w-4" aria-hidden /> {fmtDate(round.dueAt, lang)}
                </span>
              </div>
              <p className="pot-num amt mt-1.5 text-[2.4rem] leading-none text-signal sm:text-[3.4rem]" aria-label={xs(got)}>
                {pot.pre && <span className="mr-1 align-[0.3em] font-sans text-[0.5em] font-black text-ink">{pot.pre}</span>}
                {pot.num}
                {pot.post && <span className="sign ml-2 align-[0.35em] text-[0.45em] text-ink">{pot.post}</span>}
              </p>
              <p className="num mt-1.5 text-sm font-semibold text-muted">
                {t("of")} <span className="amt">{xs(target)}</span>{!complete && <> · <span className="amt">{fmtSats(got, lang)} / {fmtSats(target, lang)}</span></>}
                {balances[recipient.id] !== undefined && <span className="hidden sm:inline"> · <span className="amt">{recipient.name} {fmtSats(balances[recipient.id], lang)}</span></span>}
                {round.discountPct > 0 && <> · −{round.discountPct}%</>}
              </p>
              <div className="mt-3 h-3.5 overflow-hidden rounded-full border-2 border-ink bg-paper" role="progressbar" aria-valuenow={Math.round((got / Math.max(1, target)) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t("collected")}>
                <div className="h-full bg-route transition-[width] duration-700 ease-[var(--ease-out-expo)]" style={{ width: `${Math.min(100, (got / Math.max(1, target)) * 100)}%` }} />
              </div>
            </section>

            {complete && (
              <section className="pop rounded-[14px] border-2 border-ink bg-sun p-4">
                <h2 className="text-xl text-ink">{t("roundDone")}</h2>
                <p className="mt-1 text-base font-medium">
                  <strong>{recipient.name}</strong> {t("receivedDirect")} : <span className="amt font-bold">{xs(got)}</span> <span className="amt">({fmtSats(got, lang)})</span>
                </p>
                {allDone ? (
                  <p className="mt-3 font-bold">{t("circleDone")}</p>
                ) : (
                  <Button className="mt-3 w-full" onClick={nextRound}>{t("nextRound")} <ArrowRight className="h-5 w-5" aria-hidden /></Button>
                )}
              </section>
            )}

            {paying && (
              <section aria-live="polite" className="rounded-[14px] border-2 border-ink bg-white p-4">
                <ol className="space-y-2">
                  {STEPS.map((s, i) => {
                    const at = STEPS.findIndex((x) => x.id === paying.step);
                    const state = i < at ? "done" : i === at ? "now" : "todo";
                    return (
                      <li key={s.id} className={`flex items-center gap-3 text-base ${state === "todo" ? "text-muted" : "font-bold"}`}>
                        {state === "done" ? <Check className="h-5 w-5 text-paid" strokeWidth={3} aria-hidden /> : state === "now" ? <Loader2 className="h-5 w-5 animate-spin text-route" aria-hidden /> : <span className="h-5 w-5 rounded-full border-2 border-line" aria-hidden />}
                        {t(s.label)}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            </div>
            <div className="space-y-5">
            {!complete && !hasWallet(recipient.walletId) && (
              <div role="status" className="rounded-[14px] border-2 border-signal bg-signal-soft p-3 text-sm font-medium">
                <p><strong>{recipient.name}</strong> {t("recipientNoWallet")}</p>
                {circle.demo ? (
                  <Button variant="secondary" className="mt-2 min-h-11 py-2 text-sm" loading={provisioning === recipient.id} onClick={() => attachTestWallet(recipient.id)}>{t("addTestWallet")} : {recipient.name}</Button>
                ) : (
                  <Button variant="secondary" className="mt-2 min-h-11 py-2 text-sm" onClick={() => setTab("circle")}>{t("connectInCircle")}</Button>
                )}
              </div>
            )}
            {/* Contributions ledger */}
            <section aria-labelledby="contrib-h">
              <div className="mb-2 flex items-end justify-between">
                <h2 id="contrib-h" className="text-lg text-route">{t("contributors")}</h2>
                <span className="num text-sm font-bold text-muted">{round.payments.length}/{contributors.length}</span>
              </div>
              <ul className="divide-y-2 divide-line rounded-[14px] border-2 border-ink bg-white">
                {contributors.map((m) => {
                  const p = paymentOf(round, m.id);
                  const no = p ? receiptNo(circle, round.index, m.id) : undefined;
                  const late = !p && Date.now() > round.dueAt;
                  const canPay = hasWallet(m.walletId) && hasWallet(recipient.walletId);
                  return (
                    <li key={m.id} className="px-3 py-3 sm:px-4">
                      <div className="flex items-center gap-3">
                        <span className="sign w-[3.6rem] shrink-0 text-[0.7rem] text-muted">{no ? fmtReceipt(no) : "—"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[1.05rem] font-bold leading-tight">{m.name}</p>
                          <p className="text-[0.8rem] leading-snug text-muted sm:truncate">
                            {p ? (
                              <>
                                <span className="amt">{xs(p.amountSats)}</span> · <span className="amt">{fmtDateTime(p.paidAt, lang)}</span> · <span className="amt">{p.method === "lightning" && <ShieldCheck className="mr-0.5 inline h-3.5 w-3.5 align-[-2px] text-paid" aria-hidden />}{p.method === "cash" ? t("cash") : p.verified ? t("proofOk") : t("proof")}</span>
                              </>
                            ) : late ? (
                              <span className="font-bold text-signal">{t("late")}</span>
                            ) : balances[m.id] !== undefined ? (
                              <span className="amt">{t("balance")} {fmtSats(balances[m.id], lang)}</span>
                            ) : hasWallet(m.walletId) ? (
                              "…"
                            ) : (
                              t("noWallet")
                            )}
                          </p>
                        </div>
                        {p ? (
                          <span
                            className={`pop flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink ${p.method === "cash" ? "bg-sun text-ink" : "bg-paid text-white"}`}
                            role="img"
                            aria-label={p.method === "cash" ? t("cash") : t("paid")}
                          >
                            {p.method === "cash" ? <Banknote className="h-4 w-4" aria-hidden /> : <Check className="h-5 w-5" strokeWidth={3.5} aria-hidden />}
                          </span>
                        ) : (
                          !complete &&
                          (hasWallet(m.walletId) ? (
                            <Button className="min-h-11 shrink-0 px-3 py-2 text-sm" onClick={() => pay(m.id)} disabled={!canPay || !!paying} loading={paying?.memberId === m.id}>
                              <span className="amt">{t("contribute")} {xs(share)}</span>
                            </Button>
                          ) : circle.demo ? (
                            <Button variant="secondary" className="min-h-11 shrink-0 px-3 py-2 text-sm" loading={provisioning === m.id} disabled={!!provisioning} onClick={() => attachTestWallet(m.id)}>
                              {t("addTestWallet")}
                            </Button>
                          ) : (
                            <Button variant="secondary" className="min-h-11 shrink-0 px-3 py-2 text-sm" onClick={() => setTab("circle")}>
                              {t("connectInCircle")}
                            </Button>
                          ))
                        )}
                      </div>
                      {!p && !complete && (
                        <button className="ml-[4.35rem] mt-1 flex min-h-9 items-center gap-1 text-sm font-semibold text-route underline decoration-2 underline-offset-4 disabled:opacity-50" onClick={() => cash(m.id)} disabled={!!paying}>
                          <Banknote className="h-4 w-4" aria-hidden /> {t("recordCash")}
                        </button>
                      )}
                      {p && p.method === "lightning" && (
                        <details className="ml-[4.35rem] mt-1 text-sm">
                          <summary className="cursor-pointer font-semibold text-route">{t("proof")}</summary>
                          <dl className="mt-2 space-y-1 break-all rounded-lg bg-paper p-2.5 font-mono text-xs">
                            {p.paymentHash && (<><dt className="font-sans font-bold">payment_hash</dt><dd>{p.paymentHash}</dd></>)}
                            {p.preimage && (<><dt className="font-sans font-bold">preimage · sha256 → hash ✓</dt><dd>{p.preimage.slice(0, 16)}…{p.preimage.slice(-8)}</dd></>)}
                            <dd className="font-sans">{p.recipientConfirmed ? "✓ recipient wallet: settled" : "recipient confirmation pending"}{p.feesSats ? ` · fees ${p.feesSats} sats` : " · 0 fees"}</dd>
                          </dl>
                          {p.receiptEventId && (
                            <p className="mt-1.5">
                              {t("receiptOnNostr")}: {p.relayAcks ? `${p.relayAcks}/3 ${t("relays")}` : t("queued")}{" "}
                              <a className="inline-flex items-center gap-1 font-bold text-route underline" href={njumpUrl(p.receiptEventId, circle.nostr.pubkey)} target="_blank" rel="noopener noreferrer">
                                njump <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            </p>
                          )}
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {circle.demo && !complete && (
              <Button variant="sun" className="w-full" onClick={payAll} loading={batch} disabled={!!paying && !batch}>
                <Zap className="h-5 w-5" fill="currentColor" aria-hidden /> {t("payAll")}
              </Button>
            )}
            </div>
          </div>
        )}

        {tab === "bid" && <BidPanel circle={circle} rate={rate} onApplied={async (c) => { await onPersist(c); onChange(await commit(c)); setTab("round"); }} />}
        {tab === "advisor" && <AdvisorPanel circle={circle} />}
        {tab === "report" && <ReportPanel circle={circle} rate={rate} onChange={onChange} />}
        {tab === "circle" && <CirclePanel circle={circle} onChange={onChange} onPersist={onPersist} onDelete={onDelete} onWalletsChanged={() => { void refreshBalances(); hasVault().then(setVaultExists); }} />}
      </div>
    </div>
  );
}
