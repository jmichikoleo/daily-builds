// src/lib/image.ts
// photo resizing for the identity page and the file download helper.
// png export lives in exportImage.ts and is loaded only when used.
// everything happens in a canvas in this browser. nothing is uploaded.


/** squares and shrinks a picked photo to a small jpeg data url */
export function resizePhoto(file: File, size = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("that file is not an image."));
    if (file.size > 25_000_000) return reject(new Error("that image is very large. try one under 25 mb."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = Math.round(size * 1.25);
      const c = canvas.getContext("2d");
      if (!c) return reject(new Error("this browser cannot process images."));
      const sw = s;
      const sh = Math.min(img.naturalHeight, s * 1.25);
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      c.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("that image could not be opened."));
    };
    img.src = url;
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
