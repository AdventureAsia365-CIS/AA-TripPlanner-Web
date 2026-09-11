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
