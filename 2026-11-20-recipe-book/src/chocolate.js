// src/chocolate.js
// the line drawing of a chocolate bar with one broken square. uses currentColor so css picks the ink.

export const chocolateSvg = `
<svg class="choc" viewBox="0 0 260 170" role="img" aria-label="line drawing of a chocolate bar with a square broken off" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
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
