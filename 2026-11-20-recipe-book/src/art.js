// src/art.js
// the little line drawings. every recipe gets one, picked in the studio or by its category.
// all of them use currentColor so css picks the ink.

const open = (label) =>
  `<svg class="choc" viewBox="0 0 260 170" role="img" aria-label="${label}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`;

const chocolate = `${open("line drawing of a chocolate bar with a square broken off")}
  <g transform="rotate(-9 120 90)">
    <path d="M28 40 h88 l6 -5 l-6 9 l7 4 l-7 5 v77 h-88 z" />
    <path d="M24 34 h96 M24 34 v104 h4" opacity=".55" />
    <path d="M24 34 l-6 -10 l14 4 l10 -8 l8 9 l12 -6 l6 9 l14 -7 l9 8 l12 -5 l11 6" opacity=".55" />
    ${[0, 1, 2]
      .map((row) =>
        [0, 1]
          .map((col) => {
            const x = 34 + col * 40;
            const y = 50 + row * 27;
            return `<rect x="${x}" y="${y}" width="34" height="21" rx="2" /><rect x="${x + 5}" y="${y + 4}" width="24" height="13" rx="1.5" opacity=".5" />`;
          })
          .join("")
      )
      .join("")}
  </g>
  <g transform="rotate(14 190 110)">
    <rect x="166" y="96" width="38" height="24" rx="2" />
    <rect x="172" y="101" width="26" height="14" rx="1.5" opacity=".5" />
    <path d="M204 99 l4 3 l-3 4 l4 4 l-4 5" />
  </g>
  <path d="M214 62 l3 -6 M222 70 l6 -3 M211 74 l2 2" opacity=".6" />
  <path d="M150 150 c8 3 18 3 26 0" opacity=".4" />
</svg>`;

const whisk = `${open("line drawing of a mixing bowl with a whisk")}
  <ellipse cx="120" cy="88" rx="78" ry="13" />
  <path d="M42 88 C 46 132, 82 150, 120 150 C 158 150, 194 132, 198 88" />
  <path d="M96 150 l-4 8 h56 l-4 -8" />
  <path d="M62 96 c 20 7 96 7 116 0" opacity=".45" />
  <g transform="rotate(28 170 60)">
    <rect x="164" y="6" width="12" height="44" rx="6" />
    <path d="M170 50 v8" />
    <path d="M170 58 C 150 80, 152 118, 170 122 C 188 118, 190 80, 170 58 Z" />
    <path d="M170 58 C 160 82, 161 114, 170 122 C 179 114, 180 82, 170 58" opacity=".7" />
    <path d="M170 58 V 122" opacity=".5" />
  </g>
  <path d="M214 52 l6 -4 M218 64 l7 0" opacity=".6" />
</svg>`;

const pot = `${open("line drawing of a cooking pot with steam")}
  <path d="M62 78 h136 v52 c0 12 -8 20 -20 20 h-96 c-12 0 -20 -8 -20 -20 z" />
  <path d="M62 92 h-14 c-6 0 -6 12 0 12 h14 M198 92 h14 c6 0 6 12 0 12 h-14" />
  <path d="M54 78 c 10 -16 142 -16 152 0 z" />
  <path d="M120 62 v-6 M112 56 h16" />
  <path d="M74 120 h112" opacity=".4" />
  <path d="M96 40 c -8 -8 8 -14 0 -24 M122 36 c -8 -8 8 -14 0 -24 M148 40 c -8 -8 8 -14 0 -24" opacity=".6" />
  <path d="M60 158 h140" opacity=".4" />
</svg>`;

const ricebowl = `${open("line drawing of a bowl of rice with chopsticks")}
  <path d="M52 96 c 4 -14 16 -20 26 -18 c 6 -12 22 -16 32 -8 c 8 -10 26 -10 34 0 c 10 -8 26 -4 32 8 c 10 -2 22 4 26 18" />
  <path d="M86 86 l3 2 M112 80 l2 3 M138 82 l3 1 M160 88 l2 2 M100 92 l3 1 M128 90 l2 2" opacity=".55" />
  <path d="M44 96 h172 c -4 34 -40 52 -86 52 c -46 0 -82 -18 -86 -52 z" />
  <path d="M106 148 l-2 10 h52 l-2 -10" />
  <path d="M74 118 c 16 10 96 10 112 0" opacity=".4" />
  <path d="M168 20 L 226 74 M178 16 L 232 70" />
</svg>`;

const bread = `${open("line drawing of a loaf of bread")}
  <path d="M40 122 C 34 76, 76 50, 130 50 C 184 50, 226 76, 220 122 C 218 136, 206 142, 190 142 H 70 C 54 142, 42 136, 40 122 Z" />
  <path d="M84 70 l 14 22 M118 62 l 14 24 M152 64 l 14 22 M184 76 l 10 16" />
  <path d="M60 116 c 40 8 100 8 140 0" opacity=".4" />
  <path d="M30 152 h200" opacity=".4" />
  <path d="M206 40 l4 -6 M216 50 l7 -2" opacity=".6" />
</svg>`;

const plate = `${open("line drawing of a plate with a fork and knife")}
  <ellipse cx="130" cy="98" rx="70" ry="44" />
  <ellipse cx="130" cy="98" rx="48" ry="29" opacity=".55" />
  <path d="M38 52 v34 M30 52 v18 c0 8 16 8 16 0 v-18 M38 86 v56" />
  <path d="M222 52 c 10 6 10 36 0 44 v46" />
  <path d="M112 90 c 6 -4 14 -4 20 0" opacity=".45" />
</svg>`;

export const ART = {
  chocolate: { label: "chocolate", svg: chocolate },
  whisk: { label: "bowl and whisk", svg: whisk },
  pot: { label: "pot", svg: pot },
  ricebowl: { label: "rice bowl", svg: ricebowl },
  bread: { label: "bread", svg: bread },
  plate: { label: "plate", svg: plate },
};

const CATEGORY_DEFAULT = { sweet: "whisk", savory: "pot" };

// the drawing a recipe uses. its own pick first, then one for its category, then the plate.
export function artKey(recipe) {
  if (recipe?.art && ART[recipe.art]) return recipe.art;
  return CATEGORY_DEFAULT[String(recipe?.category ?? "").toLowerCase()] ?? "plate";
}

export function artFor(recipe) {
  return ART[artKey(recipe)].svg;
}
