# TEMPORA Framework

**Open-source, profile-driven tools for reproducible historical research.**  
**Outils open source pilotés par profils pour une recherche historique reproductible.**

[Source code](https://github.com/MGhemri/tempora-framework) · [Documentation](https://mghemri.github.io/tempora-framework/) · [API contract](https://mghemri.github.io/tempora-framework/openapi/v3.json) · [Security](https://github.com/MGhemri/tempora-framework/blob/main/SECURITY.md)

## Install / Installation

Requires **Node.js 20 or later**.

```sh
npm install tempora-framework
npx tempora --version
npx tempora --help
```

The npm package includes a CommonJS SDK, TypeScript declarations, the CLI, and the generic versioned JSON Schemas. It does **not** include any historical corpus.

Le paquet npm comprend le SDK CommonJS, les types TypeScript, la CLI et les schémas JSON génériques versionnés. Il ne contient **aucun corpus historique**.

## Use / Utilisation

```js
const tempora = require('tempora-framework');

// The canonical validator operates on an explicitly provided corpus.
const result = tempora.canonical.validateCorpus(myCanonicalCorpus);
if (!result.valid) console.error(result.errors);
```

The variable `myCanonicalCorpus` must be supplied by your application; see the [canonical model](https://mghemri.github.io/tempora-framework/guides/canonical.html), [ingestion guide](https://mghemri.github.io/tempora-framework/guides/ingestion.html), and [SDK/CLI documentation](https://mghemri.github.io/tempora-framework/guides/sdk-cli.html).

La variable `myCanonicalCorpus` doit être fournie par l'application. Consultez le [modèle canonique](https://mghemri.github.io/tempora-framework/guides/canonical.html), l'[ingestion](https://mghemri.github.io/tempora-framework/guides/ingestion.html) et la [documentation SDK/CLI](https://mghemri.github.io/tempora-framework/guides/sdk-cli.html).

## Research integrity / Intégrité scientifique

Profiles define languages, periods, identifiers, vocabularies, and review requirements. The engine supports canonical validation, JSON/CSV/GeoJSON ingestion, documentary analysis, human review, immutable releases, and a local read-only v3 API.

Les profils définissent langues, périodes, identifiants, vocabulaires et règles de revue. Le moteur assure la validation canonique, les imports JSON/CSV/GeoJSON, l'analyse documentaire, la revue humaine, les snapshots immuables et l'API v3 locale en lecture seule.

**Technical validation is not historical verification.** Researchers must inspect documentary sources, rights, uncertainty, and contradictions.

**La validation technique ne prouve pas la vérité historique.** Les sources, droits, incertitudes et contradictions doivent être examinés par les chercheurs.

## ALNOP is separate / ALNOP est indépendant

[ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset) is a separate historical dataset and application. The TEMPORA npm distribution includes no ALNOP operations, archives, adapters, or legacy APIs.

Le projet historique [ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset) reste indépendant. Le package npm TEMPORA ne contient aucune opération historique, archive, ni ancienne API ALNOP.

## License and security / Licence et sécurité

Software license: **MIT**. Each corpus retains its own data and citation conditions. Report security issues privately as described in the [security policy](https://github.com/MGhemri/tempora-framework/blob/main/SECURITY.md).

Logiciel sous licence **MIT** ; droits et citations des corpus indépendants. Les vulnérabilités sont signalées selon la [politique de sécurité](https://github.com/MGhemri/tempora-framework/blob/main/SECURITY.md).
