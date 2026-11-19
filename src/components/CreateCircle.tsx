import { useState } from "react";
import { ArrowLeft, Check, Loader2, Plus, Trash2, Wallet, X } from "lucide-react";
import { z } from "zod";
import { Button, Card, Field, inputCls, useToast } from "./ui";
import { fmtSats, useT } from "../lib/i18n";
import { fiatToSats, FIATS, type Fiat, type Rate } from "../lib/rates";
import { CIRCLE_KINDS, FIAT_LABEL, KIND_HOME, KIND_LABEL, type CircleKind } from "../lib/money";
import { classifyError } from "../lib/redact";
import { createCircle, type Circle, type Frequency, type PayoutMode } from "../lib/circle";
import { checkWallet, forgetWallet, NwcUriSchema, provisionFaucetWallet, registerWallet } from "../services/nwcService";
import { newCircleKeys, saveCircle } from "../services/nostrLedger";

interface Row {
  key: number;
  name: string;
  uri: string;
  walletId?: string; // set when a test wallet was provisioned
  status?: "checking" | "ok" | "fail";
}

const FormSchema = z.object({
  name: z.string().trim().min(1).max(40),
  amount: z.number().int().min(10).max(10_000_000),
  members: z.array(z.object({ name: z.string().trim().min(1).max(40) })).min(3).max(12),
});

let k = 0;
const blank = (name = ""): Row => ({ key: ++k, name, uri: "" });

export function CreateCircle({ rate, onBack, onCreated }: { rate: Rate; onBack: () => void; onCreated: (c: Circle) => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(5000);
  const [kind, setKind] = useState<CircleKind>("tontine");
  const [currency, setCurrency] = useState<Fiat>("XOF");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [mode, setMode] = useState<PayoutMode>("rotation");
  const [rows, setRows] = useState<Row[]>([blank(), blank(), blank()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sats = fiatToSats(amount || 0, rate, currency);

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  async function testWallet(row: Row) {
    patch(row.key, { status: "checking" });
    try {
      const id = await provisionFaucetWallet(`${row.name || "member"} (test)`.slice(0, 40), 10_000);
      patch(row.key, { walletId: id, uri: "", status: "ok" });
    } catch (e) {
      patch(row.key, { status: "fail" });
      toast("risk", t(`err_${classifyError(e)}`));
    }
  }

  async function submit() {
    const parsed = FormSchema.safeParse({ name, amount, members: rows.filter((r) => r.name.trim()) });
    const errs: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        if (i.path[0] === "name") errs.name = t("validationName");
        if (i.path[0] === "amount") errs.amount = t("validationAmount");
        if (i.path[0] === "members") errs.members = t("validationMembers");
      }
    }
    rows.forEach((r) => {
      if (r.uri.trim() && !NwcUriSchema.safeParse(r.uri).success) errs[`uri${r.key}`] = t("err_invalid_uri");
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const created: string[] = [];
    try {
      const members: Array<{ name: string; walletId?: string }> = [];
      for (const r of rows.filter((x) => x.name.trim())) {
        let walletId = r.walletId;
        if (r.uri.trim()) {
          patch(r.key, { status: "checking" });
          walletId = registerWallet(r.uri, r.name);
          created.push(walletId);
          try {
            await checkWallet(walletId);
            patch(r.key, { status: "ok", uri: "" }); // clear secret from the form as soon as it's stored in memory
          } catch (e) {
            patch(r.key, { status: "fail" });
            throw e;
          }
        }
        members.push({ name: r.name, walletId });
      }
      const circle = createCircle(
        { name, contributionSats: sats, contributionFiat: amount, kind, currency, frequency, payoutMode: mode, members, demo: rows.some((r) => r.walletId) },
        newCircleKeys(),
      );
      await saveCircle(circle);
      onCreated(circle);
    } catch (e) {
      created.forEach(forgetWallet);
      toast("risk", t(`err_${classifyError(e)}`));
    } finally {
      setBusy(false);
    }
  }

  const radio = (active: boolean) =>
    `flex-1 rounded-xl border-2 p-3 text-left transition-colors ${active ? "border-ink bg-sun" : "border-line bg-white hover:border-ink"}`;

  return (
    <div>
      <section className="border-b-2 border-ink bg-sun">
        <div className="mx-auto max-w-3xl px-4 pb-5 pt-2">
          <button onClick={onBack} className="-ml-1 flex min-h-10 items-center gap-1 rounded-lg px-1 text-sm font-bold text-ink"><ArrowLeft className="h-5 w-5" aria-hidden /> {t("back")}</button>
          <h1 className="mt-1 text-[1.75rem] leading-[1.1] text-ink">{t("createTitle")}</h1>
        </div>
      </section>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pt-5">
      <Card className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{t("circleType")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CIRCLE_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); if (["bhishi", "kameti", "chit"].includes(k)) setCurrency("INR"); else if (k === "tontine") setCurrency("XOF"); }} className={radio(kind === k)}>
                <span className="block font-bold">{KIND_LABEL[k]}</span>
                <span className="block text-xs text-muted">{KIND_HOME[k][lang]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t("circleName")} error={errors.name}>
          <input className={inputCls} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={kind === "tontine" ? "Tontine du marché HLM" : `${KIND_LABEL[kind]} …`} />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-bold">{t("displayCurrency")}</legend>
          <div className="flex gap-2">
            {FIATS.map((f) => (
              <button key={f} type="button" aria-pressed={currency === f} onClick={() => setCurrency(f)} className={radio(currency === f)}>
                <span className="font-bold">{FIAT_LABEL[f][lang]}</span>
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm text-muted">{t("paymentsInSats")}</p>
        </fieldset>
        <Field label={t("contribution")} hint={`≈ ${fmtSats(sats, lang)}`} error={errors.amount}>
          <div className="relative">
            <input className={`${inputCls} num pr-20`} inputMode="numeric" value={amount || ""} onChange={(e) => setAmount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted">{currency === "INR" ? "₹" : "FCFA"}</span>
          </div>
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("frequency")}</legend>
          <div className="flex gap-2">
            {(["weekly", "monthly"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={frequency === f} onClick={() => setFrequency(f)} className={radio(frequency === f)}>
                <span className="font-semibold">{t(f)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("payoutMode")}</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            {(["rotation", "auction"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={radio(mode === m)}>
                <span className="block font-semibold">{t(m)}</span>
                <span className="block text-sm text-muted">{t(`${m}Desc`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg text-route">{t("members")}</h2>
        <p className="text-sm text-muted">{t("walletOptional")}</p>
        {errors.members && <p role="alert" className="font-semibold text-signal">{errors.members}</p>}
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="num w-6 text-center font-bold text-muted">{i + 1}</span>
                <input className={inputCls} value={r.name} maxLength={40} placeholder={t("memberName")} aria-label={`${t("memberName")} ${i + 1}`} onChange={(e) => patch(r.key, { name: e.target.value })} />
                {rows.length > 3 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="min-h-12 px-2 text-signal" aria-label="remove">
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-2 pl-8 sm:flex-row">
                {r.walletId ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-route"><Check className="h-4 w-4" aria-hidden /> {t("useTestWallet")} · 10 000 sats</p>
                ) : (
                  <>
                    <input
                      type="password"
                      className={`${inputCls} font-mono text-sm`}
                      value={r.uri}
                      placeholder="nostr+walletconnect://…"
                      aria-label={`${t("walletUri")} — ${r.name || i + 1}`}
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="none"
                      onChange={(e) => patch(r.key, { uri: e.target.value, status: undefined })}
                    />
                    <Button type="button" variant="secondary" className="shrink-0 text-sm" onClick={() => testWallet(r)} loading={r.status === "checking"}>
                      <Wallet className="h-4 w-4" aria-hidden /> {t("useTestWallet")}
                    </Button>
                  </>
                )}
                {r.status === "checking" && <Loader2 className="h-5 w-5 animate-spin" aria-label={t("checking")} />}
                {r.status === "fail" && <X className="h-5 w-5 text-signal" aria-label={t("failed")} />}
              </div>
              {errors[`uri${r.key}`] && <p role="alert" className="mt-1 pl-8 text-sm font-semibold text-signal">{errors[`uri${r.key}`]}</p>}
            </li>
          ))}
        </ol>
        {rows.length < 12 && (
          <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}><Plus className="h-5 w-5" aria-hidden /> {t("addMember")}</Button>
        )}
      </Card>
      <Button className="w-full text-lg" onClick={submit} loading={busy}>{t("create")}</Button>
      </div>
    </div>
  );
}
