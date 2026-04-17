import { PUBLIC_IMG_DURMITOR, PUBLIC_IMG_DURMITOR_ART } from "./publicMedia";

export function PublicHome() {
  return (
    <div className="public-page">
      <section className="public-hero" style={{ backgroundImage: `url(${PUBLIC_IMG_DURMITOR})` }}>
        <div className="public-hero-overlay" />
        <div className="public-hero-content">
          <h1 className="public-hero-title">Porodica Janjić — Grabovica</h1>
          <p className="public-hero-sub">
            Rodoslov i zajednica: činjenice, generacije i veze koje povezuju porodicu u Crnoj Gori i dijaspori.
          </p>
        </div>
      </section>

      <section className="public-section public-home-showcase">
        <div className="public-home-showcase-img-wrap">
          <img
            src={PUBLIC_IMG_DURMITOR_ART}
            alt="Durmitor — Crna Gora"
            className="public-home-showcase-img"
            loading="lazy"
          />
        </div>
        <div className="public-home-showcase-text">
          <h2 className="public-home-showcase-title">Crna Gora — zavičaj</h2>
          <p className="public-home-showcase-lead">
            Durmitor, planine, kanjoni i jezera — priroda koja je oblikovala generacije porodice Janjić iz Grabovice.
          </p>
          <p className="public-home-showcase-body">
            Na ovom sajtu čuvamo porodično stablo, sećanja i veze među članovima raširenim po Crnoj Gori i dijaspori.
            Svi podaci su dostupni kroz administraciju; rodoslov možete pregledati na stranici <strong>Stablo</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}
