# TVRW J8A — Derived in-memory segment catalog

**Scope:** a research-only pre-index prototype, not a large-corpus Desktop feature, persistent store, new IPC operation, public Framework API, or Microsoft Store claim.

## Contract

`buildSegmentIndex(corpus,{collection,segmentSize})` validates a **complete canonical v3 corpus** using `tempora-framework@3.0.0`, computes its canonical SHA-256 and derives deterministic segments from typed `kind/namespace/id` references. The nine canonical collections are explicit allowlisted choices; the reference tuples are ordered lexicographically. Segment manifests include first and last reference, ordinal, offset, count and scientific digest. Catalog digest is independent of generated timestamps, but is **deliberately bound to the complete canonical corpus SHA**, including the original order of records in canonical arrays. Two corpora with the same record identities in different order may therefore have distinct catalog digests even when their sorted segment reference lists match.

`readSegment(index, corpus,{segment,offset,limit})` returns **only typed reference and original collection position** — no full canonical record, filesystem path, evidence interpretation or inferred relation. Every read checks the current full corpus digest to reject stale index/corpus pairs. Pagination never crosses segment boundaries.

Limits: 16 MiB input (preflight on canonical serialization), 100,000 records in a selected collection, maximum 512 segments, configurable segment size 32–1024 and 100 references per page. Input must still be validated in full, so **this does not make 16 MiB/10k corpora usable in TEMPORA Desktop**: the existing `ProjectManager` 3 MiB limit and IPC frame limits remain unchanged. No index survives the process lifetime; no disk writes or networking occur.

## Scientific invariants and future gates

- Canonical v3 is not mutated, repaired, inferred or overwritten; only record identity and original offsets are indexed.
- A changed canon SHA revokes the index. Dates, provenance, reviews and source independence are never inferred.
- The serialized catalog is **not** a published canonical document. Segment digests have algorithm/schema version `1.0.0` for reproducible debugging only.
- For actual large-corpus support, the next milestone needs an authenticated, strictly bounded local file stream, incremental validation, a transactional disposable index, explicit cancellation and crash cleanup, and fresh security analysis before increasing byte ceilings. Reading full JSON, hashing it for every segment read and retaining all record references in memory is not a viable 100k-production architecture.
- Benchmark on Windows installed NSIS, document RAM/CPU and streaming correctness and prove that timestamps, edits and project switches cannot cause cross-corpus leakage.

## Verification

Run `npm run test:visualization` from `apps/desktop`. The opt-in synthetic benchmark also includes a `derived_segment_catalog` operation for 100/1,000/10,000 fictional events, with explicit rejections if the 16 MiB catalog input cap is reached. It is not a streaming or desktop-session benchmark. The J8 tests use only fictional synthetic canonical fixtures, including 1,000 entries, rejection of mutated data and page caps.

The module has no IPC wiring and is not advertised as an available Desktop feature. The eight permanent GitHub Actions workflows remain unchanged; the Microsoft Store submission is untouched.
