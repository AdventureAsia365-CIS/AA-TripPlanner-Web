"use client";

import { useTrip } from "@/lib/useTrip";
import { ACTIVITIES, INTENSITIES } from "@/lib/types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function label(v: string): string {
  return v.replace(/_/g, " ");
}

export default function FilterChips() {
  const { filters, setFilters } = useTrip();

  const toggleActivity = (a: string) =>
    setFilters({ ...filters, activity: filters.activity === a ? undefined : a });

  return (
    <div className="absolute left-4 top-4 z-10 max-w-[70%] rounded-lg bg-white/95 p-3 shadow">
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITIES.map((a) => (
          <button
            key={a}
            onClick={() => toggleActivity(a)}
            aria-pressed={filters.activity === a}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              filters.activity === a
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
            }`}
          >
            {label(a)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label="Intensity"
          value={filters.intensity_level ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, intensity_level: e.target.value || undefined })
          }
          className="rounded border border-gray-300 px-2 py-1 text-xs capitalize"
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
          className="rounded border border-gray-300 px-2 py-1 text-xs"
        >
          <option value="">Any month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>

        <input
          aria-label="Country"
          placeholder="Country"
          value={filters.country ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, country: e.target.value || undefined })
          }
          className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
        />
      </div>
    </div>
  );
}
