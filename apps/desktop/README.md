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

**Scientific honesty:** this UI does **not** yet call the TEMPORA canonical validator. Its counts are *structural observations*, not historical or schema validation. It does **not** execute TensorFlow or any AI.

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

This **0.1.0 foundation is not a packaged installer yet**: `bundle.active` is deliberately set to `false` pending application icons, signing, reproducible dependency locks, and tested Windows/Linux/macOS bundling. Don't distribute unsigned executables as official releases.

La version 0.1.0 se lance en mode développement. Les installateurs natifs, les signatures et la chaîne de publication seront traités après validation du cœur Tauri.

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

A separate, pinned Node worker invokes the genuine npm TEMPORA SDK (health, canonical validation, SHA-256). It is **not yet called from Tauri**. Run `npm run test:bridge` and see [ENGINE_BRIDGE.md](../../docs/reference/ENGINE_BRIDGE.md). The WebView has no access to Node APIs.

## Next steps

See [`docs/reference/DESKTOP_ARCHITECTURE.md`](../../docs/reference/DESKTOP_ARCHITECTURE.md) for the integration plan and TensorFlow-ready inference contracts.
