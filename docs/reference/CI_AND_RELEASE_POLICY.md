# TEMPORA — CI and release policy

## Pull-request checks

- TEMPORA Framework: Node 20/22 on Linux and Node 20 on Windows; these checks are required by the `main` ruleset.
- TEMPORA Documentation UI: Chromium/Playwright browser test; `browser` is required by the `main` ruleset.
- TEMPORA Desktop Foundation: TypeScript/Vite, isolated Node bridge/scientific tests, Rust native checks, and one Windows NSIS integration build, when Desktop files change.
- Optional ALNOP compatibility: targeted changes only; full historical reference validation is manual or release-branch scoped.

The required branch-protection statuses must remain available on pull requests. Never remove/rename a required job before safely updating the ruleset. Pull-request pipelines cancel superseded runs; branch pushes no longer duplicate the same checks except on `main`.

## Manual artifact/release operations

- Microsoft Store AppX candidate: `workflow_dispatch` only. It builds an unsigned candidate and does **not** submit it to Partner Center.
- Windows signed candidate: `workflow_dispatch` only, with its signing environment and explicit fail-closed prerequisites.
- npm staging: `workflow_dispatch` only and requires explicit confirmation and subsequent human publication approval.
- GitHub Pages: automatic on `main` after documentation changes (current workflow), or manual dispatch.

## Retired automated builds

Beta 1 and Beta 2 release pipelines and the WebView2-free Electron fallback experimental workflow were removed because all duplicated Windows packaging and two contained legacy automatic prerelease publication logic. Build correctness remains covered by Desktop Foundation; distribution candidates remain manual. Historical release artifacts/tags and audit trails are **not** removed.

## GitHub maintenance

Pull requests are immutable review records: close superseded PRs with links to the successor instead of attempting to erase history. Delete only truly unreferenced, unprotected branches after auditing open PRs, release tags and unique commits. Cleaning branches does not delete the PR record.

## Store protection

The Partner Center submission currently in certification and its official package identity are intentionally untouched. No CI workflow performs an automatic Store submission or publication.
