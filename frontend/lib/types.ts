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
