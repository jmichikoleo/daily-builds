// tests/serialize.test.js
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { recipes, categories } from "../src/recipes.js";
import { serializeRecipes, cleanRecipe, slugify } from "../src/serialize.js";

async function load(text) {
  const dir = mkdtempSync(join(tmpdir(), "recipes-"));
  const file = join(dir, `r${Math.random().toString(36).slice(2)}.js`);
  writeFileSync(file, text);
  return import(pathToFileURL(file).href);
}

describe("serializeRecipes", () => {
  it("writes a file that loads back to the same recipes", async () => {
    const mod = await load(serializeRecipes(recipes.map(cleanRecipe), categories));
    expect(mod.categories).toEqual(categories);
    expect(mod.recipes).toEqual(recipes.map(cleanRecipe));
    expect(mod.recipes[0].ingredients[1].item).toBe("glutinous rice flour · 찹쌀가루");
  });

  it("survives quotes, backslashes and new lines in text", async () => {
    const tricky = cleanRecipe({
      slug: "t", title: 'Mom\'s "best" \\ cake', category: "Sweet",
      ingredients: [{ amount: "", item: "a ${not code}" }], steps: ["line one\nline two"],
    });
    const mod = await load(serializeRecipes([tricky], ["Sweet"]));
    expect(mod.recipes[0]).toEqual(tricky);
  });
});

describe("cleanRecipe", () => {
  it("trims text and drops empty rows and empty optional fields", () => {
    expect(
      cleanRecipe({
        slug: " a ", title: " A ", category: "Sweet", subtitle: "  ", featured: false, draft: true,
        ingredients: [{ amount: " 1 ", item: " egg " }, { amount: "2", item: "" }],
        steps: ["  mix ", ""],
      })
    ).toEqual({
      slug: "a", title: "A", category: "Sweet", draft: true,
      ingredients: [{ amount: "1", item: "egg" }], steps: ["mix"],
    });
  });
});

describe("slugify", () => {
  it("makes link names", () => {
    expect(slugify("Mochi brownies")).toBe("mochi-brownies");
    expect(slugify("  Crème brûlée!! ")).toBe("creme-brulee");
    expect(slugify("떡볶이")).toBe("");
  });
});
