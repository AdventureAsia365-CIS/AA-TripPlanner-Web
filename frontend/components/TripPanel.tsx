"use client";

// Live-updating itinerary list, drag-reorder, day badges, long-trip
// warning, Send to advisor + registration form. Implemented in Task 7.
export default function TripPanel() {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">Your trip</h2>
      <p className="mt-2 text-sm text-gray-500">
        Pin destinations on the map to start building your itinerary.
      </p>
    </div>
  );
}
