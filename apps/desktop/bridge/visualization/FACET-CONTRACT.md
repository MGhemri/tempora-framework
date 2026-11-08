# TVRW — Typed facet filtering, first audited scientific core

The six scientific laboratories share a reproducibility envelope, but filtering must never imply relationships or false date precision.

This milestone adds opt-in **pure** facet evaluation for declared, canonically valid TEMPORA v3 records. No public SDK, file access, cloud call, IPC API or GUI changes are made in this PR.

Facets: editorial status, one exact typed identity (kind + namespace + id), and bounded temporal windows for Chronos event dates and GraphLab declared relation dates only.

Time semantics:
- `possible-overlap`: declared earliest/latest bounds may intersect requested window; *not* a claim an event certainly occurred in that window.
- `certain-only`: the entire declared interval must be inside the window.
- `declared-start`: only exact-day starts qualify; imprecise dates are excluded with explicit diagnostics.
- Unknown dates are never manufactured. They are excluded and counted in `TEMPORAL_UNKNOWN_EXCLUDED`.

Sort the normalized status list and perform filtering *before* pagination. The selected facet is embedded in the algorithm parameters and the scientific digest, making changes reproducible. No-facet queries retain their previous output and signature.

Unsupported time filtering of GeoLab and other non-temporal collections rejects explicitly rather than inferring event time from linked data. This pure module is a foundation for separately reviewed IPC and shared UI controls.

Run `npm run test:visualization` from `apps/desktop`. Store distribution remains a distinct release and certification step.
