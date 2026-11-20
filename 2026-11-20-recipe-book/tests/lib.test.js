// tests/lib.test.js
import { describe, it, expect } from "vitest";
import { recipes, categories } from "../src/recipes.js";
import {
  search,
  groupByCategory,
  homeSelection,
  findBySlug,
  featuredRecipe,
  validate,
  readFavorites,
  toggleFavorite,
  FAVORITES_KEY,
} from "../src/lib.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

const sample = [
  { slug: "b", title: "Mochi brownies", category: "Sweet", subtitle: "The 220 g batch", ingredients: [{ item: "glutinous rice flour · 찹쌀가루" }], steps: [] },
  { slug: "k", title: "Kimchi fried rice", category: "Savory", ingredients: [{ item: "kimchi" }, { item: "rice" }], steps: [] },
  { slug: "s", title: "Sambal", category: "Sauces", ingredients: [{ item: "chili" }], steps: [] },
];

describe("real recipe data", () => {
  it("is valid", () => expect(validate(recipes)).toBe(true));
  it("features one recipe at most", () => {
    expect(recipes.filter((r) => r.featured).length).toBeLessThanOrEqual(1);
  });
  it("only has versions of recipes that exist", () => {
    for (const r of recipes.filter((x) => x.basedOn)) expect(findBySlug(recipes, r.basedOn)).not.toBeNull();
  });
});

describe("search", () => {
  it("matches title, category and ingredient", () => {
    expect(search(sample, "kimchi").map((r) => r.slug)).toEqual(["k"]);
    expect(search(sample, "savory").map((r) => r.slug)).toEqual(["k"]);
    expect(search(sample, "rice").map((r) => r.slug)).toEqual(["b", "k"]);
    expect(search(sample, "찹쌀")).toHaveLength(1);
  });
  it("needs every word to match somewhere", () => {
    expect(search(sample, "rice kimchi").map((r) => r.slug)).toEqual(["k"]);
    expect(search(sample, "rice sambal")).toEqual([]);
  });
  it("returns everything for an empty query and nothing for junk", () => {
    expect(search(sample, "  ")).toHaveLength(3);
    expect(search(sample, "zzz")).toEqual([]);
  });
});

describe("grouping", () => {
  it("keeps starting sections first, even when empty, then adds new ones", () => {
    const groups = groupByCategory([sample[0], sample[2]], categories);
    expect(groups.map((g) => g.name)).toEqual(["Sweet", "Savory", "Sauces"]);
    expect(groups[1].recipes).toEqual([]);
  });
});

describe("home selection", () => {
  it("only offers browse all when something is hidden", () => {
    expect(homeSelection(sample, 8).hasMore).toBe(false);
    expect(homeSelection(sample, 2)).toEqual({ shown: sample.slice(0, 2), hasMore: true });
  });
});

describe("slugs", () => {
  it("finds by slug", () => {
    expect(findBySlug(sample, "k").title).toBe("Kimchi fried rice");
    expect(findBySlug(sample, "nope")).toBeNull();
  });
  it("rejects duplicates and bad slugs", () => {
    expect(() => validate([sample[0], sample[0]])).toThrow(/duplicate/);
    expect(() => validate([{ ...sample[0], slug: "Bad Slug" }])).toThrow(/bad slug/);
  });
});

describe("favorites", () => {
  it("toggles on and off and survives a reread", () => {
    const s = memory();
    expect(readFavorites(s)).toEqual([]);
    toggleFavorite(s, "mochi-brownies");
    expect(readFavorites(s)).toEqual(["mochi-brownies"]);
    toggleFavorite(s, "mochi-brownies");
    expect(readFavorites(s)).toEqual([]);
  });
  it("shrugs off broken or missing storage", () => {
    const s = memory();
    s.setItem(FAVORITES_KEY, "{oops");
    expect(readFavorites(s)).toEqual([]);
    expect(readFavorites(null)).toEqual([]);
    expect(toggleFavorite(null, "x")).toEqual(["x"]);
  });
});
