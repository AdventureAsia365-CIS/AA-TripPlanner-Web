"use client";

import MapView from "@/components/MapView";
import FilterChips from "@/components/FilterChips";
import TripPanel from "@/components/TripPanel";

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <section className="relative flex-1">
        <FilterChips />
        <MapView />
      </section>
      <aside className="w-96 border-l border-gray-200 overflow-y-auto">
        <TripPanel />
      </aside>
    </main>
  );
}
