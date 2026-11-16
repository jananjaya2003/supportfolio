const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const ACCEPT_ATTRIBUTE = ACCEPTED.join(",");
const MAX_EDGE = 1920;
// Matches the server limit (Vercel Functions accept up to 4.5 MB per request).
const MAX_BYTES = 4 * 1024 * 1024;

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
}

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(new Error("The file couldn't be read."));
  reader.readAsDataURL(blob);
});

/**
 * Screenshots are often 4K PNGs (several MB). Downscale to 1920px on the long edge and
 * re-encode as WebP, which keeps text crisp, shrinks files ~10×, and strips EXIF metadata
 * (camera photos can carry GPS location). GIFs pass through untouched to keep animation.
 * SVG is rejected: served from this origin it could run script.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error(`${file.name || "That file"} isn't a PNG, JPG, WebP, or GIF image.`);

  if (file.type === "image/gif") {
    if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 4 MB. GIFs aren't resized, so trim or compress it first.`);
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { dataUrl: await readAsDataUrl(file), ...size };
  }

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error(`${file.name || "That image"} couldn't be decoded.`); }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't process images.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error(`${file.name || "That image"} couldn't be converted.`);
  if (blob.size > MAX_BYTES) throw new Error(`${file.name} is still larger than 4 MB after resizing.`);
  return { dataUrl: await readAsDataUrl(blob), width, height };
}

/** Suggest alt text from a file name: "outlook-error_0x800CCC0E.png" → "Outlook error 0x800CCC0E". */
export function altFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base || /^(image|screenshot|img|photo)?\s*\d*$/i.test(base)) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}
