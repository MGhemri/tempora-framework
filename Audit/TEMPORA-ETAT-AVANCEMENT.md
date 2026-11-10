# TEMPORA — Registre de pilotage et audit d'avancement (vivant)

> **DOCUMENTS À LIRE DANS CET ORDRE POUR REPRENDRE :** [REPRISE-TRAVAUX.md](REPRISE-TRAVAUX.md) → ce registre → [ASSIST-M1.5-PERSISTENCE.md](ASSIST-M1.5-PERSISTENCE.md) → [ASSIST-M1.5-RECOVERY-RUNBOOK.md](ASSIST-M1.5-RECOVERY-RUNBOOK.md).
> Dossier : `Audit/` · Chantier principal : Assistant M1.5 / TEMPORA Desktop Chromium.
> État initial vérifié : **2026-11-10** · Responsable de suivi : équipe TEMPORA / développeur principal.
> **Ne constitue ni une homologation de sécurité, ni une certification de durabilité.**

**FUSION CONFIRMÉE 2026-11-10 :** PR #114 intégrée dans `main` (`3c2b7bb752538a8990dad88b1527b0a422c56ca5`) après qualification AppX 0.2.0. Lire [STORE-MISE-A-JOUR-0.2.0.md](STORE-MISE-A-JOUR-0.2.0.md). Préparation Store ≠ soumission ou publication. Les P0 d'écriture scientifique restent ouverts.

## 0. Convention d'actualisation obligatoire

**Au début de chaque itération :**
1. Lire **`REPRISE-TRAVAUX.md` d'abord**, puis **ce fichier**, `ASSIST-M1.5-PERSISTENCE.md` et le runbook de récupération.
2. Contrôler le HEAD, le statut brouillon de la PR #114 et les trois workflows du **HEAD exact** ; ne pas utiliser la réussite d'un ancien commit comme preuve du nouveau.
3. Retenir les tâches prioritaires non closes, distinguer les preuves vérifiées des hypothèses, puis produire un lot cohérent.
4. **Exception autorisée le 2026-11-10 : fusionner PR #114 après tests Store verts**, sans publier npm/GitHub Release ni soumettre/publier sur Microsoft Store sans décision distincte.
5. Avant la clôture : mettre à jour **ce registre**, les preuves (SHA/CI), les changements réellement livrés, les risques résiduels, les critères de sortie et les prochaines actions. Ne jamais marquer une tâche « terminée » si sa CI est en cours.
6. Éviter les commits pendant une CI déjà lancée : les workflows PR ont `cancel-in-progress`. Préférer un lot consolidé, puis la qualification du dernier commit.

**Sens des statuts :** `IMPLÉMENTÉ` = code présent ; `TESTÉ-CI` = tests verts pour le SHA donné ; `EXPÉRIMENTAL` = usage de développement seulement ; `BLOQUÉ` = critère de sécurité non démontré ; `À FAIRE` = absent ; `VALIDÉ-DIFFUSION` = toutes les gates satisfaites (aucun élément M1.5 d'écriture n'a actuellement ce statut).

## 1. Périmètre et situation de diffusion

| Élément | Statut confirmé | Justification |
| --- | --- | --- |
| Dépôt | `MGhemri/tempora-framework` | https://github.com/MGhemri/tempora-framework |
| PR de développement | **#114, brouillon** | https://github.com/MGhemri/tempora-framework/pull/114 |
| Branche | `docs/assist-m1-5-transactional-persistence` | Branche expérimentale |
| HEAD de référence précédent | `9a9a73835396f7471e5c112193aa3839acf49a9a` | Dernière base entièrement qualifiée vérifiée au début de M15-20 |
| Framework sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42839244384 |
| Documentation UI sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42839244084 |
| Desktop Foundation sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42839244460 |
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
| M15-19 | Consolidation d'un **unique** inspecteur natif de sonde, manifeste lu par handles épinglés, classification des preuves, limite d'inventaire | **IMPLÉMENTÉ, CI À QUALIFIER** | `native-windows-guard/src/probe_inventory.rs`, `tests/native-probe-inventory.test.cjs` |
| M15-18 | **Handles Win32 épinglés** pendant toute la sonde : dossier et 3 sources, partage en lecture seule, vérification reparse, trois points de crash réels et refus de reprise | **IMPLÉMENTÉ — CI DU NOUVEAU HEAD À QUALIFIER** | `native-windows-guard/src/scientific_envelope.rs`, `native_commit.rs`, tests Windows |
| M15-20 | Relecture par handles Win32 des 4 fichiers réellement stagés et comparaison bit-à-bit avant commit de sonde ; test de corruption post-écriture + **handoff permanent** | **IMPLÉMENTÉ, CI DU HEAD FINAL À QUALIFIER** | `native_commit.rs`, `scientific-native-transport.test.cjs`, `Audit/REPRISE-TRAVAUX.md` |

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


### Lot M15-19 — 2026-11-10 — Analyse native forensic des commits de sonde

- **Nouveau module Rust réel :** `native-windows-guard/src/probe_forensic.rs`, commande read-only `--inspect-probe`, rapport JSON borné (100 noms par catégorie), classification des dossiers en attente/vérifiés/corrompus, statut du verrou et refus des dossiers/jonctions suspects.
- **Réutilisation des handles natifs :** relecture du transport par `scientific_envelope::load_verified`, validation du manifeste par `open_pinned` et `bounded_json`, sans charger une cible reparse.
- **Quatre tests Windows ajoutés :** racine vide sans mutation ; commit confirmé puis manifeste falsifié ; trois crashs réels avec verrou orphelin ; jonction refusée. Intégration dans le workflow Desktop existant, aucun workflow ajouté.
- **Statut initial :** `IMPLÉMENTÉ — CI DU HEAD FINAL À QUALIFIER`. Ne pas transférer la CI verte de M15-18 à M15-19 ; confirmer Framework, Documentation et Desktop Chromium Windows.
- **Risque résiduel :** forensic non atomique ; sortie non utilisable pour éliminer le verrou, promouvoir un candidat ou relancer automatiquement. Aucune garantie power-loss et aucune certification scientifique du marqueur `sdk_validated`.
- **Prochaine décision :** P0 `REC-01` reste bloqué jusqu'à un workflow de récupération opérateur indépendant et testé ; `SEC-WIN-01` exige un writer scientifique résistant aux races. PR #114 **DRAFT**, aucune fusion ni publication Store.


### Lot consolidé M15-18/M15-19 — sécurisation NTFS, confinement synthétique et forensic

**Vérifications et réalisations concrètes de cette itération :**

- **Protection native des ancêtres :** `native::inspect_pinned()` conserve désormais les handles de **tous les répertoires du chemin**, de la racine du volume jusqu'au dossier ciblé, au lieu de les relâcher après le précontrôle. `VerifiedTransport` détient cette chaîne côté source jusqu'à la fin du writer, et `native_commit` détient celle de la destination pendant l'écriture/renommage de sonde.
- **Test de concurrence NTFS réel :** un processus Windows tente de renommer à la fois un parent de la source et un parent de la destination pendant l'opération ; les deux substitutions sont refusées. Ce test a été **vert dans le job Windows** du lot, avant l'étape forensic.
- **Confinement accidentel de la sonde :** `synthetic_transport_commit` refuse désormais les corpus hors du profil `synthetic-history` / namespace `SYNTHETIC_HISTORY`, y compris lorsqu'une enveloppe a été recomposée avec un SHA des octets cohérent. Test Windows **vert**. Cette vérification par profil **n'est pas** une signature cryptographique et n'autorise aucun corpus réel.
- **Forensic natif M15-19 :** nouveau diagnostic read-only Windows après interruption, avec inventaire des dossiers et du verrou de sonde, classification des transactions incomplètes, finales et invalides, sans récupérer ni supprimer. Le premier run du lot a échoué sur une **divergence entre le schéma de sortie du CLI et les assertions des tests** ; les corrections doivent être validées sur le HEAD final, sans confondre cet échec avec les tests de handles déjà verts.

**Gate de clôture :** dernière PR HEAD en brouillon, les trois workflows Framework / Documentation UI / Desktop Foundation tous `success` sur **le même SHA**. Le test forensic et les tests Windows de source/destination doivent être inclus. Les tâches `SEC-WIN-01`, `SCI-01`, `DUR-01` et `REC-01` demeurent **BLOQUÉES** pour production, notamment par le manque d'attestation du consentement humain, le renommage absolu, l'absence de preuve power-loss et de procédure de récupération opérateur.

**Travaux prioritaires restants pour le prochain gros lot :** (1) sécurisation du protocole d'intention/consentement dans le hôte de confiance ; (2) vrai writer scientifique natif sans dérogation aux garanties de journal/empreintes/double consentement ; (3) tests NTFS adversariaux et interruptions OS ; (4) workflow de récupération humaine sans promotion automatique ; (5) qualification de distribution Windows réelle. Aucun `main`, release ou Store modifié.


#### M15-19 — Rectification de qualification et déduplication (2026-11-10)

- L'itération a révélé une modification concurrente de la branche : `probe_inventory.rs` exposait déjà `--inspect-probe`. La nouvelle implémentation `probe_forensic.rs` faisait doublon et son JSON incompatible a provoqué **4 échecs de tests Windows** (première CI du lot). Cette duplication n'était pas une nouvelle fonction à conserver.
- **Correction :** suppression de `probe_forensic.rs`, de la suite redondante `native-probe-forensic.test.cjs` et de son exécution CI ; restauration d'un seul branchement CLI vers l'inspecteur `probe_inventory.rs` et de son contrat `tempora-native-probe-inventory-v1`.
- **Gain sécurité effectif :** `probe_inventory.rs` lit maintenant le manifeste avec `open_pinned` et `bounded_json` plutôt qu'avec `symlink_metadata` suivi de `File::open` ; refus du suivi de liens, handles Windows conservés et lecture bornée.
- **Tests complémentaires conservés :** manifeste finalisé falsifié → `unsafe_entries` ; 101 dossiers candidats → refus sans nettoyage. Les tests existants de crash et de preuves restent exécutés une seule fois.
- **Qualification :** changement implémenté ; attendre trois workflows **SUCCESS** sur le HEAD final pour passer à TESTÉ-CI. Aucun gate P0 ne peut être clôturé sur ce seul résultat.


#### M15-19 — État final de consolidation après contrôle de cohérence GitHub

Le contrôle CI du HEAD `72ccf9b7` a révélé un second problème de branche : la commande du workflow faisait référence à `native-probe-inventory.test.cjs` alors que le fichier et le module Rust associé n'étaient plus présents dans cet arbre Git. Les autres tests Windows natifs et les suites Framework/Documentation étaient réussis ; l'échec est lié à la référence orpheline, pas à un échec de persistance scientifique.

**Correction finale :** restauration d'**un seul** `probe_inventory.rs` et de **sa seule suite** `native-probe-inventory.test.cjs`, avec branchement CLI unique, contrat JSON numérique stable, handles natifs pour les manifestes et le propriétaire du verrou, volume limité à 100 éléments, et essais de corruption/manifeste, commit synthétique, crash après renommage et dépassement de capacité. Le fichier concurrent `probe_forensic.rs` et les tests doublons restent supprimés. Le workflow existant appelle désormais un chemin présent.

**Statut : IMPLÉMENTÉ, CI DU HEAD DE CONSOLIDATION À VALIDER.** Pour toute conclusion, vérifier les trois workflows du SHA exact, en particulier la compilation Rust et les 5 tests Windows. Ne pas marquer SEC-WIN-01 / REC-01 / DUR-01 comme clôturés : le diagnostic reste consultatif et non atomique, sans pouvoir de reprise.


### M15-20 — 2026-11-10 — Sécurité pré-commit de la sonde + dossier de reprise autonome

- **BASE CI 100 % VERTE vérifiée avant développement** : `9a9a73835396f7471e5c112193aa3839acf49a9a`, runs Framework `42839244384`, Documentation UI `42839244084`, Desktop Foundation Windows Chromium NSIS `42839244460`.
- **Développement effectif** : `verify_staged_bytes` réouvre avec Win32 handles épinglés les 4 fichiers du **staging natif de sonde**, borne leurs lectures et les compare **bit à bit** aux données source validées avant leur visibilité par renommage. L'injection contrôlée `TEMPORA_NATIVE_TEST_CORRUPT_STAGED=1` simule une altération du journal *après* écriture ; le commit refuse le passage à `native-probe-complete/`.
- **Test d'intégration Windows ajouté** : vérifie le code `NATIVE_COMMIT_STAGED_MISMATCH`, préservation du verrou et du dossier de preuve partielle, absence de transaction scientifique et refus du rejeu automatique.
- **Capitalisation** : nouveau `Audit/REPRISE-TRAVAUX.md` à lire **en premier à chaque nouvelle fenêtre de chat**. Il contient l'inventaire exact du code, chemins, sécurité, consignes, commandes CI, IDs de runs validés, jalons et P0. Le registre et le CDC y renvoient. **Actualiser ces fichiers à chaque reprise.**
- **Statut du nouveau lot** : **IMPLÉMENTÉ ; TESTÉ-CI seulement après succès des trois workflows du SHA final**. La base verte citée ci-dessus ne qualifie pas ce lot.
- **P0 TOUJOURS NON CLOS** : SEC-WIN-01 (fenêtre de changement après la relecture / renommage absolu), SEC-WIN-02 (ACL et volumes), SCI-01 (consentement non authentifié), REC-01 (reprise humaine autorisée), DUR-01 (power-loss). Aucune activation de sauvegarde native scientifique ou Store.
- **Suite** : opération Windows réellement sécurisée contre les modifications après vérification jusqu'au commit ; authentification de l'intention de l'opérateur liée aux SHA et au SDK ; writer scientifique natif distinct de la sonde ; tests de panne OS/NTFS.


### Itération de préparation à la fusion et au Store 0.2.0 — 2026-11-10

- **Autorisation utilisateur :** fusionner le lot qualifié et préparer la mise à jour du Store, en gardant la soumission et la publication à **validation manuelle ultérieure**.
- **Base précédente vérifiée :** `6f5ca82029e8b01717d5c38b9734251095a7c9a7` (Framework `42846503555`, Documentation UI `42846503519`, Desktop Foundation `42846503497`, trois réussis).
- **Travaux :** candidat version `0.2.0` dans `apps/desktop/electron/package.json`, cible AppX x64 distincte de NSIS et identité officielle Microsoft ; `desktop-foundation.yml` construit le package Store sans publication, inspecte le manifeste et conserve l'artefact ; dossier [STORE-MISE-A-JOUR-0.2.0.md](STORE-MISE-A-JOUR-0.2.0.md) + [REPRISE-TRAVAUX.md](REPRISE-TRAVAUX.md) mis à jour.
- **Qualification du nouveau HEAD** : attendre la fin des trois workflows, notamment la construction AppX. Une CI verte sur le HEAD ancien ne suffit pas. N'attribuer la mention `STORE-CANDIDATE-READY` qu'après avoir effectivement vérifié le manifeste de l'artefact.
- **Fusion autorisée sous condition CI**, puis consigner le SHA final et le statut de `main`. **Aucune publication Store ni release GitHub**, aucun changement de sécurité des écritures packagées.
- **P0 non levés** : `SEC-WIN-01/02`, `SCI-01`, `REC-01`, `DUR-01`. Toute nouvelle fonctionnalité expérimentale après fusion doit être développée dans une nouvelle branche de PR.


### Clôture du lot Store et fusion — 2026-11-10 (audit post-fusion)

- **Statut GitHub :** PR #114 **MERGED** à 2026-11-10T16:23:57Z, merge SHA `3c2b7bb752538a8990dad88b1527b0a422c56ca5`. La protection de `main` impose désormais d'utiliser une PR pour modifier même un rapport ; notes post-fusion dans `docs/store-0-2-0-merge-audit`.
- **Qualification de la source de fusion :** SHA `5aca622e5a9346eccbca4d435e109704c8d09005`, **3 workflows success** : Framework `42853241876`, Documentation UI `42853242221`, Desktop Foundation `42853241862`.
- **Package Store Chromium 0.2.0 prêt comme candidat non publié :** AppX x64 archivé dans la CI ; Microsoft Identity/Publisher vérifiés par inspection de `AppxManifest.xml`. Artefact ID `13781238941`, nom `TEMPORA-Desktop-0.2.0-x64-STORE-CANDIDATE-NOT-PUBLISHED`, [run](https://github.com/MGhemri/tempora-framework/actions/runs/42853241862). La version GUI/preload et le lockfile sont synchronisés.
- **Aucune mise en production Store** : pas de soumission ni publication Partner Center ; test de migration depuis l'AppX `0.1.1-beta.2` et qualification d'installation propre restent requis. Liste complète dans [STORE-MISE-A-JOUR-0.2.0.md](STORE-MISE-A-JOUR-0.2.0.md).
- **Les P0 restent ouverts** : NTFS anti-TOCTOU, ACL/volumes, consentement authentifié, protocole de récupération humain, crash/power-loss. Writer natif/JS scientifique **toujours désactivé** dans tout package distribué.
- **Suivi après clôture :** les nouveaux développements M1.5 se font sur une **nouvelle branche issue de `main`**, en PR ; ne plus empiler les commits sur la branche fusionnée #114. Lire [REPRISE-TRAVAUX.md](REPRISE-TRAVAUX.md) avant toute reprise dans une autre fenêtre.

## Lot post-fusion 2026-11-10 — REC-01 observation de preuves cohérentes

- Nouveau garde `forensic-snapshot.cjs` : inventaire borné, sans suivi de
  lien symbolique, comparant identités de fichiers et timestamps entre les
  lectures d'un dossier de récupération. Son but est de détecter une
  substitution **même si les deux inventaires sont jugés valides**.
- `inspectCommittedIdentity` compare également les métadonnées avant/après
  et relit les manifestes des transactions correspondantes.
- Couverture de tests étendue aux modifications cohérentes de journal et
  manifeste et aux liens symboliques externes.
- Statut initial : **code proposé en PR, CI à vérifier au HEAD**, non
  homologué. Aucun nouveau workflow, release ni write packagé.
- **Toujours P0 ouverts :** autorité scientifique et autorisations hôte/Rust,
  anti-TOCTOU handle-relative, actions de récupération humaine et qualification
  après panne Windows OS/power-loss.

## TVRW J9 — carte de coordonnées interactive (lot 2026-11-10)

- **REC-01 :** PR #116 fusionnée sur `main` (merge `57cde355965324ed104559ff767c1c925dcee97f`),
  après Framework/Documentation/Desktop CI verts au HEAD `3f6166dd2ee5adad10fe51bb309ef4adc144e6d0`.
  Les P0 scientifiques/Windows restent ouverts.
- **TVRW J9 :** auto-ajustement géographique sur points déclarés, gestion de
  l'antiméridien, regroupements visuels, zoom/panoramique, tests déterministes,
  sans réseau ni données historiques inférées.
- **Qualification J9 :** code proposé sur branche dédiée ; vérifier les CI
  Framework, Documentation UI et Desktop Foundation au HEAD final avant fusion.
- **Suites :** carte vectorielle fondée sur jeux de données licites versionnés,
  hiérarchie des couches géographiques, ergonomie clavier/lecteur d'écran et
  essais Windows Sandbox ; l'API canonique v3 reste inchangée.
