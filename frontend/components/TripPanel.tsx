"use client";

import { useState } from "react";
import { useTrip } from "@/lib/useTrip";

const LONG_TRIP_WARN_DAYS = 25;

export default function TripPanel() {
  const {
    itinerary,
    status,
    narration,
    narrating,
    remove,
    reorder,
    narrate,
    send,
  } = useTrip();
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
      setSentMsg("Sent to an advisor. They'll be in touch shortly.");
    } else if (res.needsRegistration) {
      setShowReg(true);
    } else {
      setSentMsg("Something went wrong. Please try again.");
    }
  };

  const tooLong = itinerary.length > LONG_TRIP_WARN_DAYS;
  const sent = status === "sent";

  return (
    <div className="flex h-full flex-col">
      {/* Panel header */}
      <div className="flex items-baseline justify-between border-b border-aa-line px-4 py-3.5">
        <h2 className="text-base font-semibold text-aa-ink">Your trip</h2>
        {itinerary.length > 0 && (
          <span className="rounded-full bg-aa-ink px-2.5 py-0.5 text-xs font-semibold text-white">
            {itinerary.length} day{itinerary.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {itinerary.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span aria-hidden className="text-3xl">🗺️</span>
          <p className="mt-3 text-sm font-medium text-aa-ink">
            Your itinerary is empty
          </p>
          <p className="mt-1 text-xs leading-relaxed text-aa-muted">
            Pin experiences from the map and watch your day-by-day trip take
            shape here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {tooLong && (
              <div
                role="alert"
                className="mb-3 rounded-xl border border-aa-gold/40 bg-aa-gold-soft p-2.5 text-xs text-aa-gold-dark"
              >
                This trip is {itinerary.length} days — quite long. You can keep
                adding, but consider trimming for a smoother journey.
              </div>
            )}

            <ol className="space-y-2">
              {itinerary.map((d, index) => (
                <li
                  key={d.component_id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(index)}
                  className={`group flex items-start gap-3 rounded-xl border bg-white p-3 shadow-aa-sm transition ${
                    dragIndex === index
                      ? "border-aa-gold opacity-60"
                      : "border-aa-line hover:border-aa-gold/40"
                  }`}
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aa-gold text-xs font-bold text-white">
                    {d.day}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-aa-ink">
                      {d.name}
                    </p>
                    {d.rationale && (
                      <p className="mt-0.5 text-xs leading-relaxed text-aa-muted">
                        {d.rationale}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => remove(d.component_id)}
                    aria-label={`Remove day ${d.day}`}
                    className="aa-focus shrink-0 rounded-md px-1.5 py-0.5 text-xs text-aa-muted opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-2 px-1 text-[11px] text-aa-muted">
              Drag day cards to reorder.
            </p>

            {/* AI narration — proposes connective day-by-day copy. The
                customer's chosen order is always respected. */}
            <div className="mt-4 rounded-xl border border-aa-line bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-aa-ink">
                  Day-by-day narration
                </p>
                <button
                  onClick={() => narrate("compose")}
                  disabled={narrating}
                  className="aa-focus rounded-lg border border-aa-gold px-2.5 py-1 text-xs font-semibold text-aa-gold-dark transition hover:bg-aa-gold-soft disabled:opacity-50"
                >
                  {narrating
                    ? "Composing…"
                    : narration
                      ? "Regenerate"
                      : "✨ Compose"}
                </button>
              </div>
              {narration ? (
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-aa-ink-soft">
                  {narration}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-aa-muted">
                  Let AI write a warm intro for each day, in your chosen order.
                </p>
              )}
            </div>
          </div>

          {/* Sticky CTA footer */}
          <div className="border-t border-aa-line bg-white px-4 py-3">
            {sentMsg && (
              <p
                className={`mb-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  sent
                    ? "bg-aa-gold-soft text-aa-gold-dark"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {sentMsg}
              </p>
            )}
            {!showReg ? (
              <button
                onClick={() => handleSend(false)}
                disabled={sent}
                className="aa-focus w-full rounded-xl bg-aa-gold px-3 py-2.5 text-sm font-semibold text-white shadow-aa-sm transition hover:bg-aa-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sent ? "✓ Sent to advisor" : "Send to an advisor"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-aa-muted">
                  Add your details so an advisor can turn this draft into a
                  bookable itinerary.
                </p>
                <input
                  placeholder="Full name"
                  value={reg.name}
                  onChange={(e) => setReg({ ...reg, name: e.target.value })}
                  className="aa-focus w-full rounded-lg border border-aa-line px-3 py-2 text-sm text-aa-ink placeholder:text-aa-muted"
                />
                <input
                  placeholder="Phone"
                  value={reg.phone}
                  onChange={(e) => setReg({ ...reg, phone: e.target.value })}
                  className="aa-focus w-full rounded-lg border border-aa-line px-3 py-2 text-sm text-aa-ink placeholder:text-aa-muted"
                />
                <input
                  placeholder="Email"
                  value={reg.email}
                  onChange={(e) => setReg({ ...reg, email: e.target.value })}
                  className="aa-focus w-full rounded-lg border border-aa-line px-3 py-2 text-sm text-aa-ink placeholder:text-aa-muted"
                />
                <button
                  onClick={() => handleSend(true)}
                  disabled={!reg.name || (!reg.phone && !reg.email)}
                  className="aa-focus w-full rounded-xl bg-aa-gold px-3 py-2.5 text-sm font-semibold text-white shadow-aa-sm transition hover:bg-aa-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Register &amp; send
                </button>
              </div>
            )}
            <p className="mt-2 text-center text-[11px] text-aa-muted">
              An advisor confirms logistics before anything is booked.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
