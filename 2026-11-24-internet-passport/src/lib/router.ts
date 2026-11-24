// src/lib/router.ts
// tiny hash router. hash routes work on any static host without rewrites.
// #/atlas/sound -> { path: ["atlas", "sound"], query: {} }

import { useEffect, useState } from "react";

export interface Route {
  path: string[];
  query: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [p, q = ""] = raw.split("?");
  const path = p.split("/").filter(Boolean).map(decodeURIComponent);
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(q)) query[k] = v;
  return { path, query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(to: string) {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (location.hash === target) return;
  location.hash = target;
}

export const href = (to: string) => `#${to}`;
