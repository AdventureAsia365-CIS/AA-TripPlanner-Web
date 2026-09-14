"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchByCountry, fetchTile } from "@/lib/api";
import { fetchRoute, hasMapboxToken, MAPBOX_TOKEN, tileIdFor } from "@/lib/mapbox";
import type { DestinationPin } from "@/lib/types";
import { useTrip } from "@/lib/useTrip";
import DestinationPopup from "./DestinationPopup";

const SOURCE_ID = "destinations";
const TRIP_LINE_SOURCE = "trip-line";
const TRIP_STOP_SOURCE = "trip-stops";

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
  const { filters, searchResults, itinerary } = useTrip();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinsRef = useRef<Map<string, DestinationPin>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  // When search is active, the map shows the ranked result set instead of
  // tiles-by-bounds. Kept in a ref so the moveend handler can bail out.
  const searchResultsRef = useRef(searchResults);
  searchResultsRef.current = searchResults;

  const setSourceData = useCallback((pins: DestinationPin[]) => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: pins.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name, count: p.component_count },
      })),
    });
  }, []);

  const refreshVisibleTiles = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    // In search mode the map shows the ranked results, not tiles — don't let
    // a pan/zoom overwrite them.
    if (searchResultsRef.current) return;
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
    setSourceData(Array.from(merged.values()));
  }, [setSourceData]);

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
      // Colour system (deliberate, so the three roles never blur together):
      //   ink  (#1F2933) = "browse / not yet picked"  -> clusters + single pins
      //   gold (#DB9628) = "in your trip"             -> numbered day stops + route
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1F2933",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 30, 28],
          "circle-opacity": 0.88,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
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
          "circle-color": "#1F2933",
          "circle-radius": 7,
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // --- Trip path: a solid gold route (real roads via Directions, else a
      // straight fallback) connecting the pinned components in day order, plus
      // numbered day markers. Gold = "in your trip" (distinct from ink browse).
      map.addSource(TRIP_LINE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(TRIP_STOP_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      // A soft white casing under a solid gold line reads cleanly over the
      // map (like a highlighted route).
      map.addLayer({
        id: "trip-line-casing",
        type: "line",
        source: TRIP_LINE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: "trip-line",
        type: "line",
        source: TRIP_LINE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          // Deeper gold for the line so it stays distinct from the brighter
          // gold day-stop dots that sit on top of it.
          "line-color": "#B87A1A",
          "line-width": 4,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "trip-stop-dot",
        type: "circle",
        source: TRIP_STOP_SOURCE,
        paint: {
          "circle-color": "#DB9628",
          "circle-radius": 13,
          "circle-stroke-width": 3.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "trip-stop-label",
        type: "symbol",
        source: TRIP_STOP_SOURCE,
        layout: {
          "text-field": ["get", "day"],
          "text-size": 12,
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#ffffff" },
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

  // Re-query when filters change (browse mode only).
  useEffect(() => {
    if (searchResults) return; // filters re-apply via a fresh search instead
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    refreshVisibleTiles();
  }, [filters, refreshVisibleTiles, searchResults]);

  // When a COUNTRY is picked (country-first filter), fly the map to that
  // country and show its destinations — otherwise selecting a country only
  // filters within the current viewport, which looks like "nothing happened".
  useEffect(() => {
    if (searchResults) return; // search takes precedence
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const country = filters.country;
    if (!country) return; // cleared -> the filters effect above refreshes tiles

    let cancelled = false;
    fetchByCountry(country).then((pins) => {
      if (cancelled || !mapRef.current) return;
      // Respect other active filters (activity/intensity/season) by keeping
      // only pins that also pass the tile query; simplest: show country pins
      // and let a subsequent tile refresh (on moveend) reconcile.
      setSourceData(pins);
      if (pins.length > 0) {
        const b = new mapboxgl.LngLatBounds();
        for (const p of pins) b.extend([p.lng, p.lat]);
        map.fitBounds(b, { padding: 80, maxZoom: 8, duration: 700 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filters.country, searchResults, setSourceData]);

  // Render semantic-search results (or return to tiles when cleared).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (searchResults === null) {
      // Back to browse mode: repopulate from the current viewport.
      refreshVisibleTiles();
      return;
    }
    setSourceData(searchResults);
    if (searchResults.length > 0) {
      const b = new mapboxgl.LngLatBounds();
      for (const p of searchResults) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: 80, maxZoom: 9, duration: 600 });
    }
  }, [searchResults, refreshVisibleTiles, setSourceData]);

  // Draw the trip path (day-ordered line + numbered stops) from the itinerary.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const lineSrc = map.getSource(TRIP_LINE_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined;
    const stopSrc = map.getSource(TRIP_STOP_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (!lineSrc || !stopSrc) return;

    // Only days that carry coordinates (the assembly API includes lat/lng).
    const pts = itinerary
      .filter((d) => typeof d.lat === "number" && typeof d.lng === "number")
      .map((d) => ({ day: d.day, coord: [d.lng as number, d.lat as number] as [number, number] }));

    stopSrc.setData({
      type: "FeatureCollection",
      features: pts.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: p.coord },
        properties: { day: String(p.day) },
      })),
    });

    // A line needs at least 2 distinct points; dedupe consecutive identical
    // coords (several components can share one destination's coordinate).
    const straight = pts.map((p) => p.coord).filter(
      (c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1],
    );

    const setLine = (coords: [number, number][]) =>
      lineSrc.setData({
        type: "FeatureCollection",
        features:
          coords.length >= 2
            ? [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }]
            : [],
      });

    // Draw the straight path immediately (instant feedback), then upgrade to
    // a real road-following route from Mapbox Directions when it resolves.
    // Falls back to the straight line if Directions fails (e.g. points not
    // connected by road — islands/cross-water).
    setLine(straight);
    if (straight.length < 2) return;

    let cancelled = false;
    fetchRoute(straight).then((route) => {
      if (cancelled) return;
      const src = map.getSource(TRIP_LINE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      if (route && route.length >= 2) {
        src.setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: { type: "LineString", coordinates: route }, properties: {} }],
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itinerary]);

  if (!hasMapboxToken()) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-aa-sand text-center text-aa-muted">
        <div className="max-w-sm rounded-2xl border border-aa-line bg-white p-6 shadow-aa">
          <p className="font-semibold text-aa-ink">Map token not set</p>
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
