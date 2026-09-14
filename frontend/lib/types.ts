// Shared frontend types, mirroring the backend browse/assembly contracts.

export interface DestinationPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  component_count: number;
}

export interface Component {
  id: string;
  name: string;
  activity: string;
  intensity_level: string;
  duration_hint: string;
  text_extract: string;
  thumbnail_url: string | null;
  in_trip_day: number | null;
}

export interface DestinationDetail {
  id: string;
  name: string;
  country: string;
  components: Component[];
}

export interface ItineraryDay {
  day: number;
  component_id: string;
  name: string | null;
  rationale: string | null;
  // Present in the assembly API response (from the destination row); used to
  // draw the day-order path on the map. Optional so older callers still typecheck.
  lat?: number;
  lng?: number;
}

export interface BrowseFilters {
  activity?: string;
  intensity_level?: string;
  country?: string;
  season?: number;
}

export interface CountryOption {
  country: string;
  component_count: number;
}

// Regions mirror adventure.asia's own top-level grouping (Southeast / East /
// South / Central Asia). Used to group the country dropdown so the country
// filter reads like the official site. Countries not mapped fall under
// "Other".
export const REGION_OF: Record<string, string> = {
  // Southeast Asia
  Cambodia: "Southeast Asia",
  Indonesia: "Southeast Asia",
  Laos: "Southeast Asia",
  Malaysia: "Southeast Asia",
  Myanmar: "Southeast Asia",
  Philippines: "Southeast Asia",
  Singapore: "Southeast Asia",
  Thailand: "Southeast Asia",
  Vietnam: "Southeast Asia",
  "Timor-Leste": "Southeast Asia",
  Brunei: "Southeast Asia",
  // East Asia
  China: "East Asia",
  Japan: "East Asia",
  "South Korea": "East Asia",
  Mongolia: "East Asia",
  Taiwan: "East Asia",
  // South Asia
  India: "South Asia",
  Nepal: "South Asia",
  Bhutan: "South Asia",
  "Sri Lanka": "South Asia",
  Bangladesh: "South Asia",
  Pakistan: "South Asia",
  Maldives: "South Asia",
  // Central Asia
  Kazakhstan: "Central Asia",
  Kyrgyzstan: "Central Asia",
  Uzbekistan: "Central Asia",
  Tajikistan: "Central Asia",
  Turkmenistan: "Central Asia",
};

export const REGION_ORDER = [
  "Southeast Asia",
  "East Asia",
  "South Asia",
  "Central Asia",
  "Other",
] as const;

// Approximate country bounding boxes [west, south, east, north]. Used ONLY to
// discard clearly mis-geocoded outliers when fitting the map to a country
// (a known data issue: Mapbox limit=1 sometimes resolves a same-named place
// on the wrong continent). Does not modify data; only keeps the camera sane.
export const COUNTRY_BBOX: Record<string, [number, number, number, number]> = {
  Laos: [100.0, 13.5, 108.0, 22.6],
  "Sri Lanka": [79.5, 5.8, 82.0, 10.0],
  "South Korea": [125.5, 33.0, 130.0, 38.7],
  Nepal: [80.0, 26.3, 88.3, 30.5],
  Japan: [122.0, 24.0, 146.0, 45.6],
  India: [68.0, 6.5, 97.5, 35.7],
};

// Emoji fallback per activity (used until brand icons are wired everywhere).
export const ACTIVITY_ICON: Record<string, string> = {
  trekking: "🥾",
  cultural_heritage: "🏛️",
  wildlife_nature: "🐾",
  water_activities: "🌊",
  culinary: "🍜",
  wellness_relaxation: "🧘",
  adventure_sport: "🪂",
  local_immersion: "🫖",
};

export const ACTIVITIES = [
  "trekking",
  "cultural_heritage",
  "wildlife_nature",
  "water_activities",
  "culinary",
  "wellness_relaxation",
  "adventure_sport",
  "local_immersion",
] as const;

export const INTENSITIES = [
  "leisurely",
  "moderate",
  "active",
  "strenuous",
] as const;
