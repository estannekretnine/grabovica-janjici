import { useCallback, useEffect, useState } from "react";
import { PUBLIC_HERITAGE_IMAGES } from "./publicMedia";
import { WeatherWidget } from "./WeatherWidget";

function HomeLightbox({
  index,
  onClose,
  onPrev,
  onNext,
}: {
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const item = PUBLIC_HERITAGE_IMAGES[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  if (!item) return null;

  return (
    <div
      className="public-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pregled fotografije"
      onClick={onClose}
    >
      <button
        type="button"
        className="public-lightbox-btn public-lightbox-btn--close"
        aria-label="Zatvori"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
      <button
        type="button"
        className="public-lightbox-btn public-lightbox-btn--prev"
        aria-label="Prethodna fotografija"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        ‹
      </button>
      <button
        type="button"
        className="public-lightbox-btn public-lightbox-btn--next"
        aria-label="Sledeća fotografija"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        ›
      </button>
      <div className="public-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img src={item.src} alt={item.alt} className="public-lightbox-img" decoding="async" />
      </div>
    </div>
  );
}

export function PublicHome() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null) return i;
      const n = PUBLIC_HERITAGE_IMAGES.length;
      return i <= 0 ? n - 1 : i - 1;
    });
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => {
      if (i === null) return i;
      const n = PUBLIC_HERITAGE_IMAGES.length;
      return i >= n - 1 ? 0 : i + 1;
    });
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxIndex]);

  return (
    <div className="public-page">
      <section className="public-section public-home-heritage">
        <div className="public-home-heritage-grid">
          {PUBLIC_HERITAGE_IMAGES.map((item, i) => (
            <button
              key={item.src}
              type="button"
              className="public-home-heritage-item"
              onClick={() => setLightboxIndex(i)}
              aria-label={item.alt}
            >
              <div className="public-home-heritage-img-wrap">
                <img
                  src={item.src}
                  alt=""
                  className="public-home-heritage-img"
                  loading="lazy"
                  decoding="async"
                  width={1000}
                  height={680}
                />
              </div>
            </button>
          ))}
        </div>
      </section>
      <WeatherWidget />
      {lightboxIndex !== null ? (
        <HomeLightbox index={lightboxIndex} onClose={closeLightbox} onPrev={goPrev} onNext={goNext} />
      ) : null}
    </div>
  );
}
