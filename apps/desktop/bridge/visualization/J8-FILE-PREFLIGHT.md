# TVRW J8E — Streaming raw-file preflight (research prototype)

This is a **private Node-side security preflight**, not a Desktop feature.
The J8E helper reads only an **absolute path already selected and authorized by
a native file picker**, one bounded chunk at a time, computes the SHA-256 of the
original file bytes, and returns **only** format, byte count, hash and an explicit
`canonical_validated:false` status. No document bytes or paths are returned.

## Limits and safeguards

- Accepted extensions: `.json`, `.geojson`; regular files only; reject symbolic
  links; compare file identity and timestamps before/after reading, failing
  closed on observed mutation.
- Hard cap **64 MiB**; default chunk 64 KiB; caller can only *reduce* the file
  limit. All allocation sizes are separately bounded to 1 MiB per read.
- Cooperative `AbortSignal` cancellation checked throughout the read.
- The file descriptor is closed in `finally` even when reading is aborted.
- Fail-closed named codes distinguish invalid options, input limit,
  cancellation, unsupported file types and detected changes.
- No network request, file write, result persistence, source inference or
  execution of corpus-supplied code.

## Non-goals and integration gate

- This helper **does not parse JSON incrementally**, validate a canonical v3
  document, compute a canonical digest, build an index, persist a project, or
  increase the existing Desktop **3 MiB** validation cap. A raw byte hash
  differs from TEMPORA's canonical digest (serialization/normalization).
- It is **not exported through renderer IPC**, worker protocol or public SDK.
  **Never forward renderer-supplied arbitrary paths** to it.
- The future native controller must obtain the absolute path using its own
  allowlisted picker and retain an opaque session handle; preflight must
  participate in a structured cancellation and crash-cleanup lifecycle.
- Further work needs an incremental **canonical v3** validator with precise
  error locations, a transactional disposable index, page and memory budgets,
  tests of file changes during parsing and of worker termination, and Windows
  Sandbox measurements. No actual 100k-file support is claimed.
- `lstat` + `open` + descriptor `stat` offers symlink and replacement checks,
  not a complete guarantee against every adversarial local filesystem race;
  Windows ACLs, reparse points and network shares need an explicit native
  threat-model review before this becomes an accepted runtime boundary.

Run `npm run test:visualization` inside `apps/desktop`. All new fixtures in
J8E are fictional, temporary files; the ALNOP examples and source documents
are neither read by the test nor modified.

This is a preparatory research milestone only. Existing SDK/IPC protocols,
canonical v3, quotas, workflows, Store packaging and release policy are
unchanged.

## J8E Windows correction (bêta 3 release gate)

Le test de release Windows a révélé que les métadonnées renvoyées par `lstat(path)` et `fstat(handle)` peuvent différer pour un même fichier sous Windows, produisant un faux `PREFLIGHT_FILE_CHANGED` à l'ouverture. La politique corrigée compare **chemin à chemin** (avant, à l'ouverture, après lecture), **descripteur à descripteur** (avant/après) et la taille entre chemin et descripteur ; sous POSIX, l'égalité chemin/descripteur complète reste requise. Elle rejette toujours les changements détectables, les liens symboliques en entrée et les lectures incomplètes. Un test mutateur synthétique couvre le changement pendant la lecture. Cette correction ne remplace pas la revue future des reparse points, partages réseau et attaques TOCTOU Windows.
