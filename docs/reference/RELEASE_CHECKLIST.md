# TEMPORA — Release qualification / Qualification de release

**Current target / Version candidate : `3.0.0-rc.1`** — private local tarball, not a stable npm or GitHub release.

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

The obsolete Git tag **`v3.0.0`** was still present when this checklist was drafted and pointed to `55032f630b1b0107f38aa48e4c2b5b7fe3ef37e0`. Removing the corresponding GitHub release **did not remove the tag**.

L'ancien tag **`v3.0.0`** existe encore et pointe vers une révision historique. Le mainteneur doit résoudre cette collision avant une nouvelle release stable. **Ne jamais déplacer silencieusement un tag déjà publié.**

## Stable release gate / Passage en version stable

A stable release requires all checks green on the **merged** and frozen commit, explicit maintainer approval, documented licenses and changes, reproducible source and package checksums, and resolution of the obsolete tag. Npm publication is a separate decision; keep `private:true` until explicitly approved.

Une version stable exige les tests réussis sur le commit fusionné, une validation du mainteneur, le contrôle des licences et des empreintes, et le traitement explicite de l'ancien tag. **Aucune publication npm automatique**.

## Branch protection / Protection de main

In GitHub **Settings → Rules → Rulesets**, require pull requests, passing framework CI and documentation/browser CI, disallow force pushes and branch deletion, and control bypass permissions. GitHub administrative protection settings are not available through this connector.

Dans **Settings → Rules → Rulesets**, imposer les revues de PR et les contrôles CI essentiels, interdire les force-push et la suppression de `main`, et limiter les exceptions.
