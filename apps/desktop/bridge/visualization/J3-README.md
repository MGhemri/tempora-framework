# TVRW J3 — six read-only projection contracts

This module creates **derived records only** from validated TEMPORA v3 corpora. No synthetic historical facts, geocoding, inferred relations, remote tiles, model training, or modification of the source document.

`projections.cjs` exposes a bounded, deterministic scientific envelope for `geo`, `graph`, `chronos`, `evidence`, `pattern` and `observatory` with a stable typed reference and explicit `offset` / `limit` (limit <=100). No UI or native IPC is exposed in this milestone.

- Geo: canonical spatial assertions with roles, CRS, precision and geometry preserved.
- Graph: declared canonical relations only, with orientation and provenance.
- Chronos: declared time expressions, without manufacturing exact day timestamps.
- Evidence: declared claims, source pointers and contradictions; source independence remains unknown.
- Pattern: inventory of events with **`not_computed`** state. No candidates or rankings are invented.
- Observatory: per-event metadata and documented evidence counts, not historical completeness estimates.

Results preserve canonical digests and exclude generation time from scientific SHA-256. The size guard and validation of J1A remain effective. Large corpora are rejected until the separately audited J2 project/session paging pipeline exists. UI, maps, graphs, algorithms, caches and exports still require independent implementation and acceptance tests before Store release.

Run from `apps/desktop`: `npm run test:visualization`. This work is built on J1A/J1B integration and deliberately does not alter Microsoft Store packaging or public npm SDK APIs.
