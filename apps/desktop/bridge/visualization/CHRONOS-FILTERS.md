# Chronos — date uncertainty policy for deterministic interval filters

Scientific-only module for TEMPORA v3 events; no public API, native IPC or UI integration in this milestone.

Possible-overlap mode includes fully bounded intervals which may intersect the query. Certain-only mode includes only events whose full possible declared interval fits inside the query. Declared-start mode compares the declared start-date interval against the query.

Unknown or open-ended dates receive no invented day. They are excluded with explicit UNKNOWN_TEMPORAL_BOUNDS counts. A year-only event retains year precision. Neither mode certifies any historical fact.

Each result records canonical corpus digest, algorithm version and parameters, deterministic scientific SHA, pagination, source temporal expressions and diagnostics.

Limits: at most 100,000 events scanned and 100 results per page. This is not a large-corpus index, probabilistic temporal inference, calendar conversion, interactive timeline filter or feature enabled in Microsoft Store binaries.

From apps/desktop run npm run test:visualization. Fixtures are entirely fictional; canonical v3 remains unchanged.
