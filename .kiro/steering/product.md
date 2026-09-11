# Product: AA_TripPlanner_AI

## What this is
A standalone, AA-branded B2C web app. A prospective customer opens a map,
browses destinations AA already operates tours in, pins the specific places
and activities that interest them, and watches a day-by-day trip assemble
live as they pin. When satisfied, they send the draft to an AA advisor, who
turns it into a real, bookable itinerary.

This is a MAP-FIRST product (confirmed by Ms. Thu, 25/08/2026, in the
spirit of Mindtrip): browsing the map and pinning places is the primary
entry point. There is no chat-based intake in this build.

## The core unit: itinerary_component
The customer does not pin a whole AA tour, and does not pin a bare
destination. They pin an **itinerary_component** — one destination + one
activity + one usable duration, chopped out of an existing AA tour's
day-by-day content (source: `acp_contract.tour_atoms`, grouped by
`(tour_id, itinerary_day)`).

One destination pin can have MULTIPLE components available (e.g. Sapa might
offer both a 2-day trekking component from one tour and a half-day village
visit from a different tour). Clicking/hovering a destination pin opens a
list of its components, each with its own "Add" action — never a single
"Add this destination" action.

## Why sales approval is mandatory (not optional)
A trip assembled from components pulled from multiple different original
AA tours is a feasibility draft, not an operable product — the guides,
transport, and lodging were arranged for the original tours, not for a
novel recombination of pieces of them. An AA advisor must confirm
logistics actually line up before it can be sold. This is why
**"Send to advisor" is the one mandatory human gate** in an otherwise
fully self-serve flow.

## Who it's for
Senior professionals, 40-60, $250k+ household income, US/UK/AUS — AA's
"Discreet Executive Adventure" segment.

## What it is explicitly NOT
- Not part of AAA (the mobile app project) — fully standalone. AAA's
  status is inactive/uncertain and must never become a blocking
  dependency.
- Not an OTA — never books third-party flights/hotels. Only arranges AA's
  own curated tours.
- Not fully-automated — AI proposes an initial day-by-day order and
  narration when the customer has pinned enough, and re-narrates when the
  customer manually reorders. AI never decides what goes into the trip —
  the customer does, by pinning. The customer's chosen order is always
  final input, never a suggestion for AI to second-guess.
- Not chat-first — no chat/text-brief intake in this build (that was an
  earlier, now-superseded design — see PRD history). Filtering supports a
  free-text search box, but it narrows an already-visible map, it isn't an
  entry gate.
- Not open-web grounded — every component resolves to a real AA tour +
  day. Never invent a supplier, price, or claim not in AA's own catalog
  data.

## MVP goal
Build directly on real data from day one: 31 currently-active AA tours,
extracted via `acp_contract.tour_atoms` (confirmed populated for all 31
active tours, 1289 atoms total). No mock data phase — see tech.md for why.

## Explicitly out of scope for this build
- Starting a trip from an uploaded photo or a pasted link ("Start
  Anywhere")
- Real-time multi-person collaborative planning
- Real routing/travel-time between components (geographic heuristics only
  for day sequencing)
- Any language other than English
- Deeper cache optimization beyond a fixed TTL (revisit once real usage
  data exists)
