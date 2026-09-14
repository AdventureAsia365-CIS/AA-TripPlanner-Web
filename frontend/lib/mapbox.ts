// Mapbox helpers. The public token is exposed to the browser by design
// (GL JS is client-side); protect it with URL restrictions in production.

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export function hasMapboxToken(): boolean {
  return MAPBOX_TOKEN.length > 0;
}

// Fixed 1-degree grid tile id from lat/lng (matches backend TILE_DEGREES).
export function tileIdFor(lat: number, lng: number): string {
  const latCell = Math.floor(lat);
  const lngCell = Math.floor(lng);
  return `${latCell}_${lngCell}`;
}

// Mapbox Directions: max coordinates per request for the driving profile.
const MAX_DIRECTIONS_WAYPOINTS = 25;

/**
 * Fetch a real road-following route through the given [lng,lat] waypoints
 * (in order) via the Mapbox Directions API (driving profile). Returns the
 * route geometry as an array of [lng,lat] coordinates, or null if the
 * request fails or no route exists (e.g. points not connected by road —
 * islands, cross-water). The caller falls back to a straight line on null.
 */
export async function fetchRoute(
  waypoints: [number, number][],
): Promise<[number, number][] | null> {
  if (!hasMapboxToken() || waypoints.length < 2) return null;
  const pts = waypoints.slice(0, MAX_DIRECTIONS_WAYPOINTS);
  const coords = pts.map((c) => `${c[0]},${c[1]}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(route) && route.length >= 2) {
      return route as [number, number][];
    }
    return null;
  } catch {
    return null;
  }
}
