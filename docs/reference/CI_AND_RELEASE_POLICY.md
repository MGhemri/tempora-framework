> **Current desktop status, 10 November 2026:** The maintainer reports TEMPORA Desktop **0.2.0 published** in Microsoft Store, while exact Partner Center package provenance remains independently unverified here. TEMPORA Desktop **1.0.0** is a new unsigned **release candidate**, NOT a certified or published stable release. Only Electron/Chromium is supported; **manual** clean-Windows upgrade qualification, Authenticode (NSIS channel), vulnerability/license review, and Partner Center approval remain mandatory before release. See [Audit release gate](../../Audit/RELEASE-DESKTOP-STABLE-1.0.0.md). Earlier paragraphs describing a held 0.1.1 submission are historical.

# TEMPORA — CI and release policy

## Pull-request checks

- TEMPORA Framework: Node 20/22 on Linux and Node 20 on Windows; these checks are required by the `main` ruleset.
- TEMPORA Documentation UI: Chromium/Playwright browser test; `browser` is required by the `main` ruleset.
- TEMPORA Desktop Foundation: TypeScript/Vite, isolated Node bridge/scientific tests, and **one Chromium/Electron Windows NSIS integration build**, when Desktop files change.
- Optional ALNOP compatibility: targeted changes only; full historical reference validation is manual or release-branch scoped.

The required branch-protection statuses must remain available on pull requests. Never remove/rename a required job before safely updating the ruleset. Pull-request pipelines cancel superseded runs; branch pushes no longer duplicate the same checks except on `main`.

## Official Windows desktop runtime

**Chromium/Electron is the only supported Windows distribution host.** `src-tauri/` and WebView2 scripts are retained for source history only; the foundation workflow no longer runs Tauri/Rust installer jobs. Never present or upload WebView2 packages as current releases. Test a genuinely clean Windows 10/11 VM with no WebView2/Node before release.

The existing Partner Center product has Store ID `9P4MN0S3823T`, package identity `GhemriM.TEMPORADesktop`, publisher `CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455`, and PFN `GhemriM.TEMPORADesktop_y8h1gbsk7napw`. The maintainer reports **certified, held for manual publication**. Do not click `Publish now` unless the actual certified package has been inspected and confirmed Chromium, tested on a clean VM and approved. If it is WebView2, obtain a new Chromium package-specific certification under the same Store product before publishing. CI never submits.

## Manual artifact/release operations

- Microsoft Store AppX candidate: `workflow_dispatch` only. It builds an unsigned candidate and does **not** submit it to Partner Center.
- Windows signed candidate: `workflow_dispatch` only, with its signing environment and explicit fail-closed prerequisites.
- npm staging: `workflow_dispatch` only and requires explicit confirmation and subsequent human publication approval.
- GitHub Pages: automatic on `main` after documentation changes (current workflow), or manual dispatch.

## Retired automated builds

Beta 1 and Beta 2 release pipelines and the WebView2-free Electron fallback experimental workflow were removed because all duplicated Windows packaging and two contained legacy automatic prerelease publication logic. Build correctness remains covered by Desktop Foundation; distribution candidates remain manual. Historical release artifacts/tags and audit trails are **not** removed.

## GitHub maintenance

Pull requests are immutable review records: close superseded PRs with links to the successor instead of attempting to erase history.

TEMPORA Framework includes a tiny `branch-hygiene` job: it performs a dry-run on ordinary PRs, and after a same-repository PR is successfully **merged**, it verifies that the source ref is unchanged, unprotected, not under `release/`, and not referenced by another open PR before deleting the branch. It never deletes a branch on PR closure without merge or a fork source, and retains the PR audit record. This is a job in the existing Framework workflow, **not** an additional workflow. The one-time `[branch-hygiene-setup]` merge marker also removes two fully integrated maintenance branches after rechecking their `ahead_by === 0`. Delete only truly unreferenced, unprotected branches after auditing open PRs, release tags and unique commits. Cleaning branches does not delete the PR record.

## Store protection

The Partner Center submission reportedly certified and held at Ready to publish and its official package identity are intentionally untouched. No CI workflow performs an automatic Store submission or publication.
