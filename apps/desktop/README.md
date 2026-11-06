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

## Phase 1F — Installed-artifact hardening

Windows qualification now starts both the Tauri GUI and scientific worker with the runner's Node.js removed from PATH. The smoke validates that each production dependency in the embedded lockfile has an installed manifest with the expected version and is represented in the declared license inventory. An installer is rejected if silent uninstallation fails or leaves the main executable behind. CI stages the embedded engine only once per run, avoiding a second unreviewed npm resolution during packaging.

These are **runner-based checks, not clean-VM interactive acceptance**. A release remains blocked on source-controlled audited npm/Cargo locks, a real clean Windows VM (native file dialogs and end-to-end corpus validation), license-text review, code signing and final provenance verification. Do not publish unsigned experimental artifacts as an official release.

## Phase 1G — WebView2 offline qualification (Windows sandbox regression)

A manual Windows sandbox installation exposed a **blank Tauri window** and an
error saying `Could not find the WebView2 Runtime` even though the EXE
stayed alive for six seconds. The CI startup smoke had therefore produced a
false positive about GUI usability.

The experimental NSIS package now sets
`bundle.windows.webviewInstallMode = { "type": "offlineInstaller", "silent": true }`.
Tauri embeds Microsoft's **Evergreen WebView2 offline installer**, allowing
installation with no network connection. Expect roughly 127 MB additional
installer size. This is not the fixed-version runtime: installed Evergreen
WebView2 is managed and updated by Windows/Microsoft.

CI requires the installed Tauri process to spawn a `msedgewebview2.exe`
descendant; a living native shell alone is no longer accepted. The test
still does not assert that the HTML interface rendered correctly or that
file dialogs work. The user's isolated Windows sandbox remains a separate
manual acceptance gate. Microsoft WebView2 installation can be restricted
by machine policy, permissions or sandbox configuration; those cases must
be tested and documented, not treated as a passing GUI.

No public release is authorized by this change alone.

## Phase 1H — Sandbox failure reproduction and fixed-runtime experiment

**Manual regression, 2026-11-06:** A Windows sandbox still displayed
`Could not find the WebView2 Runtime` after installing the much larger
`offlineInstaller` NSIS artifact. GitHub runner green status therefore
does **not** mean that the application will work inside the sandbox.

The next test path is an **experimental, separate fixed-runtime build**.
Unlike the offline Evergreen installer, a fixed WebView2 Runtime ships
beside the application and does not require registration of a shared
WebView2 Runtime. Microsoft explicitly requires the application vendor
to maintain security updates for this runtime.

1. Obtain a Windows x64 **Fixed Version WebView2 CAB** from the official
   [Microsoft download page](https://developer.microsoft.com/microsoft-edge/webview2/).
   Record the version, Microsoft download provenance and independent SHA-256.
2. In PowerShell, from `apps/desktop`, run
   `./scripts/stage-fixed-webview.ps1 -CabPath "C:\path\Microsoft.WebView2.FixedVersionRuntime.x64.cab" -ExpectedSha256 "<verified-64-hex-sha256>"`.
   The stage **rejects SHA mismatch** and does not install anything into Windows.
3. Prepare the engine using `npm run stage:windows-engine`. Build with
   `npx --no-install tauri build --config src-tauri/tauri.windows.conf.json --config src-tauri/tauri.windows.fixed.conf.json`.
4. Install the resulting **experimental** NSIS artifact in the isolated
   sandbox, then verify the main interface and native JSON dialog.
   If it still fails, run `./scripts/diagnose-webview2.ps1` and collect
   Windows event logs; the diagnostic script changes no system settings.

**Never use an unverified third-party CAB mirror**, never commit a
Microsoft runtime binary to the source repository, and never interpret
the existing runner GUI process smoke as a full rendering test.
This build is only possible after obtaining and verifying the genuine
fixed-runtime CAB. The PR does not claim to have produced or tested it.
