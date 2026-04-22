import { useEffect, useState } from "react";

type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  accent: string;
};

const CITIES: City[] = [
  { id: "zabljak", name: "Žabljak", country: "Crna Gora", lat: 43.1547, lon: 19.1225, accent: "zabljak" },
  { id: "beograd", name: "Beograd", country: "Srbija", lat: 44.7866, lon: 20.4489, accent: "beograd" },
  { id: "sarajevo", name: "Sarajevo", country: "Bosna i Hercegovina", lat: 43.8563, lon: 18.4131, accent: "sarajevo" },
  { id: "london", name: "London", country: "Velika Britanija", lat: 51.5074, lon: -0.1278, accent: "london" },
  { id: "vasington", name: "Vašington", country: "SAD", lat: 38.9072, lon: -77.0369, accent: "vasington" },
];

type DailyEntry = { date: Date; min: number; max: number; code: number };

type Forecast = {
  city: City;
  currentTemp: number;
  currentCode: number;
  daily: DailyEntry[];
};

const DAY_SHORT = ["ned.", "pon.", "uto.", "sre.", "čet.", "pet.", "sub."];

type WeatherIconKind =
  | "clear"
  | "mostlyClear"
  | "partly"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

function weatherInfo(code: number): { label: string; kind: WeatherIconKind } {
  if (code === 0) return { label: "vedro", kind: "clear" };
  if (code === 1) return { label: "pretežno vedro", kind: "mostlyClear" };
  if (code === 2) return { label: "djelimično oblačno", kind: "partly" };
  if (code === 3) return { label: "oblačno", kind: "cloud" };
  if (code === 45 || code === 48) return { label: "magla", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "rosulja", kind: "drizzle" };
  if (code >= 61 && code <= 67) return { label: "kiša", kind: "rain" };
  if (code >= 71 && code <= 77) return { label: "snijeg", kind: "snow" };
  if (code >= 80 && code <= 82) return { label: "pljuskovi", kind: "rain" };
  if (code === 85 || code === 86) return { label: "snježni pljuskovi", kind: "snow" };
  if (code >= 95) return { label: "grmljavina", kind: "thunder" };
  return { label: "oblačno", kind: "cloud" };
}

/** Europa — satelitski / topografski prikaz (Wikimedia Commons); tamni filter u CSS-u približava IR izgledu. */
const EUROPE_MAP_SRC =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/A_physical_map_of_Europe.jpg/640px-A_physical_map_of_Europe.jpg";

const EUMETSAT_VIEWER_URL = "https://view.eumetsat.int/productviewer?v=Satellite:MSG:IODC:LRVCLDelayTime";

const svgProps = {
  viewBox: "0 0 48 48",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function WeatherOutlineIcon({ kind, className }: { kind: WeatherIconKind; className?: string }) {
  const cn = ["public-weather-outline-icon", className].filter(Boolean).join(" ");
  switch (kind) {
    case "clear":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <circle cx="24" cy="24" r="9" />
          <path d="M24 4v4M24 40v4M4 24h4M40 24h4M9.9 9.9l2.8 2.8M35.3 35.3l2.8 2.8M9.9 38.1l2.8-2.8M35.3 12.7l2.8-2.8" />
        </svg>
      );
    case "mostlyClear":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M14 30c0-5 4-9 9-9 1.5 0 3 .3 4.3 1" />
          <path d="M18 34h18a5 5 0 0 0-10-8 5 5 0 0 0-8 7z" />
          <circle cx="34" cy="14" r="6" />
          <path d="M34 6v2M34 20v2M26 14h-2M44 14h-2M28.3 8.3l1.4 1.4M39.3 19.3l1.4 1.4M28.3 19.7l1.4-1.4M39.3 8.7l1.4-1.4" />
        </svg>
      );
    case "partly":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 32c0-6 5-11 11-11 2 0 4 .5 5.6 1.4" />
          <path d="M14 36h20a5.5 5.5 0 0 0-11-9 5.5 5.5 0 0 0-9 8z" />
          <circle cx="36" cy="16" r="7" />
          <path d="M36 7v2.5M36 22.5V25M29 16h-2.5M45.5 16H48M31 10l2 2M41 22l2 2M31 22l2-2M41 10l2-2" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M12 34h26a8 8 0 0 0-15.5-3A10 10 0 1 0 12 34z" />
        </svg>
      );
    case "fog":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 22h28a7 7 0 0 0-14-2 7 7 0 0 0-14 2z" />
          <path d="M8 30h32M10 36h28M12 42h24" strokeWidth="1.5" />
        </svg>
      );
    case "drizzle":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 20h28a7 7 0 0 0-14-2 7 7 0 0 0-14 2z" />
          <path d="M16 28v6M24 28v8M32 28v6" strokeWidth="1.5" strokeDasharray="2 3" />
        </svg>
      );
    case "rain":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 18h28a7 7 0 0 0-14-2 7 7 0 0 0-14 2z" />
          <path d="M14 28l-3 10M24 26l-3 12M34 28l-3 10" strokeWidth="1.75" />
        </svg>
      );
    case "snow":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 18h28a7 7 0 0 0-14-2 7 7 0 0 0-14 2z" />
          <path d="M16 30l2 2m-2 0l2-2m8-2l2 2m-2 0l2-2m8 0l2 2m-2 0l2-2" strokeWidth="1.5" />
        </svg>
      );
    case "thunder":
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M10 18h28a7 7 0 0 0-14-2 7 7 0 0 0-14 2z" />
          <path d="M26 26l-6 12h8l-4 10" strokeWidth="2" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps} className={cn} aria-hidden>
          <path d="M12 34h26a8 8 0 0 0-15.5-3A10 10 0 1 0 12 34z" />
        </svg>
      );
  }
}

async function fetchForecast(city: City): Promise<Forecast | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${city.lat}&longitude=${city.lon}` +
      `&current_weather=true` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=8`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const current = data?.current_weather;
    const d = data?.daily;
    if (!current || !d) return null;
    const daily: DailyEntry[] = [];
    const days: string[] = d.time || [];
    const maxs: number[] = d.temperature_2m_max || [];
    const mins: number[] = d.temperature_2m_min || [];
    const codes: number[] = d.weathercode || [];
    for (let i = 1; i < Math.min(days.length, 8); i += 1) {
      daily.push({
        date: new Date(days[i]),
        min: Math.round(mins[i]),
        max: Math.round(maxs[i]),
        code: codes[i] ?? 0,
      });
    }
    return {
      city,
      currentTemp: Math.round(current.temperature),
      currentCode: Number(current.weathercode ?? 0),
      daily,
    };
  } catch {
    return null;
  }
}

export function WeatherWidget() {
  const [forecasts, setForecasts] = useState<Array<Forecast | null>>([]);
  const [loading, setLoading] = useState(true);
  const [mapImgFailed, setMapImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all(CITIES.map(fetchForecast))
      .then((res) => {
        if (!active) return;
        setForecasts(res);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="public-section public-weather-section">
      <div className="public-weather-shell">
        <div className="public-weather-main-col">
          <h2 className="public-weather-title">Prognoze za odabrane gradove</h2>
          <div className="public-weather-cards">
            {loading && forecasts.length === 0
              ? CITIES.map((c) => (
                  <div key={c.id} className={`public-weather-card public-weather-card--skeleton public-weather-card--${c.accent}`}>
                    <div className="public-weather-card-skeleton">Učitavanje…</div>
                  </div>
                ))
              : forecasts.map((f, idx) => {
                  const c = CITIES[idx];
                  if (!f) {
                    return (
                      <div key={c.id} className={`public-weather-card public-weather-card--${c.accent}`}>
                        <div className="public-weather-card-left">
                          <div className="public-weather-city">
                            <div className="public-weather-city-name">{c.name}</div>
                            <div className="public-weather-city-country">{c.country}</div>
                          </div>
                        </div>
                        <div className="public-weather-forecast public-weather-forecast--message">Nedostupno</div>
                      </div>
                    );
                  }
                  const info = weatherInfo(f.currentCode);
                  return (
                    <div key={c.id} className={`public-weather-card public-weather-card--${c.accent}`}>
                      <div className="public-weather-card-left">
                        <div className="public-weather-city">
                          <div className="public-weather-city-name">{c.name}</div>
                          <div className="public-weather-city-country">{c.country}</div>
                        </div>
                        <div className="public-weather-now">
                          <WeatherOutlineIcon kind={info.kind} className="public-weather-now-svg" />
                          <div className="public-weather-now-temp">
                            <span className="public-weather-now-value">{f.currentTemp}°C</span>
                            <span className="public-weather-now-label">{info.label}</span>
                          </div>
                        </div>
                      </div>
                      <div className="public-weather-forecast">
                        {f.daily.map((day) => {
                          const di = weatherInfo(day.code);
                          return (
                            <div key={day.date.toISOString()} className="public-weather-day">
                              <div className="public-weather-day-name">{DAY_SHORT[day.date.getDay()]}</div>
                              <WeatherOutlineIcon kind={di.kind} className="public-weather-day-svg" />
                              <div className="public-weather-day-temp public-weather-day-temp--max">
                                {day.max}°C
                              </div>
                              <div className="public-weather-day-temp public-weather-day-temp--min">
                                {day.min}°C
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
        <aside className="public-weather-map-col" aria-label="Prikaz oblačnosti u Europi">
          <h3 className="public-weather-map-heading">Prikaz oblačnosti u Europi</h3>
          <p className="public-weather-map-sub">
            U području infracrvenog spektra, posljednja 4 sata (animacija) — izvor: Meteosat / EUMETSAT, u lokalnom
            vremenu. Statička slika ispod je ilustracija; uživo na EUMETSAT.
          </p>
          <a
            className="public-weather-map-frame"
            href={EUMETSAT_VIEWER_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {mapImgFailed ? (
              <div className="public-weather-map-fallback" aria-hidden>
                <span>Otvori EUMETSAT za animiranu oblačnost</span>
              </div>
            ) : (
              <img
                src={EUROPE_MAP_SRC}
                alt="Prikaz Europe — ilustrativna karta (Wikimedia Commons)"
                className="public-weather-map-img"
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
                onError={() => setMapImgFailed(true)}
              />
            )}
            <span className="public-weather-map-chip">Prikaz oblačnosti</span>
          </a>
        </aside>
      </div>
      <p className="public-weather-source">
        Prognoza: Open-Meteo · Karta: Wikimedia Commons · Uživo:{" "}
        <a href={EUMETSAT_VIEWER_URL} target="_blank" rel="noopener noreferrer">
          EUMETSAT
        </a>
      </p>
    </section>
  );
}
