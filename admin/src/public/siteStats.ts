import { useEffect, useRef, useState } from "react";
import { audit, supabase } from "../lib/supabase";
import type { Database } from "../types/database";

type SiteSessionInsert = Database["audit"]["Tables"]["gr_site_sessions"]["Insert"];
type SitePageViewInsert = Database["audit"]["Tables"]["gr_site_page_views"]["Insert"];

const VISITOR_STORAGE_KEY = "gr_site_visitor_id";
const SESSION_STORAGE_KEY = "gr_site_session_id";
const LAST_PAGE_KEY = "gr_site_last_page";
const LAST_PAGE_AT_KEY = "gr_site_last_page_at";
const IP_STORAGE_KEY = "gr_site_ip";
const COUNTRY_CODE_STORAGE_KEY = "gr_site_country_code";
const COUNTRY_NAME_STORAGE_KEY = "gr_site_country_name";
const HEARTBEAT_MS = 30000;

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
};

async function getGeoInfo(): Promise<GeoInfo> {
  const cachedIp = localStorage.getItem(IP_STORAGE_KEY);
  const cachedCountryCode = localStorage.getItem(COUNTRY_CODE_STORAGE_KEY);
  const cachedCountryName = localStorage.getItem(COUNTRY_NAME_STORAGE_KEY);
  if (cachedIp || cachedCountryCode || cachedCountryName) {
    return {
      ip: cachedIp || null,
      countryCode: cachedCountryCode || null,
      countryName: cachedCountryName || null,
    };
  }
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) {
      return { ip: null, countryCode: null, countryName: null };
    }
    const data = (await response.json()) as {
      ip?: string;
      country_code?: string;
      country_name?: string;
    };
    const ip = data.ip?.trim() || null;
    const countryCode = data.country_code?.trim() || null;
    const countryName = data.country_name?.trim() || null;
    if (ip) localStorage.setItem(IP_STORAGE_KEY, ip);
    if (countryCode) localStorage.setItem(COUNTRY_CODE_STORAGE_KEY, countryCode);
    if (countryName) localStorage.setItem(COUNTRY_NAME_STORAGE_KEY, countryName);
    return { ip, countryCode, countryName };
  } catch {
    return { ip: null, countryCode: null, countryName: null };
  }
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

  useEffect(() => {
    void getGeoInfo().then((geo) => {
      ipRef.current = geo.ip;
      countryCodeRef.current = geo.countryCode;
      countryNameRef.current = geo.countryName;
    });
  }, []);

  useEffect(() => {
    if (!audit || !supabase) return;

    const visitorId = getOrCreateVisitorId();
    const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const lastPath = sessionStorage.getItem(LAST_PAGE_KEY);
    const lastAtRaw = sessionStorage.getItem(LAST_PAGE_AT_KEY);
    const lastAt = lastAtRaw ? Number(lastAtRaw) : null;
    const lastDuration = getDurationSeconds(lastAt);

    const save = async () => {
      let nextSessionId = sessionId;
      if (!nextSessionId) {
        const payload: SiteSessionInsert = {
          visitor_id: visitorId,
          ip_address: ipRef.current,
          country_code: countryCodeRef.current,
          country_name: countryNameRef.current,
          user_agent: navigator.userAgent,
          entry_path: pathname,
          current_path: pathname,
          pages_count: 1,
        };
        const { data, error } = await audit.from("gr_site_sessions").insert(payload).select("id").single();
        if (error) return;
        nextSessionId = data.id;
        sessionStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
      }

      if (nextSessionId && lastPath) {
        const viewPayload: SitePageViewInsert = {
          session_id: nextSessionId,
          visitor_id: visitorId,
          path: lastPath,
          duration_seconds: lastDuration,
        };
        await audit.from("gr_site_page_views").insert(viewPayload);
      }

      if (nextSessionId) {
        const prev = await audit
          .from("gr_site_sessions")
          .select("pages_count")
          .eq("id", nextSessionId)
          .single();
        const currentCount = prev.data?.pages_count ?? 1;
        const shouldIncrement = lastPath && lastPath !== pathname;
        const nextCount = shouldIncrement ? currentCount + 1 : currentCount;
        await audit
          .from("gr_site_sessions")
          .update({
            pages_count: nextCount,
            last_seen: new Date().toISOString(),
            current_path: pathname,
            ended_at: null,
          })
          .eq("id", nextSessionId);
      }
      sessionStorage.setItem(LAST_PAGE_KEY, pathname);
      sessionStorage.setItem(LAST_PAGE_AT_KEY, `${Date.now()}`);
    };

    void save();
  }, [pathname]);

  useEffect(() => {
    if (!supabase || !audit) return;
    const pullStats = async () => {
      const { data } = await supabase.rpc("get_site_stats");
      const first = data?.[0];
      setTotals({
        totalVisits: Number(first?.total_visits ?? 0),
        currentlyOnline: Number(first?.currently_online ?? 0),
      });
    };
    void pullStats();
    const statsTimer = window.setInterval(() => {
      void pullStats();
    }, 15000);

    const heartbeatTimer = window.setInterval(() => {
      const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) return;
      void audit
        .from("gr_site_sessions")
        .update({ last_seen: new Date().toISOString(), current_path: pathname, ended_at: null })
        .eq("id", sessionId);
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(heartbeatTimer);
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
