"use client";

import { useEffect, useState } from "react";
import { fetchDestination } from "@/lib/api";
import type { DestinationDetail } from "@/lib/types";
import { useTrip } from "@/lib/useTrip";

interface Props {
  destinationId: string;
  onClose: () => void;
}

function label(v: string): string {
  return v.replace(/_/g, " ");
}

export default function DestinationPopup({ destinationId, onClose }: Props) {
  const { add, remove, inTripComponentIds, itinerary } = useTrip();
  const [detail, setDetail] = useState<DestinationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDestination(destinationId).then((d) => {
      if (active) {
        setDetail(d);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [destinationId]);

  const dayOf = (componentId: string): number | null => {
    const found = itinerary.find((d) => d.component_id === componentId);
    return found ? found.day : null;
  };

  return (
    <div className="absolute right-4 top-4 z-20 w-80 rounded-lg bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold">
            {detail?.name ?? "Loading…"}
          </h3>
          {detail?.country && (
            <p className="text-xs text-gray-500">{detail.country}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {loading && <p className="mt-3 text-sm text-gray-500">Loading…</p>}

      {!loading && detail && detail.components.length === 0 && (
        <p className="mt-3 text-sm text-gray-500">No components here.</p>
      )}

      <ul className="mt-3 max-h-80 space-y-3 overflow-y-auto">
        {detail?.components.map((c) => {
          const inTrip = inTripComponentIds.has(c.id);
          const day = dayOf(c.id);
          return (
            <li key={c.id} className="rounded border border-gray-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs capitalize text-gray-500">
                    {label(c.activity)} · {label(c.intensity_level)} ·{" "}
                    {label(c.duration_hint)}
                  </p>
                </div>
                {inTrip ? (
                  <button
                    onClick={() => remove(c.id)}
                    className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => add(c.id)}
                    className="shrink-0 rounded border border-emerald-500 bg-emerald-500 px-2 py-1 text-xs text-white hover:bg-emerald-600"
                  >
                    Add
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">{c.text_extract}</p>
              {inTrip && day !== null && (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  In your trip — Day {day}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
