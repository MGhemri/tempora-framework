> **Current stable preparation:** TEMPORA Desktop **1.0.0** is a release candidate in development, not signed, Microsoft-certified or published. The 0.2.0 Microsoft Store publication was reported by the maintainer. Stable qualification requires clean Windows 10/11, upgrade and signing/channel tests. See [release GO/NO-GO](../../Audit/RELEASE-DESKTOP-STABLE-1.0.0.md). Historical Tauri/Beta instructions below are NOT supported release paths.

# TEMPORA Desktop — Chromium/Electron (official Windows runtime)

The **only supported Windows Desktop runtime is bundled Chromium/Electron**. It does not depend on Microsoft Edge WebView2 or its Evergreen distribution. Windows NSIS and Microsoft Store AppX/MSIX candidates use the same Electron host and the pinned TEMPORA 3.0.0 worker.

**Tauri/WebView2 is retired from supported Windows distributions.** Its source is preserved for audit under `src-tauri/`, but its installer is not built, published, or submitted. Historical instructions below are obsolete and must not be used for releases.

For current build and packaging guidance, see [Electron Desktop](electron/README.md). Use a genuinely clean Windows 10/11 environment without Node or WebView2 for acceptance testing. No public Store publication is authorized solely by a previous certification.

---

## Archived Tauri engineering notes — historical, not operational

# TEMPORA Desktop — Native Research Workspace

**Phase 0 / Alpha 0.1.0** · Tauri 2 · Rust · TypeScript · Vite · FR/EN

TEMPORA Desktop is an **independent native application** living beside the [TEMPORA Framework](../../README.md), **not inside its npm package**. This first iteration is a practical read-only JSON/GeoJSON document inspector with a native file picker.

La première version fournit une interface bilingue professionnelle, un dialogue natif de sélection de fichier, un aperçu structurel en lecture seule et une navigation vers les futurs espaces d'analyse et d'inférence.

## Available / Fonctionnel

- Native Tauri window and Rust file-picker command
- JSON/GeoJSON documents up to **8 MiB**; rejects invalid JSON
- Counts records, sources and assertions, with a seven-record preview
- FR/EN interface, responsive desktop layout
- No persistent index, no file writes, no upload, no telemetry, no model download
- DOM-rendered user data uses `textContent` to prevent HTML injection

**Scientific honesty:** the development build now exposes an explicit **Validate TEMPORA corpus** action calling the genuine pinned TEMPORA Engine through Rust → Node IPC; the structural preview remains separate. Its counts are *structural observations*, not historical or schema validation. It does **not** execute TensorFlow or any AI.

## Run locally / Démarrer

Prerequisites: Node.js 20+, npm, Rust 1.90+ toolchain, and the native [Tauri OS dependencies](https://v2.tauri.app/start/prerequisites/) (WebView2 on Windows, WebKitGTK on Linux, system WebKit on macOS).

```sh
cd apps/desktop
npm install
npm run tauri dev
```

To validate only the TypeScript frontend:

```sh
npm run build
```

To run the native Rust tests:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

The default Tauri configuration keeps `bundle.active=false`. **Windows x64 CI** now has a dedicated release-bundle configuration and attempts an **unsigned NSIS installer** with bundled Node.js and TEMPORA Engine. Any resulting GitHub Actions artifact is **experimental**, **not code-signed** and **not an official release**. Complete reproducibility and OS-level installation tests remain release gates.

La phase 1C prépare un installeur NSIS Windows x64 expérimental en CI et embarque Node.js ; un artefact non signé ne constitue pas une distribution officielle. Linux/macOS et la signature restent à qualifier.

## Architecture

```text
apps/desktop/
  src/                  TypeScript UI (presentation only)
  src-tauri/src/lib.rs   Explicit Rust commands and safe local preview
  src-tauri/capabilities/main.json   Minimal single-window permissions
  src-tauri/tauri.conf.json          Desktop application configuration
  src-tauri/Cargo.toml   Rust native dependencies
```

The GUI must not import `src/framework/` directly in a WebView: TEMPORA 3.0.0 is distributed as a **CommonJS/Node package**, not a browser-native module. The next development phase must introduce a separately tested, version-pinned engine adapter. **Do not duplicate scientific algorithms in Rust or TypeScript**.

L'interface n'embarque **aucune copie** du moteur scientifique ni des données ALNOP. L'adaptateur avec le SDK npm restera versionné, isolé et testé.

## Phase 1A — Engine worker protocol (under test)

A separate, pinned Node worker invokes the genuine npm TEMPORA SDK (health, canonical validation, SHA-256). It is called **only via a fixed Rust command in development builds** and never imported into the WebView. Run `npm run test:bridge` and see [ENGINE_BRIDGE.md](../../docs/reference/ENGINE_BRIDGE.md). The WebView has no access to Node APIs.

## Phase 1B — Native validation (developer mode only)

Click **Valider un corpus TEMPORA** in Documents, choose a JSON corpus through the native picker, and inspect schema diagnostics and its canonical SHA-256. Install desktop npm dependencies first. Development builds use your installed Node.js (fixed worker script, no user-controlled command arguments). Production builds refuse validation with `ENGINE_RUNTIME_NOT_BUNDLED` until a signed, pinned, audited runtime is embedded; installers remain disabled. The 3 MiB validation limit is intentionally stricter than the 8 MiB structural preview. Neither action edits the input.

## Next steps

See [`docs/reference/DESKTOP_ARCHITECTURE.md`](../../docs/reference/DESKTOP_ARCHITECTURE.md) for the integration plan and TensorFlow-ready inference contracts.

## Phase 1C — Windows standalone experiment

On Windows x64 with Rust and Node.js 22.16.0, run `npm install`, `npm run test:bridge`, `npm run stage:windows-engine` and `npm run tauri -- build --config src-tauri/tauri.windows.conf.json`. The staging script copies the fixed Node.js executable and installs `tempora-framework@3.0.0` alongside `bridge/worker.cjs`. The Rust release code locates them under the Tauri **resource directory** and never falls back to system Node. The default development build still uses installed Node.

**Security and reproducibility limits:** The CI installer is unsigned and not released publicly. Runtime SHA-256 manifest is captured at staging, but dependency lockfile/signed provenance, clean-VM no-Node end-to-end verification, and Windows antivirus/code-signing review are still required before any production release. The UI never accepts raw shell arguments or executable paths.

## Phase 1D — Installed Windows smoke tests

The Windows CI installer is **silently installed into an isolated runner directory** and checked *from its installed resource files*, not from the source checkout. The smoke explicitly removes system Node.js from `PATH`, verifies the bundled `node.exe` and worker SHA-256 against their recorded manifest, calls the installed worker for `health`, `corpus.validate` and `corpus.digest`, and invokes the silent uninstaller afterwards. A successful green job proves only installed engine viability in the CI runner, **not GUI dialog behavior or a clean virtual machine**. A real end-user clean VM with no Node installed is still required before a public Desktop release. Keep unsigned artifacts strictly experimental.

## Phase 1E — Distribution audit / audit de distribution

The Windows CI now checks the **installed GUI process** stays running for six seconds, independently of the installed Node worker tests. This is a startup smoke test, **not** a full interactive GUI acceptance test. The package staging generates a dependency lockfile within the **bundled runtime** and records its SHA-256 and an inventory of declared licenses. The npm CLI performs an audit that rejects reported **high/critical** production dependency vulnerabilities at build time. GitHub Actions also uploads the installer SHA-256 and an inventory alongside the unsigned experimental installer. These checks are reproducibility *evidence*, but do **not** replace a source-controlled dependency lockfile or a signed, hermetic release; transitive dependency resolution may still change between builds.

Before an official public release: commit audited npm and Cargo locks, inspect bundled license texts and the runtime's Node.js licensing, sign the Windows executable/NSIS installer, test native file dialogs and corpus validation inside a **genuinely clean Windows VM without Node**, perform accessibility checks and keep the updater disabled until signed metadata is available.

## Scientific workbench — Phase 1A (read-only)

After validating a selected canonical JSON corpus in Documents, open **Analyses** to inspect a bounded evidence dossier. The application displays total event/source/claim counts and the number of claims with **zero declared evidence entries**, plus the first 20 records per collection with identifiers, titles/predicates, editorial/claim status and declared evidence counts.

The canonical validation and SHA-256 digest are still performed only by the pinned TEMPORA Engine 3.0.0. Rust produces a **structural inventory**, never a scholarly assessment of the truth or quality of evidence. No input files are changed, no index is persisted, and the WebView receives only bounded, text-rendered records. A corpus invalid under canonical v3 may still be inspected, but its validation badge remains explicit.

The window remains a single-document, ephemeral workbench: no source editing, review decisions, evidence scoring, ingestion or TensorFlow execution in this tranche.

## Scientific workbench — Phase 1B (reference navigation)

In **Analyses**, select an event, claim or source row using mouse,
Enter or Space. The evidence panel shows the record's declared subject
and source references. Identifiers resolve to titles only if the
referenced event or source is within the bounded, first-20-row preview;
otherwise the UI states that the reference is outside this preview.
No hyperlink is invented and no external URL is opened.

All reference values are extracted from `subject.id` and
`provenance.evidence[].source.id` by Rust, capped at 20 references per
record. The view is ephemeral, read-only, and does not imply the
referenced material supports the historical assertion.

## Scientific workbench — Phase 1C (declared contradictions)

The **Analyses** view now displays a bounded table of claim-to-claim links
expressly present in canonical `claims[].contradicts[]`. The total reflects
all declared links in the selected corpus; at most 20 links are shown.
An explicit status distinguishes targets present in the same namespace
from absent or foreign-namespace targets. This is **not** a contradiction
detector, historical fact-checker, confidence score, or reconciliation tool.
Links are read-only; no canonical data is modified.

## Scientific workbench — Phase 1D (canonical review dossier)

**Analyses** now lists review records explicitly declared under `reviews[]`
with their subject, method, author, agent type, decision, reason, date and
optional recorded content hash. Totals distinguish reviews that explicitly
declare `agent_type: "human"` from automatic or unspecified records;
the first 20 rows are displayed. Missing fields in invalid corpora are
shown as placeholders, never fabricated.

**No new reviews are created or stored by this tranche.** Reviewing a
file in the GUI does not change its canonical status or constitute a
human approval. The canonical engine validator remains authoritative.
A future opt-in editable review workflow must include explicit reviewer
identity, selected evidence, signed decision provenance, safe export
and independent acceptance tests before enabling writes.

## Scientific workbench — Phase 1E (local, noncanonical review draft)

In **Analyses**, after validating a canonical corpus, researchers may prepare
a review draft consisting of their declared name, an **existing record ID
visible in the 20-item preview**, the review method and supporting rationale.
The draft includes the **TEMPORA Engine 3.0.0 canonical SHA-256** of the
selected source corpus. It is explicitly marked
`document_type: tempora.review_draft`, `status: draft`,
`approved: false`, and `signed: false`.

The **Copy draft JSON** button uses the local clipboard only after an
explicit click. A non-conforming corpus or an unknown subject ID blocks
draft creation. The file is never modified, and a draft is **not** a canonical
v3 `reviews[]` entry and cannot approve, publish or overwrite anything.
Clipboard permission may vary by WebView2/sandbox policy; copy failures
are shown to the researcher rather than silently treated as success.
No persistence, cryptographic signing, identity verification or automatic
review is implemented in this tranche. The user must protect any copied
private data and handle retention separately.

## Rust dependency reproducibility — committed Cargo.lock

The actual `apps/desktop/src-tauri/Cargo.lock` was generated by
Cargo on the Desktop Foundation GitHub Actions Linux runner and committed
from the SHA-256-verified artifact of workflow run `42295928577`.
Its audited SHA-256 is
`14200f525820cd8b8303938af6ee77426fae64a4d78df8d0472f59b302e726f9`
(412 package entries at creation).

The CI now **does not generate or update the lockfile**. Linux tests use
`cargo test --locked` and check its recorded SHA-256; Windows checks
`cargo metadata --locked`, passes `--locked` from the Tauri CLI through
to the Cargo runner, and checks that the installer build has not changed
`Cargo.lock`. Dependency updates must be deliberate, regenerate the
lockfile with Cargo, and receive review.

This pins the Rust dependency graph, **not** entire machine environments,
all npm tooling, compiler versions, binary timestamps, or bit-for-bit
Windows installer outputs. WebView2 sandbox compatibility remains separate.

## Fixed Version WebView2 — controlled sandbox experiment

The existing NSIS Windows workflow is **not** proven to work on machines
without an Evergreen WebView2 registration. The Windows development PC
tests demonstrate genuine canonical engine execution, but the clean sandbox
previously displayed `Could not find the WebView2 Runtime`.

This experimental build is intentionally **manual and isolated**. Obtain the
official **Microsoft Edge WebView2 Fixed Version Runtime x64 CAB** from
Microsoft; verify the source and independently record the CAB SHA-256.
The required runtime archive is not downloaded automatically and is
**never** committed. On Windows, with Rust, npm and Tauri prerequisites
installed, run from `apps/desktop/`:

```powershell
./scripts/build-fixed-webview.ps1 -CabPath "C:\\path\\Microsoft.WebView2.FixedVersionRuntime.x64.cab" -ExpectedSha256 "<64-character-verified-sha256>"
```

The script validates the CAB digest, stages the runtime in
`src-tauri/resources/webview2-fixed/`, stages the pinned scientific
Node/SDK runtime, and invokes Tauri NSIS with the override
`src-tauri/tauri.windows.fixed.conf.json` and Cargo `--locked`.

**Acceptance gate:** install the resulting unsigned NSIS executable in a
Windows sandbox where neither Evergreen WebView2 nor system Node is
installed. Confirm visible UI rendering, JSON file picker, valid/invalid
canonical corpus outcomes, shutdown and uninstall. A running GUI process
alone is not sufficient proof. The fixed-runtime experiment is not a
public release, is not yet an automated CI artifact, and does not
resolve licensing or code-signing requirements. Do not merge the old
experimental #20 blindly into the now advanced `main` branch.

## Recommended Windows installation — one NSIS setup, two components

**Default Windows installer:** `src-tauri/tauri.windows.conf.json`
now enables `offlineInstaller`. It installs TEMPORA Desktop and, where
missing, the official Microsoft **Evergreen WebView2 Runtime** during the
same setup, before the first GUI launch. It does not need network access,
but makes the installer substantially larger. This uses Tauri's supported
NSIS prerequisite mechanism; **the user does not run a second setup**.

**Lightweight online alternative:** run
`./scripts/build-online-webview.ps1` on Windows to embed Microsoft's
small WebView2 bootstrapper. If WebView2 is missing, the installer needs
Internet access to download the runtime. Already-installed Evergreen
runtimes are reused.

**Third fallback:** `build-fixed-webview.ps1` packages an application-
local Fixed Version runtime and requires a genuine Microsoft CAB plus an
independently verified SHA-256. Fixed Version is a distinct distribution
strategy, not the default, and requires application-managed security
updates.

The previous CI failure of the malformed-CAB test was caused by
`expand.exe` returning without producing `msedgewebview2.exe`.
The staging script now classifies empty extraction as an invalid CAB.
A failed verification step is not proof that the actual installer or
user's desktop application failed. The final acceptance still requires
clean-machine GUI display and real corpus validation.

## New TEMPORA visual identity — integration handoff

The project has received two official images from its maintainer:
a **transparent** black-and-gold logo and a **white-background** variant.
The original images must remain unaltered and be stored separately
from generated desktop icons. The associated user-provided files
are prepared in an external Desktop Branding Assets package, not
yet uploaded to this repository.

Proposed paths after asset upload:
- `apps/desktop/public/branding/tempora-brand-transparent-1024.png`
- `apps/desktop/public/branding/tempora-brand-white-1024.png`
- `apps/desktop/src-tauri/icons/icon.png`
- `apps/desktop/src-tauri/icons/icon.ico`

**Do not reference missing assets or replace build icons until these
files have actually been committed.** The black lettering is not
legible on the app's dark sidebar without a light background or
a distinct high-contrast variant. Treat final brand use and
high-DPI screenshots as visual acceptance criteria.
