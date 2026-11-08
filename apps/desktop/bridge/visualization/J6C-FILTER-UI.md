# TVRW J6C — Shared typed visual facets

TEMPORA Desktop's six laboratory views can retain an editorial-status filter across modules. Chronos and GraphLab additionally accept a selected Gregorian date window and one explicitly chosen interpretation: possible overlap, fully contained, or exact declared start.

The filter is sent to the validated TEMPORA v3 Node engine over restricted IPC v2, **before pagination**. The projection scientific SHA-256 binds filter settings, corpus digest and algorithm parameters. Unsupported date filtering is **not secretly inferred**: outside Chronos/GraphLab the date range is retained in controls, clearly marked as not applied, while the status filter remains active.

No algorithmic analysis, graph BFS, snapshot comparison or export silently uses an unfiltered corpus while the view shows filtered records: those operations are intentionally disabled until their own filter contracts are versioned and tested. Their buttons are restored on filter reset.

The input corpus is never changed. These are documented-record selection criteria, not proof that a historical event occurred. Unknown dates and imprecise starts are separately identified in diagnostics by the engine.

The current implementation is Electron-only; it does not enable Tauri scientific sessions, persistence, cloud access or model training. Windows GUI acceptance and published Store updates remain separate gates.

A researcher may also opt into an **exact typed reference** filter, using the shared selection from J3. It matches only a canonical record with the same kind + namespace + id. A selected event will not silently match a related claim or graph edge; investigating such declared relationships remains an explicit separate operation.
