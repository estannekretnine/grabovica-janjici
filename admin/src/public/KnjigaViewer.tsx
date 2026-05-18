import { useCallback, useEffect, useRef, useState } from "react";
import { type KnjigaManifest, knjigaPageSrc } from "./knjigaTypes";

function prefetchPage(n: number) {
  const img = new Image();
  img.src = knjigaPageSrc(n);
}

export function KnjigaViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [manifest, setManifest] = useState<KnjigaManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/knjiga/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error(`manifest ${r.status}`);
        return r.json() as Promise<KnjigaManifest>;
      })
      .then((data) => {
        if (!cancelled) setManifest(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Greška učitavanja knjige");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = manifest?.total ?? 0;
  const currentPage = manifest?.pages[pageIndex];

  useEffect(() => {
    if (!currentPage) return;
    setImgLoading(true);
    prefetchPage(currentPage.n);
    if (pageIndex > 0 && manifest?.pages[pageIndex - 1]) {
      prefetchPage(manifest.pages[pageIndex - 1].n);
    }
    if (pageIndex < total - 1 && manifest?.pages[pageIndex + 1]) {
      prefetchPage(manifest.pages[pageIndex + 1].n);
    }
  }, [currentPage, pageIndex, total, manifest]);

  const goPrev = useCallback(() => {
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) void wrapRef.current.requestFullscreen();
    else void document.exitFullscreen();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!manifest) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manifest, goNext, goPrev]);

  if (loadError) {
    return (
      <div className="knjiga-viewer knjiga-viewer--error">
        <p className="muted">Knjiga nije dostupna ({loadError}).</p>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="knjiga-viewer knjiga-viewer--loading">
        <p className="muted">Učitavanje knjige…</p>
      </div>
    );
  }

  const pageLabel = currentPage?.label;
  const pagesWord = total === 1 ? "strana" : total < 5 ? "strane" : "strana";

  return (
    <div
      ref={wrapRef}
      className={`knjiga-viewer${fullscreen ? " knjiga-viewer--fullscreen" : ""}`}
    >
      <header className="knjiga-viewer__header">
        <h1 className="knjiga-viewer__title">{manifest.title}</h1>
        <span className="knjiga-viewer__meta">
          {total} {pagesWord}
        </span>
      </header>

      <div className="knjiga-viewer__stage">
        <button
          type="button"
          className="knjiga-viewer__nav knjiga-viewer__nav--prev"
          onClick={goPrev}
          disabled={pageIndex <= 0}
          aria-label="Prethodna strana"
        >
          ‹
        </button>

        <div className="knjiga-viewer__page">
          {imgLoading ? <div className="knjiga-viewer__page-loading" aria-hidden="true" /> : null}
          {currentPage ? (
            <img
              key={currentPage.n}
              src={knjigaPageSrc(currentPage.n)}
              alt={pageLabel ?? `Strana ${pageIndex + 1}`}
              className="knjiga-viewer__img"
              decoding="async"
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          ) : null}
        </div>

        <button
          type="button"
          className="knjiga-viewer__nav knjiga-viewer__nav--next"
          onClick={goNext}
          disabled={pageIndex >= total - 1}
          aria-label="Sledeća strana"
        >
          ›
        </button>
      </div>

      <footer className="knjiga-viewer__footer">
        <span className="knjiga-viewer__counter">
          {pageIndex + 1} / {total}
        </span>
        <input
          type="range"
          className="knjiga-viewer__slider"
          min={1}
          max={total}
          value={pageIndex + 1}
          onChange={(e) => setPageIndex(Number(e.target.value) - 1)}
          aria-label="Strana knjige"
        />
        <div className="knjiga-viewer__footer-actions">
          <a
            href={manifest.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="knjiga-viewer__pdf-link"
          >
            PDF
          </a>
          <button
            type="button"
            className="knjiga-viewer__fullscreen"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Izađi iz celog ekrana" : "Ceo ekran"}
          >
            {fullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
