export type ExportErrorCode = "empty" | "unsupported" | "fonts" | "image" | "canvas" | "share";

const MESSAGES: Record<ExportErrorCode, string> = {
  empty: "Add at least one stamp to your passport before saving it.",
  unsupported: "This browser can't create images. Try a recent version of Chrome, Safari, Edge or Firefox.",
  fonts: "We couldn't load the lettering for your collage, so we stopped rather than save it with the wrong fonts. Check your connection and try again.",
  image: "Your collage couldn't be drawn as an image. Try again; if it keeps happening, try another browser.",
  canvas: "The browser refused to create the image file. Try again, or try another browser.",
  share: "Sharing didn't work on this device. You can save the image instead and post it from your photos.",
};

/** An export failure with a message written for the person using the app. */
export class ExportError extends Error {
  readonly code: ExportErrorCode;
  constructor(code: ExportErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "ExportError";
    this.code = code;
    if (detail) this.cause = detail;
  }
}

export function toExportError(err: unknown, fallback: ExportErrorCode): ExportError {
  return err instanceof ExportError ? err : new ExportError(fallback, err instanceof Error ? err.message : String(err));
}
