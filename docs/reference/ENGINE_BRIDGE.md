# TEMPORA Desktop — Engine worker bridge protocol (Phase 1A)

**Status:** Phase 1C experimental Windows x64 packaging under CI. The standard app remains 0.1.0 alpha; no signed production release or TensorFlow runtime.

The application on `main` already has a native Tauri 2 GUI with a Rust file chooser. TEMPORA's published scientific engine is **CommonJS / Node.js**, not browser-native. This phase establishes a testable scientific adapter **without importing Node.js into the WebView**.

## Engine dependency

`apps/desktop/package.json` pins **`tempora-framework: 3.0.0`**, independently of the native app version (`0.1.0`). The worker imports the **published npm package**, not a hidden copy of the framework under `src/framework`.

## Protocol v1.0.0

Temporary *newline-delimited JSON* for a local, unprivileged Node process:

```json
{"protocol_version":"1.0.0","request_id":"demo_1","operation":"corpus.validate","payload":{"corpus":{}}}
```

Response:

```json
{"protocol_version":"1.0.0","request_id":"demo_1","ok":true,"result":{"valid":false,"errors":[]}}
```

The example shows the **shape only**; the real SDK returns the authoritative diagnostic fields and errors.

Allowlisted operations: `health`, `corpus.validate`, `corpus.digest`.

- Input frame hard limit: **4 MiB**; output frame hard limit: **256 KiB**.
- IDs: 1–64 alphanumeric/underscore/hyphen characters.
- No filesystem paths, URL fetching, network listener, shell command execution, database access or writes.
- Errors are sanitized; no document text, paths, or exception stack returned.
- The response contains exactly one `request_id`, an `ok` flag, either a `result` or an `error`.

To run the bridge experiment locally:

```sh
cd apps/desktop
npm install
npm run test:bridge
node bridge/worker.cjs
```

Enter a single JSON request followed by a newline, or pipe from another process. This is a **local test**, not a GUI operation.

## Native integration required before Phase 1 completion

Do **not** make the WebView spawn Node processes. In the next reviewed PR:

1. **Windows x64 experimental bundling**: a Node runtime and the worker plus pinned SDK are staged into Tauri resources, configured by `tauri.windows.conf.json`. The Rust release process uses only these bundled paths; it never falls back to a system Node installation. **Signing, locked transitive dependencies and clean-VM verification remain production blockers.**
2. Current development implementation spawns a fixed Node executable/script via Rust, with strict response checking, 12-second timeouts, 3 MiB file limit and no user-supplied command/path. **This is not yet a packaged sidecar.**
3. Replace temporary NDJSON transport with a **length-prefixed binary framing** where necessary for exact size limits and binary transparency.
4. Validate file paths with Rust after the native picker and limit the workspace to explicit user-approved data.
5. Add host-side worker lifecycle, inactivity timeout, cancellation, result cap, error classes, OS permissions and crash recovery.
6. Compare IPC outputs and SHA-256 to direct SDK invocations on synthetic fixtures; include malicious JSON, symlinks, injection and nested data cases.
7. Build/test a real Windows installation **without requiring system Node.js**.

**Windows release experiment:** GitHub Actions stages Node.js 22.16.0 and `tempora-framework@3.0.0`, checks the worker health response, builds an unsigned NSIS installer and retains it as a short-lived CI artifact. It is not a published installer. Do not advertise it as production-ready without validating installation in a clean Windows VM with no system Node, verifying installer content, licensing, signatures, and a complete scientific validation run.

**Native development mode:** the GUI now offers `Valider un corpus TEMPORA`, opening a separate native JSON picker and running canonical validation + SDK digest via fixed Rust-to-Node commands. Files are never handed to the WebView. Production builds explicitly fail closed until a complete bundled runtime exists. The existing preview remains structural and separate.

## TensorFlow readiness

The ML provider is **not part of the engine worker protocol**; add a separate, optional inference adapter after corpus validation and editorial review work. Candidate duplicate rankings and entity linkage should produce suggestions, not mutate source records.

For each proposal, persist model ID/version/SHA-256, dataset revision, confidence, calibration, feature transformation version, evidence references and human decision. Never train on ALNOP's 263 incomplete notices as if they were exhaustive truth.

See also [Desktop architecture](DESKTOP_ARCHITECTURE.md).

## Phase 1D — Installer-level verification

CI must install the unsigned NSIS output in a unique test directory, inspect the installed runtime (rather than the build staging directory), remove Node.js from the child process `PATH`, compare both shipped runtime hashes, exercise real `health`, `corpus.validate` and `corpus.digest` requests, and uninstall it. The follow-up release gate remains a **clean Windows VM** without system Node, interactive Tauri GUI validation, signatures and dependency lockfile/provenance. A CI runner with Node removed from PATH is **not equivalent to a Node-free operating system**.
