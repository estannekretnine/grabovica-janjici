import { PUBLIC_IMG_DURMITOR, PUBLIC_HERITAGE_IMAGES } from "./publicMedia";

export function PublicHome() {
  return (
    <div className="public-page">
      <section
        className="public-hero public-hero--home"
        style={{ backgroundImage: `url(${PUBLIC_IMG_DURMITOR})` }}
      >
        <div className="public-hero-overlay" />
        <div className="public-hero-content">
          <h1 className="public-hero-title">Porodica Janjić — Crna Gora - Grabovica</h1>
          <p className="public-hero-sub">
            Rodoslov i zajednica: činjenice, generacije i veze koje povezuju porodicu u Crnoj Gori i dijaspori.
          </p>
        </div>
      </section>

      <section className="public-section public-home-heritage">
        <p className="public-lead public-home-heritage-lead">
          Fotografije iz porodičnog zapisa: istorijske kuće, kule i mesta u Grabovici i okolini.
        </p>
        <div className="public-home-heritage-grid">
          {PUBLIC_HERITAGE_IMAGES.map((item) => (
            <figure key={item.src} className="public-home-heritage-figure">
              <div className="public-home-heritage-img-wrap">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="public-home-heritage-img"
                  loading="lazy"
                  decoding="async"
                  width={1000}
                  height={900}
                />
              </div>
              <figcaption className="public-home-heritage-caption">{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
