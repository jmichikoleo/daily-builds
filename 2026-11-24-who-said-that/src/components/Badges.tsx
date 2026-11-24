// Original illustrated award badges (inline SVG, pixel-ish).
const INK = '#29252E'

const art: Record<string, React.ReactNode> = {
  badge: (
    <>
      <path d="M32 6 L52 14 V30 C52 44 42 52 32 58 C22 52 12 44 12 30 V14 Z" fill="#7FB8F5" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 18 l4 9 h9 l-7 6 3 9 -9 -5 -9 5 3 -9 -7 -6 h9 z" fill="#FFE9AE" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  mask: (
    <>
      <path d="M8 24 C8 16 20 14 32 20 C44 14 56 16 56 24 C56 36 46 42 38 38 L32 34 L26 38 C18 42 8 36 8 24 Z" fill="#B79CF2" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="22" cy="26" rx="6" ry="4" fill={INK} />
      <ellipse cx="42" cy="26" rx="6" ry="4" fill={INK} />
      <path d="M56 22 l6 -6 M8 22 l-6 -6" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  wanted: (
    <>
      <rect x="10" y="6" width="44" height="52" fill="#FFE9AE" stroke={INK} strokeWidth="4" />
      <rect x="20" y="20" width="24" height="20" fill="#FFD1D3" stroke={INK} strokeWidth="3" />
      <rect x="16" y="10" width="32" height="6" fill={INK} />
      <path d="M18 46 h28 M22 52 h20" stroke={INK} strokeWidth="3" />
    </>
  ),
  npc: (
    <>
      <rect x="8" y="12" width="48" height="32" rx="6" fill="#DDEBCF" stroke={INK} strokeWidth="4" />
      <path d="M20 44 l-4 12 l14 -12" fill="#DDEBCF" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="22" cy="28" r="3.5" fill={INK} />
      <circle cx="32" cy="28" r="3.5" fill={INK} />
      <circle cx="42" cy="28" r="3.5" fill={INK} />
    </>
  ),
  scroll: (
    <>
      <rect x="14" y="10" width="36" height="44" fill="#FFF9F0" stroke={INK} strokeWidth="4" />
      <path d="M20 20 c4 -4 8 4 12 0 s8 4 12 0 M20 30 c4 -4 8 4 12 0 s8 4 12 0 M20 40 c4 -4 8 4 12 0 s8 4 12 0" fill="none" stroke="#E85D75" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="50" r="8" fill="#FFC94D" stroke={INK} strokeWidth="3" />
    </>
  ),
  mirror: (
    <>
      <ellipse cx="32" cy="26" rx="18" ry="20" fill="#DCEBFC" stroke={INK} strokeWidth="4" />
      <path d="M32 46 v12 M24 58 h16" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M24 18 l6 -6 M24 26 l12 -12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <text x="32" y="34" textAnchor="middle" fontSize="16" fontWeight="900" fill={INK}>?</text>
    </>
  ),
  magnifier: (
    <>
      <circle cx="26" cy="26" r="16" fill="#FFD1D3" stroke={INK} strokeWidth="4" />
      <path d="M38 38 l16 16" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M20 20 l12 12 M32 20 l-12 12" stroke="#E85D75" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  brain: (
    <>
      <path d="M32 12 C22 6 10 12 12 24 C4 30 8 44 18 44 C20 54 32 54 32 46 C32 54 44 54 46 44 C56 44 60 30 52 24 C54 12 42 6 32 12 Z" fill="#FF9FB8" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 14 V46 M20 26 c4 2 6 6 4 10 M44 26 c-4 2 -6 6 -4 10" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  tape: (
    <>
      <rect x="2" y="22" width="60" height="20" fill="#FFC94D" stroke={INK} strokeWidth="4" transform="rotate(-12 32 32)" />
      <path d="M8 40 l10 -18 M22 37 l10 -18 M36 34 l10 -18 M50 31 l8 -15" stroke={INK} strokeWidth="5" transform="rotate(-12 32 32)" />
    </>
  ),
  twist: (
    <>
      <circle cx="32" cy="32" r="24" fill="#CFF2EC" stroke={INK} strokeWidth="4" />
      <path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16" fill="none" stroke="#E85D75" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  crown: (
    <>
      <path d="M8 46 L12 18 L24 32 L32 12 L40 32 L52 18 L56 46 Z" fill="#FFC94D" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="8" fill="#E85D75" stroke={INK} strokeWidth="4" />
      <circle cx="32" cy="36" r="4" fill="#DCCDF8" stroke={INK} strokeWidth="2.5" />
    </>
  ),
  ribbon: (
    <>
      <path d="M22 36 L14 60 L24 54 L30 62 L32 38 M42 36 L50 60 L40 54 L34 62 L32 38" fill="#E85D75" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="32" cy="26" r="18" fill="#FFE9AE" stroke={INK} strokeWidth="4" />
      <circle cx="32" cy="26" r="10" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="4 3" />
    </>
  ),
}

export function Badge({ kind, size = 72 }: { kind: string; size?: number }) {
  return (
    <svg className="badge-svg" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {art[kind] ?? art.ribbon}
    </svg>
  )
}
