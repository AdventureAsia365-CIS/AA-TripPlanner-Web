"use client";

import { hasMapboxToken } from "@/lib/mapbox";

// Mapbox map with tile-based pins and clustering. Implemented in Task 7.
export default function MapView() {
  if (!hasMapboxToken()) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-500">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in frontend/.env.local to load the map.
      </div>
    );
  }
  return <div id="map" className="h-full w-full" />;
}
