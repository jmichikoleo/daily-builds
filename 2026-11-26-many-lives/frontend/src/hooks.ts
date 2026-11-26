// frontend/src/hooks.ts: hash routing and a small data loading hook.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useRoute() {
  const read = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path;
}

export function query(name: string) {
  const q = location.hash.split("?")[1] || "";
  return new URLSearchParams(q).get(name);
}

export function useData<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setError(null);
    api
      .get<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => {
        if (!live) return;
        setError(String(e.message || e));
        dispatchEvent(new CustomEvent("ml-error", { detail: String(e.message || e) }));
      });
    return () => {
      live = false;
    };
  }, [path, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload, setData };
}

export function month(m?: string | null) {
  if (!m) return "an unknown time";
  const [y, mm] = m.split("-").map(Number);
  if (!mm) return String(y);
  return new Date(y, mm - 1, 1).toLocaleString("en", { month: "long", year: "numeric" }).toLowerCase();
}

export function day(ts?: string | null) {
  if (!ts) return "undated";
  const d = new Date(ts);
  if (isNaN(+d)) return ts.slice(0, 10);
  return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }).toLowerCase();
}

export function hashNum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}
