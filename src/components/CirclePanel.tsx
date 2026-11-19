import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, KeyRound, Link2, Lock, RefreshCw, Trash2, Wallet } from "lucide-react";
import { Avatar, Button, Card, Chip, inputCls, useToast } from "./ui";
import { QrCode } from "./QrCode";
import { fmtDateTime, useT } from "../lib/i18n";
import { classifyError } from "../lib/redact";
import { mergeCircle, type Circle } from "../lib/circle";
import {
  checkWallet,
  destroyVault,
  forgetAllWallets,
  forgetWallet,
  hasVault,
  hasWallet,
  lockToVault,
  NwcUriSchema,
  PassphraseSchema,
  provisionFaucetWallet,
  registerWallet,
  subscribeWallets,
  walletsVersion,
} from "../services/nwcService";
import { fetchLedger, flushOutbox, makeInvite, outboxSize, RELAYS } from "../services/nostrLedger";
import { commit } from "../services/tontine";

interface Props {
  circle: Circle;
  onChange: (c: Circle) => void;
  onPersist: (c: Circle) => Promise<void>;
  onDelete: () => void;
  onWalletsChanged: () => void;
}

export function CirclePanel({ circle, onChange, onPersist, onDelete, onWalletsChanged }: Props) {
  const { t, lang } = useT();
  const toast = useToast();
  useSyncExternalStore(subscribeWallets, walletsVersion);
  const [showInvite, setShowInvite] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queued, setQueued] = useState(0);
  const [uris, setUris] = useState<Record<string, string>>({});
  const [busyMember, setBusyMember] = useState<string>();
  const [pass, setPass] = useState("");
  const [vault, setVault] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    outboxSize().then(setQueued);
    hasVault().then(setVault);
  }, []);

  async function sync() {
    setSyncing(true);
    try {
      await flushOutbox();
      const remote = await fetchLedger(circle.id, circle.nostr.skHex);
      const merged = remote ? mergeCircle(circle, remote) : circle;
      const next = await commit({ ...merged, lastSyncedAt: Date.now() });
      onChange(next);
      setQueued(await outboxSize());
      toast(next.ledgerAcks ? "good" : "warn", next.ledgerAcks ? `${t("synced")} · ${next.ledgerAcks}/3 ${t("relays")}` : t("queued"));
    } catch (e) {
      toast("risk", t(`err_${classifyError(e)}`));
    } finally {
      setSyncing(false);
    }
  }

  async function attach(memberId: string, walletId: string) {
    const next = { ...circle, members: circle.members.map((m) => (m.id === memberId ? { ...m, walletId } : m)) };
    await onPersist(next);
    onWalletsChanged();
  }

  async function connect(memberId: string, name: string) {
    const uri = uris[memberId] ?? "";
    if (!NwcUriSchema.safeParse(uri).success) return toast("risk", t("err_invalid_uri"));
    setBusyMember(memberId);
    let id: string | undefined;
    try {
      id = registerWallet(uri, name);
      await checkWallet(id);
      setUris((u) => ({ ...u, [memberId]: "" }));
      await attach(memberId, id);
    } catch (e) {
      if (id) forgetWallet(id);
      toast("risk", t(`err_${classifyError(e)}`));
    } finally {
      setBusyMember(undefined);
    }
  }

  async function testWallet(memberId: string, name: string) {
    setBusyMember(memberId);
    try {
      await attach(memberId, await provisionFaucetWallet(`${name} (test)`.slice(0, 40)));
    } catch (e) {
      toast("risk", t(`err_${classifyError(e)}`));
    } finally {
      setBusyMember(undefined);
    }
  }

  async function lock() {
    if (!PassphraseSchema.safeParse(pass).success) return toast("risk", t("passphrase"));
    setLocking(true);
    try {
      await lockToVault(pass);
      setPass("");
      setVault(true);
      onWalletsChanged();
      toast("good", t("vaultSaved"));
    } finally {
      setLocking(false);
    }
  }

  const invite = makeInvite(circle);

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="flex items-center gap-2 text-lg "><Wallet className="h-5 w-5 text-route" aria-hidden /> {t("wallets")}</h2>
        <ul className="mt-3 space-y-3">
          {circle.members.map((m) => (
            <li key={m.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} />
                <span className="flex-1 font-semibold">{m.name}</span>
                {hasWallet(m.walletId) ? (
                  <>
                    <Chip tone="good"><Check className="h-4 w-4" aria-hidden /> NWC</Chip>
                    <button className="min-h-10 px-2 text-sm font-semibold text-signal underline" onClick={() => { forgetWallet(m.walletId!); onWalletsChanged(); }}>{t("disconnect")}</button>
                  </>
                ) : (
                  <Chip tone="info">{t("noWallet")}</Chip>
                )}
              </div>
              {!hasWallet(m.walletId) && (
                <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void connect(m.id, m.name); }}>
                  <input type="password" className={`${inputCls} font-mono text-sm`} placeholder="nostr+walletconnect://…" aria-label={`${t("walletUri")} — ${m.name}`} autoComplete="off" spellCheck={false} value={uris[m.id] ?? ""} onChange={(e) => setUris((u) => ({ ...u, [m.id]: e.target.value }))} />
                  <Button type="submit" className="shrink-0" loading={busyMember === m.id} disabled={!uris[m.id]}>{t("connect")}</Button>
                  <Button type="button" variant="secondary" className="shrink-0 text-sm" onClick={() => testWallet(m.id, m.name)} disabled={busyMember === m.id}>{t("useTestWallet")}</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg "><Lock className="h-5 w-5 text-route" aria-hidden /> {t("vaultTitle")}</h2>
        <p className="text-base text-muted">{t("vaultDesc")}</p>
        {vault && <p className="flex items-center gap-2 font-semibold text-route"><Check className="h-5 w-5" aria-hidden /> {t("vaultSaved")}</p>}
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void lock(); }}>
          <input type="password" autoComplete="new-password" className={inputCls} placeholder={t("passphrase")} aria-label={t("passphrase")} value={pass} onChange={(e) => setPass(e.target.value)} />
          <Button type="submit" className="shrink-0" loading={locking} disabled={pass.length < 8}><KeyRound className="h-5 w-5" aria-hidden /> {t("lock")}</Button>
        </form>
        <Button variant="danger" className="w-full" onClick={async () => { forgetAllWallets(); await destroyVault(); setVault(false); onWalletsChanged(); }}>
          {t("forgetAll")}
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg "><RefreshCw className="h-5 w-5 text-route" aria-hidden /> Nostr</h2>
        <ul className="space-y-1 text-sm">
          {RELAYS.map((r) => <li key={r} className="font-mono">{r}</li>)}
        </ul>
        <p className="num text-sm text-muted">
          {circle.ledgerAcks !== undefined && `${t("synced")}: ${circle.ledgerAcks}/3 ${t("relays")} · `}
          {circle.lastSyncedAt && `${fmtDateTime(circle.lastSyncedAt, lang)} · `}
          {queued > 0 && `${queued} ${t("queued")}`}
        </p>
        <Button variant="secondary" className="w-full" onClick={sync} loading={syncing}><RefreshCw className="h-5 w-5" aria-hidden /> {t("syncNow")}</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg "><Link2 className="h-5 w-5 text-route" aria-hidden /> {t("invite")}</h2>
        <p className="rounded-xl bg-sun-soft p-3 text-sm font-medium">{t("inviteWarn")}</p>
        {showInvite ? (
          <div className="flex flex-col items-center gap-3">
            <QrCode text={invite} label={t("invite")} className="h-56 w-56 rounded-xl ring-1 ring-line" />
            <button className="w-full break-all rounded-xl bg-paper p-3 text-left font-mono text-xs" onClick={() => navigator.clipboard?.writeText(invite).then(() => toast("good", t("copied")))}>
              {invite}
            </button>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>OK</Button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setShowInvite(true)}>{t("showInvite")}</Button>
        )}
      </Card>

      <Button variant="danger" className="w-full" onClick={() => { if (confirm(t("confirmDelete"))) onDelete(); }}>
        <Trash2 className="h-5 w-5" aria-hidden /> {t("deleteCircle")}
      </Button>
    </div>
  );
}
