import { Component, type ReactNode } from "react";
import { redact, log } from "../lib/redact";

/** Catches render errors. Shows only a redacted message — never secrets, preimages or invoices. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { msg?: string }> {
  state: { msg?: string } = {};
  static getDerivedStateFromError(e: unknown) {
    return { msg: redact(e, 160) };
  }
  componentDidCatch(e: unknown) {
    log.error("render error", e);
  }
  render() {
    if (!this.state.msg) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border-2 border-signal bg-white p-6 text-center">
        <h1 className="text-xl text-signal">Oups — une erreur est survenue / Something went wrong</h1>
        <p className="mt-3 break-words font-mono text-sm text-muted">{this.state.msg}</p>
        <p className="mt-3 text-base">Vos tontines sont sauvegardées sur ce téléphone. / Your circles are saved on this phone.</p>
        <button className="mt-5 min-h-12 rounded-xl bg-ink px-5 font-semibold text-white" onClick={() => location.reload()}>
          Recharger / Reload
        </button>
      </div>
    );
  }
}
