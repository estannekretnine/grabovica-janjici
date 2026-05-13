// Vercel Serverless Function: /api/geo
//
// Vercel edge automatski dodaje sledece headere u svaki request:
//   x-vercel-ip-country         (npr. "RS", "DE", "US")
//   x-vercel-ip-country-region  (npr. "BG", "BW")
//   x-vercel-ip-city            (npr. "Belgrade", URL-enkodirano)
//   x-vercel-ip-latitude / x-vercel-ip-longitude
//   x-forwarded-for / x-real-ip
//
// Posto je ovo same-origin (sa istog Vercel deployment-a), ad-blokeri ne mogu
// da blokiraju zahtev, nema rate-limita, i radi za sve posetioce.
//
// Reference: https://vercel.com/docs/edge-network/headers/request-headers#x-vercel-ip-country

const ISO_COUNTRY_TO_NAME = {
  RS: "Serbia",
  BA: "Bosnia and Herzegovina",
  ME: "Montenegro",
  HR: "Croatia",
  MK: "North Macedonia",
  SI: "Slovenia",
  AL: "Albania",
  XK: "Kosovo",
  DE: "Germany",
  AT: "Austria",
  CH: "Switzerland",
  IT: "Italy",
  FR: "France",
  GB: "United Kingdom",
  IE: "Ireland",
  ES: "Spain",
  PT: "Portugal",
  NL: "Netherlands",
  BE: "Belgium",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czechia",
  SK: "Slovakia",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  GR: "Greece",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  US: "United States",
  CA: "Canada",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  AU: "Australia",
  NZ: "New Zealand",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  IN: "India",
};

function readHeader(req, name) {
  const value = req.headers?.[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function decodeHeader(value) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const forwardedFor = readHeader(req, "x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    readHeader(req, "x-real-ip") ||
    readHeader(req, "cf-connecting-ip") ||
    null;

  let countryCode = readHeader(req, "x-vercel-ip-country");
  if (countryCode) countryCode = countryCode.toUpperCase();

  const countryName = countryCode && ISO_COUNTRY_TO_NAME[countryCode]
    ? ISO_COUNTRY_TO_NAME[countryCode]
    : countryCode || null;

  const city = decodeHeader(readHeader(req, "x-vercel-ip-city"));
  const regionCode = readHeader(req, "x-vercel-ip-country-region");
  // Preferiramo grad, jer je informativniji od regije.
  const region = city || regionCode || null;

  res.status(200).end(
    JSON.stringify({
      ip,
      country_code: countryCode,
      country_name: countryName,
      region_name: region,
      city,
      source: "vercel",
    }),
  );
}
