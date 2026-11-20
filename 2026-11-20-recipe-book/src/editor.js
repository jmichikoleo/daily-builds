// src/editor.js
// the add / edit / delete screens. only loaded while `npm run dev` runs,
// because saving writes straight into src/recipes.js on your computer.

import { slugify } from "./serialize.js";
import { ART, artKey } from "./art.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function saveRecipes(recipes, categories) {
  const res = await fetch("/__studio/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipes, categories }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "couldn't save");
}

function ingredientRow(i = { amount: "", item: "" }) {
  return `
    <li class="ed-ing">
      <input aria-label="amount" name="amount" placeholder="amount" value="${esc(i.amount)}" />
      <input aria-label="ingredient" name="item" placeholder="ingredient" value="${esc(i.item)}" />
      <button type="button" class="icon-btn" data-remove aria-label="remove this ingredient">×</button>
    </li>`;
}

function stepRow(s = "", n = 1) {
  return `
    <li class="ed-step">
      <span class="ed-num" aria-hidden="true">${n}</span>
      <textarea aria-label="step" name="step" rows="2" placeholder="what to do">${esc(s)}</textarea>
      <button type="button" class="icon-btn" data-remove aria-label="remove this step">×</button>
    </li>`;
}

// phone photos are huge, so shrink to 1600px wide jpg before sending
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

async function uploadPhoto(file, slug) {
  const blob = await shrink(file);
  const res = await fetch(`/__studio/photo?slug=${encodeURIComponent(slug || "photo")}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || file.type },
    body: blob,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "upload failed");
  return body.photo;
}

// the publish page
export function renderPublish(main) {
  main.innerHTML = `
    <div class="page-head"><h1 tabindex="-1">Publish</h1></div>
    <div class="card publish">
      <p class="lead" data-state>checking...</p>
      <p class="hint">publish builds the site, puts it on mochis-recipe-book.netlify.app and saves your recipes and photos to github. it takes about a minute.</p>
      <button type="button" class="btn primary" data-publish>Publish now</button>
      <div class="publish-result" role="status" data-result></div>
    </div>`;
  const state = main.querySelector("[data-state]");
  const btn = main.querySelector("[data-publish]");
  const result = main.querySelector("[data-result]");
  fetch("/__studio/status")
    .then((r) => r.json())
    .then((s) => {
      state.textContent = s.publishing
        ? "publishing right now..."
        : s.unpublished
          ? "you have changes that aren't on the live site yet"
          : "the live site is up to date";
    })
    .catch(() => (state.textContent = "couldn't check, but you can still publish"));
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "publishing...";
    result.textContent = "";
    try {
      const res = await fetch("/__studio/publish", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "something went wrong");
      state.textContent = "the live site is up to date";
      result.innerHTML = `<p>done. it's live at <a href="https://mochis-recipe-book.netlify.app" target="_blank" rel="noopener">mochis-recipe-book.netlify.app</a></p><p class="hint">${
        body.github === "failed"
          ? "the site is updated but saving to github didn't work. ask claude to look at it"
          : body.github === "saved"
            ? "recipes saved to github too"
            : "github already had everything"
      }</p>`;
      document.dispatchEvent(new Event("studio:published"));
    } catch (err) {
      result.innerHTML = `<p class="ed-error">${esc(err.message)}. nothing changed on the live site</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Publish now";
    }
  });
  return "Publish";
}

export async function hasUnpublished() {
  try {
    return (await (await fetch("/__studio/status")).json()).unpublished;
  } catch {
    return false;
  }
}

// vite reloads the page when recipes.js changes. this is the backup if nothing changed.
function reloadSoon() {
  setTimeout(() => location.reload(), 1500);
}

// draws the form into `main`. returns the page title.
export function renderEditor(main, { recipe, recipes, categories }) {
  const isNew = !recipe;
  const r = recipe ?? { title: "", slug: "", category: categories[0] ?? "", ingredients: [], steps: [], draft: true };
  const allCats = [...new Set([...categories, ...recipes.map((x) => x.category)])];
  let slugTouched = !isNew;

  main.innerHTML = `
    <a class="back" href="${isNew ? "#/" : `#/recipe/${esc(r.slug)}`}">← ${isNew ? "back to recipes" : "back to the recipe"}</a>
    <form class="card editor" novalidate>
      <h1 tabindex="-1">${isNew ? "New recipe" : "Edit recipe"}</h1>

      <div class="ed-grid">
        <label><span class="ed-label">title</span>
          <input name="title" required value="${esc(r.title)}" placeholder="what is it called" />
        </label>
        <label><span class="ed-label">link name</span>
          <input name="slug" required value="${esc(r.slug)}" placeholder="filled in from the title" />
          <small>shows up in the link as #/recipe/<span data-slug-preview>${esc(r.slug || "...")}</span></small>
        </label>
        <label><span class="ed-label">category</span>
          <input name="category" required list="cats" value="${esc(r.category)}" placeholder="Sweet, Savory or something new" />
          <datalist id="cats">${allCats.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
        </label>
        <label><span class="ed-label">subtitle <span class="opt">optional</span></span>
          <input name="subtitle" value="${esc(r.subtitle)}" placeholder="a little line under the title" />
        </label>
        <label class="wide"><span class="ed-label">batch note <span class="opt">optional</span></span>
          <input name="note" value="${esc(r.note)}" placeholder="a note to future you, shown in yellow" />
        </label>
      </div>

      <fieldset class="ed-picture">
        <legend>Picture</legend>
        <p class="hint">pick a drawing. a photo of your own takes its place if you add one</p>
        <div class="art-pick" role="radiogroup" aria-label="drawing">
          <label class="art-opt">
            <input type="radio" name="art" value="" ${r.art ? "" : "checked"} />
            <span class="art-box" data-auto-art>${ART[artKey({ category: r.category })].svg}</span>
            <span>auto</span>
          </label>
          ${Object.entries(ART)
            .map(
              ([key, a]) => `
          <label class="art-opt">
            <input type="radio" name="art" value="${key}" ${r.art === key ? "checked" : ""} />
            <span class="art-box">${a.svg}</span>
            <span>${a.label}</span>
          </label>`
            )
            .join("")}
        </div>
        <input type="hidden" name="photo" value="${esc(r.photo)}" />
        <div class="photo-row">
          <img class="photo-preview" alt="your photo" data-photo-preview ${r.photo ? `src="./${esc(r.photo)}"` : "hidden"} />
          <label class="btn small file-btn">
            <input type="file" accept="image/jpeg,image/png,image/webp" data-photo-file />
            <span data-photo-label>${r.photo ? "change photo" : "+ add a photo"}</span>
          </label>
          <button type="button" class="btn small" data-photo-remove ${r.photo ? "" : "hidden"}>remove photo</button>
        </div>
      </fieldset>

      <div class="ed-checks">
        <label class="check"><input type="checkbox" name="featured" ${r.featured ? "checked" : ""} /> show in the big pink tile</label>
        <label class="check"><input type="checkbox" name="draft" ${r.draft ? "checked" : ""} /> still a draft</label>
      </div>

      <fieldset>
        <legend>Ingredients</legend>
        <p class="hint">leave the amount empty if you don't know it yet</p>
        <ul class="ed-list" data-ings>${(r.ingredients.length ? r.ingredients : [undefined]).map(ingredientRow).join("")}</ul>
        <button type="button" class="btn small" data-add-ing>+ add ingredient</button>
      </fieldset>

      <fieldset>
        <legend>Method</legend>
        <ol class="ed-list" data-steps>${(r.steps.length ? r.steps : [""]).map((s, i) => stepRow(s, i + 1)).join("")}</ol>
        <button type="button" class="btn small" data-add-step>+ add step</button>
      </fieldset>

      <p class="ed-error" role="alert" data-error></p>

      <div class="ed-actions">
        <button type="submit" class="btn primary">${isNew ? "Add recipe" : "Save changes"}</button>
        <a class="btn" href="${isNew ? "#/" : `#/recipe/${esc(r.slug)}`}">cancel</a>
        ${isNew ? "" : `<button type="button" class="btn danger" data-delete>Delete recipe</button>`}
      </div>
    </form>`;

  const form = main.querySelector("form");
  const ings = form.querySelector("[data-ings]");
  const steps = form.querySelector("[data-steps]");
  const errorBox = form.querySelector("[data-error]");
  const slugInput = form.elements.slug;
  const preview = form.querySelector("[data-slug-preview]");

  // picture. the auto drawing follows the category
  const autoArt = form.querySelector("[data-auto-art]");
  form.elements.category.addEventListener("input", () => {
    autoArt.innerHTML = ART[artKey({ category: form.elements.category.value })].svg;
  });
  const photoInput = form.elements.photo;
  const photoPreview = form.querySelector("[data-photo-preview]");
  const photoLabel = form.querySelector("[data-photo-label]");
  const photoRemove = form.querySelector("[data-photo-remove]");
  const setPhoto = (path) => {
    photoInput.value = path;
    photoPreview.hidden = !path;
    if (path) photoPreview.src = `./${path}`;
    photoRemove.hidden = !path;
    photoLabel.textContent = path ? "change photo" : "+ add a photo";
  };
  form.querySelector("[data-photo-file]").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    photoLabel.textContent = "uploading...";
    try {
      const path = await uploadPhoto(file, slugify(form.elements.slug.value || form.elements.title.value));
      setPhoto(path);
      showError("");
    } catch (err) {
      setPhoto(photoInput.value);
      showError(`couldn't add the photo. ${err.message}`);
    }
  });
  photoRemove.addEventListener("click", () => setPhoto(""));

  const renumber = () =>
    steps.querySelectorAll(".ed-num").forEach((el, i) => {
      el.textContent = i + 1;
    });

  form.elements.title.addEventListener("input", () => {
    if (!slugTouched) slugInput.value = slugify(form.elements.title.value);
    preview.textContent = slugInput.value || "...";
  });
  slugInput.addEventListener("input", () => {
    slugTouched = true;
    preview.textContent = slugInput.value || "...";
  });

  form.querySelector("[data-add-ing]").addEventListener("click", () => {
    ings.insertAdjacentHTML("beforeend", ingredientRow());
    ings.lastElementChild.querySelector("input").focus();
  });
  form.querySelector("[data-add-step]").addEventListener("click", () => {
    steps.insertAdjacentHTML("beforeend", stepRow("", steps.children.length + 1));
    steps.lastElementChild.querySelector("textarea").focus();
  });
  form.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    btn.closest("li").remove();
    renumber();
  });

  const showError = (msg) => {
    errorBox.textContent = msg;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    const next = {
      title: f.title.value.trim(),
      slug: slugify(f.slug.value),
      category: f.category.value.trim(),
      subtitle: f.subtitle.value,
      note: f.note.value,
      photo: f.photo.value,
      art: f.art.value,
      featured: f.featured.checked,
      draft: f.draft.checked,
      ingredients: [...ings.children].map((li) => ({
        amount: li.querySelector("[name=amount]").value,
        item: li.querySelector("[name=item]").value,
      })),
      steps: [...steps.querySelectorAll("textarea")].map((t) => t.value),
    };
    if (!next.title) return showError("give it a title first");
    if (!next.slug) return showError("the link name needs at least one letter or number");
    if (!next.category) return showError("pick a category, like Sweet or Savory");
    const clash = recipes.find((x) => x.slug === next.slug && x !== recipe);
    if (clash) return showError(`“${clash.title}” already uses that link name`);

    let list = recipe ? recipes.map((x) => (x === recipe ? next : x)) : [...recipes, next];
    if (next.featured) list = list.map((x) => (x === next ? x : { ...x, featured: false }));

    showError("");
    try {
      // set the address first, the page reloads by itself once the file changes
      history.replaceState(null, "", `#/recipe/${next.slug}`);
      await saveRecipes(list, categories);
      reloadSoon();
    } catch (err) {
      history.replaceState(null, "", isNew ? "#/new" : `#/edit/${recipe.slug}`);
      showError(`couldn't save. ${err.message}`);
    }
  });

  form.querySelector("[data-delete]")?.addEventListener("click", () => deleteRecipe(recipe, recipes, categories, showError));

  return isNew ? "New recipe" : `Edit ${r.title}`;
}

export async function deleteRecipe(recipe, recipes, categories, onError = alert) {
  if (!confirm(`Delete “${recipe.title}”? this takes it out of src/recipes.js.`)) return;
  try {
    history.replaceState(null, "", "#/");
    await saveRecipes(
      recipes.filter((x) => x !== recipe),
      categories
    );
    reloadSoon();
  } catch (err) {
    history.replaceState(null, "", `#/recipe/${recipe.slug}`);
    onError(`couldn't delete. ${err.message}`);
  }
}
