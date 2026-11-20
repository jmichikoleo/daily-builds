// src/cook.js
// cook mode. first tick off the ingredients, then one step at a time with big text and big buttons.
// it remembers where you were on this phone, and asks the screen to stay on while you cook.

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const key = (slug) => `mochi-recipe-book:cook:${slug}`;

export function readCookState(storage, recipe) {
  try {
    const s = JSON.parse(storage?.getItem(key(recipe.slug)) ?? "null");
    if (!s || typeof s !== "object") throw new Error();
    const stage = Number.isInteger(s.stage) ? Math.min(Math.max(s.stage, 0), recipe.steps.length + 1) : 0;
    const checked = Array.isArray(s.checked) ? s.checked.filter((n) => Number.isInteger(n) && n < recipe.ingredients.length) : [];
    return { stage, checked };
  } catch {
    return { stage: 0, checked: [] };
  }
}

function writeCookState(storage, recipe, state) {
  try {
    storage?.setItem(key(recipe.slug), JSON.stringify(state));
  } catch {
    // fine, it just won't remember
  }
}

// stage 0 is the ingredient list, 1..n are the steps, n + 1 is done
export function renderCook(main, recipe, storage) {
  const total = recipe.steps.length;
  let state = readCookState(storage, recipe);
  let wakeLock = null;
  document.body.classList.add("cooking");

  const keepAwake = async () => {
    try {
      if (document.visibilityState === "visible" && "wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      wakeLock = null;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") keepAwake();
  };

  const save = () => writeCookState(storage, recipe, state);
  const go = (stage) => {
    state.stage = Math.min(Math.max(stage, 0), total + 1);
    save();
    paint();
    main.querySelector("[data-focus]")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };

  const header = () => `
    <div class="cook-top">
      <a class="back" href="#/recipe/${esc(recipe.slug)}">× leave cook mode</a>
      <p class="cook-title">${esc(recipe.title)}</p>
    </div>`;

  const progress = () => {
    const dots = Array.from({ length: total + 1 }, (_, i) => `<span class="${i === state.stage ? "on" : i < state.stage ? "past" : ""}"></span>`).join("");
    return `<div class="cook-progress" aria-hidden="true">${dots}</div>`;
  };

  function paint() {
    const { stage, checked } = state;
    let body;
    if (stage === 0) {
      body = `
        <h1 class="cook-h" tabindex="-1" data-focus>Get everything out</h1>
        <p class="cook-hint">tap each one as you put it on the counter</p>
        ${
          recipe.ingredients.length
            ? `<ul class="cook-ings">${recipe.ingredients
                .map(
                  (i, n) => `
              <li><button type="button" class="cook-ing" aria-pressed="${checked.includes(n)}" data-ing="${n}">
                <span class="box" aria-hidden="true">${checked.includes(n) ? "✓" : ""}</span>
                <span class="cook-amt">${i.amount ? esc(i.amount) : ""}</span>
                <span>${esc(i.item)}</span>
              </button></li>`
                )
                .join("")}</ul>`
            : `<p class="cook-hint">no ingredients written down for this one</p>`
        }
        <div class="cook-nav">
          ${total ? `<button type="button" class="btn primary big" data-next>Start the steps →</button>` : `<a class="btn big" href="#/recipe/${esc(recipe.slug)}">back to the recipe</a>`}
        </div>`;
    } else if (stage <= total) {
      body = `
        <p class="cook-count">step ${stage} of ${total}</p>
        <h1 class="cook-step" tabindex="-1" data-focus>${esc(recipe.steps[stage - 1])}</h1>
        <div class="cook-nav">
          <button type="button" class="btn big" data-prev>← back</button>
          <button type="button" class="btn primary big" data-next>${stage === total ? "Finish" : "Next step →"}</button>
        </div>
        <details class="cook-peek">
          <summary>see the ingredients</summary>
          <ul>${recipe.ingredients.map((i) => `<li><b>${esc(i.amount)}</b> ${esc(i.item)}</li>`).join("")}</ul>
        </details>`;
    } else {
      body = `
        <h1 class="cook-h" tabindex="-1" data-focus>All done. enjoy it</h1>
        <p class="cook-hint">if something turned out different, write it down in the studio while you remember</p>
        <div class="cook-nav">
          <button type="button" class="btn big" data-prev>← last step</button>
          <a class="btn primary big" href="#/recipe/${esc(recipe.slug)}" data-reset>back to the recipe</a>
        </div>`;
    }
    main.innerHTML = `
      <div class="cook">
        ${header()}
        ${progress()}
        ${body}
        ${stage > 0 && stage <= total + 1 ? `<button type="button" class="link-btn" data-restart>start over</button>` : ""}
      </div>`;

    main.querySelectorAll("[data-ing]").forEach((b) =>
      b.addEventListener("click", () => {
        const n = Number(b.dataset.ing);
        state.checked = state.checked.includes(n) ? state.checked.filter((x) => x !== n) : [...state.checked, n];
        save();
        const on = state.checked.includes(n);
        b.setAttribute("aria-pressed", String(on));
        b.querySelector(".box").textContent = on ? "✓" : "";
      })
    );
    main.querySelector("[data-next]")?.addEventListener("click", () => go(state.stage + 1));
    main.querySelector("[data-prev]")?.addEventListener("click", () => go(state.stage - 1));
    main.querySelector("[data-restart]")?.addEventListener("click", () => {
      state = { stage: 0, checked: [] };
      go(0);
    });
    main.querySelector("[data-reset]")?.addEventListener("click", () => {
      state = { stage: 0, checked: [] };
      save();
    });
  }

  const onKey = (e) => {
    if (e.target.closest?.("input, textarea")) return;
    if (e.key === "ArrowRight" && state.stage <= total && total) go(state.stage + 1);
    if (e.key === "ArrowLeft" && state.stage > 0) go(state.stage - 1);
  };

  paint();
  keepAwake();
  document.addEventListener("visibilitychange", onVisible);
  document.addEventListener("keydown", onKey);

  return {
    title: `Cooking ${recipe.title}`,
    leave() {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("keydown", onKey);
      wakeLock?.release?.().catch(() => {});
      document.body.classList.remove("cooking");
    },
  };
}
