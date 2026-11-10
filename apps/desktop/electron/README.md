> **Release preparation (November 10, 2026):** TEMPORA Desktop **1.0.0** is being prepared as a *stable source candidate*, NOT as an already signed/certified/published release. Versioned Chromium/Electron, pinned TEMPORA Framework 3.0.0, read-only workbench and human-gated staging are supported; packaged M1.5 scientific writes and TensorFlow remain disabled. See [stable qualification and GO/NO-GO](../../../Audit/RELEASE-DESKTOP-STABLE-1.0.0.md) and [draft release notes](RELEASE-NOTES-1.0.0.md). Previous Beta/Partner Center notes below are historical and do not override this status.

# TEMPORA Desktop — Official Chromium/Electron runtime

**Windows x64 distribution target: bundled Chromium/Electron only.** No WebView2 runtime or Evergreen installation is required to launch TEMPORA Desktop. A bare Windows VM must be validated before publication.

The original Tauri/WebView2 code is retained under `apps/desktop/src-tauri/` for historical audit and potential migration only: **it is not a supported Windows product, release target, Store candidate, fallback, or installer**. No installer or signing instructions for Tauri are part of the official distribution pipeline.

**Microsoft Store:** the existing certified, manually held Partner Center submission (Store ID `9P4MN0S3823T`) must **not** be published until its actual uploaded package is verified as Chromium. A previous certification is not proof of Chromium support; if the certified package is WebView2, prepare a replacement Chromium AppX/MSIX submission under the same identity and obtain fresh certification before publishing. Never auto-submit or press Publish now.

**Official identity:** Name `GhemriM.TEMPORADesktop`; Publisher `CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455`; Publisher display `Ghemri M`; PFN `GhemriM.TEMPORADesktop_y8h1gbsk7napw`.

## Windows release gates

- Electron Chromium NSIS self-contained installer with the pinned Node 3.0.0 scientific worker.
- Electron AppX/MSIX Store candidate separately verified with the exact Partner Center manifest identity.
- Fresh Windows 10/11 virtual machine with **no WebView2 and no Node.js**: install, launch UI, inspect source files, run synthetic canonical validation, test offline use, uninstall and reinstall.
- Explicit security/update review for the bundled Chromium runtime, dependency hashes and code signing per distribution channel.
- Store publication is **manual after package-specific certification and independent acceptance**; a verified GitHub NSIS build alone does not authorize Store publication.

## Build and tests

From `apps/desktop/`, run `npm install --ignore-scripts`, `npm run build`, `npm run stage:windows-engine`, then `cd electron && npm ci && npm run dist:win`. The Microsoft Store AppX candidate is built by the separate manual workflow. No Tauri desktop package is built by the official CI.

The Renderer remains sandboxed, context isolated, with no Node integration. Electron's bundled Chromium runs only local application content. Source selection and the TEMPORA engine run from restricted host IPC; the scientific decision remains human.

---

## Historical details

> 
> This is an **independent experimental desktop host** using Electron's
> **bundled Chromium** instead of Tauri's Windows Edge WebView2 WebView.
> It does not need WebView2 Evergreen registration or the Microsoft
> WebView2 Standalone installer.
> 
> It deliberately reuses the existing `apps/desktop/src/` frontend and
> `tempora-framework@3.0.0` Node bridge. The same canonical engine
> decides whether a selected document conforms to v3 and computes its
> digest. Structure previews, declared reference navigation, contradiction
> and review inventories, and human drafts are displayed locally.
> No AI model is run, no canonical document is modified, and no direct
> filesystem paths, commands, shell or worker arguments are accepted from
> the renderer.
> 
> ## Windows developer build
> 
> From `apps/desktop`, ensure Node.js and npm are installed; on Windows x64:
> 
> ```powershell
> npm install --ignore-scripts --no-audit --no-fund
> npm run build
> npm run stage:windows-engine
> cd electron
> npm ci --no-audit --no-fund
> npm run dist:win
> ```
> 
> The resulting **unsigned experimental** setup is under
> `apps/desktop/electron/release/`.
> 
> A dedicated GitHub Actions Windows workflow builds this automatically
> and uploads `TEMPORA-Desktop-Electron-Windows-EXPERIMENTAL-NOT-RELEASE`.
> The Electron binary and `electron-builder` versions are exact-pinned in
> `electron/package.json` and a Windows-CI-generated npm v3
> `electron/package-lock.json` is committed. The Electron packaging toolchain
> is installed with `npm ci` and its lockfile digest is recorded in the
> experimental installer provenance. This build is a trial,
> not a replacement for the audited Tauri installer or a release.
> 
> ## Security model
> 
> The renderer is sandboxed, Node integration disabled, context isolation
> enabled; a preload exposes exactly two named operations. A native file
> dialog chooses files; only bounded JSON and GeoJSON are read. Validation
> invokes the **bundled, pinned** Node worker with fixed protocol operations
> and short timeouts. No network requests are used for historical data.
> Electron's own Chromium may use normal OS networking unless explicitly
> blocked; no remote content is loaded by this application.
> 
> ## Acceptance gate
> 
> Test in a **new Windows Sandbox** with no WebView2:
> 1. Install and launch the Electron/Chromium setup, inspect visible GUI.
> 2. Select a JSON and a GeoJSON; verify read-only structural preview.
> 3. Validate the existing known-valid and known-invalid synthetic v3
>    corpora; compare engine diagnostics and SHA-256 with the Tauri output.
> 4. Navigate events/sources/assertions; prepare but do not approve a
>    local review draft.
> 5. Test app exit, reopening, offline use, uninstall and missing-engine
>    behavior.
> 
> A passing installer build does not establish rendering success in the
> Sandbox. This experimental runtime has a larger installer footprint and
> must receive Chromium security updates.
> 
> ## Confirmed Windows Sandbox acceptance (Nov 7, 2026)
> 
> The maintainer independently confirmed that the Electron/Chromium variant
> installed and launched on a fresh Windows Sandbox where Tauri/Evergreen
> had repeatedly failed. The exact two synthetic reference tests produced:
> 
> - Canonical v3 valid: `valid=true`, **0 diagnostics**,
>   SHA-256 `869baa4aa744e886d38177e19962a619b95a4e72e435863e5ee21e91d16cd4d5`.
> - Canonical v3 deliberately invalid: `valid=false`, **1 diagnostic**
>   `CANONICAL_SCHEMA_INVALID` at `/events/0/schema_version`,
>   SHA-256 `21c088887e58e3a2d1c23b95d18afd524e937ff7fa6697708906001973ad82eb`.
> - Scientific engine version: `3.0.0`; structural preview: one event,
>   one source, one assertion. This is schema conformity, **not** an
>   assertion of historical fact.
> 
> A separate Windows CI test executes the **packaged** `node.exe` and
> worker from `electron/release/win-unpacked/resources/engine/` with
> fresh synthetic valid/invalid corpora and verifies divergent digests.
> Those synthetic inputs are not the user's two independent reference
> files; do not compare their digests directly.
> 
> Remaining beta gates: interactive navigation and clipboard review-draft
> test, clean-machine uninstall/reinstall, icon/branding binary delivery,
> signed Windows packages, security updates for bundled Chromium, and
> reproducible builds. **No public release is authorized yet.**
> 
> 
> ## TEMPORA Desktop identity and Windows signing readiness
> 
> **Visible application name:** `TEMPORA Desktop` throughout NSIS, shortcuts,
> the native window and executable. The Electron/Chromium implementation
> remains an internal technical detail and does not form part of the user-facing
> product name.
> 
> **Branding:** the Windows package uses the user's **white-background**
> hourglass artwork (`build/icon-white-256.png`); the in-app About view uses
> the **transparent** `public/branding/tempora-logo-transparent.png` asset.
> Both are checked-in graphics derived from the supplied originals, without
> replacing the originals. They are intentionally distinct assets.
> 
> **About / À propos:** contains the author/project attribution **Ghemri M**
> (and only there), the project website `https://connect-gm.com`, TEMPORA
> Framework 3.0.0, desktop version, MIT licence and GitHub source URL.
> External site links open only on explicit user click in the system browser,
> via two precisely allowlisted URLs. No SSH, hosting or cPanel credentials
> are used by TEMPORA Desktop or its distribution workflows.
> 
> ### Real Windows Authenticode signing (NOT accomplished yet)
> 
> The new **manual** workflow `desktop-electron-signed-candidate.yml` produces
> no artifact unless a valid Windows **code-signing certificate** is available.
> The **GitHub Environment** `windows-code-signing` must be configured,
> preferably with required approvals, and must have secrets:
> 
> - `WIN_CSC_LINK`: certificate reference supported by electron-builder
>   (for example a compliant code-signing identity; exportable PFX only
>   when permitted by the issuing CA).
> - `WIN_CSC_KEY_PASSWORD`: certificate passphrase (when applicable).
> 
> The pipeline enforces `forceCodeSigning=true`, verifies Authenticode
> `Valid` on both `TEMPORA Desktop.exe` and the NSIS installer, executes
> the packaged scientific worker, writes SHA-256 provenance and only then
> uploads a **signed candidate**. It does **not** create a public release.
> The final publisher identity must match the validated legal identity on
> the certificate, not an invented display name.
> 
> **Important:** a website and its HTTPS/TLS certificate are **not Windows
> code-signing credentials**. Hosting/cPanel/SSH credentials must never be
> pasted into project code, Actions secrets intended for signing, or build
> logs; rotate any accidentally exposed hosting password and prefer SSH keys.
> For HSM or Azure cloud code-signing, configure the corresponding provider
> integration separately and maintain the same Authenticode validation gate.
> 
> Do not label a release as signed until a genuine certificate has been
> configured and both installer and executable have passed verification.
> 
> 
> ## Microsoft Store — voie AppX / MSIX (sans certificat personnel)
> 
> La voie Microsoft Store est **distincte** du téléchargement EXE NSIS.
> Le Microsoft Store **resigne les paquets AppX/MSIX après certification** :
> il n'est pas nécessaire d'acheter un certificat Authenticode personnel
> pour ce canal. Cette signature ne s'étend **pas** à l'EXE NSIS hébergé
> sur GitHub ; une diffusion hors Store d'AppX/MSIX exige une signature
> de confiance séparée.
> 
> Avec la version actuellement verrouillée d'`electron-builder@26.18.0`,
> le packaging compatible Store documenté et stable est **`appx`**
> (format membre de la famille MSIX). Le target MSIX natif plus moderne
> est encore en évolution et devra être évalué sur une nouvelle version
> d'electron-builder, avec lockfile, tests de migration et qualification
> Windows séparés. Ne pas remplacer un build fonctionnel par un upgrade
> non vérifié uniquement pour l'extension de fichier.
> 
> **Pré-requis externes** : créer/valider un compte développeur Partner Center,
> réserver le nom **TEMPORA Desktop** puis récupérer **les valeurs exactes**
> de `Package/Identity/Name`, `Publisher` et nom d'éditeur depuis Microsoft.
> Ne jamais inventer de Publisher ou utiliser le CN du certificat HTTPS
> `connect-gm.com`.
> 
> Les trois identifiants publics ont désormais été confirmés par le titulaire du
> compte et versionnés dans la configuration de packaging : `Name =
> GhemriM.TEMPORADesktop`, `Publisher =
> CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455`,
> `PublisherDisplayName = Ghemri M`. Il ne s'agit **pas de secrets**.
> 
> Aucune variable GitHub n'est nécessaire pour lancer la compilation
> candidat ; les valeurs sont vérifiées avant le build. Une éventuelle
> substitution via environnement est rejetée si elle ne correspond pas
> strictement à l'identité officielle. Si l'identité Partner Center
> change, procéder à une modification revue du fichier
> `store-appx.config.cjs` et du workflow.
> 
> Le workflow **manuel ou déclenché en PR** `desktop-electron-microsoft-store-candidate.yml`
> produit un package AppX **non signé / candidat uniquement**, contrôle le
> manifest, la présence et le fonctionnement du moteur scientifique emballé,
> puis publie un artefact temporaire de CI (pas une GitHub Release).
> Aucun accès ni jeton Partner Center n'est stocké, aucune soumission
> automatique n'est effectuée.
> 
> Après construction : vérifier un premier paquet via les outils Windows,
> préparer capture, description, politique de confidentialité, âge,
> choix de distribution et soumettre manuellement depuis Partner Center.
> La signature Store réelle et la disponibilité publique n'existeront
> qu'**après certification et publication par Microsoft**.
> 
> Les variantes NSIS et Store doivent être testées séparément, notamment
> le stockage local, la sélection native de fichiers, le lancement du
> worker Node embarqué, la lecture de corpus synthétiques et la désinstallation.
> 
> 
> ## Exemples scientifiques inclus / Bundled research examples (J8B)
> 
> Les installateurs **Electron NSIS et Microsoft Store AppX candidat** embarquent maintenant
> un dossier `resources/examples/` local et hors ligne, identique à celui livré par Tauri NSIS :
> 
> - `synthetic-canonical-v3.json` : corpus de test **fictif**, compatible avec la
>   validation TEMPORA v3, utilisable dans le sélecteur de documents et les modules TVRW.
> - `alnop-geographic-sample.geojson` : extrait de **cinq notices** issues du
>   dataset ALNOP, une par wilaya historique W1 à W5, pour inspection géographique.
>   **GeoJSON ≠ corpus canonique TEMPORA v3**. Ce jeu peut être lu par l'inspecteur
>   GeoJSON mais n'est pas validable directement comme corpus canonique.
> - `README.md` : attribution, licence, limites historiques et mode d'emploi.
> 
> La source géographique est figée à la révision ALNOP
> `2428a693393a4a635d5eeac3e3c8542498b8b9d6`.
> Licence annoncée par l'export GeoJSON : **CC BY 4.0**, attribution Ghemri M.
> Les coordonnées représentatives ne doivent jamais être présentées comme
> des positions historiques exactes. Aucun fonds ou géocodage distant n'est téléchargé.
> 
> **Pour essayer :** après installation, naviguer dans le dossier d'installation,
> sous `resources/examples/`, et ouvrir l'un des deux documents depuis
> TEMPORA Desktop via le sélecteur natif. L'application ne copie pas les fichiers
> dans le profil utilisateur et ne modifie pas les exemples d'origine.
> 
> La CI du package Electron contrôle la présence des ressources dans
> `win-unpacked/resources/examples/`, puis installe réellement le NSIS dans un
> répertoire Windows isolé, vérifie les exemples installés et exécute le
> validateur canonique avec le Node embarqué (sans Node système dans `PATH`). Les chemins Store sont aussi vérifiés par le
> test de contrat; ce contrôle n'est **pas** une qualification E2E d'installation
> Store et ne remplace pas les essais manuels sur Windows Sandbox propre.
> 