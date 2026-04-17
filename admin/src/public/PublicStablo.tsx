import { PUBLIC_IMG_TREE } from "./publicMedia";

export function PublicStablo() {
  return (
    <div className="public-page public-page--narrow">
      <section className="public-section">
        <h1 className="public-page-title">Stablo</h1>
        <p className="public-lead">
          Porodično stablo povezuje generacije — od predaka do potomaka. U administraciji možete unositi članove,
          roditelj–dete i partnerske veze, kao i prikaz u obliku stabla.
        </p>
        <div className="public-card">
          <img
            src={PUBLIC_IMG_TREE}
            alt="Rodoslovno stablo — ilustracija"
            className="public-tree-img public-tree-img--large"
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
