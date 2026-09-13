"use client";

import Header from "@/components/Header";
import MapView from "@/components/MapView";
import FilterChips from "@/components/FilterChips";
import TripPanel from "@/components/TripPanel";
import { TripProvider } from "@/lib/useTrip";

export default function Home() {
  return (
    <TripProvider>
      {/* Inline heights so the layout box exists regardless of Tailwind class
          generation — the map's absolute container needs a sized, positioned
          ancestor (this was load-bearing for Mapbox canvas sizing). */}
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw" }}>
        <Header />
        <main className="overflow-hidden" style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <section style={{ position: "relative", flex: 1, height: "100%" }}>
            <FilterChips />
            <MapView />
          </section>
          <aside
            className="border-l border-aa-line bg-aa-offwhite"
            style={{ height: "100%", width: "25rem", flexShrink: 0, overflowY: "auto" }}
          >
            <TripPanel />
          </aside>
        </main>
      </div>
    </TripProvider>
  );
}
