// src/games/thumbnails.tsx
// original little svg cartridge art for each game.

const ink = "#2b2340";

export function StarCatcherThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#2a1755" />
      {[[20, 18], [44, 40], [120, 22], [140, 52], [70, 14], [96, 46]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="2.5" height="2.5" fill="#fff3c4" />
      ))}
      <circle cx="130" cy="24" r="11" fill="#fff3c4" />
      <circle cx="135" cy="21" r="10" fill="#2a1755" />
      <path d="M80 26l5 10 11 1-8 7 2 11-10-6-10 6 2-11-8-7 11-1z" fill="#ffd23f" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M40 46l3 6 7 .7-5 4.5 1.5 7L40 61l-6.5 3.2 1.5-7-5-4.5 7-.7z" fill="#5ab8ff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M58 82h44l-7 18H65z" fill="#e2965a" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="54" y="78" width="52" height="7" rx="3.5" fill="#c46f3a" stroke={ink} strokeWidth="2.5" />
      <circle cx="72" cy="91" r="2" fill={ink} />
      <circle cx="88" cy="91" r="2" fill={ink} />
    </svg>
  );
}

export function PanicButtonThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#ffe8c2" />
      <rect x="28" y="22" width="104" height="70" rx="10" fill="#9ad7c8" stroke={ink} strokeWidth="3" />
      <path d="M14 40h14M132 60h16v-30" stroke={ink} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="56" cy="50" r="15" fill="#fff" stroke={ink} strokeWidth="3" />
      <path d="M56 50l9-8" stroke="#ff5a5f" strokeWidth="3" strokeLinecap="round" />
      <circle cx="104" cy="50" r="15" fill="#fff" stroke={ink} strokeWidth="3" />
      <path d="M104 50l-6-10" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <rect x="66" y="72" width="28" height="12" rx="6" fill="#ff5a5f" stroke={ink} strokeWidth="3" />
      <circle cx="40" cy="30" r="4" fill="#ffc23c" stroke={ink} strokeWidth="2" />
      <circle cx="120" cy="30" r="4" fill="#ff5a5f" stroke={ink} strokeWidth="2" />
      <path d="M146 26c-6-6 6-10 0-16M152 24c-5-5 5-8 0-13" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function FrogTrafficThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#6cc7b6" />
      <rect y="0" width="160" height="16" fill="#9be07a" />
      <rect y="94" width="160" height="16" fill="#9be07a" />
      {[30, 52, 74].map((y, i) => (
        <path key={y} d={`M0 ${y + 10}q20 -4 40 0t40 0t40 0t40 0`} stroke="#a8e6dc" strokeWidth="2" fill="none" opacity={0.6 + i * 0.1} />
      ))}
      <ellipse cx="42" cy="36" rx="22" ry="8" fill="#4fae5a" stroke={ink} strokeWidth="2.5" />
      <ellipse cx="112" cy="58" rx="24" ry="8" fill="#4fae5a" stroke={ink} strokeWidth="2.5" />
      <ellipse cx="60" cy="80" rx="20" ry="7" fill="#4fae5a" stroke={ink} strokeWidth="2.5" />
      <ellipse cx="112" cy="53" rx="11" ry="9" fill="#8fdc5c" stroke={ink} strokeWidth="2.5" />
      <circle cx="106" cy="45" r="4.5" fill="#fff" stroke={ink} strokeWidth="2" />
      <circle cx="118" cy="45" r="4.5" fill="#fff" stroke={ink} strokeWidth="2" />
      <circle cx="106" cy="45" r="1.8" fill={ink} />
      <circle cx="118" cy="45" r="1.8" fill={ink} />
    </svg>
  );
}

export function WrongDeliveryThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#ffd9e6" />
      <rect x="0" y="62" width="160" height="22" fill="#7a6a8a" stroke={ink} strokeWidth="3" />
      {[10, 34, 58, 82, 106, 130, 154].map((x) => (
        <circle key={x} cx={x} cy="73" r="5" fill="#b9acc7" stroke={ink} strokeWidth="2" />
      ))}
      <rect x="22" y="34" width="30" height="28" rx="4" fill="#ffc23c" stroke={ink} strokeWidth="3" />
      <circle cx="37" cy="48" r="7" fill="#ff5a5f" stroke={ink} strokeWidth="2" />
      <rect x="66" y="30" width="32" height="32" rx="4" fill="#4aa8ff" stroke={ink} strokeWidth="3" />
      <circle cx="82" cy="46" r="7" fill="#ffe7a1" stroke={ink} strokeWidth="2" />
      <ellipse cx="82" cy="46" rx="13" ry="3.5" fill="none" stroke={ink} strokeWidth="2" />
      <rect x="112" y="36" width="28" height="26" rx="4" fill="#b58cf6" stroke={ink} strokeWidth="3" />
      <path d="M126 40l2 5 5 .5-4 3 1 5-4-2.6-4 2.6 1-5-4-3 5-.5z" fill="#fff" stroke={ink} strokeWidth="1.5" />
      <text x="80" y="102" textAnchor="middle" fontFamily="Silkscreen, monospace" fontSize="11" fill={ink}>1 2 3</text>
    </svg>
  );
}

export function GardenEmergencyThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#dff5c9" />
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => <rect key={`${c}${r}`} x={16 + c * 46} y={16 + r * 44} width="38" height="36" rx="7" fill="#b9845a" stroke={ink} strokeWidth="2.5" />),
      )}
      <path d="M35 46v-16" stroke="#3c9a4a" strokeWidth="3" />
      <circle cx="35" cy="26" r="7" fill="#ff8fc7" stroke={ink} strokeWidth="2" />
      <circle cx="35" cy="26" r="2.5" fill="#ffc23c" />
      <path d="M74 46l4-12 4 12M70 46l-2-9M86 46l2-9" stroke="#557a2a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M127 46v-10" stroke="#9aa65a" strokeWidth="3" />
      <path d="M127 38c-6-2-8 2-8 2M127 38c6-2 8 2 8 2" stroke="#9aa65a" strokeWidth="2.5" fill="none" />
      <path d="M132 22c0 4-3 6-3 6s-3-2-3-6c0-3 3-6 3-6s3 3 3 6z" fill="#4aa8ff" stroke={ink} strokeWidth="1.5" />
      <path d="M35 90v-14" stroke="#3c9a4a" strokeWidth="3" />
      <ellipse cx="35" cy="74" rx="5" ry="7" fill="#ffc23c" stroke={ink} strokeWidth="2" />
      <path d="M100 68c4-6 10-6 12 0-6 2-8 6-12 0z" fill="#ffc23c" stroke={ink} strokeWidth="1.5" />
      <path d="M112 68c4-6 10-6 12 0-6 2-8 6-12 0z" fill="#ff8fc7" stroke={ink} strokeWidth="1.5" />
    </svg>
  );
}

export function GhostHuntThumb() {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true">
      <rect width="160" height="110" fill="#d9d2f7" />
      <rect y="78" width="160" height="32" fill="#b2a6e6" />
      <rect x="12" y="20" width="36" height="62" rx="4" fill="#8a7ad1" stroke={ink} strokeWidth="2.5" />
      <path d="M30 20v62" stroke={ink} strokeWidth="2" />
      <rect x="96" y="58" width="56" height="24" rx="6" fill="#7fb4ef" stroke={ink} strokeWidth="2.5" />
      <rect x="98" y="50" width="20" height="12" rx="5" fill="#fff" stroke={ink} strokeWidth="2" />
      <rect x="60" y="14" width="26" height="22" rx="2" fill="#fff7d6" stroke={ink} strokeWidth="2.5" />
      <path d="M64 48c0-12 8-18 16-18s16 6 16 18v20l-5-4-5 4-6-4-5 4-5-4-6 4z" fill="#ffffff" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" opacity="0.95" />
      <circle cx="74" cy="46" r="3" fill={ink} />
      <circle cx="86" cy="46" r="3" fill={ink} />
      <ellipse cx="80" cy="54" rx="3" ry="2.4" fill={ink} />
      <circle cx="69" cy="52" r="2.5" fill="#ff8fc7" />
      <circle cx="91" cy="52" r="2.5" fill="#ff8fc7" />
    </svg>
  );
}
