"use client";

// Top brand bar — Adventure Asia wordmark + tagline. Kept slim so the map
// dominates the viewport (map-first product).
export default function Header() {
  return (
    <header
      className="z-30 flex items-center justify-between border-b border-aa-line bg-white px-5"
      style={{ height: "56px", flexShrink: 0 }}
    >
      <div className="flex items-center gap-3">
        {/* Gold compass-dot mark */}
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-aa-ink"
        >
          <span className="h-3 w-3 rounded-full bg-aa-gold" />
        </span>
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-aa-ink">
              Adventure Asia
            </span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-aa-gold sm:inline">
              Trip Planner
            </span>
          </div>
          <p className="hidden text-[11px] text-aa-muted md:block">
            Discreet executive adventures, crafted day by day
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-2 text-sm">
        <span className="hidden text-aa-muted md:inline">
          Pin experiences · build your trip · hand off to an advisor
        </span>
      </nav>
    </header>
  );
}
