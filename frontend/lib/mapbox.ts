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

// A single travel leg between two consecutive waypoints.
export interface RouteLeg {
  // Great-circle vs road distinction: these come from the Directions API
  // (road-following) when available, else from a straight-line estimate.
  distanceKm: number;
  durationMin: number;
  // true when the values are a straight-line (haversine) estimate because
  // the Directions API returned no drivable route (islands, cross-water).
  estimated: boolean;
}

// Haversine great-circle distance in km between two [lng,lat] points.
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Fetch per-leg distance + duration between consecutive [lng,lat] waypoints.
 * Uses the Mapbox Directions API (driving profile), which returns one `leg`
 * per pair of waypoints. When no drivable route exists (e.g. crossing water
 * to an island), that leg falls back to a straight-line haversine estimate
 * at an assumed 60 km/h, flagged `estimated: true`.
 *
 * Returns waypoints.length - 1 legs, or null if the token is missing or
 * there are fewer than 2 waypoints.
 */
export async function fetchRouteLegs(
  waypoints: [number, number][],
): Promise<RouteLeg[] | null> {
  if (waypoints.length < 2) return null;
  const pts = waypoints.slice(0, MAX_DIRECTIONS_WAYPOINTS);

  const straightLineLegs = (): RouteLeg[] =>
    pts.slice(1).map((c, i) => {
      const km = haversineKm(pts[i], c);
      return { distanceKm: km, durationMin: (km / 60) * 60, estimated: true };
    });

  if (!hasMapboxToken()) return straightLineLegs();

  const coords = pts.map((c) => `${c[0]},${c[1]}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?overview=false&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return straightLineLegs();
    const data = await res.json();
    const legs = data?.routes?.[0]?.legs;
    if (!Array.isArray(legs) || legs.length !== pts.length - 1) {
      return straightLineLegs();
    }
    return legs.map((leg: { distance?: number; duration?: number }, i: number) => {
      const dist = leg?.distance;
      const dur = leg?.duration;
      // A 0-distance leg usually means the points aren't road-connected;
      // fall back to a straight-line estimate for that leg only.
      if (typeof dist !== "number" || dist <= 0) {
        const km = haversineKm(pts[i], pts[i + 1]);
        return { distanceKm: km, durationMin: (km / 60) * 60, estimated: true };
      }
      return {
        distanceKm: dist / 1000,
        durationMin: (typeof dur === "number" ? dur : 0) / 60,
        estimated: false,
      };
    });
  } catch {
    return straightLineLegs();
  }
}

// Suggested travel mode between two stops, tuned for AA's adventure trips
// (not city tours). Distance-based, since we don't have real routing:
//   short  -> often a trek / boat / short 4WD run
//   medium -> overland by 4WD, or a river/boat leg
//   long   -> a scenic overland day, or a domestic flight for big jumps
// Deliberately hedged ("likely") — an advisor confirms the real logistics.
export interface TravelMode {
  icon: string;
  label: string;
}

export function suggestTravelMode(km: number): TravelMode {
  if (km < 8) return { icon: "🥾", label: "on foot or a short transfer" };
  if (km < 60) return { icon: "🚙", label: "4WD or boat transfer" };
  if (km < 250) return { icon: "🚙", label: "overland by 4WD (a scenic drive)" };
  if (km < 500) return { icon: "🚙", label: "a long overland day, or a domestic hop" };
  return { icon: "✈️", label: "likely a domestic flight" };
}

// Human-friendly leg label with a mode hint, e.g.
// "🚙 120 km · ~2h · 4WD or boat transfer".
export function formatLeg(leg: RouteLeg): string {
  const km = Math.round(leg.distanceKm);
  const mins = Math.round(leg.durationMin);
  let time: string;
  if (mins < 60) {
    time = `~${mins} min`;
  } else {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    time = m === 0 ? `~${h}h` : `~${h}h ${m}m`;
  }
  const mode = suggestTravelMode(leg.distanceKm);
  return `${mode.icon} ${km} km · ${time} · ${mode.label}`;
}
