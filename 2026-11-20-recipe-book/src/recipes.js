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
    slug: "mochi-brownies",
    title: "Mochi brownies",
    category: "Sweet",
    subtitle: "The 220 g batch",
    note: "Sized for the 220 g of chocolate I had.",
    art: "chocolate",
    featured: true,
    draft: true,
    ingredients: [
      { amount: "220 g", item: "chocolate" },
      { amount: "", item: "glutinous rice flour · 찹쌀가루" },
    ],
    steps: [
    ],
  },
];
