# Tasks: AA_TripPlanner_AI (map-first, v0.3)

- [ ] 1. Repo scaffold
  - Create `frontend/`, `backend/browse/`, `backend/assembly/`,
    `backend/shared/`, `backend/extraction/` per structure.md
  - _Requirements: scaffold only_

- [ ] 2. Database schema
  - Write `migrations/001_tripplanner_schema.sql` (itinerary_components,
    customers, sessions, trip_events, trip_drafts) per design.md
  - Write `migrations/002_shared_destinations.sql` — coordinate table
    name/columns with any existing AA-CIS-App migration conventions for
    the `shared` schema before applying
  - _Requirements: 1_

- [ ] 3. Extraction pipeline
  - `backend/extraction/country_normalize.py` — hard-coded map
  - `backend/extraction/geocode.py` — Mapbox Geocoding, cached lookup
    against `shared.destinations`
  - `backend/extraction/verify.py` — deterministic keyword/synonym check
  - `backend/extraction/run.py` — full pipeline: read active tours ->
    read+group atoms -> LLM categorize -> verify (retry once) ->
    geocode -> insert components
  - Run against the real 31 active tours (no mock data step)
  - _Requirements: 1_

- [ ] 4. Bedrock satellite module
  - `backend/shared/bedrock_satellite.py` — STS assume-role (acc3
    primary, acc1 fallback), Bedrock invoke wrapper, streaming support
  - Unit test against a stubbed STS/Bedrock response — no live AWS calls
    in tests
  - _Requirements: 3_

- [ ] 5. Lambda A — Map/Browse
  - `backend/browse/tiles.py` — fixed 1° grid tile query with filter
    support (activity, intensity_level, country, season)
  - `backend/browse/search.py` — pgvector search within pre-filtered set
  - `backend/browse/handler.py` — routes: GET tiles, GET destination
    detail, GET search
  - _Requirements: 2_

- [ ] 6. Lambda B — Trip Assembly
  - `backend/assembly/events.py` — append-only trip_events writer +
    trip_drafts projection updater (single transaction per event)
  - `backend/assembly/sequencing.py` — deterministic nearest-neighbor
    day-ordering
  - `backend/assembly/agent.py` — `compose` and `renarrate` LLM steps,
    SSE streaming, debounce handling
  - `backend/assembly/registration.py` — Customer dedupe by phone/email,
    session claim on registration
  - `backend/assembly/notify.py` — advisor notification (fixed email
    config value)
  - `backend/assembly/handler.py` — routes: add/remove component,
    reorder, send-to-advisor
  - _Requirements: 3, 5, 6_

- [ ] 7. Frontend
  - `MapView.tsx` — Mapbox, tile-based pins, clustering
  - `FilterChips.tsx` — activity/intensity/season/country, wired to tile
    query params
  - `DestinationPopup.tsx` — hover (200ms debounce) + tap, lists all
    components at a destination with Add/Remove
  - `TripPanel.tsx` — live-updating list, drag-reorder, day badges,
    long-trip warning banner, "Send to advisor" button + registration
    form
  - BFF routes (`app/api/browse`, `app/api/trip`) proxying to Lambda A/B
    — Lambda URLs never exposed client-side
  - _Requirements: 2, 3, 4, 5, 6_

- [ ] 8. End-to-end smoke test
  - Manual run: browse map -> hover a destination with 2+ components ->
    add one -> confirm trip panel updates immediately -> add a second
    component from a different destination -> confirm compose runs once
    after debounce -> drag-reorder -> confirm renarrate runs, components
    unchanged -> register at send-to-advisor -> confirm notification
    fires to the configured address -> edit trip again -> confirm it's
    still editable and re-send works
  - Confirm every component surfaced on the map traces back to a real,
    active tour in `published_tours`

## Explicitly NOT Kiro tasks (human / Terraform gate)
- New Lambda resources + IAM trust policy additions in `AA-CIS-Infra`
  (acc3-bedrock, acc1-bedrock) — Nghiep applies manually via Terraform
- New CloudFront distribution — Terraform, human-applied
- Vercel project creation, domain setup
- Coordinating the `shared.destinations` migration with any concurrent
  AA-CIS-App schema work — flag for Nghiep to check before applying
  migration 002
- Merge to main — human-only, per standing program rule. Open a PR after
  each task instead
