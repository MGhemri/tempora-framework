# TEMPORA — Publication npm / npm publishing

> **Software / Logiciel : `tempora-framework` · Version initiale : `3.0.0`**
>
> This document is a **procedure**, not proof that the package is already published.
> Ce guide n'atteste **pas** que le package a déjà été publié.

## Architecture / Séparation des manifestes

- Root `package.json`: **`private: true`**, used only for repository development and tests.
- `distribution/package.json`: **`private: false`**, MIT, public npm registry, explicit entrypoints/dependencies.
- `distribution/README.md`: the public consumer README, copied into the generated tarball.
- `scripts/pack-tempora.js`: whitelist-based packer. **Always publish the resulting tarball, never the repository root.**
- `npm run check:release`, `npm run test:package` and `npm run test:standalone`: release checks.

**Ne publie jamais depuis la racine : elle reste privée.** Utilise uniquement l'archive générée par `pack:tempora`.

## 1. Confirm the package name / Vérifier le nom du package

After logging in to npm, run:

```sh
npm view tempora-framework version
```

- A registry **404** can mean no public package under that name, but is **not** a guarantee of reservation or final availability.
- If a package exists and you do not own it, **do not publish**. Change the package name in a reviewed PR, or use a verified npm scope.
- Name availability was **not independently confirmed** when this workflow was prepared.

Vérifier que le nom npm est libre ou que ton compte en est propriétaire. Ne jamais tenter d'écraser le package d'un autre utilisateur.

## 2. Release validation / Recette avant publication

On the fully reviewed and merged **`main`** commit:

```sh
npm ci
npm run check:release
npm run check:npm:distribution
npm test
npm run test:standalone
npm run test:compat:alnop:minimal
```

The CI checks Node 20, Node 22, Windows, documentation, and the pinned full ALNOP compatibility suite on release pull requests. Confirm all required statuses are green before publishing.

Vérifier les droits des dépendances, le contenu réel de l'archive, les secrets, la présence des schémas et l'absence de corpus ALNOP. Le contrôle logiciel n'est pas une certification historique.

## 3. Initial bootstrap / Première publication manuelle

The first publication requires the owner to authenticate interactively with npm and enable account **2FA**. In PowerShell (Windows) or a compatible shell:

```sh
git switch main
git pull --ff-only
npm ci
npm run check:npm:distribution
npm login
npm whoami
mkdir work/npm-release
npm run pack:tempora -- --out work/npm-release --write
```

Review the resulting tarball **before** any publication:

```sh
npm pack ./work/npm-release/tempora-framework-3.0.0.tgz --dry-run
```

If your npm CLI does not support pack dry-run on a tarball, use `tar -tzf work/npm-release/tempora-framework-3.0.0.tgz` or npm's `npm pack --dry-run --json` inside an extracted temporary folder. The CI also inspects the whitelist automatically.

**Recommended / Recommandé : staged publishing** — Node.js 22.14+ and npm CLI 11.15+ with 2FA:

```sh
npm stage publish ./work/npm-release/tempora-framework-3.0.0.tgz --access public
```

Then open [npmjs.com](https://www.npmjs.com/) → **Staged Packages**, examine the staged package and select **Approve** with your 2FA challenge. Staging a package that does not exist may create a public placeholder `0.0.0-stage`. The actual version becomes public only on approval.

If staged publishing is not available, npm's supported **direct publish** alternative is:

```sh
npm publish ./work/npm-release/tempora-framework-3.0.0.tgz --access public
```

**Never run both.** Once a name/version is published on npm, it cannot be republished or overwritten. npm requires interactive 2FA for initial ownership/publishing; do not post passwords, tokens, or one-time codes to ChatGPT.

**Ne lance jamais les deux commandes.** Après la publication, vérifier `npm view tempora-framework@3.0.0 version` et installer le package depuis un dossier neuf.

## 4. Enable npm Trusted Publishing / Configurer OIDC

**After the first package exists and is owned by your npm account**, open its page in npmjs.com → **Settings → Trusted publishing → Add trusted publisher**.

Choose **GitHub Actions** and enter these values exactly:

| Field / Champ | Value / Valeur |
|---|---|
| Organization or user | `MGhemri` |
| Repository | `tempora-framework` |
| Workflow filename | `npm-stage-publish.yml` |
| Environment name | *(leave empty / laisser vide)* |
| Allowed actions | **Allow `npm stage publish`**; do not enable direct `npm publish` |
| Dist-tag management | Not required / Non nécessaire |

**Important:** Activate the trust relationship shortly before the first CI stage publish; newly created npm configurations must successfully publish within **2 days**.

When Trusted Publishing has been verified, consider npm package **Publishing access → Require two-factor authentication and disallow tokens**. This prevents classic token-based publishing while allowing trusted OIDC publishing.

## 5. Future versions / Versions suivantes

Every subsequent npm version must be new (for example, `3.0.1`) and must be committed, reviewed, and merged in all required manifests and docs. Tag the **approved merged commit** with `v3.0.1` and push the tag. Do not move existing tags.

Open **GitHub → Actions → Stage TEMPORA on npm → Run workflow**. Enter:

- `tag`: `v3.0.1`
- `confirmation`: `STAGE-NPM`

The workflow validates the tag, commit ancestry, package version, tests, package whitelist and tarball SHA-256, then calls **`npm stage publish` with OIDC**. It does **not** auto-approve, publish immediately, create a GitHub release, or manage npm dist-tags.

Finally, review the staged package on npmjs.com and approve it with 2FA. Verify the public install and provenance.

**Une release GitHub et la publication npm sont deux décisions distinctes.** Le workflow n'effectue aucune publication automatique lors d'un simple push sur `main`.

## 6. Troubleshooting / Dépannage

- `ENEEDAUTH` / `E404`: verify package ownership, publisher fields, exact workflow filename, and npm/Node versions. OIDC is not used for `npm whoami`.
- `EPUBLISHCONFLICT`: version already published; create a **new version**, never reuse it.
- `E_STAGE_REQUIRED`: use `npm stage publish` and approve manually.
- Missing provenance: only public packages published by trusted GitHub/GitLab workflows support automatic provenance.
- No package found: check name with `npm view`; an unclaimed name is not guaranteed until claimed on npm.

Documentation officielle : [Trusted publishing](https://docs.npmjs.com/trusted-publishers/), [Staged publishing](https://docs.npmjs.com/staged-publishing/), [Publishing public packages](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).
