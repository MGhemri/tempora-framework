# TEMPORA — Registre de pilotage et audit d'avancement (vivant)

> **Document de référence à relire et actualiser à chaque itération.**
> Dossier : `Audit/` · Chantier principal : Assistant M1.5 / TEMPORA Desktop Chromium.
> État initial vérifié : **2026-11-10** · Responsable de suivi : équipe TEMPORA / développeur principal.
> **Ne constitue ni une homologation de sécurité, ni une certification de durabilité.**

## 0. Convention d'actualisation obligatoire

**Au début de chaque itération :**
1. Lire **ce fichier**, `ASSIST-M1.5-PERSISTENCE.md` et le runbook de récupération.
2. Contrôler le HEAD, le statut brouillon de la PR #114 et les trois workflows du **HEAD exact** ; ne pas utiliser la réussite d'un ancien commit comme preuve du nouveau.
3. Retenir les tâches prioritaires non closes, distinguer les preuves vérifiées des hypothèses, puis produire un lot cohérent.
4. Ne pas fusionner sur `main`, publier npm/GitHub Release ou soumettre sur Microsoft Store sans décision explicite.
5. Avant la clôture : mettre à jour **ce registre**, les preuves (SHA/CI), les changements réellement livrés, les risques résiduels, les critères de sortie et les prochaines actions. Ne jamais marquer une tâche « terminée » si sa CI est en cours.
6. Éviter les commits pendant une CI déjà lancée : les workflows PR ont `cancel-in-progress`. Préférer un lot consolidé, puis la qualification du dernier commit.

**Sens des statuts :** `IMPLÉMENTÉ` = code présent ; `TESTÉ-CI` = tests verts pour le SHA donné ; `EXPÉRIMENTAL` = usage de développement seulement ; `BLOQUÉ` = critère de sécurité non démontré ; `À FAIRE` = absent ; `VALIDÉ-DIFFUSION` = toutes les gates satisfaites (aucun élément M1.5 d'écriture n'a actuellement ce statut).

## 1. Périmètre et situation de diffusion

| Élément | Statut confirmé | Justification |
| --- | --- | --- |
| Dépôt | `MGhemri/tempora-framework` | https://github.com/MGhemri/tempora-framework |
| PR de développement | **#114, brouillon** | https://github.com/MGhemri/tempora-framework/pull/114 |
| Branche | `docs/assist-m1-5-transactional-persistence` | Branche expérimentale |
| HEAD de référence précédent | `8d2936f2263c8811743f936e4d4f5743af2807af` | Dernière base entièrement qualifiée vérifiée au début de cette itération |
| Framework sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42832156582 |
| Documentation UI sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42832156447 |
| Desktop Foundation sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42832156535 |
| Installateur Windows Chromium NSIS | Construction CI réussie sur le SHA de référence | Cela ne prouve pas une qualification NTFS / power-loss |
| Enregistrement M1.5 dans le binaire distribué | **DÉSACTIVÉ** | Uniquement Electron non packagé et `TEMPORA_EXPERIMENTAL_M15_SAVE=1` |
| Fusion dans `main` / nouvelle release / Store | **NON EFFECTUÉ** dans ce chantier | Conserver les protections de distribution |

**Distinction essentielle :** M1.5 dispose de composants opérationnels en développement, mais le moteur de persistance n'est **pas homologué pour diffusion**. La certification Microsoft Store d'une version antérieure ne qualifie pas les nouveaux mécanismes M1.5.

## 2. Inventaire du travail réellement accompli

| ID | Composant ou résultat | Statut | Preuve / code principal |
| --- | --- | --- | --- |
| M15-01 | Détection et normalisation Assistant (source, mapping, revue humaine, dry-run) | IMPLÉMENTÉ et TESTÉ-CI | `apps/desktop/electron/assistant-session.cjs`, `bridge/worker.cjs` et tests |
| M15-02 | Prévisualisation canonique v3 + staging scientifique **en mémoire** avec reçus non publiés | IMPLÉMENTÉ et TESTÉ-CI | `apps/desktop/electron/main.cjs`, `bridge/worker.cjs` |
| M15-03 | Seconde autorisation à usage unique, source/corpus/mapping SHA-256, relecture et SDK 3.0.0 | IMPLÉMENTÉ et TESTÉ-CI, EXPÉRIMENTAL | `review-persistence-*.cjs`, `assistant-persistence-binding.cjs`, `assistant-persistence-authority.cjs` |
| M15-04 | Transaction locale immuable, journal + corpus + manifeste, déduplication, réservation interprocessus | IMPLÉMENTÉ et TESTÉ-CI, EXPÉRIMENTAL | `transaction-store.cjs`, tests dédiés |
| M15-05 | Protections JS des symlinks/jonctions, identités de dossiers et verrous, lecture bornée 16 Mio | IMPLÉMENTÉ et TESTÉ-CI, **non garantie TOCTOU native** | `transaction-store.cjs` |
| M15-06 | Inspection des transactions, preuves orphelines, verrou, rapprochement read-only par 5 SHA | IMPLÉMENTÉ et TESTÉ-CI | `recovery-assessment.cjs`, `scripts/assess-recovery.cjs` |
| M15-07 | GUI diagnostic read-only + sauvegarde expérimentale sous deux dialogues natifs | IMPLÉMENTÉ et TESTÉ-CI, EXPÉRIMENTAL | `main.cjs`, `preload.cjs`, `src/assistant-view.ts` |
| M15-08 | Tests d'interruption du processus enfant à 6 étapes, avant et après renommage | IMPLÉMENTÉ et TESTÉ-CI | `tests/recovery-assessment.test.cjs` |
| M15-09 | Packaging Chromium NSIS, exemples synthétiques, SDK épinglé, CI Ubuntu/Windows | TESTÉ-CI pour HEAD de référence | `.github/workflows/desktop-foundation.yml` |
| M15-10 | Dossier documentaire d'audit et runbook opérateur | IMPLÉMENTÉ | `Audit/ASSIST-M1.5-*.md` |
| M15-11 | Registre durable de tâches et des gates à vérifier à chaque itération | **IMPLÉMENTÉ (présent fichier)** | `Audit/TEMPORA-ETAT-AVANCEMENT.md` |
| M15-12 | Empreinte du verrou avant/après audit : détecte substitution même si le statut reste `reserved` | **IMPLÉMENTÉ ET TESTÉ-CI sur `6f1ce4a9`** | `recovery-assessment.cjs` et test de remplacement à nonce cloné |
| M15-13 | Deux passes complètes d'inventaire read-only : détecter changement de journal d'une transaction finalisée ou candidate `.pending` sans changement d'ID | **IMPLÉMENTÉ ET TESTÉ-CI sur `5f9b5a2d`** | `recovery-assessment.cjs`, deux tests d'altération concurrente |
| M15-14 | Couche Rust Win32 de contrôle de destination NTFS locale par handles, refus des UNC/reparse/jonctions | **IMPLÉMENTÉ ET TESTÉ-CI sur `9ccab348`** | `apps/desktop/native-windows-guard/`, `electron/windows-native-destination.cjs` |
| M15-15 | Premier commit synthétique Win32 avec handles parents conservés et renommage à chemin absolu | **TESTÉ-CI sur `4f4ca37f`**, sonde uniquement | `native-windows-guard/src/native_commit.rs` et tests Win32 |
| M15-16 | Contrat de transport scientifique SDK → Rust : cinq empreintes canoniques, deux SHA des fichiers, journal et non-publication | **TESTÉ-CI sur `4b46ee81`**, lecture seule | `electron/scientific-native-transport.cjs`, `native-windows-guard/src/scientific_envelope.rs`, tests Node/Win32 |
| M15-17 | Writer natif de sonde consomme les buffers vérifiés par Rust et copie les octets exacts dans `native-probe-complete/` | **TESTÉ-CI sur `8d2936f2`**, non scientifique | `native_commit.rs`, `scientific_envelope.rs`, tests Windows |
| M15-18 | **Handles Win32 épinglés** pendant toute la sonde : dossier et 3 sources, partage en lecture seule, vérification reparse, trois points de crash réels et refus de reprise | **IMPLÉMENTÉ — CI DU NOUVEAU HEAD À QUALIFIER** | `native-windows-guard/src/scientific_envelope.rs`, `native_commit.rs`, tests Windows |

## 3. Backlog de qualification — priorités et conditions de fermeture

| ID | Priorité | Statut | Action requise | Preuve nécessaire pour cocher |
| --- | --- | --- | --- | --- |
| SEC-WIN-01 | **P0** | **PARTIEL : sonde de renommage natif avec handles parents implémentée, CI à qualifier ; données scientifiques toujours BLOQUÉES** | Transformer le prototype synthétique en **transaction scientifique native**, sans relâcher les handles avant commit ; garantir le lien SHA/source/SDK, ACL et attestation | NTFS adversarial, processus concurrents, parcours réel, récupération, revue de code et absence TOCTOU |
| SEC-WIN-02 | **P0** | **PARTIEL : contrôle Win32 du volume / rejet UNC et non-NTFS, CI à vérifier** | Politique de support disques locaux / volumes mappés / SMB / UNC / dispositifs, ACL et permissions de dossier | Test sur machine Windows et matrice des systèmes de fichiers ; refus fermé des cibles non qualifiées |
| DUR-01 | **P0** | BLOQUÉ | Durabilité après arrêt brutal de l'OS, perte électrique, reboot et flush des répertoires/volumes | Essais sur machine ou VM instrumentée ; aucune affirmation à partir du seul `process.exit()` |
| REC-01 | **P0** | BLOQUÉ | Procédure contrôlée de récupération **humaine**, preuve préalable, revue des verrous/candidats, journal des actions et vérification post-opération | Scénarios de recovery reproductibles, absence de promotion automatique, validation opérateur |
| SCI-01 | **P0** | BLOQUÉ | Qualification complète du parcours scientifique et des signatures/reviewer dans le modèle v3 ; identité déclarative ≠ authentification | Tests d'intégrité, provenance et revue du contrat scientifique |
| GUI-01 | **P1** | EXPÉRIMENTAL | Qualification UX/IPC des deux décisions, annulation, sessions expirées, reprise et états d'échec | Tests sur build Windows installé ; aucune mutation sans double consentement |
| PACK-01 | **P1** | BLOQUÉ | Installation propre, démarrage hors ligne, exemples, permissions Windows, mise à jour Store compatible | Tests manuels/automatisés sur installateurs signés et chemins Windows pris en charge |
| CI-01 | **P1** | EN COURS D'AMÉLIORATION | Réduire l'exécution redondante et éviter le redémarrage des workflows par micro-commits | Couverture maintenue, durée mesurée sur lots comparables ; zéro gate supprimée |
| PERF-01 | P2 | À FAIRE | Benchmarks reproductibles corpus synthétiques, mémoire, temps d'inventaire **avec deux passes**, volume élevé, p95 | Budget fixé, données et méthode de mesure versionnées |
| DOC-01 | P1 | **RÉCURRENT** | Mettre à jour ce rapport et le runbook à chaque itération | HEAD, statut des trois CI, tâches modifiées et risques résiduels consignés |

**Interdits tant que P0 ouverts :** activation du write IPC en package de production, nettoyage automatique de `.writer-lock`, promotion automatique de `.pending`, récupération par heuristique PID, écrasement du corpus original, publication scientifique implicite, fusion de la PR expérimentale.

## 4. Découpage des lots recommandés

**Lot A — EN COURS (sécurité diagnostique, sans écriture) :** contrôle du verrou à identité inchangée **testé CI** ; deux passes complètes d'inventaire finalisé et `.pending` **implémentées, qualification du nouveau HEAD à confirmer**. Les limites de snapshot atomique/TOCTOU demeurent ; vérifier le coût de la double lecture et les contrats de confidentialité IPC.

**Lot B — FONDATION NATIVE EN COURS :** M15-16/17 SDK→Rust→sonde NTFS qualifiés CI. **M15-18 conserve maintenant quatre handles sources pendant lecture, contrôle et commit de sonde**, ajoute tests concurrents et crashs Rust. **À FAIRE P0** : authenticité de l'approbation humaine, sécurité intégrale des ancêtres et cible du renommage, ACL, NTFS adversarial, panne électrique et récupération.

**Lot C — durabilité et recovery humain :** injecter des pertes d'énergie et crash OS sur NTFS instrumenté, définir une transaction recoverable manuellement, consigner consentement et provenance ; ne pas déduire les garanties d'une seule CI.

**Lot D — qualification de distribution :** installateurs sur postes Windows propres, upgrade, tests hors ligne, rapports de sécurité, décision de fusion et release uniquement une fois les gates P0 levées.

## 5. Historique des itérations — append-only logique

| Date | Référence | Travaux et constat | Qualification / décision |
| --- | --- | --- | --- |
| 2026-11-10 | `5aa3970a` | Six scénarios de perte de processus, déduplication des suites Ubuntu et mise à jour audit | **3 workflows verts**, M1.5 toujours expérimental |
| 2026-11-10 | `a447ecdf` | Création du registre central ; liste P0/P1/P2, critères de sortie et protocole de suivi | Rapport versionné dans la PR #114 |
| 2026-11-10 | `302e57a7` → `6f1ce4a9` | Diagnostic de verrou renforcé par empreinte physique et métadonnées de son fichier propriétaire ; test d'échange par un verrou au même nonce | **Trois workflows CI réussis sur `6f1ce4a9`**, dont packaging NSIS. Pas de garantie atomique ni handles Windows natifs |
| 2026-11-10 | `5f9b5a2d` | Double inspection forensic, mutations concurrentes, suivi audit | **3 workflows verts**, Desktop Chromium/Windows compris |
| 2026-11-10 | `9ccab348` — M15-14 | Préflight Win32 local NTFS / reparse, raccordé au parcours de développement et compilation Rust Windows | **3 workflows verts**, y compris test Rust et packaging NSIS, sans certification TOCTOU |
| 2026-11-10 | M15-15 — commit Rust fictif / Win32 | Nouveau fichier `native_commit.rs`, verrou de sonde exclusif, trois documents fictifs synchronisés, renommage natif à chemin absolu par `FileRenameInfo` et test end-to-end Windows | **Code intégré, CI du nouveau HEAD à vérifier** ; aucune intégration au SDK scientifique / aucune autorisation de diffusion |

**Politique CI du présent lot M15-15 :** base vérifiée `9ccab348` (Framework `42758208653`, Documentation `42758208402`, Desktop `42758208397`). La sonde native de commit est `IMPLÉMENTÉE` ; elle ne passe `TESTÉ-CI` qu'après réussite du job Windows cargo/Node et des trois workflows du HEAD courant. Elle ne lève jamais automatiquement SEC-WIN-01.

### Modèle de compte rendu d'itération (à compléter et conserver)

- **Date / branche / SHA exact :**
- **Base CI vérifiée (Framework / Documentation / Desktop Windows) :**
- **Travaux réellement livrés, fichiers :**
- **Tests ajoutés, exécutés, résultats :**
- **Backlog :** ID changés ; preuve ; pourquoi le statut est maintenu ou levé
- **Risques et écarts constatés :**
- **Prochaine tranche P0/P1 :**
- **Décision de diffusion :** PR brouillon / fusion interdite / Store inchangé tant que P0 non clos

## 6. Références primaires

- [Contrat et preuves de persistance M1.5](ASSIST-M1.5-PERSISTENCE.md)
- [Runbook read-only de diagnostic](ASSIST-M1.5-RECOVERY-RUNBOOK.md)
- [PR #114](https://github.com/MGhemri/tempora-framework/pull/114)
- [Workflow Desktop Foundation](../.github/workflows/desktop-foundation.yml)

> **Règle de décision :** Une CI verte prouve uniquement que ses tests définis sont passés pour un SHA précis. Elle ne prouve pas la sûreté NTFS contre les races, la durabilité électrique ni une autorisation scientifique.


### Incident et décision M15-15 — 2026-11-10

- **CI Windows initiale : échec confirmé.** La variante `FileRenameInfo` avec `RootDirectory` et nom relatif a renvoyé `ERROR_INVALID_PARAMETER (87)`.
- **Correctif intégré :** passage à `FileRenameInfo` avec cible absolue et `RootDirectory=NULL`, sans libérer les handles parents avant l'opération native.
- **Statut :** `IMPLÉMENTÉ, CI À QUALIFIER` tant que les tests réels Windows du nouveau HEAD ne sont pas verts ; **ce n'est pas une opération handle-relative sécurisée**, même en cas de succès.
- **SEC-WIN-01 demeure P0/BLOQUÉ** : résoudre le renommage réellement handle-relative ou un protocole NTFS atomique de même niveau, avec revues de sécurité et tests d'attaque.


### Itération M15-16 — 2026-11-10 — Contrat scientifique natif (à qualifier)

- **Baseline vérifiée :** `4f4ca37fb7c96811e99b2cbe40ac35cb39418fea` ; Framework, Documentation UI et Desktop Foundation Windows NSIS **tous réussis** (runs `42760005561`, `42760005640`, `42760005524`).
- **Travaux :** création du contrat pur `scientific-native-transport.cjs`, du lecteur Rust `scientific_envelope.rs` et de sa commande `--verify-envelope`, avec validation de SHA des octets, identité à cinq digests, journal et statuts non publiés. Tests SDK synthétiques, tampering et Windows intégrés à la CI existante.
- **Statut :** `IMPLÉMENTÉ / CI À CONFIRMER` tant que les trois workflows du HEAD final ne sont pas verts ; ce contrat **ne crée pas une transaction scientifique**.
- **Risques P0 :** pas de vérification canonique SDK à l'intérieur de Rust, pas de lecture fichier handle-based intégrale, pas de writer scientifique natif, pas de signature de consentement humain, pas de qualification de durabilité électrique ni récupération opérateur.
- **Prochaine action majeure :** transporter le corpus validé par SDK vers une transaction native sous handles sans confondre SHA des fichiers et digest canonique ; construire des tests NTFS adversariaux avant activation.
- **Décision :** PR #114 brouillon, aucun changement dans `main`, releases ou Microsoft Store.


### Itération M15-17 — 2026-11-10 — Première consommation de buffers vérifiés par le writer natif

- **Baseline CI vérifiée :** `4b46ee81419e1adcfa3018bed85c73fcb0b4f3b6` : Framework run `42762689352`, Documentation run `42762689375`, Desktop Windows Chromium NSIS run `42762689715`, trois **success**.
- **Fonctionnalité implémentée :** `scientific_envelope::load_verified` retourne les trois buffers déjà vérifiés et `native_commit::synthetic_transport_commit` les écrit sans rouvrir la source, dans le seul répertoire de sonde Windows. Commande `--synthetic-transport-commit` exigeant l'opt-in existant.
- **Test ajouté :** véritable processus Rust Windows, refus sans opt-in et d'un journal altéré avant toute écriture, copie binaire exacte de l'enveloppe et de ses deux fichiers, aucune écriture dans `transactions/` ou `.pending/`.
- **Qualification :** code `IMPLÉMENTÉ`; la CI du nouveau HEAD doit encore réussir avant `TESTÉ-CI`.
- **Risques P0 inchangés :** un faux indicateur `sdk_validated` ne prouve pas le consentement ; les lectures d'entrée par chemins restent sujettes à des races ; la cible du renommage est absolue et non handle-relative ; pas de vraie transaction scientifique, récupération humaine ou durabilité power-loss.
- **Décision :** PR #114 en brouillon. Aucun changement dans `main`, releases ou Microsoft Store ; writer scientifique distribué toujours désactivé.


### Itération M15-18 — 2026-11-10 — Lot consolidé : handles, concurrence, crashs Rust

- **Base CI exacte entièrement verte :** `8d2936f2263c8811743f936e4d4f5743af2807af`, Framework `42832156582`, Documentation `42832156447`, Desktop Windows/Linux/NSIS `42832156535`.
- **Implémentation :** le lecteur Rust utilise `CreateFileW` + `OPEN_REPARSE_POINT` sur la source et ses fichiers, refuse les liens et conserve **les handles du dossier et des trois fichiers** jusqu'à la fin du commit de sonde. Ouverture sans `FILE_SHARE_WRITE` ou `FILE_SHARE_DELETE` ; lecture bornée directement depuis les handles.
- **Preuves tests ajoutées :** (i) lien symbolique d'un document refusé, (ii) modification concurrente refusée pendant qu'un autre processus détient les handles, (iii) trois interruptions réelles de Rust au verrou, au premier fichier et après renommage, (iv) verrou orphelin empêchant le rejeu.
- **Statut :** `IMPLÉMENTÉ`, **CI finale du lot à vérifier**, pas encore homologué en sécurité.
- **Risques :** les composants ancêtres peuvent changer entre inspection et ouverture ; consentement humain et marqueur `sdk_validated` sans signature ; cible finale Win32 absolue, power-loss et reprise opérateur non qualifiés. **P0 non levés**.
- **Décision :** PR #114 brouillon, aucun merge sur `main`, aucune release, aucun Store. Sauvegarde de production toujours désactivée.
