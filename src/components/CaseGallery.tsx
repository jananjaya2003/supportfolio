import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { CaseImage } from "../data/cases";

/** Thumbnail grid + modal lightbox (native <dialog>: focus trap, Esc to close, top layer). */
export function CaseGallery({ images, title }: { images: CaseImage[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = openIndex === null ? null : images[openIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) dialog.showModal();
    if (openIndex === null && dialog.open) dialog.close();
    document.body.classList.toggle("dialog-open", openIndex !== null);
    return () => document.body.classList.remove("dialog-open");
  }, [openIndex]);

  const step = (delta: number) => setOpenIndex((index) => (index === null ? index : (index + delta + images.length) % images.length));

  return (
    <>
      <div className={`case-gallery${images.length === 1 ? " single" : ""}`}>
        {images.map((image, index) => (
          <figure className="gallery-item" key={image.id}>
            <button type="button" className="gallery-thumb" onClick={() => setOpenIndex(index)} aria-label={`View image ${index + 1} of ${images.length} full size${image.caption ? `: ${image.caption}` : ""}`}>
              <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
              <span className="gallery-zoom" aria-hidden="true"><Maximize2 size={13} /></span>
            </button>
            {image.caption && <figcaption>{image.caption}</figcaption>}
          </figure>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label={`${title} — images`}
        onClose={() => setOpenIndex(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpenIndex(null); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") step(1);
          if (event.key === "ArrowLeft") step(-1);
        }}
      >
        {current && openIndex !== null && (
          <div className="lightbox-inner">
            <div className="lightbox-bar">
              <span>Image {openIndex + 1} of {images.length}</span>
              <button type="button" className="lightbox-close" onClick={() => setOpenIndex(null)} aria-label="Close image viewer"><X size={18} /></button>
            </div>
            <div className="lightbox-stage">
              {images.length > 1 && <button type="button" className="lightbox-nav prev" onClick={() => step(-1)} aria-label="Previous image"><ChevronLeft size={20} /></button>}
              <img key={current.id} src={current.src} alt={current.alt} />
              {images.length > 1 && <button type="button" className="lightbox-nav next" onClick={() => step(1)} aria-label="Next image"><ChevronRight size={20} /></button>}
            </div>
            {current.caption && <p className="lightbox-caption">{current.caption}</p>}
          </div>
        )}
      </dialog>
    </>
  );
}
