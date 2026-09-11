"use client";

import MapView from "@/components/MapView";
import FilterChips from "@/components/FilterChips";
import TripPanel from "@/components/TripPanel";
import { TripProvider } from "@/lib/useTrip";

export default function Home() {
  return (
    <TripProvider>
      {/* Inline heights so the layout box exists regardless of Tailwind
          class generation — the map's absolute container needs a sized,
          positioned ancestor. */}
      <main
        className="overflow-hidden"
        style={{ display: "flex", height: "100vh", width: "100vw" }}
      >
        <section style={{ position: "relative", flex: 1, height: "100vh" }}>
          <FilterChips />
          <MapView />
        </section>
        <aside
          className="border-l border-gray-200 bg-gray-50"
          style={{ height: "100vh", width: "24rem", flexShrink: 0, overflowY: "auto" }}
        >
          <TripPanel />
        </aside>
      </main>
    </TripProvider>
  );
}
