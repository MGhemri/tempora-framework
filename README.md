# TEMPORA Framework

[![TEMPORA Framework CI](https://github.com/MGhemri/tempora-framework/actions/workflows/validate-framework.yml/badge.svg)](https://github.com/MGhemri/tempora-framework/actions/workflows/validate-framework.yml)
[![Documentation](https://github.com/MGhemri/tempora-framework/actions/workflows/test-documentation-ui.yml/badge.svg)](https://github.com/MGhemri/tempora-framework/actions/workflows/test-documentation-ui.yml)
[![GitHub Pages](https://github.com/MGhemri/tempora-framework/actions/workflows/pages-framework.yml/badge.svg)](https://github.com/MGhemri/tempora-framework/actions/workflows/pages-framework.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Release stage](https://img.shields.io/badge/Release-3.0.0-blue)

**An open-source, profile-driven framework for reproducible historical corpora.**  
**Un framework open source piloté par profils pour des corpus historiques reproductibles.**

[**English**](#english) · [**Français**](#français) · [Documentation / Docs](https://mghemri.github.io/tempora-framework/) · [OpenAPI 3.1](https://mghemri.github.io/tempora-framework/openapi/v3.json)

---

## English

### What is TEMPORA?

TEMPORA helps researchers and developers **structure, validate, compare, review, and publish historical records** without embedding the assumptions of a particular region, period, or archive in the framework itself.

A versioned **profile** describes the corpus-specific languages, chronology, controlled vocabularies, and validation rules. TEMPORA provides the reusable processing engine; humans remain responsible for source interpretation and editorial decisions.

> **Scientific boundary:** Validation, similarity, and automated detection do **not** establish historical truth. Uncertainty, disagreement, evidence, and human review remain explicit.

### Capabilities

| Component | Purpose |
|---|---|
| **Profile system** | Versioned JSON manifests, controlled inheritance, local validation, and configurable rules |
| **Canonical model v3** | Events, sources, entities, claims, relations, temporal/spatial assertions, and provenance |
| **Ingestion** | JSON, CSV, and GeoJSON preview; mapping, quarantine, and explicit acceptance |
| **Research assistance** | Candidate duplicate/identity links, competing claims, temporal and spatial comparisons, and corpus coverage |
| **Editorial governance** | Recorded human decisions, review policies, and content-bound verification |
| **Reproducible publication** | Review-gated immutable snapshots, manifests, checksums, and rollback |
| **Read-only API v3** | Versioned access to activated publications, with an OpenAPI 3.1 contract |
| **Developer tools** | JavaScript SDK (CommonJS), TypeScript declarations, CLI, and synthetic fixtures |

### Quick start

**Requirements:** Node.js 20+, npm, and Git. The commands below work with synthetic historical profiles; **ALNOP is not needed**.

```bash
git clone https://github.com/MGhemri/tempora-framework.git
cd tempora-framework
npm ci
npm run test:e2e:synthetic
```

Preview an import with the included fictitious corpus profile (no files written by default):

```bash
npm run ingest:tempora -- import \
  --profile profiles/synthetic-history/profile.json \
  --taxonomies profiles/synthetic-history/taxonomies.json \
  --input profiles/synthetic-history/sample.csv \
  --mapping profiles/synthetic-history/mapping.json \
  --report markdown
```

Build and check the documentation; inspect the CLI/SDK packaging locally:

```bash
npm run check:site
npm run test:package
npm run test:standalone
```

The repository root remains **`private: true`** to prevent accidental publishing. Its separate, audited distribution manifest is configured for **public npm publishing**; public availability is **not claimed until an authenticated npm publish succeeds**. Follow the [npm publishing guide](docs/reference/NPM_PUBLISHING.md). Use the [SDK and CLI guide](https://mghemri.github.io/tempora-framework/guides/sdk-cli.html) for local packaging and usage.

### Desktop application (Tauri 2)

The new [TEMPORA Desktop alpha](apps/desktop/README.md) provides a native FR/EN research workspace with **read-only local JSON/GeoJSON preview**. Scientific engine integration and TensorFlow are planned but **not yet implemented**. See the [desktop architecture and AI roadmap](docs/reference/DESKTOP_ARCHITECTURE.md).

### Architecture and documentation

```text
src/framework/          Core validation, ingestion, analysis, review, publication, API
src/sdk/                JavaScript SDK and TypeScript declarations
src/cli/                Command-line interface
schemas/tempora/        Canonical v3 JSON Schemas
profiles/               Synthetic, independent examples
compatibility/alnop/    Optional pinned ALNOP compatibility fixtures and adapters
docs/reference/         Versioned technical documentation (Markdown)
docs/site-src/          Additional sources for the documentation site
docs/guides/            Generated HTML documentation
tests/                  Unit, integration, architecture, and browser tests
```

See the [npm publishing guide](docs/reference/NPM_PUBLISHING.md) and the [release qualification checklist](docs/reference/RELEASE_CHECKLIST.md) before any stable release.

Read the [reference documentation](docs/reference/README.md): [architecture](docs/reference/FRAMEWORK.md), [canonical data model](docs/reference/CANONICAL_MODEL.md), [ingestion](docs/reference/INGESTION.md), [analysis](docs/reference/ANALYSIS.md), and [release policy](docs/reference/RELEASE_POLICY.md).

The public [TEMPORA documentation site](https://mghemri.github.io/tempora-framework/) and its [OpenAPI 3.1 contract](https://mghemri.github.io/tempora-framework/openapi/v3.json) are generated from versioned sources. The HTTP adapter serves **published releases locally**; do not assume a hosted public TEMPORA API is available.

### ALNOP: optional compatibility profile

[ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset) is a separate historical research dataset and atlas concerning the Algerian War of Independence. Its 263 documented operations, archives, and legacy APIs **remain owned by the ALNOP project**, not by TEMPORA.

TEMPORA keeps a **small, pinned compatibility profile**, not a copy of the full historical dataset:

```bash
npm run test:compat:alnop:minimal
# Full verification requires an external clean checkout at compatibility/alnop/pin.json
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

For methodology and compatibility details, see the [ALNOP compatibility guide](compatibility/alnop/README.md). The generic framework works without ALNOP or a network download.

### Quality, security, and contributions

```bash
npm test
npm run test:standalone
npm run check:site
npx playwright install chromium
npm run test:browser
```

GitHub Actions runs the framework checks on Linux and Windows, plus documentation/browser checks. The full pinned ALNOP compatibility check is separate. A green CI run does not replace an independent historical source review.

Report vulnerabilities as described in [Security](SECURITY.md); contribute through [Contributing](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

**License:** [MIT](LICENSE) for TEMPORA source code. Each historical corpus retains its **own** data licensing and citation obligations. For the software citation, see [CITATION.cff](CITATION.cff); for changes, see [CHANGELOG.md](CHANGELOG.md).

---

## Français

### Qu'est-ce que TEMPORA ?

TEMPORA aide les chercheurs et les développeurs à **structurer, valider, comparer, examiner et publier des données historiques** sans imposer au moteur les particularités d'une époque, d'un territoire ou d'un fonds d'archives.

Chaque **profil versionné** précise les langues, la chronologie, les vocabulaires contrôlés et les règles documentaires du corpus. TEMPORA fournit les mécanismes communs ; les décisions scientifiques et éditoriales restent humaines.

> **Principe scientifique :** un contrôle réussi ou une similarité algorithmique ne démontre **pas** un fait historique. Les incertitudes, les sources, les contradictions et les arbitrages demeurent traçables.

### Fonctionnalités

| Composant | Fonction |
|---|---|
| **Système de profils** | Manifestes JSON versionnés, héritage maîtrisé, validation locale et règles configurables |
| **Modèle canonique v3** | Événements, sources, entités, assertions, relations, temps, espace et provenance |
| **Ingestion** | Import JSON, CSV, GeoJSON ; simulation, mapping, quarantaine et acceptation explicite |
| **Assistance scientifique** | Doublons candidats, rapprochements d'entités, assertions divergentes, comparaisons spatio-temporelles et couverture |
| **Gouvernance éditoriale** | Décisions humaines consignées, politiques de revue et approbations liées au contenu |
| **Publication reproductible** | Snapshots immuables après revue, manifestes, empreintes et retour vers une version antérieure |
| **API REST v3** | Consultation en lecture seule des versions activées et contrat OpenAPI 3.1 |
| **Outils développeur** | SDK JavaScript CommonJS, types TypeScript, CLI et exemples synthétiques |

### Démarrage rapide

**Prérequis :** Node.js 20+, npm et Git. Le parcours utilise des profils fictifs ; **ALNOP n'est pas nécessaire**.

```bash
git clone https://github.com/MGhemri/tempora-framework.git
cd tempora-framework
npm ci
npm run test:e2e:synthetic
```

Prévisualiser un import sans modifier de données :

```bash
npm run ingest:tempora -- import \
  --profile profiles/synthetic-history/profile.json \
  --taxonomies profiles/synthetic-history/taxonomies.json \
  --input profiles/synthetic-history/sample.csv \
  --mapping profiles/synthetic-history/mapping.json \
  --report markdown
```

Vérifier la documentation, le paquet et l'indépendance du moteur :

```bash
npm run check:site
npm run test:package
npm run test:standalone
```

Le dépôt racine reste marqué **`private: true`** pour empêcher toute publication accidentelle. Un manifeste de distribution séparé est préparé pour npm public ; **la disponibilité sur le registre ne sera annoncée qu'après une publication authentifiée réussie**. Voir le [guide npm](docs/reference/NPM_PUBLISHING.md). Consulter le [guide SDK/CLI](https://mghemri.github.io/tempora-framework/guides/sdk-cli.html).

### Application desktop native (Tauri 2)

La nouvelle [application TEMPORA Desktop alpha](apps/desktop/README.md) propose un espace de recherche FR/EN et un **aperçu local JSON/GeoJSON en lecture seule**. La connexion au moteur scientifique et TensorFlow sont **encore à développer**. Voir l'[architecture desktop et la feuille de route IA](docs/reference/DESKTOP_ARCHITECTURE.md).

### Organisation et documentation

Les composants génériques sont regroupés sous `src/framework/`, `src/sdk/`, `src/cli/` et `schemas/tempora/`. Les profils fictifs vivent sous `profiles/` ; la compatibilité ALNOP reste isolée sous `compatibility/alnop/`.

Le [guide de publication npm](docs/reference/NPM_PUBLISHING.md) détaille la première publication et l'automatisation sécurisée. La [checklist de qualification](docs/reference/RELEASE_CHECKLIST.md) décrit les conditions préalables à toute version stable.

Les documents techniques versionnés sont réunis dans [`docs/reference/`](docs/reference/README.md) : [architecture](docs/reference/FRAMEWORK.md), [modèle canonique](docs/reference/CANONICAL_MODEL.md), [ingestion](docs/reference/INGESTION.md), [analyses](docs/reference/ANALYSIS.md) et [politique de publication](docs/reference/RELEASE_POLICY.md).

Le [site de documentation TEMPORA](https://mghemri.github.io/tempora-framework/) et son [contrat OpenAPI 3.1](https://mghemri.github.io/tempora-framework/openapi/v3.json) sont générés depuis des sources versionnées. Le serveur REST v3 fonctionne **localement** sur des publications activées ; il ne faut pas le confondre avec un service API public hébergé.

### ALNOP : un profil de compatibilité facultatif

Le [projet ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset) conserve son corpus historique de 263 opérations, son atlas, ses archives et ses anciennes API. TEMPORA conserve uniquement les éléments minimaux permettant de vérifier la compatibilité et la conversion des données.

```bash
npm run test:compat:alnop:minimal
# La suite complète exige un clone externe propre à la révision de pin.json
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Voir le [guide de compatibilité](compatibility/alnop/README.md) et la [référence historique](docs/reference/ALNOP.md). Les tests et l'installation du framework ne nécessitent pas ce corpus.

### Qualité, contributions et licences

```bash
npm test
npm run test:standalone
npm run check:site
npx playwright install chromium
npm run test:browser
```

Les workflows GitHub Actions vérifient le framework sur Linux et Windows ; les tests du site sont indépendants. La compatibilité ALNOP épinglée dispose de sa propre suite. Les tests logiciels n'équivalent pas à une validation historiographique.

Pour contribuer : [CONTRIBUTING.md](CONTRIBUTING.md). Pour signaler une vulnérabilité : [SECURITY.md](SECURITY.md). Respecter le [code de conduite](CODE_OF_CONDUCT.md).

**Licence :** code TEMPORA sous [MIT](LICENSE). Les données des corpus conservent leurs droits et obligations de citation propres. Voir [CITATION.cff](CITATION.cff) et [CHANGELOG.md](CHANGELOG.md).

---

**TEMPORA is a framework for documenting evidence, not manufacturing historical certainty.**  
**TEMPORA structure les preuves documentaires sans fabriquer de certitudes historiques.**
