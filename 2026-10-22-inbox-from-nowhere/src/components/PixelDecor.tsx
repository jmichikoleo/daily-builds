/** Small pixel-art decorations drawn with SVG rects. */
interface PixelProps {
  className?: string;
  title?: string;
}

export function PixelHeart({ className = 'h-5 w-5', title }: PixelProps) {
  return (
    <svg viewBox="0 0 8 8" className={`pixelated ${className}`} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path fill="#E7A4C4" d="M1 1h2v1H1zM5 1h2v1H5zM0 2h8v2H0zM1 4h6v1H1zM2 5h4v1H2zM3 6h2v1H3z" />
      <path fill="#F6DCE9" d="M1 2h1v1H1z" />
    </svg>
  );
}

export function PixelEnvelope({ className = 'h-6 w-6' }: PixelProps) {
  return (
    <svg viewBox="0 0 12 9" className={`pixelated ${className}`} aria-hidden>
      <path fill="#F6DCE9" d="M0 0h12v9H0z" />
      <path fill="#543447" d="M0 0h1v1H0zM11 0h1v1h-1zM1 1h1v1H1zM10 1h1v1h-1zM2 2h1v1H2zM9 2h1v1H9zM3 3h1v1H3zM8 3h1v1H8zM4 4h4v1H4z" />
      <path fill="#E7A4C4" d="M5 5h2v1H5zM4 6h1v1H4zM7 6h1v1H7z" />
    </svg>
  );
}

export function PixelSparkle({ className = 'h-3 w-3' }: PixelProps) {
  return (
    <svg viewBox="0 0 5 5" className={`pixelated ${className}`} aria-hidden>
      <path fill="currentColor" d="M2 0h1v5H2zM0 2h5v1H0z" />
    </svg>
  );
}

export function PixelSkull({ className = 'h-4 w-4' }: PixelProps) {
  return (
    <svg viewBox="0 0 8 8" className={`pixelated ${className}`} aria-hidden>
      <path fill="#F6DCE9" d="M2 0h4v1H2zM1 1h6v4H1zM2 5h4v1H2zM2 6h1v1H2zM4 6h1v1H4z" />
      <path fill="#130C13" d="M2 2h1v2H2zM5 2h1v2H5zM3 4h2v1H3z" />
    </svg>
  );
}

/** One to three pixel squares showing roast intensity. */
export function IntensityPips({ level, className = '' }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`h-[5px] w-[5px] ${i <= level ? 'bg-rose' : 'bg-mauve/60'}`} />
      ))}
    </span>
  );
}
