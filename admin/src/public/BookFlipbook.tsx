import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import HTMLFlipBook from "react-pageflip";

type KnjigaManifest = {
  title: string;
  total: number;
  pdfUrl: string;
  pages: { n: number; label?: string }[];
};

const Page = forwardRef<HTMLDivElement, { src: string; label?: string }>(
  function BookPage({ src, label }, ref) {
    return (
      <div className="book-flip-page" ref={ref}>
        <img
          src={src}
          alt={label ?? ""}
          className="book-flip-page-img"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
);

type FlipBookRef = {
  pageFlip: () => {
    flipNext: (corner?: string) => void;
    flipPrev: (corner?: string) => void;
    getCurrentPageIndex: () => number;
    turnToPage: (page: number) => void;
  };
};

export function BookFlipbook() {
  const bookRef = useRef<FlipBookRef>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [manifest, setManifest] = useState<KnjigaManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [dims, setDims] = useState({ width: 560, height: 400 });

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

  useEffect(() => {
    const update = () => {
      const maxW = Math.min(720, window.innerWidth - 32);
      const w = Math.max(280, maxW);
      const h = Math.round(w * 0.72);
      setDims({ width: w, height: h });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const total = manifest?.total ?? 0;

  const flipNext = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext();
  }, []);

  const flipPrev = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") flipNext();
      if (e.key === "ArrowLeft") flipPrev();
      if (e.key === "f" || e.key === "F") {
        if (!wrapRef.current) return;
        if (!document.fullscreenElement) {
          void wrapRef.current.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipNext, flipPrev]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (loadError) {
    return (
      <div className="book-flip book-flip--error">
        <p className="muted">Knjiga nije dostupna ({loadError}).</p>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="book-flip book-flip--loading">
        <p className="muted">Učitavanje knjige…</p>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`book-flip${fullscreen ? " book-flip--fullscreen" : ""}`}
    >
      <header className="book-flip-header">
        <h2 className="book-flip-title">{manifest.title}</h2>
        <p className="book-flip-sub muted">
          List {pageIndex + 1} od {total} · strelice za okretanje
        </p>
      </header>

      <div className="book-flip-stage">
        <HTMLFlipBook
          ref={bookRef}
          width={dims.width}
          height={dims.height}
          size="stretch"
          minWidth={280}
          maxWidth={720}
          minHeight={200}
          maxHeight={520}
          showCover
          mobileScrollSupport
          usePortrait
          drawShadow
          flippingTime={600}
          className="book-flip-book"
          onFlip={(e) => setPageIndex(e.data)}
        >
          {manifest.pages.map((p) => (
            <Page
              key={p.n}
              src={`/knjiga/pages/p${String(p.n).padStart(3, "0")}.webp`}
              label={p.label}
            />
          ))}
        </HTMLFlipBook>
      </div>

      <div className="book-flip-controls">
        <button type="button" className="book-flip-btn" onClick={flipPrev} aria-label="Prethodni list">
          ‹
        </button>
        <span className="book-flip-indicator">
          {pageIndex + 1} / {total}
        </span>
        <button type="button" className="book-flip-btn" onClick={flipNext} aria-label="Sledeći list">
          ›
        </button>
        <a
          className="book-flip-link"
          href={manifest.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Otvori PDF
        </a>
        <button
          type="button"
          className="book-flip-btn book-flip-btn--ghost"
          onClick={() => {
            if (!wrapRef.current) return;
            if (!document.fullscreenElement) void wrapRef.current.requestFullscreen();
            else void document.exitFullscreen();
          }}
        >
          {fullscreen ? "Izađi" : "Ceo ekran"}
        </button>
      </div>
    </div>
  );
}
