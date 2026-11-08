# TVRW — Synthetic-only performance baseline (J7 preparation)

Run from apps/desktop: `node scripts/bench-visualization.mjs --iterations=3`.

Use `--sizes=100,1000,10000` (default) to choose synthetic sizes and `--iterations=N` (1–10) to control independent repetitions in the same process. `--large` is mandatory for sizes above 10,000. Every operation reports its measured samples, min/max and median; rejected operations retain an explicit error code and stop further repetitions. These measurements are **not p95**, not Windows GUI latency and not evidence of performance on real historical data.

The script generates **fictional** canonical TEMPORA v3 events and measures single-run wall-clock timing for validation, SHA-256, a Chronos page, Observatory analysis and project-handle creation. Default dataset sizes: 100 / 1,000 / 10,000 records; explicit opt-in `--large --sizes=100000` for memory-heavy workloads. It has no network calls, imports no real historical dataset and does not persist files or indexes.

Each result records corpus byte size, RSS before/after, elapsed time and either success or an explicit rejection (including a 3 MiB local project cap). Do not call these results p95, FPS, Windows performance, or claims of handling corpus sizes that exceed the engine's validated limits. Re-run several times on documented Windows x64 hardware for confidence intervals, CPU/RAM and UI interactivity profiling.

Acceptance gates for increased corpus limits: explicit performance budget, application E2E tests, quota review, cancellable jobs and an independent security review. SQLite FTS5/RTree remains optional and **not installed or persisted by this harness**. The public v3 model and Store submission are untouched.
