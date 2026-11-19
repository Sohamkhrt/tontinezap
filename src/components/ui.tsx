import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { redact } from "../lib/redact";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "sun";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-sun hover:bg-[#2a2a2a] disabled:bg-muted/50 disabled:text-cream",
  sun: "bg-sun text-ink border-2 border-ink hover:bg-sun-deep disabled:opacity-60",
  secondary: "bg-white text-ink border-2 border-ink hover:bg-sun-soft disabled:opacity-50",
  ghost: "bg-transparent text-route underline underline-offset-4 decoration-2 hover:decoration-sun disabled:opacity-50",
  danger: "bg-white text-signal border-2 border-signal hover:bg-signal-soft disabled:opacity-50",
};

export function Button({
  variant = "primary",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold transition-[background-color,filter,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[14px] border-2 border-ink bg-card p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function Chip({ tone, children }: { tone: "good" | "warn" | "risk" | "info"; children: ReactNode }) {
  const t = {
    good: "bg-paid text-white",
    warn: "bg-sun text-ink",
    risk: "bg-signal text-white",
    info: "bg-paper text-ink border border-line",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-bold ${t}`}>{children}</span>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const palette = ["bg-route text-white", "bg-sun text-ink", "bg-ink text-sun", "bg-cream text-ink"];
  const i = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % palette.length;
  const s = size === "lg" ? "h-14 w-14 text-2xl" : "h-10 w-10 text-base";
  return (
    <span aria-hidden className={`sign inline-flex shrink-0 items-center justify-center rounded-full border-2 border-ink ${s} ${palette[i]}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-sm text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-sm font-semibold text-signal">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full min-h-12 rounded-xl border-2 border-line bg-white px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-route focus:outline-none";

export function Progress({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-4 w-full overflow-hidden rounded-full bg-paper ring-1 ring-line">
      <div className="h-full rounded-full bg-route transition-[width] duration-700 ease-[var(--ease-out-expo)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ───────── Toasts (all text passes through redact) ─────────

interface Toast {
  id: number;
  tone: "good" | "risk" | "warn";
  text: string;
}
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, tone, text: redact(text, 200) }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-xl border-2 border-ink px-4 py-3 text-base font-medium ${
              t.tone === "good" ? "bg-ink text-white" : t.tone === "warn" ? "bg-sun text-ink" : "bg-signal text-white"
            }`}
          >
            {t.tone === "good" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : t.tone === "warn" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
