import { useEffect, useRef, useState } from "react";
import { auditTracking, publicTracking } from "../lib/supabase";
import type { Database } from "../types/database";

// Tracking klijent (bez auth perzistencije) — nezavisan od admin login sesije,
// da istek JWT-a iz admin-a ne uzrokuje 401 na heartbeat/update.
const audit = auditTracking;
const supabase = publicTracking;

type SiteSessionInsert = Database["audit"]["Tables"]["gr_site_sessions"]["Insert"];
type SitePageViewInsert = Database["audit"]["Tables"]["gr_site_page_views"]["Insert"];

const VISITOR_STORAGE_KEY = "gr_site_visitor_id";
const SESSION_STORAGE_KEY = "gr_site_session_id";
const SESSION_LAST_SEEN_KEY = "gr_site_session_last_seen_at";
const SESSION_PAGES_COUNT_KEY = "gr_site_session_pages_count";
const LAST_PAGE_KEY = "gr_site_last_page";
const LAST_PAGE_AT_KEY = "gr_site_last_page_at";
// v2 sufiks invalidira keseve iz prethodne verzije gde su mnogi posetioci
// imali NULL geo zbog ad-blokiranja eksternih providera. Sada se koristi
// isključivo same-origin /api/geo (Vercel edge headere).
const IP_STORAGE_KEY = "gr_site_ip_v2";
const COUNTRY_CODE_STORAGE_KEY = "gr_site_country_code_v2";
const COUNTRY_NAME_STORAGE_KEY = "gr_site_country_name_v2";
const REGION_NAME_STORAGE_KEY = "gr_site_region_name_v2";
const GEO_CACHE_AT_KEY = "gr_site_geo_cached_at_v2";
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HEARTBEAT_MS = 30000;
const STATS_REFRESH_MS = 5000;
const SESSION_STALE_MS = 5 * 60 * 1000;
/** Koliko dugo čekamo /api/geo pre prvog INSERT-a sesije (same-origin). */
const FIRST_INSERT_GEO_WAIT_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function logTrackError(step: string, error: unknown) {
  // Debug only: pomaže da brzo vidimo zašto se insert/update ne upisuje.
  const e = error as {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
    status?: number;
  } | null;
  console.error(`[site-tracking] ${step} failed`, {
    message: e?.message,
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
    status: e?.status,
    raw: error,
  });
}

function isMissingSessionColumnError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const msg = String((error as { message?: unknown }).message ?? "").toLowerCase();
  if (!msg.includes("column") && !msg.includes("schema cache")) return false;
  return (
    msg.includes("ip_address") ||
    msg.includes("country_code") ||
    msg.includes("country_name") ||
    msg.includes("region_name")
  );
}

function getOrCreateVisitorId() {
  const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  localStorage.setItem(VISITOR_STORAGE_KEY, next);
  return next;
}

type GeoInfo = {
  ip: string | null;
  countryCode: string | null;
  countryName: string | null;
  regionName: string | null;
};

function normalizeGeo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function pickBestRegion(values: unknown[]): string | null {
  for (const v of values) {
    const t = normalizeGeo(v);
    if (t) return t;
  }
  return null;
}

async function fetchGeoFromVercelEdge(): Promise<GeoInfo> {
  // Same-origin endpoint koji cita Vercel edge headere (x-vercel-ip-country, ...).
  // Ovo je primarni izvor jer ad-blokeri ne blokiraju same-origin pozive,
  // nema rate-limita, i radi za sve posetioce.
  const response = await fetch("/api/geo", { cache: "no-store" });
  if (!response.ok) throw new Error(`vercel geo status ${response.status}`);
  const data = (await response.json()) as {
    ip?: string;
    country_code?: string;
    country_name?: string;
    region_name?: string;
    city?: string;
  };
  return {
    ip: normalizeGeo(data.ip),
    countryCode: normalizeGeo(data.country_code),
    countryName: normalizeGeo(data.country_name),
    regionName: pickBestRegion([data.region_name, data.city]),
  };
}

async function getGeoInfo(): Promise<GeoInfo> {
  const now = Date.now();
  const cachedAtRaw = localStorage.getItem(GEO_CACHE_AT_KEY);
  const cachedAt = cachedAtRaw ? Number(cachedAtRaw) : 0;
  const cachedIp = localStorage.getItem(IP_STORAGE_KEY);
  const cachedCountryCode = localStorage.getItem(COUNTRY_CODE_STORAGE_KEY);
  const cachedCountryName = localStorage.getItem(COUNTRY_NAME_STORAGE_KEY);
  const cachedRegionName = localStorage.getItem(REGION_NAME_STORAGE_KEY);
  if (
    cachedAt > 0 &&
    now - cachedAt <= GEO_CACHE_TTL_MS &&
    (cachedIp || cachedCountryCode || cachedCountryName || cachedRegionName)
  ) {
    return {
      ip: cachedIp || null,
      countryCode: cachedCountryCode || null,
      countryName: cachedCountryName || null,
      regionName: cachedRegionName || null,
    };
  }
  let geo: GeoInfo = { ip: null, countryCode: null, countryName: null, regionName: null };
  try {
    geo = await fetchGeoFromVercelEdge();
  } catch {
    // npr. lokalni dev bez Vercel runtime-a ili privremeni mrežni problem
  }

  if (geo.ip) localStorage.setItem(IP_STORAGE_KEY, geo.ip);
  if (geo.countryCode) localStorage.setItem(COUNTRY_CODE_STORAGE_KEY, geo.countryCode);
  if (geo.countryName) localStorage.setItem(COUNTRY_NAME_STORAGE_KEY, geo.countryName);
  if (geo.regionName) localStorage.setItem(REGION_NAME_STORAGE_KEY, geo.regionName);
  if (geo.ip || geo.countryCode || geo.countryName || geo.regionName) {
    localStorage.setItem(GEO_CACHE_AT_KEY, `${Date.now()}`);
  }
  return geo;
}

/** Jedan zajednički fetch geo za sve instance hook-a (INSERT čeka do FIRST_INSERT_GEO_WAIT_MS). */
let geoReadyPromise: Promise<GeoInfo> | null = null;

function ensureGeoFetchStarted(): Promise<GeoInfo> {
  if (!geoReadyPromise) {
    geoReadyPromise = getGeoInfo();
  }
  return geoReadyPromise;
}

function getDurationSeconds(fromMs: number | null) {
  if (fromMs == null) return null;
  const diff = Math.max(0, Date.now() - fromMs);
  return Math.round(diff / 1000);
}

export function useSiteTracking(pathname: string) {
  const [totals, setTotals] = useState({ totalVisits: 0, currentlyOnline: 0 });
  const ipRef = useRef<string | null>(null);
  const countryCodeRef = useRef<string | null>(null);
  const countryNameRef = useRef<string | null>(null);
  const regionNameRef = useRef<string | null>(null);

  const syncGeoToCurrentSession = async () => {
    if (!audit) return;
    const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) return;
    const hasGeo =
      Boolean(ipRef.current) ||
      Boolean(countryCodeRef.current) ||
      Boolean(countryNameRef.current) ||
      Boolean(regionNameRef.current);
    if (!hasGeo) return;
    const { error } = await audit
      .from("gr_site_sessions")
      .update({
        ip_address: ipRef.current,
        country_code: countryCodeRef.current,
        country_name: countryNameRef.current,
        region_name: regionNameRef.current,
        last_seen: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) logTrackError("sync session geo", error);
  };

  useEffect(() => {
    void ensureGeoFetchStarted().then((geo) => {
      ipRef.current = geo.ip;
      countryCodeRef.current = geo.countryCode;
      countryNameRef.current = geo.countryName;
      regionNameRef.current = geo.regionName;
      void syncGeoToCurrentSession();
    });
  }, []);

  useEffect(() => {
    if (!audit || !supabase) return;

    const visitorId = getOrCreateVisitorId();
    const sessionIdRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const sessionLastSeenRaw = sessionStorage.getItem(SESSION_LAST_SEEN_KEY);
    const sessionLastSeenAt = sessionLastSeenRaw ? Number(sessionLastSeenRaw) : null;
    const lastPath = sessionStorage.getItem(LAST_PAGE_KEY);
    const lastAtRaw = sessionStorage.getItem(LAST_PAGE_AT_KEY);
    const lastAt = lastAtRaw ? Number(lastAtRaw) : null;
    const lastDuration = getDurationSeconds(lastAt);

    const save = async () => {
      let nextSessionId = sessionIdRaw;
      if (nextSessionId) {
        const isStale = sessionLastSeenAt == null || Date.now() - sessionLastSeenAt > SESSION_STALE_MS;
        if (isStale) {
          nextSessionId = null;
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
          sessionStorage.removeItem(SESSION_LAST_SEEN_KEY);
          sessionStorage.removeItem(SESSION_PAGES_COUNT_KEY);
        }
      }
      if (!nextSessionId) {
        const raced = await Promise.race([
          ensureGeoFetchStarted(),
          sleep(FIRST_INSERT_GEO_WAIT_MS).then(() => "timeout" as const),
        ]);
        if (raced !== "timeout") {
          ipRef.current = raced.ip;
          countryCodeRef.current = raced.countryCode;
          countryNameRef.current = raced.countryName;
          regionNameRef.current = raced.regionName;
        }
        const generatedSessionId =
          typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
        const payload: SiteSessionInsert = {
          id: generatedSessionId,
          visitor_id: visitorId,
          ip_address: ipRef.current,
          country_code: countryCodeRef.current,
          country_name: countryNameRef.current,
          region_name: regionNameRef.current,
          user_agent: navigator.userAgent,
          entry_path: pathname,
          current_path: pathname,
          pages_count: 1,
        };
        let insertRes = await audit.from("gr_site_sessions").insert(payload);
        if (insertRes.error && isMissingSessionColumnError(insertRes.error)) {
          // Backward compatibility: produkcija bez IP/geo kolona iz novijih migracija.
          const fallbackPayload = { ...payload };
          delete (fallbackPayload as { ip_address?: string | null }).ip_address;
          delete (fallbackPayload as { country_code?: string | null }).country_code;
          delete (fallbackPayload as { country_name?: string | null }).country_name;
          delete (fallbackPayload as { region_name?: string | null }).region_name;
          insertRes = await audit.from("gr_site_sessions").insert(fallbackPayload);
        }
        if (insertRes.error) {
          logTrackError("insert session", insertRes.error);
          return;
        }
        nextSessionId = generatedSessionId;
        sessionStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
        sessionStorage.setItem(SESSION_LAST_SEEN_KEY, `${Date.now()}`);
        sessionStorage.setItem(SESSION_PAGES_COUNT_KEY, "1");
      }

      if (nextSessionId && lastPath) {
        const viewPayload: SitePageViewInsert = {
          session_id: nextSessionId,
          visitor_id: visitorId,
          path: lastPath,
          duration_seconds: lastDuration,
        };
        const { error } = await audit.from("gr_site_page_views").insert(viewPayload);
        if (error) logTrackError("insert page view", error);
      }

      if (nextSessionId) {
        const currentCountRaw = sessionStorage.getItem(SESSION_PAGES_COUNT_KEY);
        const currentCount = Number(currentCountRaw ?? "1") || 1;
        const shouldIncrement = lastPath && lastPath !== pathname;
        const nextCount = shouldIncrement ? currentCount + 1 : currentCount;
        const updatePayload = {
          ip_address: ipRef.current,
          country_code: countryCodeRef.current,
          country_name: countryNameRef.current,
          region_name: regionNameRef.current,
          pages_count: nextCount,
          last_seen: new Date().toISOString(),
          current_path: pathname,
          ended_at: null,
        };
        let updateRes = await audit
          .from("gr_site_sessions")
          .update(updatePayload)
          .eq("id", nextSessionId);
        if (updateRes.error && isMissingSessionColumnError(updateRes.error)) {
          const fallbackPayload = { ...updatePayload };
          delete (fallbackPayload as { ip_address?: string | null }).ip_address;
          delete (fallbackPayload as { country_code?: string | null }).country_code;
          delete (fallbackPayload as { country_name?: string | null }).country_name;
          delete (fallbackPayload as { region_name?: string | null }).region_name;
          updateRes = await audit
            .from("gr_site_sessions")
            .update(fallbackPayload)
            .eq("id", nextSessionId);
        }
        if (updateRes.error) logTrackError("update session heartbeat/path", updateRes.error);
        sessionStorage.setItem(SESSION_LAST_SEEN_KEY, `${Date.now()}`);
        sessionStorage.setItem(SESSION_PAGES_COUNT_KEY, `${nextCount}`);
      }
      sessionStorage.setItem(LAST_PAGE_KEY, pathname);
      sessionStorage.setItem(LAST_PAGE_AT_KEY, `${Date.now()}`);
    };

    void save();
  }, [pathname]);

  useEffect(() => {
    if (!supabase || !audit) return;
    const pullStats = async () => {
      const { data, error } = await supabase.rpc("get_site_stats");
      if (error) {
        logTrackError("rpc get_site_stats", error);
        return;
      }
      const first = data?.[0];
      setTotals({
        totalVisits: Number(first?.total_visits ?? 0),
        currentlyOnline: Number(first?.currently_online ?? 0),
      });
    };
    void pullStats();
    const statsTimer = window.setInterval(() => {
      void pullStats();
    }, STATS_REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") void pullStats();
    };
    const onFocus = () => void pullStats();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    const heartbeatTimer = window.setInterval(() => {
      const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) return;
      void audit
        .from("gr_site_sessions")
        .update({
          ip_address: ipRef.current,
          country_code: countryCodeRef.current,
          country_name: countryNameRef.current,
          region_name: regionNameRef.current,
          last_seen: new Date().toISOString(),
          current_path: pathname,
          ended_at: null,
        })
        .eq("id", sessionId);
      sessionStorage.setItem(SESSION_LAST_SEEN_KEY, `${Date.now()}`);
      void pullStats();
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(heartbeatTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);

  useEffect(() => {
    if (!audit) return;
    const onLeave = () => {
      const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      const lastPath = sessionStorage.getItem(LAST_PAGE_KEY);
      const lastAtRaw = sessionStorage.getItem(LAST_PAGE_AT_KEY);
      const visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
      const duration = getDurationSeconds(lastAtRaw ? Number(lastAtRaw) : null);
      if (!sessionId || !lastPath || !visitorId) return;
      void audit.from("gr_site_page_views").insert({
        session_id: sessionId,
        visitor_id: visitorId,
        path: lastPath,
        duration_seconds: duration,
      });
      void audit
        .from("gr_site_sessions")
        .update({ ended_at: new Date().toISOString(), last_seen: new Date().toISOString() })
        .eq("id", sessionId);
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  return totals;
}
