# GraphLab — bounded declared-relation navigation

This milestone introduces deterministic breadth-first traversal of explicitly declared TEMPORA v3 relations. It never manufactures historical facts or changes canonical files. Parallel edges and the typed (kind, namespace, id) identity are preserved.

From the Electron Workbench, open a validated corpus, select GraphLab, enter a typed record identity and select direction (in/out/both) and depth (1–5). Outputs record original relation identity and traversal direction. Truncation is reported; no inference of truth.

Limits: 5,000 declared relations, 1,000 visited typed nodes, depth 5, 100 returned edges maximum, default 50. Each result is tied to canonical corpus SHA-256 and scientific algorithm parameters.

Not implemented here: arbitrary node-to-node path search, large-graph indexing, time filtering, job cancellation, advanced layout or a Tauri bridge. The same edge can appear twice in bidirectional traversal (once per direction); this is a path traversal report, not an edge-deduplicated canonical graph.

Tests: from apps/desktop run npm run test:visualization. Verify the actual GUI and worker under Windows Sandbox offline and without Node in system PATH before a new Store submission. The private CDC is not included.