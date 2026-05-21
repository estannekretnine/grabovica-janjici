import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type KnjigaManifest, knjigaPageSrc } from "./knjigaTypes";

function prefetchImage(src: string) {
  const img = new Image();
  img.src = src;
}

export function KnjigaViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [manifest, setManifest] = useState<KnjigaManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [opened, setOpened] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);

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
          setLoadError(
            e instanceof Error ? e.message : "Greška učitavanja knjige",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = manifest?.total ?? 0;
  const pageNum = spreadIndex + 1;

  const pageSrc = useMemo(
    () => (pageNum >= 1 && pageNum <= total ? knjigaPageSrc(pageNum) : null),
    [pageNum, total],
  );

  useEffect(() => {
    if (!opened || total === 0) return;
    const prefetchNums = [pageNum + 1, pageNum + 2, pageNum - 1, pageNum - 2];
    for (const n of prefetchNums) {
      if (n >= 1 && n <= total) prefetchImage(knjigaPageSrc(n));
    }
  }, [opened, pageNum, total]);

  useEffect(() => {
    setPageLoading(true);
  }, [pageNum]);

  const goPrev = useCallback(() => {
    setSpreadIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSpreadIndex((i) => Math.min(total - 1, i + 1));
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
    if (!opened) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape" && document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (e.key === "Home") {
        e.preventDefault();
        setSpreadIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSpreadIndex(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, goPrev, goNext, total]);

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

  const { title, coverFront, coverBack } = manifest;

  const pageLabel = `${pageNum} / ${total}`;

  return (
    <div
      ref={wrapRef}
      className={`knjiga-viewer${fullscreen ? " knjiga-viewer--fullscreen" : ""}`}
      onContextMenu={(e) => {
        if (opened) e.preventDefault();
      }}
    >
      <header className="knjiga-viewer__header">
        <h1 className="knjiga-viewer__title">{title}</h1>
        <div className="knjiga-viewer__header-actions">
          {opened ? (
            <span className="knjiga-viewer__counter" aria-live="polite">
              {pageLabel}
            </span>
          ) : null}
          {opened ? (
            <button
              type="button"
              className="knjiga-viewer__pdf-link"
              onClick={() => {
                setOpened(false);
                setSpreadIndex(0);
              }}
              title="Zatvori knjigu"
            >
              Zatvori
            </button>
          ) : null}
          <button
            type="button"
            className="knjiga-viewer__fullscreen"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Izađi iz celog ekrana" : "Ceo ekran"}
            title={fullscreen ? "Izađi iz celog ekrana" : "Ceo ekran"}
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
      </header>

      <div className="knjiga-viewer__stage">
        {opened ? (
          <>
            <button
              type="button"
              className="knjiga-viewer__nav knjiga-viewer__nav--prev"
              onClick={goPrev}
              disabled={spreadIndex <= 0}
              aria-label="Prethodna strana"
            >
              ‹
            </button>

            <div className="knjiga-viewer__spread knjiga-viewer__spread--single">
              {pageSrc ? (
                <div className="knjiga-viewer__page-slot">
                  {pageLoading ? (
                    <div className="knjiga-viewer__page-loading" aria-hidden="true" />
                  ) : null}
                  <img
                    key={pageNum}
                    src={pageSrc}
                    alt={`Strana ${pageNum}`}
                    className="knjiga-viewer__img"
                    draggable={false}
                    onLoad={() => setPageLoading(false)}
                    onError={() => setPageLoading(false)}
                  />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="knjiga-viewer__nav knjiga-viewer__nav--next"
              onClick={goNext}
              disabled={spreadIndex >= total - 1}
              aria-label="Sledeća strana"
            >
              ›
            </button>
          </>
        ) : (
          <div className="knjiga-viewer__intro">
            {coverFront ? (
              <img
                src={coverFront}
                alt="Prednja korica knjige"
                className="knjiga-viewer__cover knjiga-viewer__cover--front"
                loading="lazy"
              />
            ) : null}
            <div className="knjiga-viewer__intro-info">
              <p className="knjiga-viewer__intro-title">{title}</p>
              <p className="knjiga-viewer__intro-text">
                Kliknite na dugme ispod da otvorite knjigu i listate strane.
              </p>
              <button
                type="button"
                className="knjiga-viewer__open-btn"
                onClick={() => setOpened(true)}
              >
                Otvori knjigu
              </button>
            </div>
            {coverBack ? (
              <img
                src={coverBack}
                alt="Zadnja korica knjige"
                className="knjiga-viewer__cover knjiga-viewer__cover--back"
                loading="lazy"
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
