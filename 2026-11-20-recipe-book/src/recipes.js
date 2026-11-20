// src/recipes.js
// this is the only file you need to touch to add or change a recipe.
// the studio rewrites this file for you, see the readme.
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
//     art: "chocolate",                // optional drawing. chocolate, whisk, pot, ricebowl, bread or plate
//     servings: "makes 16 squares",    // optional
//     source: "https://...",           // optional, where the recipe came from
//     collections: ["Bakes"],          // optional, a recipe can be in several
//     basedOn: "og-brownie",           // optional, makes this a version of another recipe
//     outcome: "fudgier, bake 5 less", // optional, how it turned out
//     ingredients: [
//       { amount: "220 g", item: "chocolate" },
//       { amount: "", item: "salt" },  // leave amount empty if you don't know it yet
//     ],
//     steps: [
//       "first step",
//       "second step",
//     ],
//   }

// sections always shown in this order. categories not listed here get added after them.
export const categories = ["Sweet", "Savory"];

export const recipes = [
  {
    slug: "og-brownie",
    title: "OG Brownie",
    category: "Sweet",
    art: "chocolate",
    featured: true,
    draft: true,
    ingredients: [
      { amount: "150gr", item: "chocolate, melted" },
      { amount: "100gr", item: "butter, melted" },
      { amount: "2", item: "eggs" },
      { amount: "100gr", item: "sugar" },
      { amount: "60gr", item: "flour" },
      { amount: "20gr", item: "cocoa powder" },
    ],
    steps: [
      "mix the melted chocolate and melted butter together",
      "mix the eggs and sugar together and combine with the melted chocolate and butter",
      "add the flour and cocoa powder",
      "bake / airfry for about 30 mins until it's done!",
    ],
  },
];
