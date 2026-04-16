/**
 * Čišćenje Supabase Project URL-a.
 * Česta greška: umesto https://PROJEKT.supabase.co uneto https://PROJEKT.co (DNS ERR_NAME_NOT_RESOLVED).
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  let u = (raw ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  if (!u || u === "undefined" || u === "null") return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;

  try {
    let parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";

    let host = parsed.hostname.toLowerCase();

    // Samo ref bez domena (npr. https://abcdwxyz...)
    if (/^[a-z0-9]{10,40}$/i.test(host)) {
      host = `${host}.supabase.co`;
      parsed = new URL(`${parsed.protocol}//${host}`);
    }
    // Pogrešno .co umesto .supabase.co (npr. luwiowidfkktqs.co)
    else if (
      /^[a-z0-9]{10,40}\.co$/i.test(host) &&
      !host.includes("supabase")
    ) {
      const ref = host.replace(/\.co$/i, "");
      host = `${ref}.supabase.co`;
      parsed = new URL(`${parsed.protocol}//${host}`);
    }

    if (!parsed.hostname.endsWith(".supabase.co") && !parsed.hostname.endsWith(".supabase.in")) {
      return "";
    }

    const path =
      parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${path}`;
  } catch {
    return "";
  }
}
