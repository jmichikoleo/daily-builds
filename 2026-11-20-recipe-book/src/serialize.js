// src/serialize.js
// turns the recipe list back into the text of src/recipes.js. used by the editor's save.

const HEADER = `// src/recipes.js
// this is the only file you need to touch to add or change a recipe.
// you can also use the editor while \`npm run dev\` is running, it rewrites this file for you.
//
// each recipe looks like this
//
//   {
//     slug: "mochi-brownies",          // used in the link, lowercase-with-dashes
//     title: "Mochi brownies",
//     category: "Sweet",               // any name works, new ones get their own section
//     subtitle: "The 220 g batch",     // optional, shown in italics
//     note: "Sized for ...",           // optional, the yellow batch note
//     featured: true,                  // optional, shows it in the big pink tile on the home page
//     draft: true,                     // optional, marks it as not finished yet
//     photo: "photos/brownies.jpg",    // optional, put the file in public/photos
//     ingredients: [
//       { amount: "220 g", item: "chocolate" },
//       { amount: "", item: "salt" },  // leave amount empty if you don't know it yet
//     ],
//     steps: [
//       "first step",
//       "second step",
//     ],
//   }
`;

const str = (s) => JSON.stringify(String(s ?? ""));

// keeps only known fields, trims text, drops empty optional ones
export function cleanRecipe(r) {
  const out = {
    slug: String(r.slug ?? "").trim(),
    title: String(r.title ?? "").trim(),
    category: String(r.category ?? "").trim(),
  };
  for (const key of ["subtitle", "note", "photo"]) {
    const v = String(r[key] ?? "").trim();
    if (v) out[key] = v;
  }
  if (r.featured) out.featured = true;
  if (r.draft) out.draft = true;
  out.ingredients = (r.ingredients ?? [])
    .map((i) => ({ amount: String(i.amount ?? "").trim(), item: String(i.item ?? "").trim() }))
    .filter((i) => i.item);
  out.steps = (r.steps ?? []).map((s) => String(s ?? "").trim()).filter(Boolean);
  return out;
}

function recipeText(r) {
  const lines = ["  {"];
  for (const key of ["slug", "title", "category", "subtitle", "note", "photo"]) {
    if (r[key] !== undefined) lines.push(`    ${key}: ${str(r[key])},`);
  }
  if (r.featured) lines.push("    featured: true,");
  if (r.draft) lines.push("    draft: true,");
  lines.push("    ingredients: [");
  for (const i of r.ingredients) lines.push(`      { amount: ${str(i.amount)}, item: ${str(i.item)} },`);
  lines.push("    ],");
  lines.push("    steps: [");
  for (const s of r.steps) lines.push(`      ${str(s)},`);
  lines.push("    ],");
  lines.push("  },");
  return lines.join("\n");
}

export function serializeRecipes(recipes, categories) {
  return `${HEADER}
// sections always shown in this order. categories not listed here get added after them.
export const categories = [${categories.map(str).join(", ")}];

export const recipes = [
${recipes.map(recipeText).join("\n")}
];
`;
}

export function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
