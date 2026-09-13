"use client";

import { useState } from "react";
import { useTrip } from "@/lib/useTrip";
import { ACTIVITIES, INTENSITIES } from "@/lib/types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function label(v: string): string {
  return v.replace(/_/g, " ");
}

// Compact activity icons (emoji keeps it dependency-free; swap for SVG later).
const ACTIVITY_ICON: Record<string, string> = {
  trekking: "🥾",
  cultural_heritage: "🏛️",
  wildlife_nature: "🐾",
  water_activities: "🌊",
  culinary: "🍜",
  wellness_relaxation: "🧘",
  adventure_sport: "🪂",
  local_immersion: "🫖",
};

export default function FilterChips() {
  const { filters, setFilters } = useTrip();
  const [open, setOpen] = useState(true);

  const toggleActivity = (a: string) =>
    setFilters({ ...filters, activity: filters.activity === a ? undefined : a });

  const activeCount =
    (filters.activity ? 1 : 0) +
    (filters.intensity_level ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.country ? 1 : 0);

  return (
    <div className="pointer-events-none absolute left-4 right-4 top-4 z-10 flex justify-start">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-aa-line bg-white/95 shadow-aa backdrop-blur">
        {/* Search + toggle row */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex h-9 flex-1 items-center gap-2 rounded-xl border border-aa-line bg-aa-sand px-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-aa-muted">
              <path
                d="M21 21l-4.3-4.3M11 19a8 8 0 100-16 8 8 0 000 16z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              aria-label="Search by country"
              placeholder="Search a country — e.g. Nepal, Vietnam, Japan"
              value={filters.country ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, country: e.target.value || undefined })
              }
              className="aa-focus w-full bg-transparent text-sm text-aa-ink placeholder:text-aa-muted focus:outline-none"
            />
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="aa-focus flex h-9 items-center gap-1.5 rounded-xl border border-aa-line px-3 text-sm font-medium text-aa-ink hover:bg-aa-sand"
          >
            Filters
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-aa-gold px-1 text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {open && (
          <div className="aa-animate-in border-t border-aa-line px-3 py-3">
            {/* Activity chips */}
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITIES.map((a) => {
                const active = filters.activity === a;
                return (
                  <button
                    key={a}
                    onClick={() => toggleActivity(a)}
                    aria-pressed={active}
                    className={`aa-focus flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                      active
                        ? "border-aa-gold bg-aa-gold text-white shadow-aa-sm"
                        : "border-aa-line bg-white text-aa-ink hover:border-aa-gold/60 hover:bg-aa-gold-soft"
                    }`}
                  >
                    <span aria-hidden>{ACTIVITY_ICON[a] ?? "•"}</span>
                    {label(a)}
                  </button>
                );
              })}
            </div>

            {/* Selects */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                aria-label="Intensity"
                value={filters.intensity_level ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, intensity_level: e.target.value || undefined })
                }
                className="aa-focus rounded-lg border border-aa-line bg-white px-2.5 py-1.5 text-xs capitalize text-aa-ink"
              >
                <option value="">Any intensity</option>
                {INTENSITIES.map((i) => (
                  <option key={i} value={i}>
                    {label(i)}
                  </option>
                ))}
              </select>

              <select
                aria-label="Season month"
                value={filters.season ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    season: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="aa-focus rounded-lg border border-aa-line bg-white px-2.5 py-1.5 text-xs text-aa-ink"
              >
                <option value="">Any month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>

              {activeCount > 0 && (
                <button
                  onClick={() => setFilters({})}
                  className="aa-focus ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-aa-muted hover:text-aa-ink"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
