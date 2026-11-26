// frontend/src/api.ts: tiny fetch wrapper. every request says which universe (real or demo) it wants.
// writes carry the x-ml header, the server refuses writes without it.
export type Universe = "real" | "demo";

let universe: Universe = ((): Universe => {
  try {
    return localStorage.getItem("ml-universe") === "demo" ? "demo" : "real";
  } catch {
    return "real";
  }
})();

export function getUniverse() {
  return universe;
}
export function setUniverse(u: Universe) {
  universe = u;
  try {
    localStorage.setItem("ml-universe", u);
  } catch {}
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "x-universe": universe, "x-ml": "1", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = j.detail || j.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  get: <T = any>(p: string) => req<T>("GET", p),
  post: <T = any>(p: string, b: unknown = {}) => req<T>("POST", p, b),
  put: <T = any>(p: string, b: unknown) => req<T>("PUT", p, b),
  del: <T = any>(p: string) => req<T>("DELETE", p),
};

export function exportUrl(fmt: string) {
  return `/api/library/export?fmt=${fmt}&universe=${universe}`;
}
