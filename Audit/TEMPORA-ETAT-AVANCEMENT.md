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
| HEAD de référence précédent | `5aa3970a246817c3256d679d3ddbb5e42b3108d7` | Dernière base entièrement qualifiée au début du rapport |
| Framework sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42755173090 |
| Documentation UI sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42755172936 |
| Desktop Foundation sur ce SHA | **TESTÉ-CI : succès** | https://github.com/MGhemri/tempora-framework/actions/runs/42755172931 |
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

## 3. Backlog de qualification — priorités et conditions de fermeture

| ID | Priorité | Statut | Action requise | Preuve nécessaire pour cocher |
| --- | --- | --- | --- | --- |
| SEC-WIN-01 | **P0** | BLOQUÉ | I/O Windows natif fondé sur handles, ouverture sans suivi de reparse points, handles de répertoires, renommage protégé contre substitutions après contrôle | Tests adversariaux sur NTFS réel : jonctions, symlinks, remplacement concurrent, traversées parent, ACL ; revue de code |
| SEC-WIN-02 | **P0** | BLOQUÉ | Politique de support disques locaux / volumes mappés / SMB / UNC / dispositifs, ACL et permissions de dossier | Test sur machine Windows et matrice des systèmes de fichiers ; refus fermé des cibles non qualifiées |
| DUR-01 | **P0** | BLOQUÉ | Durabilité après arrêt brutal de l'OS, perte électrique, reboot et flush des répertoires/volumes | Essais sur machine ou VM instrumentée ; aucune affirmation à partir du seul `process.exit()` |
| REC-01 | **P0** | BLOQUÉ | Procédure contrôlée de récupération **humaine**, preuve préalable, revue des verrous/candidats, journal des actions et vérification post-opération | Scénarios de recovery reproductibles, absence de promotion automatique, validation opérateur |
| SCI-01 | **P0** | BLOQUÉ | Qualification complète du parcours scientifique et des signatures/reviewer dans le modèle v3 ; identité déclarative ≠ authentification | Tests d'intégrité, provenance et revue du contrat scientifique |
| GUI-01 | **P1** | EXPÉRIMENTAL | Qualification UX/IPC des deux décisions, annulation, sessions expirées, reprise et états d'échec | Tests sur build Windows installé ; aucune mutation sans double consentement |
| PACK-01 | **P1** | BLOQUÉ | Installation propre, démarrage hors ligne, exemples, permissions Windows, mise à jour Store compatible | Tests manuels/automatisés sur installateurs signés et chemins Windows pris en charge |
| CI-01 | **P1** | EN COURS D'AMÉLIORATION | Réduire l'exécution redondante et éviter le redémarrage des workflows par micro-commits | Couverture maintenue, durée mesurée sur lots comparables ; zéro gate supprimée |
| PERF-01 | P2 | À FAIRE | Benchmarks reproductibles corpus synthétiques, mémoire, temps d'inventaire, volume élevé, p95 | Budget fixé, données et méthode de mesure versionnées |
| DOC-01 | P1 | **RÉCURRENT** | Mettre à jour ce rapport et le runbook à chaque itération | HEAD, statut des trois CI, tâches modifiées et risques résiduels consignés |

**Interdits tant que P0 ouverts :** activation du write IPC en package de production, nettoyage automatique de `.writer-lock`, promotion automatique de `.pending`, récupération par heuristique PID, écrasement du corpus original, publication scientifique implicite, fusion de la PR expérimentale.

## 4. Découpage des lots recommandés

**Lot A — prochain (sécurité diagnostique, sans écriture) :** vérifier le comportement fail-closed des inventaires en cas d'écriture concurrente, améliorer les rapports d'erreur sans divulguer de chemins, et ajouter les tests Windows/Linux ; actualiser les preuves.

**Lot B — fondation native Windows :** concevoir et qualifier une couche privilégiée Rust/Windows avec contrôle des handles, reparse points, volumes et ACL ; maintenir un fallback JS **en refus d'écriture** pour environnements non qualifiés.

**Lot C — durabilité et recovery humain :** injecter des pertes d'énergie et crash OS sur NTFS instrumenté, définir une transaction recoverable manuellement, consigner consentement et provenance ; ne pas déduire les garanties d'une seule CI.

**Lot D — qualification de distribution :** installateurs sur postes Windows propres, upgrade, tests hors ligne, rapports de sécurité, décision de fusion et release uniquement une fois les gates P0 levées.

## 5. Historique des itérations — append-only logique

| Date | Référence | Travaux et constat | Qualification / décision |
| --- | --- | --- | --- |
| 2026-11-10 | `5aa3970a` | Six scénarios de perte de processus, déduplication des suites Ubuntu et mise à jour audit | **3 workflows verts**, M1.5 toujours expérimental |
| 2026-11-10 | Mise en place de `TEMPORA-ETAT-AVANCEMENT.md` | Création du registre central ; liste P0/P1/P2, critères de sortie et protocole de suivi | Dépend de la CI du nouveau HEAD (à remplir à chaque passage) |

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
