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
