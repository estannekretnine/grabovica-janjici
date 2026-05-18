import { KnjigaViewer } from "./KnjigaViewer";

export function PublicKnjiga() {
  return (
    <div className="public-page public-page--knjiga">
      <section className="public-section public-section--knjiga" aria-label="Knjiga">
        <KnjigaViewer />
      </section>
    </div>
  );
}
