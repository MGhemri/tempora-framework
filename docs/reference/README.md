# Documentation de référence · TEMPORA / Reference documentation

This directory contains the **versioned technical specification** of TEMPORA. The [website](https://mghemri.github.io/tempora-framework/) presents accessible guides generated from these sources.

Ce dossier regroupe les **documents techniques versionnés** de TEMPORA. Le [site officiel](https://mghemri.github.io/tempora-framework/) propose les guides de consultation générés à partir de ces sources.

| Document / Guide | Scope / Périmètre |
|---|---|
| [Architecture / Framework](FRAMEWORK.md) | Profiles, boundaries, CLI, SDK, API / profils, frontières, CLI, SDK et API |
| [Native desktop architecture / Architecture desktop native](DESKTOP_ARCHITECTURE.md) | Tauri workspace, engine bridge and TensorFlow readiness / GUI, moteur et préparation IA |
| [Canonical model / Modèle canonique](CANONICAL_MODEL.md) | V3 schemas and provenance / schémas v3 et provenance |
| [Ingestion](INGESTION.md) | Import preview, quarantine, acceptance / prévisualisation, quarantaine, acceptation |
| [Analysis / Analyses](ANALYSIS.md) | Candidate identification, reproducibility / rapprochements, reproductibilité |
| [Publication policy / Politique de publication](RELEASE_POLICY.md) | Software and corpus versions / versions logicielles et des corpus |
| [Release qualification / Qualification de release](RELEASE_CHECKLIST.md) | Candidate and stable release gates / conditions de qualification |
| [npm publishing / Publication npm](NPM_PUBLISHING.md) | First release, staging, Trusted Publishing OIDC / première publication, staging et OIDC |
| [ALNOP compatibility / Compatibilité ALNOP](ALNOP.md) | Optional pinned historical test profile / profil historique de test facultatif |
| [TEMPORA Studio / Desktop architecture](DESKTOP_ARCHITECTURE.md) | Native Tauri application and future ML boundary / application native et IA future |

**Maintainer-facing documents remain in the repository root:** [README](../../README.md), [Contributing](../../CONTRIBUTING.md), [Security](../../SECURITY.md), [Changelog](../../CHANGELOG.md), [Code of Conduct](../../CODE_OF_CONDUCT.md), [License](../../LICENSE), and [Citation](../../CITATION.cff).

**Source of truth:** Edit the Markdown here and `docs/site-src/` rather than editing generated `docs/guides/*.html` directly. Run `npm run build:site && npm run check:site`.
