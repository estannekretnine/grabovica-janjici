import { PUBLIC_HERITAGE_IMAGES } from "./publicMedia";
import { WeatherWidget } from "./WeatherWidget";

export function PublicHome() {
  return (
    <div className="public-page">
      <section className="public-section public-home-heritage">
        <p className="public-lead public-home-heritage-lead">
          Fotografije iz porodičnog zapisa: istorijske kuće, kule i mesta u Grabovici i okolini.
        </p>
        <div className="public-home-heritage-grid">
          {PUBLIC_HERITAGE_IMAGES.map((item) => (
            <figure key={item.src} className="public-home-heritage-figure">
              {item.captionAbove ? (
                <p className="public-home-heritage-caption public-home-heritage-caption--above">{item.captionAbove}</p>
              ) : null}
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
              <figcaption className="public-home-heritage-caption public-home-heritage-caption--below">
                {item.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <WeatherWidget />
    </div>
  );
}
