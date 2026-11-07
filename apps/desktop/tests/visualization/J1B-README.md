# TEMPORA TVRW — J1B synthetic reproducibility suite

This test-only fixture registry is **fictional** and **independent of ALNOP**. It is not a historical database, not a training dataset, and not a claim about real people, places or events.

## Scope

Run from `apps/desktop`: `npm run test:visualization`.

The twelve cases under `tests/visualization/synthetic-cases.mjs` cover:
- SYN-01 valid nonmilitary baseline;
- SYN-02 year-level historical civil time;
- SYN-03 negative longitude and explicitly approximate place;
- SYN-04 missing declared evidence without a truth judgment;
- SYN-05 and SYN-06 typed identity and namespace collision safeguards;
- SYN-07 multilingual original labels;
- SYN-08 duplicate invalid records;
- SYN-09 impossible latitude;
- SYN-10 schema version mismatch;
- SYN-11 dates outside declared profile;
- SYN-12 unknown temporal bounds.

`j1b-reproducibility.test.mjs` asserts canonical validation status, immutability, deterministic SHA-256 (ignoring generation timestamps and object key order), scientific hash changes when corpus/filter/algorithm parameters change, and rejection of invalid canonical inputs.

## Explicit limitations

The suite does **not** implement GeoLab, GraphLab, Chronos, EvidenceLab, PatternLab or Observatory; J1B contains no view, inference, historical truth scoring, cache, filesystem access, IPC v2 or model training. The tests do not certify geospatial topology, time interval algorithms or runtime performance: those belong to future dedicated PRs.

The J1A projection contract is a prerequisite. This change deliberately **does not** modify `schemas/tempora/v3`, the public `tempora-framework` package, Electron distribution workflows, or Microsoft Store packages.

## Merge/release gate

CI must pass on the J1B branch, then on an integration branch containing the current `main`. The present J1A PR #37 was created before subsequent Microsoft Store changes and must be reconciled rather than force-merged. No store submission or release is triggered by these tests.
