import { useCallback, useEffect, useRef, useState } from "react";
import { type KnjigaManifest } from "./knjigaTypes";

export function KnjigaViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [manifest, setManifest] = useState<KnjigaManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [opened, setOpened] = useState(false);

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

  const { title, pdfUrl, coverFront, coverBack } = manifest;

  return (
    <div
      ref={wrapRef}
      className={`knjiga-viewer${fullscreen ? " knjiga-viewer--fullscreen" : ""}`}
    >
      <header className="knjiga-viewer__header">
        <h1 className="knjiga-viewer__title">{title}</h1>
        <div className="knjiga-viewer__header-actions">
          {opened ? (
            <button
              type="button"
              className="knjiga-viewer__pdf-link"
              onClick={() => setOpened(false)}
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
          <iframe
            title={title}
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=Fit&pagemode=none`}
            className="knjiga-viewer__pdf"
            loading="lazy"
            onContextMenu={(e) => e.preventDefault()}
          />
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
                Kliknite na dugme ispod da otvorite knjigu i pregledate sve strane.
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
