# TEMPORA — Release qualification / Qualification de release

**Proposed version / Version proposée : `3.0.0`** — versioning metadata prepared, but the stable GitHub release, immutable tag and any npm publication are **not yet performed**.

## Requirements / Prérequis

- Freeze an exact reviewed commit SHA. Never release an unverified moving branch.
- Validate Node.js 20 and 22 on Linux, and Node.js 20 on Windows.
- Install the tarball in a truly independent consumer project; test CLI, SDK, TypeScript types, publication and API v3.
- Run dependency vulnerability auditing. Review licenses, provenance, privacy, and security before any stable designation.
- Keep ALNOP optional; never change its historical reference silently.

- Figer un commit Git exact et approuvé.
- Valider Node.js 20 et 22 sous Linux et Node.js 20 sous Windows.
- Installer le tarball dans un projet indépendant et vérifier CLI, SDK, types TypeScript, publication et API v3.
- Auditer les dépendances, les licences, la provenance, les données privées et la sécurité.
- Préserver ALNOP comme profil facultatif, sans jamais modifier implicitement sa référence.

## Mandatory commands / Commandes obligatoires

```sh
npm ci
npm run check:release
npm test
npm run test:standalone
npm run test:e2e:synthetic
npm run check:site
npm run test:compat:alnop:minimal
npx playwright install chromium
npm run test:browser
```

Full ALNOP compatibility requires a separate clean checkout at the commit in `compatibility/alnop/pin.json`:

```sh
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Review the exact tarball contents, SHA-256, dependency audit, reproducible snapshots, and OpenAPI 3.1 contract. Never publish private review journals, historical archives or ALNOP datasets.

## Tag warning / Avertissement de tag

The obsolete historical tags **`v1.0.0`** and **`v3.0.0`** were verified as absent before preparing the current stable version. Before publishing, check once more that `v3.0.0` is absent; then create a new immutable tag on the explicitly approved merged commit. Never silently move a published tag.

Les anciens tags historiques **`v1.0.0`** et **`v3.0.0`** ont été vérifiés absents avant cette préparation. Contrôler de nouveau leur absence avant toute publication ; créer ensuite le nouveau tag immuable uniquement sur le commit fusionné et approuvé.

## Stable release gate / Passage en version stable

A stable release requires all checks green on the **merged** and frozen commit, explicit maintainer approval, documented licenses and changes, reproducible source and package checksums, and resolution of the obsolete tag. Npm publication is a separate decision; keep `private:true` until explicitly approved.

Une version stable exige les tests réussis sur le commit fusionné, une validation du mainteneur, le contrôle des licences et des empreintes, et le traitement explicite de l'ancien tag. **Aucune publication npm automatique**.

## Branch protection / Protection de main

In GitHub **Settings → Rules → Rulesets**, require pull requests, passing framework CI and documentation/browser CI, disallow force pushes and branch deletion, and control bypass permissions. GitHub administrative protection settings are not available through this connector.

Dans **Settings → Rules → Rulesets**, imposer les revues de PR et les contrôles CI essentiels, interdire les force-push et la suppression de `main`, et limiter les exceptions.
