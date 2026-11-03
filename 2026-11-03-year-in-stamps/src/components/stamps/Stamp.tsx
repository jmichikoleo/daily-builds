import { STAMP_VIEWBOX, type StampDesign, type StampModel } from "@/lib/stamps/types";
import { StampGraphic } from "./StampGraphic";

interface StampProps {
  model: StampModel;
  design: StampDesign;
  /** Apply the stamp's own deterministic tilt. */
  tilted?: boolean;
  className?: string;
  /** Decorative stamps are hidden from assistive tech. */
  decorative?: boolean;
}

/** A standalone stamp as its own <svg>, sized by its container via className. */
export function Stamp({ model, design, tilted = false, className, decorative = false }: StampProps) {
  const box = STAMP_VIEWBOX[design.style];
  const label = [`${model.name} stamp`, model.label, model.dateText].filter(Boolean).join(", ");
  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      className={className}
      style={tilted ? { transform: `rotate(${design.rotation}deg)` } : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      overflow="visible"
    >
      <StampGraphic model={model} design={design} />
    </svg>
  );
}
