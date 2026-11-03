import type { Frame, ResolvedStudio } from "@/lib/collage/frame";

/**
 * Paper, texture, border and theme accents. Pure SVG (patterns, gradients and
 * one noise filter): no images or remote assets, so it rasterises as-is.
 */
export function CollageBackground({ frame, resolved, uid }: { frame: Frame; resolved: ResolvedStudio; uid: string }) {
  const { width: W, height: H, margin: M } = frame;
  const { theme, texture, border, showAccents, paper } = resolved;
  const ink = resolved.textColor;

  return (
    <g aria-hidden="true">
      <defs>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0.1 0" />
        </filter>
        <radialGradient id={`${uid}-vignette`} cx="50%" cy="45%" r="75%">
          <stop offset="60%" stopColor={theme.paperAlt} stopOpacity="0" />
          <stop offset="100%" stopColor={theme.paperAlt} stopOpacity="0.85" />
        </radialGradient>
        <pattern id={`${uid}-linen`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 4 H8 M4 0 V8" stroke={theme.muted} strokeWidth="0.6" opacity="0.16" />
        </pattern>
        <pattern id={`${uid}-dots`} width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="18" cy="18" r="2" fill={theme.accent} opacity="0.3" />
        </pattern>
        <pattern id={`${uid}-grid`} width="54" height="54" patternUnits="userSpaceOnUse">
          <path d="M 54 0 L 0 0 0 54" fill="none" stroke={theme.muted} strokeWidth="1" opacity="0.2" />
        </pattern>
        <pattern id={`${uid}-airmail`} width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="16" height="64" fill={theme.accent} />
          <rect x="32" width="16" height="64" fill={theme.text} opacity="0.75" />
        </pattern>
        <mask id={`${uid}-edge`}>
          <rect width={W} height={H} fill="white" />
          <rect x={M * 0.24} y={M * 0.24} width={W - M * 0.48} height={H - M * 0.48} fill="black" />
        </mask>
      </defs>

      <rect width={W} height={H} fill={paper} />
      {(texture === "grain" || texture === "aged") && <rect width={W} height={H} filter={`url(#${uid}-grain)`} />}
      {texture === "aged" && <rect width={W} height={H} fill={`url(#${uid}-vignette)`} />}
      {texture === "linen" && <rect width={W} height={H} fill={`url(#${uid}-linen)`} />}
      {texture === "dots" && <rect width={W} height={H} fill={`url(#${uid}-dots)`} />}
      {texture === "grid" && <rect width={W} height={H} fill={`url(#${uid}-grid)`} />}

      {border === "hairline" && <rect x={M * 0.4} y={M * 0.4} width={W - M * 0.8} height={H - M * 0.8} fill="none" stroke={ink} strokeWidth="2" opacity="0.45" />}
      {border === "double" && (
        <g fill="none" stroke={ink} opacity="0.5">
          <rect x={M * 0.32} y={M * 0.32} width={W - M * 0.64} height={H - M * 0.64} strokeWidth="3.5" />
          <rect x={M * 0.48} y={M * 0.48} width={W - M * 0.96} height={H - M * 0.96} strokeWidth="1.2" />
        </g>
      )}
      {border === "airmail" && <rect width={W} height={H} fill={`url(#${uid}-airmail)`} mask={`url(#${uid}-edge)`} opacity="0.85" />}
      {border === "registration" && (
        <g stroke={ink} strokeWidth="1.6" opacity="0.6" fill="none">
          {[
            [M * 0.45, M * 0.45, 1, 1],
            [W - M * 0.45, M * 0.45, -1, 1],
            [M * 0.45, H - M * 0.45, 1, -1],
            [W - M * 0.45, H - M * 0.45, -1, -1],
          ].map(([x, y, sx, sy]) => (
            <path key={`${x}-${y}`} d={`M ${x} ${y + sy * M * 0.5} V ${y} H ${x + sx * M * 0.5}`} />
          ))}
        </g>
      )}

      {showAccents && <Accent frame={frame} resolved={resolved} />}
    </g>
  );
}

/** A small theme mark in the top margin band, clear of all text. */
function Accent({ frame, resolved }: { frame: Frame; resolved: ResolvedStudio }) {
  const { width: W, margin: M } = frame;
  const { theme } = resolved;
  const band = M * 0.72; // vertical centre of the top margin band
  if (theme.accents === "postmark") {
    const x0 = W - M - M * 3.6;
    return (
      <g fill="none" stroke={theme.muted} strokeWidth={M * 0.035} opacity="0.55">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M ${x0} ${band - M * 0.2 + i * M * 0.13} q ${M * 0.3} ${-M * 0.12} ${M * 0.6} 0 t ${M * 0.6} 0 t ${M * 0.6} 0 t ${M * 0.6} 0 t ${M * 0.6} 0`} />
        ))}
        <circle cx={W - M - M * 0.38} cy={band - M * 0.01} r={M * 0.34} strokeWidth={M * 0.03} />
      </g>
    );
  }
  if (theme.accents === "airmail") {
    const w = M * 3.4;
    const h = M * 0.46;
    const x = W - M - w;
    return (
      <g opacity="0.9">
        <rect x={x} y={band - h / 2} width={w} height={h} fill="none" stroke={theme.accent} strokeWidth={M * 0.03} rx={M * 0.04} />
        <text
          x={x + w / 2}
          y={band + h * 0.18}
          textAnchor="middle"
          fill={theme.text}
          style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
          fontSize={h * 0.5}
          fontStyle="italic"
          letterSpacing={h * 0.08}
        >
          par avion · by air mail
        </text>
      </g>
    );
  }
  // Editorial: a printer's colour bar.
  const sw = M * 0.34;
  return (
    <g>
      {theme.inks.slice(0, 3).map((ink, i) => (
        <rect key={ink + i} x={W - M - sw * (3 - i) - i * 4} y={band - sw / 2} width={sw} height={sw} fill={ink} opacity="0.85" />
      ))}
    </g>
  );
}
