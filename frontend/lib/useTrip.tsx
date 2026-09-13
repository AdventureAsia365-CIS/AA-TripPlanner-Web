"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import * as api from "./api";
import type { BrowseFilters, ItineraryDay } from "./types";

// Guest identity: a random session + trip id, held in memory only (guests
// are not persisted — lost on tab close, per requirements).
function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface TripState {
  sessionId: string;
  tripId: string;
  itinerary: ItineraryDay[];
  filters: BrowseFilters;
  status: string;
  inTripComponentIds: Set<string>;
  narration: string;
  narrating: boolean;
  setFilters: (f: BrowseFilters) => void;
  add: (componentId: string) => Promise<void>;
  remove: (componentId: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  narrate: (mode?: "compose" | "renarrate") => Promise<void>;
  send: (customer?: { name: string; phone: string; email: string }) => Promise<
    { ok: boolean; needsRegistration: boolean }
  >;
}

const TripContext = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const idsRef = useRef<{ sessionId: string; tripId: string }>();
  if (!idsRef.current) {
    idsRef.current = { sessionId: randomId(), tripId: randomId() };
  }
  const { sessionId, tripId } = idsRef.current;

  const [itinerary, setItinerary] = useState<ItineraryDay[]>([]);
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [status, setStatus] = useState<string>("draft");
  const [narration, setNarration] = useState<string>("");
  const [narrating, setNarrating] = useState<boolean>(false);

  const inTripComponentIds = useMemo(
    () => new Set(itinerary.map((d) => d.component_id)),
    [itinerary],
  );

  const add = useCallback(
    async (componentId: string) => {
      const res = await api.addComponent(tripId, sessionId, componentId);
      if (res.itinerary) setItinerary(res.itinerary);
    },
    [tripId, sessionId],
  );

  const remove = useCallback(
    async (componentId: string) => {
      const res = await api.removeComponent(tripId, sessionId, componentId);
      if (res.itinerary) setItinerary(res.itinerary);
    },
    [tripId, sessionId],
  );

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      const res = await api.reorder(tripId, sessionId, orderedIds);
      if (res.itinerary) setItinerary(res.itinerary);
    },
    [tripId, sessionId],
  );

  const narrate = useCallback(
    async (mode: "compose" | "renarrate" = "compose") => {
      setNarrating(true);
      try {
        const res = await api.narrate(tripId, sessionId, mode);
        if (res.ok) setNarration(res.narration);
      } finally {
        setNarrating(false);
      }
    },
    [tripId, sessionId],
  );

  const send = useCallback(
    async (customer?: { name: string; phone: string; email: string }) => {
      const { status: code, body } = await api.sendToAdvisor(
        tripId,
        sessionId,
        customer,
      );
      if (code === 200) {
        if (body.itinerary) setItinerary(body.itinerary);
        setStatus("sent");
        return { ok: true, needsRegistration: false };
      }
      if (code === 422 && body.error === "registration_required") {
        return { ok: false, needsRegistration: true };
      }
      return { ok: false, needsRegistration: false };
    },
    [tripId, sessionId],
  );

  const value: TripState = {
    sessionId,
    tripId,
    itinerary,
    filters,
    status,
    inTripComponentIds,
    narration,
    narrating,
    setFilters,
    add,
    remove,
    reorder,
    narrate,
    send,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripState {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
