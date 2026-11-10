# TEMPORA — DOSSIER DE REPRISE AUTONOME (à lire en premier)

> **ETAT COURANT (2026-11-10) : lire d'abord [POINT-DE-REPRISE.md](POINT-DE-REPRISE.md).** Les PR #114, #115, #116 et #117 sont fusionnées ; les anciennes mentions « brouillon/en cours » ci-dessous sont historiques, pas des instructions opérationnelles.

> **Objectif :** permettre à une nouvelle conversation / un nouveau développeur de reprendre immédiatement **sans redemander l'historique**. Ce fichier est versionné dans le dépôt et **fait autorité pour les consignes de reprise**, mais **pas** pour un SHA ou un résultat CI devenu périmé : ceux-ci sont à vérifier sur GitHub. À mettre à jour au cours de chaque itération.
>
> Date de création : **2026-11-10**. Périmètre : TEMPORA Desktop / Assistant M1.5 (persistance expérimentale).

## 1. Contrat de travail non négociable

- Dépôt : **https://github.com/MGhemri/tempora-framework**.
- **Branche active : `main` (après fusion PR #117).** Toute nouvelle implémentation se fait en branche éphémère issue du HEAD de `main`, jamais sur une ancienne branche fusionnée.
- **PR #114 FUSIONNÉE** le 2026-11-10 : https://github.com/MGhemri/tempora-framework/pull/114 ; merge `3c2b7bb752538a8990dad88b1527b0a422c56ca5`. **Branche active post-fusion : `main`** ; la PR documentaire de suivi est `docs/store-0-2-0-merge-audit`. Ne pas développer de nouveaux P0 directement dans `main`.
- Le propriétaire demande d'agir directement sur le dépôt, de **développer, vérifier, corriger et continuer**, sans lui faire répéter les priorités ni solliciter des confirmations de routine.
- Avancer par **lots cohérents suffisamment importants**, pas par micro-correctifs ou simples rapports. Limiter les commits / relances de CI, puis qualifier **le HEAD final exact**.
- **Décision exécutée le 2026-11-10 :** fusion de la PR #114 après réussite des trois CI et génération AppX Store `0.2.0`. Le merge est effectif (SHA ci-dessus). **Release GitHub/npm, upload et publication Microsoft Store non exécutés et nécessitant une décision distincte**. Ne pas confondre préparation Store et publication. Une certification Store antérieure ne qualifie pas M1.5.
- Aucun write M1.5 dans les applications packagées : `electron/local-save-access.cjs` impose `isPackaged===false && TEMPORA_EXPERIMENTAL_M15_SAVE==='1'`. Le mode non packagé et opt-in reste **uniquement expérimental**. La sonde Rust `TEMPORA_NATIVE_SYNTHETIC_TEST=1` est **test-only** ; ne jamais l'exposer via IPC ou l'installateur.
- Ne pas confondre **acceptation humaine pour staging local**, **approbation scientifique**, **publication**, **validation de l'intégrité** et **consentement authentifié**.
- Ne jamais effacer automatiquement un verrou, renommer un candidat `.pending` en résultat final par heuristique, ni réessayer une transaction après erreur de résultat incertain.
- Les rapports de CI sont des preuves **du SHA testé seulement**. Un test process-exit ne prouve pas la durabilité électrique/OS, une cible renommée par **chemin absolu** ne prouve pas un commit sécurisé *handle-relative*.

## 2. Reprise en moins de cinq contrôles

1. Lire **ce dossier**, puis `Audit/TEMPORA-ETAT-AVANCEMENT.md`, `Audit/ASSIST-M1.5-PERSISTENCE.md` et `Audit/ASSIST-M1.5-RECOVERY-RUNBOOK.md`.
2. Sur GitHub, obtenir le **HEAD actuel** de la branche, vérifier la fusion des PR #116/#117 et le nouveau HEAD `main`, puis vérifier Framework, Documentation UI et Desktop Foundation (Windows Rust/Node/Chromium NSIS, et Ubuntu) **attachés au HEAD**.
3. Lire les fichiers correspondant au jalon P0 choisi, vérifier que les références de fichiers/tests/CI existent réellement au **même HEAD**. La branche a déjà eu un incident de double implémentation forensic et des références orphelines.
4. Implémenter **plusieurs tâches liées** dans le même lot (fonctionnalité + tests de falsification/crash + documentation), qualifier le dernier SHA, corriger tout échec réellement observé. Éviter de surveiller en boucle sans produire de nouveau travail.
5. Mettre à jour **avant de conclure** ce fichier (si l'architecture, les chemins ou les décisions changent), le registre et, au besoin, le runbook, avec **SHA / IDs de runs / résultats exacts / risques P0 / prochaines actions**. Le rapport permanent ne peut pas prétendre à une CI verte avant sa fin.

## 3. Dernière référence solide et jalon en cours

- **Dernier HEAD intégralement vert vérifié à la création** : `9a9a73835396f7471e5c112193aa3839acf49a9a`.
- **Runs réussis sur ce SHA** : Framework `42839244384`, Documentation UI `42839244084`, Desktop Foundation `42839244460`. Windows y comprend tests Rust, contrats scientifiques, diagnostic de sonde et packaging NSIS.
- **Lot actuellement en développement : M15-20** — **relecture par handles Win32 des fichiers de staging réellement écrits**, comparaison bit-à-bit avec les buffers vérifiés **avant** renommage de la transaction de sonde. Un test Windows injecte une altération du `journal.json` après écriture et attend refus de visibilité, verrou et candidat conservés, aucun écrit scientifique. **Le statut CI de ce lot doit être contrôlé au HEAD courant ; ne pas hériter du vert précédent.**
- PR #114 **DRAFT**, `main` inchangée par ce chantier, pas de release/Store.

## 4. Où se trouve chaque composant

| Responsabilité | Fichier / dossier |
| --- | --- |
| Détection/normalisation et état de session | `apps/desktop/electron/assistant-session.cjs` |
| Décisions humaines natives / prévisualisation / IPC | `apps/desktop/electron/main.cjs`, `preload.cjs`, `src/assistant-view.ts` |
| Accès expérimental dev-only | `apps/desktop/electron/local-save-access.cjs` |
| Autorité de transaction et liaison des inputs | `apps/desktop/electron/assistant-persistence-authority.cjs`, `assistant-persistence-binding.cjs` |
| Contrat validé par le SDK v3, en mémoire | `apps/desktop/electron/scientific-native-transport.cjs` |
| Stockage JS immuable et verrou `.writer-lock` (prototype) | `apps/desktop/electron/transaction-store.cjs` |
| Diagnostic scientifique JS read-only | `apps/desktop/electron/recovery-assessment.cjs`, `scripts/assess-recovery.cjs` |
| Qualification Win32 destination locale/NTFS + CLI | `apps/desktop/native-windows-guard/src/main.rs` |
| Lecture des buffers, SHA et handles sources Win32 épinglés | `apps/desktop/native-windows-guard/src/scientific_envelope.rs` |
| Writer **synthétique seulement**, renommage NTFS natif, crash hooks | `apps/desktop/native-windows-guard/src/native_commit.rs` |
| Inventaire **consultatif**, *non récupération*, de sonde NTFS | `apps/desktop/native-windows-guard/src/probe_inventory.rs` |
| Wrapper préflight de destination Windows | `apps/desktop/electron/windows-native-destination.cjs` |
| Tests Rust/Windows | `apps/desktop/electron/tests/windows-native-destination.test.cjs`, `scientific-native-transport.test.cjs`, `native-probe-inventory.test.cjs` |
| Contrats/tests JS des transactions et incidents | `apps/desktop/electron/tests/transaction-store.test.cjs`, `recovery-assessment.test.cjs` |
| CI globale existante | `.github/workflows/desktop-foundation.yml`, autres workflows Framework/Documentation UI |
| Corpus de test fictif | `apps/desktop/examples/synthetic-canonical-v3.json` |

### Architecture réellement acquise

**SDK Node canonique v3** → validateur + digest canonique du corpus et décisions de staging → enveloppe `tempora-scientific-transport-v1` contenant **5 SHA d'identité et 2 SHA des octets transportés** → **Rust `scientific_envelope::load_verified`** : lecture bornée et épinglée via Win32, vérification des SHA et du journal → **writer natif de sonde**, sur `TEMPORA_NATIVE_SYNTHETIC_TEST=1` seulement → `.native-probe-pending/<id>` → `native-probe-complete/<id>` (après `SetFileInformationByHandle(FileRenameInfo)` **avec cible absolue** et handles parents conservés). Rien n'est écrit par cette sonde dans `.pending/` ou `transactions/` scientifique. Le `manifest.json` de sonde est `NTFS_SCIENTIFIC_TRANSPORT_PROBE` ou `NTFS_HANDLE_RENAME_PROBE`, **pas** un reçu d'approbation ou publication.

Le diagnostic natif `--inspect-probe` expose `tempora-native-probe-inventory-v1` : **compteurs** `committed_verified`, `pending_complete`, `pending_incomplete`, `unsafe_entries`, `lock_status`, `production_recovery_authorized:false`. Ne pas recréer `probe_forensic.rs` ou une autre commande concurrente. Limite actuelle : 100 entrées par catégorie.

## 5. Procédure de tests (Windows PowerShell)

Depuis la racine du dépôt et après installation des dépendances :

```powershell
cd apps/desktop
cargo test --manifest-path native-windows-guard/Cargo.toml
cargo build --release --manifest-path native-windows-guard/Cargo.toml
npm install --ignore-scripts --no-audit --no-fund
npm run build
npm run test:scientific-native-transport
node --test electron/tests/native-probe-inventory.test.cjs
npm run test:transaction
npm run test:recovery
```

La CI complète est `TEMPORA Desktop Foundation` + `TEMPORA Framework` + `TEMPORA Documentation UI` au **même commit**. Évaluer le succès Windows NSIS à partir du job complet, pas seulement `cargo test`. Sur Linux, les cas Win32 gardés conditionnellement sont omis : cela ne suffit pas à qualifier les primitives natives.

Pour le diagnostic scientifique JS, et uniquement sans mutation :

```powershell
cd apps/desktop
node electron/scripts/assess-recovery.cjs "C:\Dossier\TEMPORA-imports"
```

La commande native `--inspect-probe` est une inspection **de sonde**, distincte de la récupération du corpus scientifique.

## 6. Prochains lots à développer réellement (priorisés)

1. **P0 SEC-WIN-01 / SCI-01 — vrai writer scientifique natif :** établir un protocole d'autorisation hôte ↔ Rust résistant à la falsification, lié à la session et à **deux décisions humaines**, avec identité source/base/mapping/output, SDK canonique et contenu immuable. Le champ `sdk_validated:true` seul est falsifiable. **Ne pas exposer un write via CLI depuis le renderer.**
2. **P0 SEC-WIN-01/02 — anti-TOCTOU end-to-end :** qualifier l'ouverture des répertoires et leurs ancêtres, l'intégrité des fichiers jusqu'au commit, ACL/volumes fixes NTFS/reparse point et race interprocessus. La variante `RootDirectory` + nom relatif de `FileRenameInfo` a échoué avec Win32 **87** ; le chemin absolu actuel **n'est pas une solution de sécurité prouvée**.
3. **P0 REC-01 — récupération humaine contrôlée :** spécifier et tester des actions d'opérateur explicites, revues en lecture seule d'abord, conservation des preuves, journal d'autorisation, règles anti-double-rejeu. Le diagnostic natif et JS ne donnent pas un droit de suppression/promotion.
4. **P0 DUR-01 — qualification vraie panne OS/power-loss :** essais Windows VM / machine instrumentée, NTFS, flush, reboot et état après incident ; pas uniquement des `process.exit`.
5. **P1 GUI-01 / PACK-01 :** tests installateur signé/hors ligne/upgrade, IPC opt-in/annulation/session expirée, zéro publication ou écriture packagée tant que P0 ouverts.
6. **P1 CI-01 / P2 PERF-01 :** mesurer la durée et les retests redondants, bench sur corpus synthétiques, inventaire 100/1k dossiers, mémoire et budget p95. Ne pas supprimer les gates.

## 7. Incident connu de l'historique (ne pas répéter)

Pendant M15-19, un double inspecteur `probe_forensic.rs` et `probe_inventory.rs` a introduit deux contrats JSON différents et plusieurs CI échouées ; une version intermédiaire a même référencé un test absent. L'unique inspecteur a été rétabli, la suite de tests réconciliée, et la campagne du SHA `9a9a7383` est **verte**. Vérifier l'existence des chemins/tests au **HEAD final**. Ne pas considérer un échec de câblage CI comme une preuve que le modèle scientifique est incorrect.

## 8. Protocole de compte rendu final à l'utilisateur

Un court résumé en français comprenant : **fonctionnalité effectivement livrée, tests qui ont réussi/échoué sur le SHA, lien PR #114, état de diffusion**, plus les **P0 non clos**. La valeur principale doit venir du code, pas du volume de narration. Garder l'historique technique et les instructions complètes ici et dans `Audit/TEMPORA-ETAT-AVANCEMENT.md`, pour que toute reprise de ChatGPT puisse commencer immédiatement.

**Dernière règle :** une nouvelle conversation doit commencer par lire `Audit/REPRISE-TRAVAUX.md` et contrôler le HEAD GitHub, puis reprendre le premier jalon P0 non clôturé, sans demander à l'utilisateur de reformuler les étapes déjà consignées.


## 9. Changement de stratégie : fusion et préparation Store 0.2.0 (2026-11-10)

**Le propriétaire demande de FINALISER puis FUSIONNER le lot qualifié**, et de préparer la mise à jour Microsoft Store. Ne pas traiter les anciennes consignes « PR draft pour toujours » comme prioritaires après cette autorisation ; elles valaient avant celle-ci.

- **Lire obligatoirement** [STORE-MISE-A-JOUR-0.2.0.md](STORE-MISE-A-JOUR-0.2.0.md).
- Candidat Chromium/Electron **AppX x64 0.2.0**, identité `GhemriM.TEMPORADesktop`, éditeur `CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455`, nom affiché `Ghemri M`. Packaging **NSIS ≠ Store AppX**.
- CI candidate : `npm run dist:store` sur Windows, `--publish never`, inspection `AppxManifest.xml`, sauvegarde de l'AppX en artefact Actions. N'autoriser la fusion qu'après confirmation du job complet et des trois workflows du SHA précis.
- Après fusion, inscrire le SHA de merge et les nouvelles CI `main` dans le rapport Store et le registre. Commencer le travail scientifique restant sur **une nouvelle branche**, avec restrictions M1.5 toujours actives.
- **AUCUNE soumission, validation Partner Center ni publication Store** sans une décision distincte. L'ancien package certifié n'est pas modifié depuis GitHub.


## 10. Résultat définitif du jalon de fusion 0.2.0 — 2026-11-10

- **PR #114 fusionnée dans `main`** : `3c2b7bb752538a8990dad88b1527b0a422c56ca5`. La PR est **close/merged**, non draft.
- **Tests du code exact fusionné (avant merge) :** HEAD `5aca622e5a9346eccbca4d435e109704c8d09005` ; Workflow Framework `42853241876`, Docs `42853242221`, Desktop Windows Chromium/NSIS/AppX `42853241862`, **tous success**.
- **Store AppX x64 0.2.0** : construit et manifeste validé avec identité `GhemriM.TEMPORADesktop` et Publisher officiel. [Artefact de la CI](https://github.com/MGhemri/tempora-framework/actions/runs/42853241862) `TEMPORA-Desktop-0.2.0-x64-STORE-CANDIDATE-NOT-PUBLISHED` (artefact `13781238941`). **Soumission et publication non faites**.
- **Rapport détaillé / checklist Store :** [STORE-MISE-A-JOUR-0.2.0.md](STORE-MISE-A-JOUR-0.2.0.md).
- **Pour la suite du projet :** reprendre les P0 `SEC-WIN-01/02`, `SCI-01`, `DUR-01`, `REC-01` sur **nouvelle branche depuis `main`**, ne pas réactiver le writer M1.5 packagé par inadvertance. La version 0.2.0 du client Chromium est une **base de diffusion possible**, pas une qualification des expérimentations NTFS.
- **Protection GitHub** : toutes les modifications de `main` doivent passer par PR ; ce compte rendu de fusion est réalisé sur `docs/store-0-2-0-merge-audit` et sera visible dans `main` après intégration de cette PR. Ne pas contourner cette règle.

## 11. REC-01 — Cohérence de l'inventaire médico-légal (lot du 2026-11-10)

La reprise progresse avec une comparaison **interne et en lecture seule** des
empreintes de métadonnées NTFS/FS de la racine, des dossiers `transactions/`,
`.pending/` et de leur contenu immédiat. Cette protection détecte notamment
une permutation de manifestes/journaux entre deux passages même lorsque
les transactions restent structurellement valides et que la liste des IDs
est inchangée. Le rapprochement d'une transaction par les cinq SHA effectue
aussi une seconde lecture du manifeste correspondant.

- Code : `apps/desktop/electron/forensic-snapshot.cjs`,
  `recovery-assessment.cjs`, `transaction-store.cjs`.
- Régressions : tests de mutation conservant des transactions valides,
  d'identité changée et de refus des symlinks sans traverser leur cible.
- **PR #116 fusionnée** : HEAD `3f6166dd2ee5adad10fe51bb309ef4adc144e6d0` ; Framework `42864910071`, Docs `42864909686`, Desktop `42864910230` : tous `success`. Merge `57cde355965324ed104559ff767c1c925dcee97f`.
- Ce contrôle **n'est pas** un snapshot atomique, un contrôle cryptographique
  de toute la donnée, une garantie anti-TOCTOU Win32, une preuve de durabilité,
  un mécanisme de signature ou un droit de supprimer/promouvoir un candidat.
  Les gates `REC-01`, `SEC-WIN-01/02`, `SCI-01` et `DUR-01` restent ouverts.

**Reprise efficace :** les PR #116 et #117 sont déjà fusionnées ; créer une nouvelle branche issue du dernier `main` et traiter un P0 restant sans redévelopper les deux lots validés. Ne pas activer l'écriture M1.5 dans les applications packagées.
