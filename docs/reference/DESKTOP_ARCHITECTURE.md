# TEMPORA Studio — Architecture & implementation roadmap

**Status:** architectural foundation `0.1.0`. **Not a release.** The TEMPORA Engine `3.0.0` npm package is an independent project with a compatibility boundary.

## Vision

TEMPORA Studio is an offline-first, native desktop scientific workstation for creating, importing, evaluating, reviewing, and publishing *multiple independent* historical corpora. It must not inherit historical assumptions from ALNOP or embed the ALNOP dataset.

Native host: **Tauri 2 / Rust**, UI initially framework-free HTML/CSS/JavaScript to minimize prototype dependencies; select a stable component architecture after actual UX testing. First intended OS: Windows 10/11, then Linux and macOS.

**Architecture:**

```text
┌────────────────────────────── TEMPORA Studio ──────────────────────────────┐
│ Tauri WebView UI                                                          │
│  Dashboard | Corpus workspace | Import | Review | Analysis | Publication │
│            │ typed IPC (commands; no raw shell access)                   │
│ Rust host  │ file dialog & scoped storage | jobs | logging | integrity   │
│            │                                                              │
│        engine adapter ←── bounded JSON messages ──→ pinned Node sidecar   │
│                                              TEMPORA Framework SDK 3.x    │
│        intelligence adapter ← optional local inference runtime            │
│                                              models, features, provenance │
└───────────────────────────────────────────────────────────────────────────┘
```

**Hard boundary:** The `tempora-framework` npm library is a CommonJS SDK using Node.js. Its `fs`, `path`, and other Node dependencies mean it **must not be imported into the WebView**. The Rust host should own the isolation boundary and invoke an audited, bundled **Node sidecar** with a fixed command vocabulary, fixed message envelope and pinned engine version. The final distribution must bundle the runtime: requiring a user's separately installed Node.js is not acceptable for a native release.

Tauri officially supports explicitly bundled external binaries/sidecars: https://v2.tauri.app/develop/sidecar/ . The **sidecar choice and packaging strategy remain to be implemented and tested**, not invented as already working.

## Phase D0 — Native shell (this PR)

- Native Tauri 2 process with a narrow `runtime_info` IPC command.
- Local, offline, responsive UI with French and English controls.
- Read-only file *preview* (JSON/GeoJSON/CSV), size-limited to 8 MiB.
- No file writes, web calls, shell access, or AI inference.
- No claims that parsing JSON constitutes canonical validation.
- Avoid adding desktop dependencies to the framework root or npm public tarball.

**Acceptance:** static tests pass, no accidental network or production data access; Windows native build and installer must be verified in D1.

## Phase D1 — Canonical SDK bridge and first desktop build

**Native delivery gates:** Windows x64 build; reproducible install; WebView2 handling; icons; code signing plan; Tauri capability audit; exact component licenses; automated updater *disabled until signed releases exist*.

1. Build an isolated Node sidecar with pinned TEMPORA SDK version and predeclared command schemas.
2. Define request: `{id, protocol_version, method, payload}`; response: `{id, ok, data?, diagnostics?, error?}`.
3. IPC `runtime_info`, `workspace_open`, `profile_validate`, `corpus_validate`, `ingestion_preview`, `analysis_run`, `review_eligibility`, `publication_preview`.
4. Worker communicates via length-prefixed bounded UTF-8 JSON over pipe, not an exposed HTTP port.
5. **No arbitrary path or command arguments from WebView**; paths must be chosen through trusted OS dialogs, canonicalized, and constrained to an approved workspace.
6. Sidecar must be restarted under bounded conditions, with timeout/cancellation, budgets, error mapping and nonzero exit handling.
7. Never mutate source files. Writes require explicit previews, approvals and atomic revisioned snapshots. Lock concurrent writes.
8. Compare output bit-for-bit with framework SDK tests; no separate implementation of validation or scientific operations in Rust or UI.

**Acceptance:** a real corpus is validated by SDK via native IPC; invalid data produces identical diagnostics; sidecar unavailability fails closed; no runtime internet access; true desktop build and installation validated on Windows.

## Phase D2 — Workspace research tools

- Multi-corpus management: workspace manifest, profile versions, corpus snapshots, SHA-256, automatic checkpointing of *working copies*.
- Imports: CSV/JSON/GeoJSON mappings, preview, quarantine, conflicts and source traceability.
- Evidence lab: sources, assertions, identities, temporal/spatial uncertainty, two-way provenance links.
- Review workstation: reviewer identities, signed/append-only (or externally anchored) journal, decisions, contested claims.
- Analysis: comparison candidates, coverage, contradiction explorer, explicit parameter and method versioning.
- Publication: immutable manifests, reproducible exports, version promotion and rollback. No release without human review.
- Accessibility: keyboard, screen reader labels, high contrast, responsive scaling; FR/EN first, RTL Arabic after verified corpus-independent localization.

## Phase D3 — TensorFlow readiness (not model training yet)

**Do not bind the desktop to one ML runtime yet.** Specify a model provider interface and benchmark candidates:

- TensorFlow.js in the Node worker versus Python TensorFlow *only if justified*; evaluate CPU behavior, model size, packaging, startup, offline load, native bindings/ABI, GPU access, licenses and Windows installability.
- Local embedding models and sentence similarity; entity/linkage candidates; potential duplicates; source quality *review hints*, temporal conflicts.
- Models and datasets are stored and versioned separately from published corpora and the stable engine.
- Every inference record captures `model_id`, `model_version`, `model_sha256`, `dataset_version`, `feature_pipeline_version`, `parameters`, `score`, `calibration`, `explanation`, `created_at`, `approved_by?`.
- Require experiment registry: train/test separation by document/source, leakage checks, reproducible splits, metrics, subgroup/temporal drift, baseline comparison, and human acceptance.
- Never auto-merge entities, rewrite citations, invent sources or promote historical facts.
- Train only with rights-cleared datasets; avoid training on private journals unless explicit approval and documented governance.
- Inference can be disabled; **the application must remain functional without ML**.

A practical first ML candidate is a **non-destructive duplicate-ranking assistant**. Benchmarks determine whether TensorFlow is the right runtime; **the eventual learning model must not be confused with the source of scientific truth**.

## Repository and release policy

- `src/framework`, `src/sdk`, `src/cli`, `distribution`: the generic published engine. **No desktop import into core.**
- `apps/desktop`: independently versioned desktop application, Rust host, UI, OS packaging and desktop-only tests.
- `docs/reference`: architectural contracts and scientific limits.
- Future sidecar versions and hashes must be auditable, offline and separately tested.
- Desktop releases and npm SDK versions use **independent version numbers**.
- Installer signing, Windows x64, Linux and macOS testing are explicit gates, not implied by web UI passing.

## Security threat model (minimum)

Untrusted inputs: files, metadata, profile config, import mappings, model outputs and inter-process messages. Protect against path traversal, symlink escapes, decompression bombs, overly nested JSON, long input lines, UI HTML injection, hostile sidecar arguments, model tampering, arbitrary network traffic, corrupt checkpoints and stale review approvals. Set explicit per-command permission scopes. Do not enable shell access in JavaScript or permit raw filesystem paths without Rust validation.

**Sources:** [Tauri v2 capabilities](https://v2.tauri.app/security/capabilities/), [Tauri sidecar documentation](https://v2.tauri.app/develop/sidecar/), [Tauri Windows installers](https://v2.tauri.app/distribute/windows-installer/).
