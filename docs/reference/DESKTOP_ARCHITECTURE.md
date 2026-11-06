# TEMPORA Desktop — Architecture scientifique et préparation TensorFlow

**Statut : Phase 0 / Tauri 2 · Application native en cours de développement**

## 1. Principes non négociables

1. Le **moteur TEMPORA** (`tempora-framework` 3.0.0) reste l'autorité de validation, ingestion, analyse, revue et publication. Aucune duplication des algorithmes dans l'interface.
2. L'application `apps/desktop/` est **indépendante du package npm** ; elle possède son propre cycle de versions, dépendances, tests et installateurs.
3. Les corpus, documents privés, journaux et modèles restent locaux par défaut. Aucune synchronisation cloud ni télémétrie implicite.
4. **Un modèle IA propose ; un humain vérifie et décide.** Les suggestions ne deviennent jamais des données historiques publiées sans preuves et approbation.
5. L'interface présente distinctement : aperçu structurel, validation de schéma, analyse scientifique, inférence probabiliste et décision humaine.
6. Les profils d'autres périodes, langues ou territoires ne doivent pas être traités comme des variantes d'ALNOP.

## 2. Découpage technique

```text
Desktop GUI  (TypeScript / WebView)
       |
       |  IPC JSON sérialisé, commandes explicitement exposées
       v
Tauri native authority  (Rust)
       |  file picker / filesystem constraints / process management
       |  no arbitrary shell execution or unscoped filesystem access
       v
TEMPORA engine adapter  (future, separate process with versioned contract)
       |  pinned `tempora-framework` runtime, no direct WebView Node APIs
       v
Canonical v3 · Ingestion · Analysis · Review · Publication
       |
       +------------------------------+
                                      |
                         Future inference service
                         Model registry / TensorFlow
                         Suggestions + provenance
                         NEVER direct publication
```

Tauri 2 grants window capabilities explicitly. The Phase-0 Rust command opens the **native file chooser itself**; the frontend does not receive arbitrary read/write permission or pick its own file paths. The 8 MiB preview size limit protects memory usage. The UI uses DOM-safe rendering.

## 3. Functional phases / Tranches de réalisation

| Phase | Deliverable | Acceptance criterion |
|---|---|---|
| 0 — Native foundation | Tauri shell, FR/EN navigation, native JSON/GeoJSON read-only previews | Rust tests, frontend compilation, no network dependency, no write |
| 1 — TEMPORA engine bridge | Profile selection, validated corpus import, dry-run, quarantine, analysis, reviewer workspace | Uses genuine SDK v3; stable IPC protocol; independent installer test |
| 1b — Research tools | Comparisons, discrepancy views, source provenance, human review and immutable snapshots | Every decision attributable and repeatable; exact artifact hash |
| 2 — Inference provider | Explicit opt-in local inference, provider API, model registry | No implicit model loading; actionable suggestions with uncertainty |
| 3 — TensorFlow | Audited TensorFlow-compatible runtime, benchmarks and opt-in models | Reproducible datasets and evaluations, licensing, CPU/GPU fallback |
| 4 — Distribution | Signed Windows/macOS/Linux installers, auto-updates only if opted in | Reproducible binaries, vulnerability checks, release attestations |

### Phase-1 bridge — engineering decision

TEMPORA npm 3.0.0 currently exports a CommonJS SDK requiring Node APIs. **Do not import it into the WebView**. The preferred initial integration is a separately versioned, locally packaged **Node worker** that speaks length-bounded JSON messages with Rust and never exposes arbitrary shell or filesystem commands.

Alternative evaluated later: a **Rust-native module** only if it can preserve the canonical schemas and produces identical output verified by cross-language fixtures. Never attempt to maintain two divergent scientific engines.

The worker will use stable message envelopes:
- `protocol_version`, `request_id`, `operation`, `profile_id`
- `input_hash`, `expected_schema_version`, `read_only`, `limits`
- response `status`, `result`, `diagnostics`, `output_hash`, `engine_version`
- default to dry-run, cap input and response size, allowlist methods and paths
- propagate cancellations, timeouts and structured errors with no secret leakage

A file preview **must not** be reported as passing canonical validation.

### Phase-2/3 inference contract

Implement an extension point, **not TensorFlow code in the desktop main process**:

```typescript
type InferenceProposal = {
  provider: "tensorflow" | "baseline";
  modelId: string;
  modelVersion: string;
  modelSha256: string;
  datasetSha256: string;
  operation: "candidate-duplicate" | "entity-link" | "source-assistance";
  recordIds: string[];
  confidence: number | null;
  calibrationId: string | null;
  evidenceRefs: string[];
  explanation: string;
  createdAt: string;
  status: "proposal";
};
```

Providers are loaded **only after explicit consent**, with verified hashes, declared licenses, provenance, runtime version, hardware support and resource limits. Record CPU/GPU device, runtime library version, inference parameters, time and (if applicable) deterministic seed. Keep offline CPU fallback and disable untrusted remote model execution.

Training and inference are **separate**. Do not train on the 263 incomplete ALNOP notices as if they formed a complete or ground-truth historical universe. Require held-out, independently annotated validation and leakage checks before making scientific claims.

Evaluate precision, recall, calibration, false positive risks, profile transfer, temporal ambiguities and language coverage (including Arabic script) against human-curated reference sets. Proposals must show provenance and allow explicit reviewer rejection.

Never let an ML score overwrite a sourced historical claim, assign exact coordinates without evidence, or autonomously approve publication.

## 4. Native security and governance

- Tauri 2 capability allowlist per window; remote content must not gain IPC access.
- Production CSP and self-hosted/local assets; no remote fonts, analytics or default internet permission.
- Never use a generic `execute(command)` endpoint or unsandboxed file-read IPC.
- All export locations via native picker, verified within an approved user workspace.
- No permanent file persistence until explicit project creation and retention policy.
- Use a SQLite-based local index only when the workflow and migration policy justify it; keep canonical JSON snapshots immutable.
- Separate public data from private review journals and identifiers.
- Threat model: malicious JSON, deep nesting, ZIP bombs, symlink escapes, stale model versions, compromised workers, poisoned training data.

## 5. Test and release gates

- Phase 0: `npm run build` in `apps/desktop/`, `cargo test` with a native toolchain, GitHub Actions platform smoke checks.
- Phase 1: compare engine adapter results byte-for-byte or canonical-hash-for-canonical-hash with framework tests; match API v3 golden fixtures.
- Phase 2: deterministic inference fixtures, calibration benchmarks, failure simulations and license checks.
- Phase 4: build Windows MSI/NSIS, macOS DMG, Linux DEB/AppImage with platform-specific toolchains; sign packages before distribution.
- Fail closed on unsupported schema/model versions. Never block researchers from exporting unmodified source files.

**Statut actuel :** le bureau est un véritable projet Tauri, mais **pas encore un outil d'édition canonique ni un moteur TensorFlow**. Ces fonctionnalités exigent les phases décrites ci-dessus.

## Phase 1A — Evidence workbench / Atelier scientifique

The first scientific-workbench tranche keeps the existing native file-picker
and TEMPORA Engine validation workflow. On successful engine invocation, Rust
returns a **bounded structural evidence inventory** alongside the engine's
canonical decision and digest. `Analyses` displays counts, editorial statuses,
and up to 20 evidence summaries for each of events, sources and claims.

`unsupportedClaimCount` means only **zero declared
`provenance.evidence` entries**; it does not assert that a claim lacks real
historical support. The GUI renders user strings using `textContent`,
without HTML injection. No indexing, writes, source ranking, historical
verification, review action, inference or TensorFlow training is performed.

## Phase 1C — Explicit contradiction inventory

The Rust bridge reads `claims[].contradicts[]` *only* for an informational
display, preserving the canonical validator as the scientific authority.
The complete link count is returned with a bounded first-20-entry preview.
An absent or other-namespace target is clearly labelled as unresolved.
Neither semantic contradictions, corroboration nor truth are inferred.
No reviewer writes, model execution or publishing actions are included.
