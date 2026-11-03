"use client";

import { useEffect, useState } from "react";
import { buildCatalog, type PlaceCatalog } from "./search";
import type { RawCatalog } from "./types";

export const CATALOG_URL = "/data/catalog.v1.json";

let pending: Promise<PlaceCatalog> | null = null;

/** Fetch and index the catalog once per page load; later calls reuse it. */
export function loadCatalog(): Promise<PlaceCatalog> {
  if (!pending) {
    pending = fetch(CATALOG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
        return res.json() as Promise<RawCatalog>;
      })
      .then(buildCatalog)
      .catch((err) => {
        pending = null; // allow a retry
        throw err;
      });
  }
  return pending;
}

export type CatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: PlaceCatalog }
  | { status: "error"; retry: () => void };

/** Loads the catalog only where it's used (the passport page), never on the landing page. */
export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadCatalog().then(
      (catalog) => alive && setState({ status: "ready", catalog }),
      () =>
        alive &&
        setState({
          status: "error",
          retry: () => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          },
        }),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);
  return state;
}
