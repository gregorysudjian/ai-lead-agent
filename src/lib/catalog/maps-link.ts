import type { ProviderSnapshot } from "../types";

/**
 * A link that opens a business in Google Maps.
 *
 * ── WHY THIS IS ALLOWED WHEN A GOOGLE CATALOG IS NOT ──────────────────────
 *
 * The catalog cannot be built from Google: scraping Maps is forbidden by
 * CLAUDE.md and by Google's terms, and even the paid Places API may not have
 * its names, phones or websites stored. A Maps URL is neither. It is Google's
 * own documented, keyless way for a site to link into Maps
 * (`maps/search/?api=1&query=...`): nothing is fetched by us, nothing is
 * stored, and the operator's browser does the looking. One click shows
 * Google's photos, reviews and opening hours for a business -- the context a
 * human wants before deciding it is worth a lead -- without any of it entering
 * our records.
 *
 * ── WHAT THE QUERY CONTAINS ───────────────────────────────────────────────
 *
 * Name, street, district and province: enough for Maps to land on the
 * listing itself rather than a pin. Coordinates are deliberately NOT used --
 * a bare coordinate query drops a pin and skips the listing, which is the
 * part worth seeing.
 *
 * With Google's place id -- known once the Google Maps check has matched the
 * business -- the same link opens that exact listing rather than a search.
 */
export function googleMapsSearchUrl(
  provider: Pick<ProviderSnapshot, "name" | "address" | "city">,
  placeId: string | null = null,
): string {
  const parts = [provider.name, provider.address, provider.city, "QC"].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );
  const query = parts.map((part) => part.trim()).join(", ");
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return placeId === null ? base : `${base}&query_place_id=${encodeURIComponent(placeId)}`;
}
