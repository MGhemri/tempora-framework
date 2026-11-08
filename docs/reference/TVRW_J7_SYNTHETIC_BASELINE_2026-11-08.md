# TEMPORA Visual Research Workbench — Synthetic J7 baseline (2026-11-08)

**Status:** recorded CI observation, not a Windows GUI performance certification or a historical research finding.

## Evidence and reproducibility

- GitHub Actions run: https://github.com/MGhemri/tempora-framework/actions/runs/42438137569
- Tested commit: `d00099cb992799c9b7ac6ada7572f511525a4ad0` (`main` after PR #68).
- Runner: GitHub-hosted Ubuntu Linux, Node.js 22.16.0.
- Generator: `apps/desktop/scripts/bench-visualization.mjs`, fictional TEMPORA v3 events only.
- Each operation: three in-process wall-clock samples, median reported below. Startup, cache, GC and runner variations may affect measurements.
- Source artifact: `TEMPORA-J7-ONE-TIME-SYNTHETIC-BASELINE` (GitHub artifact ID `13599933315`, retained for 14 days).
- No real historical corpus, Windows UI frame rate, p95 or confidence interval was measured.

## Measurements

| Synthetic events | Serialized corpus size (bytes) | Canonical validation (median) | Chronos scoped projection (median) | Scoped JSON export (median) | Project creation |
| ---: | ---: | ---: | ---: | ---: | --- |
| 100 | 75,352 | 4.477 ms | 15.762 ms | 12.880 ms | OK, median 7.797 ms |
| 1,000 | 743,761 | 43.632 ms | 78.866 ms | 76.718 ms | OK, median 70.345 ms |
| 10,000 | 7,427,859 | 269.781 ms | 756.762 ms | 742.436 ms | **Rejected: `LIMIT_EXCEEDED`** |

The 10k projection and export measurements were obtained by calling the pure validated scientific functions directly. They **do not establish** that a 10k event corpus can be opened by TEMPORA Desktop today. Desktop's `ProjectManager` bounds a local corpus session to **3 MiB (3,145,728 bytes)**. Its rejection in the 10k sample is expected and safeguards that limit.

### Interpretation

- There is evidence that CPU-time and corpus payload grow materially with synthetic event count on this Linux runner.
- Repeated canonical validation, canonical hashing and deterministic sorting occur inside research operations; optimize these only after preserving immutable validated input and reproducibility contracts.
- The 10k UI integration is currently blocked by the existing corpus-size guard, **not** by a demonstrated Windows rendering limit.
- Do **not** raise the 3 MiB limit merely because the isolated in-memory test was successful.

## J7 acceptance gates before large-corpus claims

1. Specify a bounded read-only streaming/indexing architecture with explicit provenance, local-only storage, interruptibility and protection against oversized/untrusted files; no implicit canonical writes.
2. Add baseline, stress, malformed-corpus and cancellation tests to the IPC/worker layer, then measure *actual* session loading and per-module paging separately.
3. Confirm cache safety with corpus digest invalidation, isolated project handles, deterministic iteration/order and no corruption of canonical v3.
4. Quantify memory, end-to-end latency and Windows-installed NSIS behavior on controlled x64 hardware; repeat samples and record CPU/RAM specifications.
5. Only after the previous gates pass, define an explicit maximum corpus size (bytes and records). Optional SQLite FTS5/RTree indexing must remain private, derived, versioned, disposable and reproducible.

**Store:** no Microsoft Store package or submission was produced by this benchmark. Scientific research outputs must not be interpreted as historical certification.

## Repository hygiene

PR #68 removed 21 stale branches only after a dry-run, with five fully integrated and sixteen closed/superseded PR heads audited by original SHA and replacement merge. The original PR records and their commit references remain available on GitHub. One-time workflow removed by the follow-up PR; permanent workflow count returns to eight. The two historical `release/` branches remain untouched.
