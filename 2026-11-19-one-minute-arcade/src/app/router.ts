// src/app/router.ts
// a very small history router. four kinds of pages, no library needed.

import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "play"; id: string }
  | { name: "records" }
  | { name: "settings" }
  | { name: "notFound" };

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { name: "home" };
  if (path === "/records") return { name: "records" };
  if (path === "/settings") return { name: "settings" };
  const m = path.match(/^\/play\/([a-z0-9-]+)$/);
  if (m) return { name: "play", id: m[1] };
  return { name: "notFound" };
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("popstate", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("popstate", l);
  };
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === window.location.pathname) return;
  if (opts.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.scrollTo(0, 0);
  notify();
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}
