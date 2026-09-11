"use client";

import { useState } from "react";
import { useTrip } from "@/lib/useTrip";

const LONG_TRIP_WARN_DAYS = 25;

export default function TripPanel() {
  const { itinerary, status, remove, reorder, send } = useTrip();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showReg, setShowReg] = useState(false);
  const [reg, setReg] = useState({ name: "", phone: "", email: "" });
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  const onDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const ids = itinerary.map((d) => d.component_id);
    const [moved] = ids.splice(dragIndex, 1);
    ids.splice(index, 0, moved);
    setDragIndex(null);
    await reorder(ids);
  };

  const handleSend = async (withCustomer: boolean) => {
    setSentMsg(null);
    const res = await send(withCustomer ? reg : undefined);
    if (res.ok) {
      setShowReg(false);
      setSentMsg("Sent to an advisor. They'll be in touch.");
    } else if (res.needsRegistration) {
      setShowReg(true);
    } else {
      setSentMsg("Something went wrong. Please try again.");
    }
  };

  const tooLong = itinerary.length > LONG_TRIP_WARN_DAYS;

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="text-lg font-semibold">Your trip</h2>

      {itinerary.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          Pin destinations on the map to start building your itinerary.
        </p>
      ) : (
        <>
          {tooLong && (
            <div
              role="alert"
              className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800"
            >
              This trip is {itinerary.length} days — quite long. You can keep
              adding, but consider trimming for a smoother journey.
            </div>
          )}

          <ol className="mt-3 flex-1 space-y-2 overflow-y-auto">
            {itinerary.map((d, index) => (
              <li
                key={d.component_id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                className="flex items-start gap-2 rounded border border-gray-200 bg-white p-2"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                  {d.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  {d.rationale && (
                    <p className="text-xs text-gray-500">{d.rationale}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(d.component_id)}
                  aria-label={`Remove day ${d.day}`}
                  className="shrink-0 text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-3 border-t border-gray-200 pt-3">
            {sentMsg && (
              <p className="mb-2 text-sm text-emerald-700">{sentMsg}</p>
            )}
            {!showReg ? (
              <button
                onClick={() => handleSend(false)}
                disabled={status === "sent"}
                className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {status === "sent" ? "Sent to advisor" : "Send to advisor"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  Add your details so an advisor can reach you.
                </p>
                <input
                  placeholder="Name"
                  value={reg.name}
                  onChange={(e) => setReg({ ...reg, name: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  placeholder="Phone"
                  value={reg.phone}
                  onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  placeholder="Email"
                  value={reg.email}
                  onChange={(e) => setReg({ ...reg, email: e.target.value })}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  onClick={() => handleSend(true)}
                  disabled={!reg.name || (!reg.phone && !reg.email)}
                  className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Register &amp; send
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
