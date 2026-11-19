import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ui";
import { log } from "./lib/redact";

// Global safety net: never let an unhandled error print a raw secret.
window.addEventListener("unhandledrejection", (e) => {
  e.preventDefault();
  log.error("unhandled rejection", e.reason);
});
window.addEventListener("error", (e) => {
  log.error("uncaught", e.error ?? e.message);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
