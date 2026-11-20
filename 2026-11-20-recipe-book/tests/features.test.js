// tests/features.test.js
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  search,
  collectionsOf,
  inCollection,
  nestVersions,
  versionsOf,
  parentOf,
  uniqueSlug,
  safeLink,
  linkHost,
  validate,
} from "../src/lib.js";
import { cleanRecipe, serializeRecipes } from "../src/serialize.js";
import { readCookState } from "../src/cook.js";

const base = (o) => ({ category: "Sweet", ingredients: [], steps: [], ...o });
const book = [
  base({ slug: "og-brownie", title: "OG Brownie", collections: ["Bakes"] }),
  base({ slug: "og-brownie-220", title: "220 g batch", basedOn: "og-brownie", collections: ["Bakes"], outcome: "fudgier" }),
  base({ slug: "crispy-rice", title: "Crispy rice salad", category: "Savory", collections: ["Things to Try", "Weeknight Dinners"] }),
];

describe("collections", () => {
  it("lists every collection once, a to z", () => {
    expect(collectionsOf(book)).toEqual(["Bakes", "Things to Try", "Weeknight Dinners"]);
  });
  it("filters by collection and searches them", () => {
    expect(inCollection(book, "Bakes").map((r) => r.slug)).toEqual(["og-brownie", "og-brownie-220"]);
    expect(inCollection(book, "")).toHaveLength(3);
    expect(search(book, "weeknight").map((r) => r.slug)).toEqual(["crispy-rice"]);
  });
});

describe("versions", () => {
  it("finds versions and the original", () => {
    expect(versionsOf(book, "og-brownie").map((r) => r.slug)).toEqual(["og-brownie-220"]);
    expect(parentOf(book, book[1]).slug).toBe("og-brownie");
    expect(parentOf(book, book[0])).toBeNull();
  });
  it("tucks versions under their original in the index", () => {
    const rows = nestVersions(book);
    expect(rows.map((r) => r.recipe.slug)).toEqual(["og-brownie", "crispy-rice"]);
    expect(rows[0].versions.map((v) => v.slug)).toEqual(["og-brownie-220"]);
  });
  it("shows a version on its own when the original isn't in the list", () => {
    expect(nestVersions([book[1]]).map((r) => r.recipe.slug)).toEqual(["og-brownie-220"]);
  });
  it("won't let a recipe be a version of itself", () => {
    expect(() => validate([base({ slug: "a", title: "A", basedOn: "a" })])).toThrow(/itself/);
  });
});

describe("helpers", () => {
  it("makes unused link names", () => {
    expect(uniqueSlug(book, "crispy-rice")).toBe("crispy-rice-2");
    expect(uniqueSlug(book, "new-one")).toBe("new-one");
  });
  it("only links real web addresses", () => {
    expect(safeLink("https://example.com/r?x=1")).toBe("https://example.com/r?x=1");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("example.com")).toBeNull();
    expect(linkHost("https://www.bbcgoodfood.com/recipes/x")).toBe("bbcgoodfood.com");
  });
});

describe("saving the new fields", () => {
  it("round trips servings, source, collections, versions and outcome", async () => {
    const r = cleanRecipe({
      ...book[1],
      servings: " makes 16 ",
      source: "https://example.com",
      collections: ["Bakes", " Bakes ", "", "Things to Try"],
    });
    expect(r.collections).toEqual(["Bakes", "Things to Try"]);
    expect(r.servings).toBe("makes 16");
    const dir = mkdtempSync(join(tmpdir(), "recipes-"));
    const file = join(dir, "r.js");
    writeFileSync(file, serializeRecipes([cleanRecipe(book[0]), r], ["Sweet"]));
    const mod = await import(pathToFileURL(file).href);
    expect(mod.recipes[1]).toEqual(r);
    expect(mod.recipes[1].basedOn).toBe("og-brownie");
    expect(mod.recipes[1].outcome).toBe("fudgier");
  });
  it("drops empty collections and versions", () => {
    const r = cleanRecipe(base({ slug: "a", title: "A", collections: [], basedOn: "" }));
    expect(r).not.toHaveProperty("collections");
    expect(r).not.toHaveProperty("basedOn");
  });
});

describe("cook mode memory", () => {
  const recipe = base({ slug: "x", title: "X", ingredients: [{ item: "a" }, { item: "b" }], steps: ["one", "two"] });
  const store = (v) => ({ getItem: () => v });
  it("starts fresh with nothing saved or junk saved", () => {
    expect(readCookState(store(null), recipe)).toEqual({ stage: 0, checked: [] });
    expect(readCookState(store("{oops"), recipe)).toEqual({ stage: 0, checked: [] });
    expect(readCookState(null, recipe)).toEqual({ stage: 0, checked: [] });
  });
  it("keeps the step in range and drops ticks for missing ingredients", () => {
    expect(readCookState(store(JSON.stringify({ stage: 9, checked: [0, 1, 5, "x"] })), recipe)).toEqual({ stage: 3, checked: [0, 1] });
  });
});
