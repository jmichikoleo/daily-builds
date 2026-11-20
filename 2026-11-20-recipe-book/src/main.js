// src/main.js
// tiny hash router plus the four views: home, all recipes, favorites and one recipe.
// links look like #/recipe/mochi-brownies so they work on any static host.

import "./style.css";
import { recipes, categories } from "./recipes.js";
import { chocolateSvg } from "./chocolate.js";
import {
  search,
  groupByCategory,
  homeSelection,
  findBySlug,
  featuredRecipe,
  validate,
  readFavorites,
  toggleFavorite,
} from "./lib.js";

validate(recipes);

const main = document.getElementById("main");
const SITE = "mochi’s recipe book";

let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
let favorites = readFavorites(storage);
let query = "";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const recipeHref = (r) => `#/recipe/${r.slug}`;

function photoUrl(r) {
  return r.photo ? `./${r.photo.replace(/^\.?\//, "")}` : null;
}

// ---------- shared pieces ----------

function searchField(label = "search recipes") {
  return `
    <div class="search">
      <label class="sr-only" for="q">${label}</label>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <input id="q" type="search" autocomplete="off" placeholder="search titles, categories, ingredients" value="${esc(query)}" />
    </div>`;
}

function indexList(list, { showEmptySections = true } = {}) {
  const groups = groupByCategory(list, categories).filter((g) => showEmptySections || g.recipes.length);
  return groups
    .map(
      (g) => `
      <section class="cat" aria-labelledby="cat-${esc(g.name)}">
        <h2 class="cat-name" id="cat-${esc(g.name)}">${esc(g.name)}</h2>
        ${
          g.recipes.length
            ? `<ul class="rows">${g.recipes
                .map(
                  (r) => `
              <li>
                <a class="row" href="${recipeHref(r)}">
                  <span class="row-title">${esc(r.title)}</span>
                  ${r.subtitle ? `<span class="row-sub">${esc(r.subtitle)}</span>` : ""}
                  ${r.draft ? `<span class="tag">draft</span>` : ""}
                  ${favorites.includes(r.slug) ? `<span class="heart" aria-label="saved">♥</span>` : ""}
                </a>
              </li>`
                )
                .join("")}</ul>`
            : `<p class="quiet">nothing here yet</p>`
        }
      </section>`
    )
    .join("");
}

function emptySearch() {
  return `
    <div class="empty" role="status">
      <p class="empty-title">no recipes match “${esc(query)}”</p>
      <p>try a title, a category or an ingredient like 찹쌀가루</p>
      <button type="button" class="btn" data-clear>clear search</button>
    </div>`;
}

function featureTile(r) {
  const photo = photoUrl(r);
  return `
    <a class="feature" href="${recipeHref(r)}">
      <span class="ribbon ribbon-butter" aria-hidden="true"></span>
      <span class="feature-art">${photo ? `<img src="${esc(photo)}" alt="" />` : chocolateSvg}</span>
      <span class="feature-text">
        <span class="feature-kicker">${esc(r.category)}</span>
        <span class="feature-title">${esc(r.title)}</span>
        ${r.subtitle ? `<span class="feature-sub">${esc(r.subtitle)}</span>` : ""}
      </span>
    </a>`;
}

// wires the search box so typing only re-renders the list, focus stays put
function bindSearch(renderResults) {
  const input = main.querySelector("#q");
  const out = main.querySelector("[data-results]");
  const paint = () => {
    out.innerHTML = renderResults();
    out.querySelector("[data-clear]")?.addEventListener("click", () => {
      query = "";
      input.value = "";
      paint();
      input.focus();
    });
  };
  input.addEventListener("input", () => {
    query = input.value;
    paint();
  });
  paint();
}

// ---------- views ----------

function homeView() {
  const feat = featuredRecipe(recipes);
  main.innerHTML = `
    <div class="page-head">
      <h1 tabindex="-1">Recipe book</h1>
      ${searchField()}
    </div>
    <div class="home-grid">
      ${feat ? featureTile(feat) : ""}
      <div class="index" data-results aria-live="polite"></div>
    </div>`;
  bindSearch(() => {
    if (query.trim()) {
      const hits = search(recipes, query);
      return hits.length ? indexList(hits, { showEmptySections: false }) : emptySearch();
    }
    const { shown, hasMore } = homeSelection(recipes);
    return `${indexList(shown)}${hasMore ? `<a class="browse" href="#/recipes">Browse all recipes →</a>` : ""}`;
  });
  return "Recipe book";
}

function allView() {
  main.innerHTML = `
    <div class="page-head">
      <h1 tabindex="-1">All recipes</h1>
      ${searchField()}
    </div>
    <div class="index index-wide" data-results aria-live="polite"></div>`;
  bindSearch(() => {
    const hits = search(recipes, query);
    if (!hits.length) return emptySearch();
    return indexList(hits, { showEmptySections: !query.trim() });
  });
  return "All recipes";
}

function favoritesView() {
  const saved = recipes.filter((r) => favorites.includes(r.slug));
  main.innerHTML = `
    <div class="page-head">
      <h1 tabindex="-1">Favorites</h1>
    </div>
    <div class="index index-wide">
      ${
        saved.length
          ? indexList(saved, { showEmptySections: false })
          : `<div class="empty"><p class="empty-title">no favorites yet</p><p>open a recipe and tap save recipe to keep it here</p><a class="btn" href="#/recipes">see all recipes</a></div>`
      }
    </div>`;
  return "Favorites";
}

function recipeView(slug) {
  const r = findBySlug(recipes, slug);
  if (!r) {
    main.innerHTML = `
      <a class="back" href="#/">← back to recipes</a>
      <div class="empty"><h1 tabindex="-1" class="empty-title">this recipe isn’t in the book</h1><p>the link might be old. try the full list instead</p><a class="btn" href="#/recipes">see all recipes</a></div>`;
    return "not found";
  }
  const saved = favorites.includes(r.slug);
  const photo = photoUrl(r);
  main.innerHTML = `
    <a class="back" href="#/">← back to recipes</a>
    <article class="card">
      <span class="ribbon ribbon-pink" aria-hidden="true"></span>
      <header class="card-head">
        <p class="kicker">${esc(r.category)}${r.draft ? ` <span class="tag">draft</span>` : ""}</p>
        <h1 tabindex="-1">${esc(r.title)}</h1>
        ${r.subtitle ? `<p class="subtitle">${esc(r.subtitle)}</p>` : ""}
        <button type="button" class="btn save" aria-pressed="${saved}" data-save>
          <span aria-hidden="true">${saved ? "♥" : "♡"}</span>
          <span>${saved ? "Saved" : "Save recipe"}</span>
        </button>
      </header>
      ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
      ${photo ? `<img class="photo" src="${esc(photo)}" alt="${esc(r.title)}" />` : ""}
      <div class="cols">
        <section class="ingredients" aria-labelledby="ing-h">
          <h2 id="ing-h">Ingredients</h2>
          ${
            r.ingredients.length
              ? `<ul>${r.ingredients
                  .map(
                    (i) => `<li><span class="amt ${i.amount ? "" : "amt-missing"}">${i.amount ? esc(i.amount) : "amount tbd"}</span><span>${esc(i.item)}</span></li>`
                  )
                  .join("")}</ul>`
              : `<p class="quiet">no ingredients written yet</p>`
          }
        </section>
        <section class="method" aria-labelledby="method-h">
          <h2 id="method-h">Method</h2>
          ${
            r.steps.length
              ? `<ol>${r.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
              : `<p class="quiet">the steps aren’t written down yet</p>`
          }
        </section>
      </div>
      ${photo ? "" : `<div class="card-art" aria-hidden="true">${chocolateSvg}</div>`}
    </article>`;
  main.querySelector("[data-save]").addEventListener("click", () => {
    favorites = toggleFavorite(storage, r.slug);
    const btn = main.querySelector("[data-save]");
    const on = favorites.includes(r.slug);
    btn.setAttribute("aria-pressed", String(on));
    btn.children[0].textContent = on ? "♥" : "♡";
    btn.children[1].textContent = on ? "Saved" : "Save recipe";
  });
  return r.title;
}

// ---------- router ----------

let firstRender = true;

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [section, slug] = hash.split("/");
  let title;
  let nav = "";
  if (section === "recipe" && slug) {
    title = recipeView(decodeURIComponent(slug));
  } else if (section === "recipes") {
    title = allView();
    nav = "recipes";
  } else if (section === "favorites") {
    title = favoritesView();
    nav = "favorites";
  } else {
    title = homeView();
  }
  document.title = title === "Recipe book" ? SITE : `${title} · ${SITE}`;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (!firstRender) {
    window.scrollTo(0, 0);
    main.querySelector("h1")?.focus({ preventScroll: true });
  }
  firstRender = false;
}

// another tab changed favorites
window.addEventListener("storage", () => {
  favorites = readFavorites(storage);
});
window.addEventListener("hashchange", route);
route();
