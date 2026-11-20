// src/main.js
// tiny hash router plus the views: home, all recipes, favorites, one recipe and cook mode.
// links look like #/recipe/og-brownie so they work on any static host.
// the studio screens (new, edit, version, quick save, publish) only exist in the dev server.

import "./style.css";
import { recipes, categories } from "./recipes.js";
import { artFor } from "./art.js";
import { renderCook } from "./cook.js";
import {
  search,
  groupByCategory,
  homeSelection,
  findBySlug,
  featuredRecipe,
  validate,
  readFavorites,
  toggleFavorite,
  collectionsOf,
  inCollection,
  nestVersions,
  versionsOf,
  parentOf,
  safeLink,
  linkHost,
} from "./lib.js";

validate(recipes);

const STUDIO = import.meta.env.DEV;
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
let collection = "";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const recipeHref = (r) => `#/recipe/${r.slug}`;
const collectionHref = (c) => `#/recipes?c=${encodeURIComponent(c)}`;

function photoUrl(r) {
  return r.photo ? `./${r.photo.replace(/^\.?\//, "")}` : null;
}

// ---------- shared pieces ----------

function searchField(label = "search recipes") {
  return `
    <div class="search">
      <label class="sr-only" for="q">${label}</label>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <input id="q" type="search" autocomplete="off" placeholder="search titles, collections, ingredients" value="${esc(query)}" />
    </div>`;
}

function collectionChips() {
  const all = collectionsOf(recipes);
  if (!all.length) return "";
  const chip = (value, label) =>
    `<button type="button" class="chip" data-collection="${esc(value)}" aria-pressed="${collection === value}">${esc(label)}</button>`;
  return `<div class="chips" role="group" aria-label="collections">${chip("", "All")}${all.map((c) => chip(c, c)).join("")}</div>`;
}

function rowLink(r, { version = false } = {}) {
  return `
    <a class="row${version ? " row-version" : ""}" href="${recipeHref(r)}">
      ${version ? `<span class="row-arrow" aria-hidden="true">↳</span>` : ""}
      <span class="row-title">${esc(r.title)}</span>
      ${r.subtitle ? `<span class="row-sub">${esc(r.subtitle)}</span>` : ""}
      ${version ? `<span class="sr-only">, a version</span>` : ""}
      ${r.draft ? `<span class="tag">draft</span>` : ""}
      ${favorites.includes(r.slug) ? `<span class="heart" aria-label="saved">♥</span>` : ""}
    </a>`;
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
            ? `<ul class="rows">${nestVersions(g.recipes)
                .map(
                  ({ recipe, versions }) => `
              <li>
                ${rowLink(recipe)}
                ${versions.length ? `<ul class="rows versions">${versions.map((v) => `<li>${rowLink(v, { version: true })}</li>`).join("")}</ul>` : ""}
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
  const what = [query.trim() && `“${esc(query)}”`, collection && `in ${esc(collection)}`].filter(Boolean).join(" ");
  return `
    <div class="empty" role="status">
      <p class="empty-title">no recipes ${what ? `match ${what}` : "here yet"}</p>
      <p>try a title, a collection or an ingredient like 찹쌀가루</p>
      <button type="button" class="btn" data-clear>show everything</button>
    </div>`;
}

function featureTile(r) {
  const photo = photoUrl(r);
  return `
    <a class="feature" href="${recipeHref(r)}">
      <span class="ribbon ribbon-butter" aria-hidden="true"></span>
      <span class="feature-art">${photo ? `<img src="${esc(photo)}" alt="" />` : artFor(r)}</span>
      <span class="feature-text">
        <span class="feature-kicker">${esc(r.category)}</span>
        <span class="feature-title">${esc(r.title)}</span>
        ${r.subtitle ? `<span class="feature-sub">${esc(r.subtitle)}</span>` : ""}
      </span>
    </a>`;
}

// wires the search box and collection chips so only the list re-renders, focus stays put
function bindFilters(renderResults) {
  const input = main.querySelector("#q");
  const out = main.querySelector("[data-results]");
  const paint = () => {
    out.innerHTML = renderResults();
    out.querySelector("[data-clear]")?.addEventListener("click", () => {
      query = "";
      collection = "";
      input.value = "";
      syncChips();
      paint();
      input.focus();
    });
  };
  const syncChips = () => {
    main.querySelectorAll("[data-collection]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.collection === collection)));
    if (location.hash.startsWith("#/recipes")) {
      history.replaceState(null, "", collection ? collectionHref(collection) : "#/recipes");
    }
  };
  input.addEventListener("input", () => {
    query = input.value;
    paint();
  });
  main.querySelectorAll("[data-collection]").forEach((b) =>
    b.addEventListener("click", () => {
      collection = b.dataset.collection;
      syncChips();
      paint();
    })
  );
  paint();
}

const filtered = () => search(inCollection(recipes, collection), query);

// ---------- views ----------

function homeView() {
  const feat = featuredRecipe(recipes);
  main.innerHTML = `
    <div class="page-head">
      <h1 tabindex="-1">Recipe book</h1>
      ${searchField()}
    </div>
    ${STUDIO ? `<p class="studio-quick"><a href="#/quick">+ quick save a link or an idea</a></p>` : ""}
    ${collectionChips()}
    <div class="home-grid">
      ${feat ? featureTile(feat) : ""}
      <div class="index" data-results aria-live="polite"></div>
    </div>`;
  bindFilters(() => {
    if (query.trim() || collection) {
      const hits = filtered();
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
    ${collectionChips()}
    <div class="index index-wide" data-results aria-live="polite"></div>`;
  bindFilters(() => {
    const hits = filtered();
    if (!hits.length) return emptySearch();
    return indexList(hits, { showEmptySections: !query.trim() && !collection });
  });
  return collection ? `${collection} · All recipes` : "All recipes";
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

function notFound() {
  main.innerHTML = `
    <a class="back" href="#/">← back to recipes</a>
    <div class="empty"><h1 tabindex="-1" class="empty-title">this recipe isn’t in the book</h1><p>the link might be old. try the full list instead</p><a class="btn" href="#/recipes">see all recipes</a></div>`;
  return "not found";
}

function recipeView(slug) {
  const r = findBySlug(recipes, slug);
  if (!r) return notFound();
  const saved = favorites.includes(r.slug);
  const photo = photoUrl(r);
  const parent = parentOf(recipes, r);
  const versions = versionsOf(recipes, r.slug);
  const source = safeLink(r.source);
  const canCook = r.ingredients.length || r.steps.length;
  main.innerHTML = `
    <a class="back" href="${parent ? recipeHref(parent) : "#/"}">← ${parent ? `back to ${esc(parent.title)}` : "back to recipes"}</a>
    <article class="card">
      <span class="ribbon ribbon-pink" aria-hidden="true"></span>
      <header class="card-head">
        <p class="kicker">${esc(r.category)}${r.draft ? ` <span class="tag">draft</span>` : ""}</p>
        <h1 tabindex="-1">${esc(r.title)}</h1>
        ${r.subtitle ? `<p class="subtitle">${esc(r.subtitle)}</p>` : ""}
        ${parent ? `<p class="version-of">my version of <a href="${recipeHref(parent)}">${esc(parent.title)}</a></p>` : ""}
        <div class="meta">
          ${r.servings ? `<span>${esc(r.servings)}</span>` : ""}
          ${source ? `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">original recipe at ${esc(linkHost(source))} ↗</a>` : ""}
        </div>
        ${
          r.collections?.length
            ? `<p class="chips small">${r.collections.map((c) => `<a class="chip" href="${collectionHref(c)}">${esc(c)}</a>`).join("")}</p>`
            : ""
        }
        <div class="actions">
          ${canCook ? `<a class="btn primary" href="#/cook/${esc(r.slug)}">Start cooking</a>` : ""}
          <button type="button" class="btn save" aria-pressed="${saved}" data-save>
            <span aria-hidden="true">${saved ? "♥" : "♡"}</span>
            <span>${saved ? "Saved" : "Save recipe"}</span>
          </button>
        </div>
        ${
          STUDIO
            ? `<div class="actions dev-tools">
                <a class="btn" href="#/edit/${esc(r.slug)}">Edit</a>
                <a class="btn" href="#/version/${esc(r.slug)}">Make a version</a>
                <button type="button" class="btn danger" data-delete>Delete</button>
              </div>`
            : ""
        }
      </header>
      ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
      ${r.outcome ? `<div class="outcome"><p class="outcome-label">how it turned out</p><p>${esc(r.outcome)}</p></div>` : ""}
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
      ${
        versions.length || STUDIO
          ? `<section class="my-versions" aria-labelledby="ver-h">
              <h2 id="ver-h">My versions</h2>
              ${
                versions.length
                  ? `<ul>${versions
                      .map(
                        (v) => `<li><a href="${recipeHref(v)}"><span class="row-title">${esc(v.title)}</span>${v.subtitle ? ` <span class="row-sub">${esc(v.subtitle)}</span>` : ""}</a>${
                          v.outcome ? `<p>${esc(v.outcome)}</p>` : ""
                        }</li>`
                      )
                      .join("")}</ul>`
                  : `<p class="quiet">no versions yet. make one to try different amounts and write down how it went</p>`
              }
            </section>`
          : ""
      }
      ${photo ? "" : `<div class="card-art" aria-hidden="true">${artFor(r)}</div>`}
    </article>`;
  main.querySelector("[data-save]").addEventListener("click", () => {
    favorites = toggleFavorite(storage, r.slug);
    const btn = main.querySelector("[data-save]");
    const on = favorites.includes(r.slug);
    btn.setAttribute("aria-pressed", String(on));
    btn.children[0].textContent = on ? "♥" : "♡";
    btn.children[1].textContent = on ? "Saved" : "Save recipe";
  });
  if (STUDIO) {
    main.querySelector("[data-delete]").addEventListener("click", async () => {
      const { deleteRecipe } = await import("./editor.js");
      deleteRecipe(r, recipes, categories);
    });
  }
  return r.title;
}

function cookView(slug) {
  const r = findBySlug(recipes, slug);
  if (!r) return notFound();
  return renderCook(main, r, storage);
}

// studio screens
async function studioView(section, slug) {
  const editor = await import("./editor.js");
  if (section === "publish") return editor.renderPublish(main);
  if (section === "quick") return editor.renderQuick(main, { recipes, categories });
  const found = slug ? findBySlug(recipes, slug) : null;
  if (slug && !found) return notFound();
  if (section === "version") return editor.renderEditor(main, { recipes, categories, versionOf: found });
  return editor.renderEditor(main, { recipe: found, recipes, categories });
}

// ---------- router ----------

let firstRender = true;
let leaveView = null;

async function route() {
  leaveView?.();
  leaveView = null;
  document.body.classList.remove("cooking");
  const [path, qs = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [section, rawSlug] = path.split("/");
  const slug = rawSlug ? decodeURIComponent(rawSlug) : "";
  let title;
  let nav = "";
  if (STUDIO && ["new", "edit", "version", "quick", "publish"].includes(section)) {
    title = await studioView(section, slug);
    nav = section === "publish" ? "publish" : section === "new" || section === "quick" ? "new" : "";
  } else if (section === "recipe" && slug) {
    title = recipeView(slug);
  } else if (section === "cook" && slug) {
    const result = cookView(slug);
    title = typeof result === "string" ? result : result.title;
    leaveView = result.leave ?? null;
  } else if (section === "recipes") {
    collection = new URLSearchParams(qs).get("c") ?? "";
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

if (STUDIO) {
  document
    .querySelector("nav")
    .insertAdjacentHTML(
      "beforeend",
      `<a href="#/new" data-nav="new" class="nav-new">+ New recipe</a><a href="#/publish" data-nav="publish" class="nav-publish">Publish<span class="dot" hidden aria-label="unpublished changes"></span></a>`
    );
  const markUnpublished = async () => {
    const { hasUnpublished } = await import("./editor.js");
    document.querySelector(".nav-publish .dot").hidden = !(await hasUnpublished());
  };
  markUnpublished();
  document.addEventListener("studio:published", markUnpublished);
} else if ("serviceWorker" in navigator) {
  // lets the live site open offline in the kitchen and install to the home screen
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

window.addEventListener("hashchange", route);
route();
