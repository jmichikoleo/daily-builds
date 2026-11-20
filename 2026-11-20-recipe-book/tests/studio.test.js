// tests/studio.test.js
import { describe, it, expect } from "vitest";
import { ART, artKey, artFor } from "../src/art.js";
import { cleanRecipe } from "../src/serialize.js";
import { allowed } from "../studio/plugin.js";

describe("drawings", () => {
  it("uses the recipe's own pick first", () => {
    expect(artKey({ art: "bread", category: "Sweet" })).toBe("bread");
  });
  it("falls back by category, then the plate", () => {
    expect(artKey({ category: "Sweet" })).toBe("whisk");
    expect(artKey({ category: "savory" })).toBe("pot");
    expect(artKey({ category: "Drinks" })).toBe("plate");
    expect(artKey({ art: "nope", category: "Drinks" })).toBe("plate");
  });
  it("every drawing is an svg", () => {
    for (const a of Object.values(ART)) expect(a.svg.trim()).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(artFor({ category: "Savory" })).toBe(ART.pot.svg);
  });
  it("keeps the art field when saving", () => {
    expect(cleanRecipe({ slug: "a", title: "A", category: "Sweet", art: "bread", ingredients: [], steps: [] }).art).toBe("bread");
  });
});

describe("studio access", () => {
  const req = (host, origin) => ({ headers: { host, origin } });
  it("lets in this computer and the tailnet, from the studio page only", () => {
    expect(allowed(req("localhost:4290", "http://localhost:4290"))).toBe(true);
    expect(allowed(req("josephas-mac-mini.tailb457cb.ts.net:8490", "https://josephas-mac-mini.tailb457cb.ts.net:8490"))).toBe(true);
  });
  it("allows a same-site read that has no origin header", () => {
    expect(allowed({ headers: { host: "localhost:4290", "sec-fetch-site": "same-origin" } })).toBe(true);
  });
  it("turns away other sites and other hosts", () => {
    expect(allowed(req("localhost:4290", "https://evil.example"))).toBe(false);
    expect(allowed(req("localhost:4290", undefined))).toBe(false);
    expect(allowed({ headers: { host: "localhost:4290", "sec-fetch-site": "cross-site" } })).toBe(false);
    expect(allowed(req("evil.example", "https://evil.example"))).toBe(false);
    expect(allowed(req("mochis-recipe-book.netlify.app", "https://mochis-recipe-book.netlify.app"))).toBe(false);
  });
});
