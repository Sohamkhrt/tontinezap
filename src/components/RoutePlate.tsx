import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

export interface Stop {
  id: string;
  name: string;
  state: "done" | "now" | "next";
}

/**
 * The signature: an ultramarine route plate, painted like the destination
 * board of a car rapide. Members are stops; the yellow pot disc sits on the
 * current recipient and slides to the next stop when a round begins.
 */
export function RoutePlate({ title, stops, caption, className = "", wide: wideLayout = false }: { title: string; stops: Stop[]; caption?: string; className?: string; wide?: boolean }) {
  const n = Math.max(1, stops.length);
  const found = stops.findIndex((s) => s.state === "now");
  const cur = Math.max(0, found);
  const scroller = useRef<HTMLDivElement>(null);
  const wide = n > 6;

  useEffect(() => {
    // Keep the current stop in view when the route is longer than the screen.
    const el = scroller.current;
    if (!el || !wide) return;
    const stopW = el.scrollWidth / n;
    el.scrollTo({ left: Math.max(0, stopW * cur - el.clientWidth / 2 + stopW / 2), behavior: "smooth" });
  }, [cur, n, wide]);

  return (
    <section className={`on-dark bg-route text-cream ${className}`} aria-label={title}>
      <div className={`mx-auto px-4 pb-4 pt-3 ${wideLayout ? "max-w-3xl lg:max-w-6xl" : "max-w-3xl"}`}>
        <p className="sign text-[0.8rem] tracking-[0.04em] text-sun">{title}</p>
        <div ref={scroller} className={`mt-2 ${wide ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : ""}`}>
          <ol className="relative flex" style={wide ? { width: `${n * 68}px` } : undefined}>
            {/* rail between stops */}
            <span aria-hidden className="absolute top-[19px] h-1 rounded bg-cream/45" style={{ left: `${50 / n}%`, right: `${50 / n}%` }} />
            {/* the pot: one yellow disc that travels the route */}
            <span
              aria-hidden
              className={`pot-marker pointer-events-none absolute left-0 top-0 flex justify-center ${found < 0 ? "opacity-0" : ""}`}
              style={{ width: `${100 / n}%`, transform: `translateX(${cur * 100}%)` }}
            >
              <span className="h-10 w-10 rounded-full border-[3px] border-ink bg-sun shadow-[0_0_0_5px_rgb(245_183_0/0.35)]" />
            </span>
            {stops.map((s) => (
              <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center" aria-current={s.state === "now" ? "step" : undefined}>
                <span
                  className={`sign relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-[0.95rem] ${
                    s.state === "done"
                      ? "border-[3px] border-cream bg-paid text-white"
                      : s.state === "now"
                        ? "text-ink"
                        : "border-[3px] border-cream bg-route text-cream"
                  }`}
                >
                  {s.state === "done" ? <Check className="h-5 w-5" strokeWidth={3.5} aria-hidden /> : s.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={`mt-1.5 w-full truncate px-0.5 text-center text-xs font-bold ${s.state === "now" ? "text-sun" : "text-cream"}`}>{s.name}</span>
                <span className="sr-only">{s.state === "done" ? "✓" : s.state === "now" ? "→" : ""}</span>
              </li>
            ))}
          </ol>
        </div>
        {caption && <p className="mt-2 text-sm font-semibold text-cream">{caption}</p>}
      </div>
    </section>
  );
}
