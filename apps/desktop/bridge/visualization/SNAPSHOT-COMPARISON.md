# Corpus Observatory — deterministic snapshot comparisons

Compares two independent, explicit TEMPORA v3 corpus snapshots in memory without writing them, using the canonical TEMPORA Framework validator and digest. This initial scientific core does not expose a UI or public SDK method.

Each output records both corpus digests, their profile identifiers, nine canonical collection counts, typed identity additions/removals and reproducible algorithm SHA. Content edits without record count changes remain visible through the changed canonical digests.

Scientific limitation: counts of documented records do not represent historical exhaustiveness; an absent entry is not evidence of an absent historical event. No automatic judgments or inferred relationships are made.

Limit: 100,000 total records per input with canonical validation required. Indexing, large project persistence, snapshot selection UI and Windows GUI tests remain separate release gates.

Run npm run test:visualization in apps/desktop. This private implementation does not alter v3 canonical schemas, the public npm package, or Microsoft Store submission.