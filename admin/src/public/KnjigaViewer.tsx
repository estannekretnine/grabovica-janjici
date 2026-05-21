import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type KnjigaManifest } from "./knjigaTypes";

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [mod, workerMod] = await Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
      ]);
      mod.GlobalWorkerOptions.workerSrc = workerMod.default;
      return mod;
    })();
  }
  return pdfjsPromise;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 720px)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export function KnjigaViewer() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  const [manifest, setManifest] = useState<KnjigaManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [opened, setOpened] = useState(false);

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [rendering, setRendering] = useState(false);

  const isMobile = useIsMobile();
  const pagesPerSpread = isMobile ? 1 : 2;
  const totalSpreads = Math.max(1, Math.ceil(totalPages / pagesPerSpread));
  const leftPageNum = spreadIndex * pagesPerSpread + 1;
  const rightPageNum = pagesPerSpread === 2 ? leftPageNum + 1 : 0;

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

  useEffect(() => {
    if (!opened || !manifest) return;
    if (pdf) return;
    let cancelled = false;
    let taskRef: { destroy: () => Promise<void> } | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;
        const task = pdfjs.getDocument({
          url: manifest.pdfUrl,
          disableAutoFetch: true,
          disableStream: false,
        });
        taskRef = task;
        const doc = await task.promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        setPdf(doc);
        setTotalPages(doc.numPages);
      } catch (e: unknown) {
        if (!cancelled) {
          setPdfError(
            e instanceof Error ? e.message : "Greška učitavanja PDF-a",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      if (taskRef) void taskRef.destroy();
    };
  }, [opened, manifest, pdf]);

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setStageSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [opened]);

  const renderPageOnCanvas = useCallback(
    async (
      pageNum: number,
      canvas: HTMLCanvasElement | null,
      availableW: number,
      availableH: number,
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!pdf || pageNum < 1 || pageNum > pdf.numPages || availableW <= 0 || availableH <= 0) {
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = "0";
        canvas.style.height = "0";
        return;
      }
      const page = await pdf.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(availableW / base.width, availableH / base.height);
      if (!Number.isFinite(scale) || scale <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      if (!ctx) return;
      await page.render({
        canvasContext: ctx,
        viewport,
        canvas,
      }).promise;
    },
    [pdf],
  );

  useEffect(() => {
    if (!pdf || stageSize.width <= 0 || stageSize.height <= 0) return;
    let cancelled = false;
    setRendering(true);
    const gap = pagesPerSpread === 2 ? 16 : 0;
    const padding = 16;
    const availableW = Math.max(0, (stageSize.width - gap - padding * 2) / pagesPerSpread);
    const availableH = Math.max(0, stageSize.height - padding * 2);
    void (async () => {
      try {
        await renderPageOnCanvas(leftPageNum, leftCanvasRef.current, availableW, availableH);
        if (cancelled) return;
        if (pagesPerSpread === 2) {
          await renderPageOnCanvas(rightPageNum, rightCanvasRef.current, availableW, availableH);
        } else if (rightCanvasRef.current) {
          rightCanvasRef.current.width = 0;
          rightCanvasRef.current.height = 0;
        }
      } catch {
        // ignore render aborts
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, leftPageNum, rightPageNum, pagesPerSpread, stageSize, renderPageOnCanvas]);

  const goPrev = useCallback(() => {
    setSpreadIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setSpreadIndex((i) => Math.min(totalSpreads - 1, i + 1));
  }, [totalSpreads]);

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
        setSpreadIndex(totalSpreads - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened, goPrev, goNext, totalSpreads]);

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

  const pageLabel =
    pagesPerSpread === 2 && rightPageNum <= totalPages
      ? `${leftPageNum}–${rightPageNum} / ${totalPages}`
      : `${leftPageNum} / ${totalPages}`;

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
              {totalPages > 0 ? pageLabel : "…"}
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

      <div className="knjiga-viewer__stage" ref={stageRef}>
        {opened ? (
          pdfError ? (
            <div className="knjiga-viewer__pdf-error">
              <p className="muted">Greška: {pdfError}</p>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="knjiga-viewer__nav knjiga-viewer__nav--prev"
                onClick={goPrev}
                disabled={spreadIndex <= 0}
                aria-label="Prethodne strane"
              >
                ‹
              </button>

              <div className={`knjiga-viewer__spread${pagesPerSpread === 1 ? " knjiga-viewer__spread--single" : ""}`}>
                <canvas
                  ref={leftCanvasRef}
                  className="knjiga-viewer__canvas"
                  aria-label={`Strana ${leftPageNum}`}
                />
                {pagesPerSpread === 2 ? (
                  <canvas
                    ref={rightCanvasRef}
                    className="knjiga-viewer__canvas"
                    aria-label={`Strana ${rightPageNum}`}
                    style={{ visibility: rightPageNum > totalPages && totalPages > 0 ? "hidden" : undefined }}
                  />
                ) : null}
                {!pdf || rendering ? (
                  <div className="knjiga-viewer__page-loading-overlay" aria-hidden="true">
                    <span>Učitavanje…</span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="knjiga-viewer__nav knjiga-viewer__nav--next"
                onClick={goNext}
                disabled={spreadIndex >= totalSpreads - 1}
                aria-label="Sledeće strane"
              >
                ›
              </button>
            </>
          )
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
