import { describe, expect, it, vi } from "vitest";
import { canShareFiles, downloadBlob, shareFiles } from "./share";

const file = new File([new Uint8Array([1])], "my-2026-passport-story.png", { type: "image/png" });
const text = { title: "My year", text: "Made with Your Year in Stamps" };

describe("native sharing", () => {
  it("shares files when the browser supports it", async () => {
    const share = vi.fn(async () => undefined);
    const env = { navigator: { share, canShare: () => true } };
    expect(canShareFiles([file], env)).toBe(true);
    expect(await shareFiles([file], text, env)).toEqual({ outcome: "shared" });
    expect(share).toHaveBeenCalledWith({ files: [file], ...text });
  });

  it("reports unsupported when the Web Share API or file sharing is missing", async () => {
    expect(await shareFiles([file], text, { navigator: {} })).toEqual({ outcome: "unsupported" });
    expect(await shareFiles([file], text, { navigator: { share: async () => undefined, canShare: () => false } })).toEqual({ outcome: "unsupported" });
    expect(canShareFiles([file], { navigator: { share: async () => undefined, canShare: () => { throw new TypeError("bad"); } } })).toBe(false);
  });

  it("treats closing the share sheet as a cancellation, not an error", async () => {
    const env = { navigator: { canShare: () => true, share: async () => Promise.reject(new DOMException("closed", "AbortError")) } };
    expect(await shareFiles([file], text, env)).toEqual({ outcome: "cancelled" });
  });

  it("reports other share failures so the UI can offer the download instead", async () => {
    const boom = new DOMException("not allowed", "NotAllowedError");
    const env = { navigator: { canShare: () => true, share: async () => Promise.reject(boom) } };
    expect(await shareFiles([file], text, env)).toEqual({ outcome: "failed", error: boom });
  });
});

describe("download fallback", () => {
  it("clicks a temporary <a download> with the given filename", () => {
    const clicked: { href: string; download: string }[] = [];
    const anchor = {
      href: "",
      download: "",
      rel: "",
      style: { display: "" },
      click() {
        clicked.push({ href: this.href, download: this.download });
      },
      remove: vi.fn(),
    };
    const doc = { createElement: () => anchor, body: { appendChild: vi.fn() } } as unknown as Document;
    vi.useFakeTimers();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    expect(downloadBlob(new Blob(["x"]), "my-2026-passport-story.png", doc)).toBe(true);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("my-2026-passport-story.png");
    expect(clicked[0].href).toMatch(/^blob:/);
    expect(anchor.remove).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
