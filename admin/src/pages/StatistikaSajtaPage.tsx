import { useCallback, useEffect, useMemo, useState } from "react";
import { audit } from "../lib/supabase";
import type { Database } from "../types/database";

type SessionRow = Database["audit"]["Tables"]["gr_site_sessions"]["Row"];
type ViewRow = Database["audit"]["Tables"]["gr_site_page_views"]["Row"];

type SessionStat = {
  session: SessionRow;
  pages: string[];
  totalDurationSec: number;
};

type CountryStat = {
  country: string;
  visits: number;
  uniqueVisitors: number;
};

function toDateInputValue(value: Date) {
  const d = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return {
    from: toDateInputValue(from),
    to: toDateInputValue(today),
  };
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("sr-Latn-ME");
}

function formatDuration(seconds: number) {
  if (!seconds || seconds < 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function StatistikaSajtaPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => getDefaultDateRange().from);
  const [toDate, setToDate] = useState(() => getDefaultDateRange().to);

  const load = useCallback(async () => {
    if (!audit) return;
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) {
      setError("Datum 'Od' ne može biti posle datuma 'Do'.");
      return;
    }
    const fromIso = new Date(`${fromDate}T00:00:00`).toISOString();
    const toIso = new Date(`${toDate}T23:59:59.999`).toISOString();

    const [sessionsRes, viewsRes] = await Promise.all([
      audit
        .from("gr_site_sessions")
        .select("*")
        .gte("started_at", fromIso)
        .lte("started_at", toIso)
        .order("started_at", { ascending: false })
        .limit(3000),
      audit
        .from("gr_site_page_views")
        .select("*")
        .gte("viewed_at", fromIso)
        .lte("viewed_at", toIso)
        .order("viewed_at", { ascending: false })
        .limit(15000),
    ]);
    if (sessionsRes.error) {
      setError(sessionsRes.error.message);
      return;
    }
    if (viewsRes.error) {
      setError(viewsRes.error.message);
      return;
    }
    setError(null);
    setSessions(sessionsRes.data ?? []);
    setViews(viewsRes.data ?? []);
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo<SessionStat[]>(() => {
    const bySession = new Map<string, ViewRow[]>();
    for (const view of views) {
      const arr = bySession.get(view.session_id) ?? [];
      arr.push(view);
      bySession.set(view.session_id, arr);
    }
    return sessions.map((session) => {
      const list = bySession.get(session.id) ?? [];
      const ordered = [...list].sort((a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime());
      return {
        session,
        pages: ordered.map((v) => v.path),
        totalDurationSec: ordered.reduce((sum, v) => sum + (v.duration_seconds ?? 0), 0),
      };
    });
  }, [sessions, views]);

  const currentlyOnline = useMemo(
    () => sessions.filter((s) => Date.now() - new Date(s.last_seen).getTime() <= 2 * 60 * 1000).length,
    [sessions],
  );

  const totalUniqueVisitors = useMemo(() => new Set(sessions.map((s) => s.visitor_id)).size, [sessions]);

  const countries = useMemo<CountryStat[]>(() => {
    const byCountry = new Map<string, { visits: number; visitors: Set<string> }>();
    for (const session of sessions) {
      const country = session.country_name?.trim() || "Nepoznato";
      const entry = byCountry.get(country) ?? { visits: 0, visitors: new Set<string>() };
      entry.visits += 1;
      entry.visitors.add(session.visitor_id);
      byCountry.set(country, entry);
    }
    return Array.from(byCountry.entries())
      .map(([country, entry]) => ({
        country,
        visits: entry.visits,
        uniqueVisitors: entry.visitors.size,
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [sessions]);

  if (!audit) {
    return <p className="error">Supabase nije podešen.</p>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Statistika sajta</h1>
      <p className="muted">Praćenje poseta: IP adresa, posećene strane i vreme zadržavanja.</p>

      <div className="card row">
        <label>
          Od
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          Do
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <p className="muted" style={{ margin: 0 }}>
          Ukupno poseta: <strong>{sessions.length}</strong> | Ukupno jedinstvenih: <strong>{totalUniqueVisitors}</strong>{" "}
          | Trenutno online: <strong>{currentlyOnline}</strong>
        </p>
        <button type="button" onClick={() => void load()}>
          Osveži
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Iz kojih zemalja</h2>
        <table>
          <thead>
            <tr>
              <th>Zemlja</th>
              <th>Poseta</th>
              <th>Jedinstvenih</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((item) => (
              <tr key={item.country}>
                <td>{item.country}</td>
                <td>{item.visits}</td>
                <td>{item.uniqueVisitors}</td>
              </tr>
            ))}
            {countries.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  Nema podataka za izabrani period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="site-stats-table-wrap">
          <table className="site-stats-table">
            <thead>
              <tr>
                <th>Početak sesije</th>
                <th>Poslednja aktivnost</th>
                <th>IP adresa</th>
                <th>Zemlja</th>
                <th>Trenutna strana</th>
                <th>Pogledane strane</th>
                <th>Zadržavanje</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.session.id}>
                  <td>{formatDate(row.session.started_at)}</td>
                  <td>{formatDate(row.session.last_seen)}</td>
                  <td>{row.session.ip_address ?? "—"}</td>
                  <td>{row.session.country_name ?? "—"}</td>
                  <td>{row.session.current_path}</td>
                  <td className="site-stats-paths">{row.pages.length > 0 ? row.pages.join(" -> ") : "—"}</td>
                  <td>{formatDuration(row.totalDurationSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
