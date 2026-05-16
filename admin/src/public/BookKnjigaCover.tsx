import { useCallback, useEffect, useState } from "react";

const PDF_URL = "/knjiga/grabovica-sken.pdf";
const COVER_SRC = "/knjiga/pages/p001.webp";

export function BookKnjigaCover({ embedded = false }: { embedded?: boolean }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const cover = (
    <button
      type="button"
      className="public-knjiga-cover-btn"
      onClick={() => setOpen(true)}
      aria-label="Otvori knjigu — pun ekran PDF"
    >
      <img
        src={COVER_SRC}
        alt=""
        className="public-knjiga-cover-img"
        width={360}
        height={480}
        loading="lazy"
        decoding="async"
      />
      <span className="public-knjiga-cover-label">Čitaj knjigu</span>
    </button>
  );

  return (
    <>
      {embedded ? (
        <div className="public-home-knjiga-slot" aria-label="Knjiga Grabovica">
          {cover}
        </div>
      ) : (
        <section className="public-section public-home-knjiga" aria-label="Knjiga Grabovica">
          {cover}
        </section>
      )}

      {open ? (
        <div className="public-pdf-fullscreen" role="dialog" aria-modal="true" aria-label="Knjiga PDF">
          <div className="public-pdf-fullscreen-bar">
            <span className="public-pdf-fullscreen-title">Grabovica u Drobnjaku i porodice u njoj</span>
            <button
              type="button"
              className="public-pdf-fullscreen-close"
              onClick={close}
              aria-label="Zatvori knjigu"
            >
              Zatvori ×
            </button>
          </div>
          <iframe
            className="public-pdf-fullscreen-frame"
            src={PDF_URL}
            title="Knjiga Grabovica PDF"
          />
        </div>
      ) : null}
    </>
  );
}
