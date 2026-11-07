# TEMPORA Desktop — Chromium fallback (Windows Sandbox)

This is an **independent experimental desktop host** using Electron's
**bundled Chromium** instead of Tauri's Windows Edge WebView2 WebView.
It does not need WebView2 Evergreen registration or the Microsoft
WebView2 Standalone installer.

It deliberately reuses the existing `apps/desktop/src/` frontend and
`tempora-framework@3.0.0` Node bridge. The same canonical engine
decides whether a selected document conforms to v3 and computes its
digest. Structure previews, declared reference navigation, contradiction
and review inventories, and human drafts are displayed locally.
No AI model is run, no canonical document is modified, and no direct
filesystem paths, commands, shell or worker arguments are accepted from
the renderer.

## Windows developer build

From `apps/desktop`, ensure Node.js and npm are installed; on Windows x64:

```powershell
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run stage:windows-engine
cd electron
npm install --no-audit --no-fund
npm run dist:win
```

The resulting **unsigned experimental** setup is under
`apps/desktop/electron/release/`.

A dedicated GitHub Actions Windows workflow builds this automatically
and uploads `TEMPORA-Desktop-Electron-Windows-EXPERIMENTAL-NOT-RELEASE`.
The Electron binary and `electron-builder` dependencies are exact-pinned
in `electron/package.json`; a lockfile is required before the project
claims frozen Electron dependency resolution. This build is a trial,
not a replacement for the audited Tauri installer or a release.

## Security model

The renderer is sandboxed, Node integration disabled, context isolation
enabled; a preload exposes exactly two named operations. A native file
dialog chooses files; only bounded JSON and GeoJSON are read. Validation
invokes the **bundled, pinned** Node worker with fixed protocol operations
and short timeouts. No network requests are used for historical data.
Electron's own Chromium may use normal OS networking unless explicitly
blocked; no remote content is loaded by this application.

## Acceptance gate

Test in a **new Windows Sandbox** with no WebView2:
1. Install and launch the Electron/Chromium setup, inspect visible GUI.
2. Select a JSON and a GeoJSON; verify read-only structural preview.
3. Validate the existing known-valid and known-invalid synthetic v3
   corpora; compare engine diagnostics and SHA-256 with the Tauri output.
4. Navigate events/sources/assertions; prepare but do not approve a
   local review draft.
5. Test app exit, reopening, offline use, uninstall and missing-engine
   behavior.

A passing installer build does not establish rendering success in the
Sandbox. This experimental runtime has a larger installer footprint and
must receive Chromium security updates.
