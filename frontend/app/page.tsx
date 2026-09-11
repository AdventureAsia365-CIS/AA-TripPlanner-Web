"use client";

import MapView from "@/components/MapView";
import FilterChips from "@/components/FilterChips";
import TripPanel from "@/components/TripPanel";
import { TripProvider } from "@/lib/useTrip";

export default function Home() {
  return (
    <TripProvider>
      <main className="flex h-screen max-h-screen w-screen overflow-hidden">
        <section className="relative h-screen flex-1">
          <FilterChips />
          <MapView />
        </section>
        <aside className="h-screen w-96 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50">
          <TripPanel />
        </aside>
      </main>
    </TripProvider>
  );
}
