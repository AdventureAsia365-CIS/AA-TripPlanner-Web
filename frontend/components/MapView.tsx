"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchTile } from "@/lib/api";
import { hasMapboxToken, MAPBOX_TOKEN, tileIdFor } from "@/lib/mapbox";
import type { DestinationPin } from "@/lib/types";
import { useTrip } from "@/lib/useTrip";
import DestinationPopup from "./DestinationPopup";

const SOURCE_ID = "destinations";

// Enumerate the integer 1° tiles covering the current map bounds.
function tilesForBounds(b: mapboxgl.LngLatBounds): string[] {
  const out: string[] = [];
  const latMin = Math.floor(b.getSouth());
  const latMax = Math.floor(b.getNorth());
  const lngMin = Math.floor(b.getWest());
  const lngMax = Math.floor(b.getEast());
  for (let lat = latMin; lat <= latMax; lat++) {
    for (let lng = lngMin; lng <= lngMax; lng++) {
      out.push(`${lat}_${lng}`);
    }
  }
  return out;
}

export default function MapView() {
  const { filters } = useTrip();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinsRef = useRef<Map<string, DestinationPin>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refreshVisibleTiles = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const tiles = tilesForBounds(bounds);
    const results = await Promise.all(
      tiles.map((t) => fetchTile(t, filtersRef.current)),
    );
    // Dedup by destination id across tiles.
    const merged = pinsRef.current;
    merged.clear();
    for (const pins of results) {
      for (const p of pins) merged.set(p.id, p);
    }
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: "FeatureCollection",
        features: Array.from(merged.values()).map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { id: p.id, name: p.name, count: p.component_count },
        })),
      });
    }
  }, []);

  useEffect(() => {
    if (!hasMapboxToken() || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [105, 15],
      zoom: 3,
    });
    mapRef.current = map;

    // Mapbox reports token/style/worker problems via an 'error' event, not
    // a thrown exception — so a broken map leaves the JS console clean.
    map.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.error("[mapbox error]", e?.error?.message ?? e);
    });

    // The map is created inside useEffect (after first paint), but Mapbox
    // still frequently measures the container before layout settles and
    // locks the canvas at its 400x300 default. Force a resize on the next
    // animation frames, and keep a ResizeObserver for later layout changes.
    const raf1 = requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    map.on("load", () => {
      map.resize(); // ensure canvas matches container after first layout
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 50,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#059669",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#0f766e",
          "circle-radius": 8,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) setSelected(id);
      });
      map.on("click", "clusters", (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        const clusterId = f.properties?.cluster_id;
        const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
        src.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          map.easeTo({
            center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
          });
        });
      });
      map.on("mouseenter", "unclustered", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("moveend", refreshVisibleTiles);
      refreshVisibleTiles();
    });

    return () => {
      cancelAnimationFrame(raf1);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [refreshVisibleTiles]);

  // Re-query when filters change.
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      refreshVisibleTiles();
    }
  }, [filters, refreshVisibleTiles]);

  if (!hasMapboxToken()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-center text-gray-500">
        <div>
          <p className="font-medium">Map token not set</p>
          <p className="mt-1 text-sm">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to frontend/.env.local to load the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inline style (not Tailwind) so the map container always has a
          real, positioned box — independent of any Tailwind
          purge/config. Mapbox measures this element to size its canvas. */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {selected && (
        <DestinationPopup
          destinationId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
