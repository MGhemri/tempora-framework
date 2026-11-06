# TEMPORA Studio — Native desktop foundation (v0.1.0)

This directory contains the **first Tauri 2 native application foundation**, separate from the **TEMPORA 3.0.0 scientific engine**.

## What works now

- Native Tauri window with Rust backend and an explicit `runtime_info` IPC command.
- Offline, dependency-free user interface in French and English.
- Local browser/WebView file preview for `*.json`, `*.geojson` and `*.csv`, with a strict 8 MiB preview limit.
- No network requests, no files written, no remote telemetry.
- Static smoke tests for the standalone UI and application configuration.

**Important:** A parsed file is **not** a validated historical corpus. Canonical validation, ingestion and publication are *not wired to TEMPORA Engine yet*. Do not represent this desktop prototype as a working data editor.

## Run locally / Exécution locale

Prerequisites: [Tauri 2 requirements](https://v2.tauri.app/start/prerequisites/), Rust stable, Node.js 20+.

```sh
cd apps/desktop
npm install
npm test
npm run dev
```

The `src-tauri/tauri.conf.json` embeds the static `ui/` directory; no CDN, API key, React build step or external web service is needed. `bundle.active=false` deliberately prevents unreviewed installers from being distributed at this stage.

You can also preview just the web UI without Rust:

```sh
npm run preview
# open http://127.0.0.1:4176
```

The browser preview is *not* the native binary, and the Rust runtime command is unavailable in the browser.

## Architectural dependency boundary

```text
apps/desktop/ui/                Unprivileged WebView presentation
apps/desktop/src-tauri/         Native Rust host and audited IPC entrypoints
[future] desktop-engine-bridge  Separately packaged Node.js runtime + TEMPORA SDK 3.0.0
[future] intelligence-adapter   Optional TensorFlow inference with provenance
```

**Do not import** `tempora-framework` CommonJS directly inside the WebView. The existing package depends on Node.js file APIs; it must run in an isolated local worker/sidecar or a future compatible Rust bridge. The GUI must never duplicate scientific validation logic or invoke an arbitrary shell.

**Do not download models or external scientific data automatically.** All ML results require explicit model hash, version, training-data license, confidence/calibration and human acceptance.

For the comprehensive roadmap and acceptance criteria see [DESKTOP_ARCHITECTURE.md](../../docs/reference/DESKTOP_ARCHITECTURE.md).
