"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Product image gallery: main image fits its frame (object-contain, never
 * cropped), a scrollable thumbnail strip switches images, and clicking the
 * main image opens a fullscreen lightbox with prev/next, keyboard arrows, and
 * Escape — the standard online-store pattern. No dependencies.
 */
export default function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const count = images.length;

  const prev = useCallback(() => setActive((a) => (a - 1 + count) % count), [count]);
  const next = useCallback(() => setActive((a) => (a + 1) % count), [count]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox, prev, next]);

  const arrowBtn =
    "absolute top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full w-11 h-11 flex items-center justify-center text-xl select-none transition-colors";

  return (
    <div className="space-y-4">
      {/* Main image — contained, never cropped */}
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="relative block w-full aspect-square rounded-lg overflow-hidden border border-white/10 bg-surface-container cursor-zoom-in"
        aria-label={`View ${name} images fullscreen`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={`${name} — image ${active + 1} of ${count}`}
          className="w-full h-full object-contain"
        />
        {count > 1 && (
          <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] font-label-bold uppercase tracking-widest px-2 py-1 rounded">
            {active + 1} / {count}
          </span>
        )}
      </button>

      {/* Thumbnail strip — scrollable when it overflows */}
      {count > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 w-20 h-20 rounded border bg-surface-container overflow-hidden transition-all ${
                i === active
                  ? "border-secondary ring-1 ring-secondary"
                  : "border-white/10 hover:border-white/40"
              }`}
              aria-label={`Show image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none w-11 h-11"
            aria-label="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[active]}
            alt={`${name} — image ${active + 1} of ${count}`}
            className="max-w-[92vw] max-h-[88vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {count > 1 && (
            <>
              <button
                type="button"
                className={`${arrowBtn} left-4`}
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous image"
              >
                ‹
              </button>
              <button
                type="button"
                className={`${arrowBtn} right-4`}
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next image"
              >
                ›
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-xs font-label-bold uppercase tracking-widest">
                {active + 1} / {count}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
