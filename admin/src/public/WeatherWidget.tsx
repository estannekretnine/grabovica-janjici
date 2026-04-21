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

function weatherInfo(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "vedro", icon: "☀️" };
  if (code === 1) return { label: "pretežno vedro", icon: "🌤️" };
  if (code === 2) return { label: "djelimično oblačno", icon: "⛅" };
  if (code === 3) return { label: "oblačno", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "magla", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "rosulja", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "kiša", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "snijeg", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "pljuskovi", icon: "🌦️" };
  if (code === 85 || code === 86) return { label: "snježni pljuskovi", icon: "🌨️" };
  if (code >= 95) return { label: "grmljavina", icon: "⛈️" };
  return { label: "—", icon: "☁️" };
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
      <h2 className="public-weather-title">Prognoze za odabrane gradove</h2>
      <div className="public-weather-grid">
        {loading && forecasts.length === 0
          ? CITIES.map((c) => (
              <div key={c.id} className={`public-weather-card public-weather-card--${c.accent}`}>
                <div className="public-weather-card-skeleton">Učitavanje…</div>
              </div>
            ))
          : forecasts.map((f, idx) => {
              const c = CITIES[idx];
              if (!f) {
                return (
                  <div key={c.id} className={`public-weather-card public-weather-card--${c.accent}`}>
                    <div className="public-weather-city">
                      <div className="public-weather-city-name">{c.name}</div>
                      <div className="public-weather-city-country">{c.country}</div>
                    </div>
                    <div className="public-weather-card-skeleton">Nedostupno</div>
                  </div>
                );
              }
              const info = weatherInfo(f.currentCode);
              return (
                <div key={c.id} className={`public-weather-card public-weather-card--${c.accent}`}>
                  <div className="public-weather-city">
                    <div className="public-weather-city-name">{c.name}</div>
                    <div className="public-weather-city-country">{c.country}</div>
                  </div>
                  <div className="public-weather-now">
                    <div className="public-weather-now-icon" aria-hidden="true">
                      {info.icon}
                    </div>
                    <div className="public-weather-now-temp">
                      <span className="public-weather-now-value">{f.currentTemp}°C</span>
                      <span className="public-weather-now-label">{info.label}</span>
                    </div>
                  </div>
                  <div className="public-weather-forecast">
                    {f.daily.map((day) => {
                      const di = weatherInfo(day.code);
                      return (
                        <div key={day.date.toISOString()} className="public-weather-day">
                          <div className="public-weather-day-name">{DAY_SHORT[day.date.getDay()]}</div>
                          <div className="public-weather-day-icon" aria-hidden="true">
                            {di.icon}
                          </div>
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
      <p className="public-weather-source">Izvor: Open-Meteo · Ažurirano automatski</p>
    </section>
  );
}
