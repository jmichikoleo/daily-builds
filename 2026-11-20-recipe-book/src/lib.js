// src/lib.js
// small pure helpers for search, grouping and favorites. no DOM in here so they are easy to test.

export const HOME_LIMIT = 8;
export const FAVORITES_KEY = "mochi-recipe-book:favorites";

function norm(text) {
  return String(text ?? "").normalize("NFC").toLowerCase().trim();
}

// matches title, subtitle, category, collections and ingredient names
export function matches(recipe, query) {
  const q = norm(query);
  if (!q) return true;
  const fields = [
    recipe.title,
    recipe.subtitle,
    recipe.category,
    ...(recipe.collections ?? []),
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
    if (r.collections !== undefined && !Array.isArray(r.collections)) {
      throw new Error(`${r.slug} collections should be a list`);
    }
    if (r.basedOn && r.basedOn === r.slug) throw new Error(`${r.slug} can't be a version of itself`);
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

// ---------- collections ----------

// every collection used by any recipe, a to z
export function collectionsOf(recipes) {
  return [...new Set(recipes.flatMap((r) => r.collections ?? []))].sort((a, b) => a.localeCompare(b));
}

export function inCollection(recipes, name) {
  if (!name) return recipes;
  return recipes.filter((r) => (r.collections ?? []).includes(name));
}

// ---------- versions ----------

export function versionsOf(recipes, slug) {
  return recipes.filter((r) => r.basedOn === slug);
}

export function parentOf(recipes, recipe) {
  return recipe?.basedOn ? findBySlug(recipes, recipe.basedOn) : null;
}

// for the index. a version sits under its original when both are in the list,
// otherwise it shows as its own row.
export function nestVersions(list) {
  const slugs = new Set(list.map((r) => r.slug));
  return list
    .filter((r) => !(r.basedOn && slugs.has(r.basedOn)))
    .map((recipe) => ({ recipe, versions: list.filter((v) => v.basedOn === recipe.slug) }));
}

// a slug nobody else uses yet, like brownies-2
export function uniqueSlug(recipes, base) {
  const taken = new Set(recipes.map((r) => r.slug));
  const root = base || "recipe";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

// only real web links become clickable
export function safeLink(url) {
  const u = String(url ?? "").trim();
  return /^https?:\/\/[^\s]+$/i.test(u) ? u : null;
}

export function linkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
