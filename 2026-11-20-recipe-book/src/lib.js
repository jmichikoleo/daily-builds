// src/lib.js
// small pure helpers for search, grouping and favorites. no DOM in here so they are easy to test.

export const HOME_LIMIT = 8;
export const FAVORITES_KEY = "mochi-recipe-book:favorites";

function norm(text) {
  return String(text ?? "").normalize("NFC").toLowerCase().trim();
}

// matches title, subtitle, category and ingredient names
export function matches(recipe, query) {
  const q = norm(query);
  if (!q) return true;
  const fields = [
    recipe.title,
    recipe.subtitle,
    recipe.category,
    ...(recipe.ingredients ?? []).map((i) => i.item),
  ];
  return q.split(/\s+/).every((word) => fields.some((f) => norm(f).includes(word)));
}

export function search(recipes, query) {
  return recipes.filter((r) => matches(r, query));
}

// returns [{ name, recipes }] in the order of `order`, then any extra categories alphabetically
export function groupByCategory(recipes, order = []) {
  const names = [...order];
  for (const r of recipes) {
    if (r.category && !names.includes(r.category)) names.push(r.category);
  }
  const extra = names.slice(order.length).sort((a, b) => a.localeCompare(b));
  return [...order, ...extra].map((name) => ({
    name,
    recipes: recipes
      .filter((r) => r.category === name)
      .sort((a, b) => a.title.localeCompare(b.title)),
  }));
}

// the home page index shows at most `limit` recipes. hasMore says whether to show "Browse all recipes".
export function homeSelection(recipes, limit = HOME_LIMIT) {
  return { shown: recipes.slice(0, limit), hasMore: recipes.length > limit };
}

export function findBySlug(recipes, slug) {
  return recipes.find((r) => r.slug === slug) ?? null;
}

export function featuredRecipe(recipes) {
  return recipes.find((r) => r.featured) ?? recipes[0] ?? null;
}

// throws if two recipes share a slug or a recipe misses the basics
export function validate(recipes) {
  const seen = new Set();
  for (const r of recipes) {
    for (const key of ["slug", "title", "category"]) {
      if (!r[key]) throw new Error(`recipe is missing ${key}: ${JSON.stringify(r.title ?? r.slug)}`);
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) throw new Error(`bad slug ${r.slug}`);
    if (seen.has(r.slug)) throw new Error(`duplicate slug ${r.slug}`);
    seen.add(r.slug);
    if (!Array.isArray(r.ingredients) || !Array.isArray(r.steps)) {
      throw new Error(`${r.slug} needs ingredients and steps lists`);
    }
  }
  return true;
}

export function readFavorites(storage) {
  try {
    const list = JSON.parse(storage?.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(storage, slug) {
  const list = readFavorites(storage);
  const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
  try {
    storage?.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    // storage blocked, keep going for this page view
  }
  return next;
}
