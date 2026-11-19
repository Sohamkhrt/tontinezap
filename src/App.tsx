import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { CreateCircle } from "./components/CreateCircle";
import { Dashboard } from "./components/Dashboard";
import { LangContext, translate, type Lang } from "./lib/i18n";
import { cachedRate, fetchLiveRate, type Rate } from "./lib/rates";
import { circleCurrency, type Circle } from "./lib/circle";
import { deleteCircle, flushOutbox, loadCircles, saveCircle } from "./services/nostrLedger";

type View = { name: "home" } | { name: "create" } | { name: "circle"; id: string };

const LANG_KEY = "tz.lang";
const initialLang = (): Lang => {
  try {
    const l = localStorage.getItem(LANG_KEY);
    if (l === "fr" || l === "en") return l;
  } catch {
    /* ignore */
  }
  return navigator.language?.startsWith("en") ? "en" : "fr";
};

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [rate, setRate] = useState<Rate>(cachedRate);
  const [online, setOnline] = useState(navigator.onLine);
  const [circles, setCircles] = useState<Record<string, Circle>>({});
  const [view, setView] = useState<View>({ name: "home" });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `TontineZap — ${translate(lang, "appTagline")}`;
  }, [lang]);

  useEffect(() => {
    loadCircles().then((list) => setCircles(Object.fromEntries(list.map((c) => [c.id, c]))));
    fetchLiveRate().then(setRate);
    flushOutbox().catch(() => {});
    const iv = setInterval(() => fetchLiveRate().then(setRate), 5 * 60_000);
    const on = () => {
      setOnline(true);
      flushOutbox().catch(() => {});
      fetchLiveRate().then(setRate);
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(iv);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const upsert = useCallback((c: Circle) => {
    setCircles((m) => ({ ...m, [c.id]: c }));
  }, []);

  const persist = useCallback(
    async (c: Circle) => {
      upsert(c);
      await saveCircle(c);
    },
    [upsert],
  );

  const remove = useCallback(async (id: string) => {
    await deleteCircle(id);
    setCircles((m) => {
      const { [id]: _drop, ...rest } = m;
      void _drop;
      return rest;
    });
    setView({ name: "home" });
  }, []);

  const open = (c: Circle) => {
    upsert(c);
    setView({ name: "circle", id: c.id });
    window.scrollTo({ top: 0 });
  };

  const active = view.name === "circle" ? circles[view.id] : undefined;

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="min-h-dvh pb-28 sm:pb-12">
        <Header rate={rate} online={online} currency={active ? circleCurrency(active) : "XOF"} wide={!!active} onHome={() => setView({ name: "home" })} />
        {!online && (
          <div role="status" className="bg-ink px-4 py-2 text-center text-sm font-semibold text-sun">
            {translate(lang, "offline")}
          </div>
        )}
        <main>
          {view.name === "home" && (
            <Home circles={Object.values(circles).sort((a, b) => b.updatedAt - a.updatedAt)} rate={rate} onOpen={open} onCreate={() => setView({ name: "create" })} />
          )}
          {view.name === "create" && <CreateCircle rate={rate} onBack={() => setView({ name: "home" })} onCreated={open} />}
          {active && (
            <Dashboard key={active.id} circle={active} rate={rate} onChange={upsert} onPersist={persist} onDelete={() => remove(active.id)} onBack={() => setView({ name: "home" })} />
          )}
        </main>
        <footer className="mx-auto mt-12 max-w-3xl px-4 text-center text-sm font-semibold text-muted">{translate(lang, "footer")}</footer>
      </div>
    </LangContext.Provider>
  );
}
