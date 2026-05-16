import { useCallback, useEffect } from "react";

export const KNIGA_PDF_URL = "/knjiga/grabovica-sken.pdf";
const KNIGA_TITLE = "Grabovica u Drobnjaku i porodice u njoj";

export function KnjigaPdfModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useCallback(() => onClose(), [onClose]);

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

  if (!open) return null;

  return (
    <div className="public-pdf-fullscreen" role="dialog" aria-modal="true" aria-label="Knjiga PDF">
      <div className="public-pdf-fullscreen-bar">
        <span className="public-pdf-fullscreen-title">{KNIGA_TITLE}</span>
        <button
          type="button"
          className="public-pdf-fullscreen-close"
          onClick={close}
          aria-label="Zatvori knjigu"
        >
          Zatvori ×
        </button>
      </div>
      <iframe className="public-pdf-fullscreen-frame" src={KNIGA_PDF_URL} title="Knjiga Grabovica PDF" />
    </div>
  );
}
