import { useCallback, useEffect, useState } from "react";
import { PUBLIC_HERITAGE_IMAGES } from "./publicMedia";
import { WeatherWidget } from "./WeatherWidget";
import { BookFlipbook } from "./BookFlipbook";

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

function HeritageTile({
  item,
  index,
  onOpen,
  className,
}: {
  item: (typeof PUBLIC_HERITAGE_IMAGES)[number];
  index: number;
  onOpen: (i: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`public-home-heritage-item${className ? ` ${className}` : ""}`}
      onClick={() => onOpen(index)}
      aria-label={item.alt}
    >
      <div className="public-home-heritage-img-wrap">
        <img
          src={item.src}
          alt=""
          className="public-home-heritage-img"
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          width={1000}
          height={680}
        />
      </div>
    </button>
  );
}

export function PublicHome() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const heroImage = PUBLIC_HERITAGE_IMAGES[0];
  const galleryImages = PUBLIC_HERITAGE_IMAGES.slice(1);

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
      <div className="public-home-transition" aria-hidden="true" />

      {heroImage ? (
        <section className="public-section public-home-hero" aria-label="Glavna fotografija">
          <HeritageTile item={heroImage} index={0} onOpen={setLightboxIndex} className="public-home-hero-item" />
        </section>
      ) : null}

      {galleryImages.length > 0 ? (
        <section className="public-section public-home-heritage" aria-label="Galerija fotografija">
          <div className="public-home-heritage-grid">
            {galleryImages.map((item, i) => (
              <HeritageTile key={item.src} item={item} index={i + 1} onOpen={setLightboxIndex} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="public-section public-home-knjiga" aria-label="Knjiga Grabovica">
        <BookFlipbook />
      </section>

      <WeatherWidget />
      {lightboxIndex !== null ? (
        <HomeLightbox index={lightboxIndex} onClose={closeLightbox} onPrev={goPrev} onNext={goNext} />
      ) : null}
    </div>
  );
}
