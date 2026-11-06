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
