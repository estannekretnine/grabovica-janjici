/** Uklanja navodnike, dodaje https ako fali, vraća prazan string ako URL nije validan. */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!u || u === "undefined" || u === "null") return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `${parsed.origin}${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}
