# Registre priorisé des constats de l'audit externe

Source primaire : retour d'audit de Claude communiqué le 2026-11-08 et patch `tempora-audit-fixes.patch` fourni par le mainteneur. Les chiffres de performance sont des **mesures rapportées par l'auditeur**, non des benchmarks indépendamment reproduits dans la CI de ce dépôt. La vérification interne a inspecté notamment `src/framework/{analysis,ingestion,ingestion-mapping,ingestion-formats,publication-store,published-catalog,publication}.js` et `scripts/ingest-tempora.js`.

Légende : **confirmé dans le code** = comportement directement visible ; **rapporté** = reproduction externe non encore redoublée ; **spécifié** = solution définie mais non livrée ; **corrigé** = PR fusionnée avec CI verte.

| ID | Priorité | Constat / portée | Statut au 2026-11-08 | Décision et test de sortie |
|---|---|---|---|---|
| AUD-01 | P2 | Analyse de similarité à fort coût : trigrammes partagés, explosion des candidats (`max_pairs` 200 000 par défaut, 1 000 000 maximum). | Algorithme confirmé ; mesures 800–1 780 événements **rapportées** | Benchmark synthétique 100/1k/10k et mémoire/temps ; expérimenter blocages rares sans perdre silencieusement les candidats ; conserver métriques de rappel et traçabilité des exclusions. |
| AUD-02 | **P0** | `acceptImport` vérifie le bundle recalculé mais n'exige **pas** que `review` cite son `batch_id`. Une décision portée d'un lot vers un autre est possible si IDs sélectionnés identiques. | **Corrigé / CI validée — PR #78 fusionnée** | Exiger `review.batch_id === expected.report.batch_id` ; mettre à jour CLI `accept --batch-id` ou explicitement lier la décision au lot lu, avec contrat traçable ; tester permutation A/B, entrée absente, valeur erronée, compatibilité/migration de contrat. Ne pas imposer une validation humaine fictive depuis la GUI. |
| AUD-03 | **P1** | `.promotion-lock` obtenu via `openSync('wx')`, aucun protocole de reprise après crash. | **Correctif diagnostic en PR ; récupération non implémentée** | Ne pas supprimer sur seul PID : risques de réutilisation de PID, perte de lien, concurrence, volume partagé. Étudier lock propriétaire + jeton aléatoire + machine + horodatage et reprise explicite contrôlée ; test crash, double processus et export/rollback ; documenter Windows/macOS. |
| AUD-04 | **P1** | `requireOperator` utilise des identifiants déclaratifs ; `verifyPublicationArtifacts` vérifie l'intégrité interne et non l'authenticité d'un signataire. | **Confirmé dans le code** | Définir contrat de signature détachée Ed25519 (ou alternative examinée) sur hash canonique + journal, politique de clés de confiance et révocation ; garder les données lisibles hors-ligne ; tests de falsification, rotation et refus de clés inconnues. Ne pas appeler la sortie actuelle « authentifiée ». |
| AUD-05 | P2 | Alias `event_type` et couverture bloqués sur la clé `event_types` même quand le profil déclare une autre taxonomie. | **Corrigé / CI validée** | [PR #76](https://github.com/MGhemri/tempora-framework/pull/76) fusionnée : résolution via règle `event_type`, repli rétrocompatible et régression `types_evenement`. |
| AUD-06 | P2 | Contrôle d'auto-intersection des polygones potentiellement quadratique et non borné par nombre de sommets. | **Rapporté ; à profiler** | Fixer des budgets par anneau/polygone après audit du schéma et du validateur ; échec explicite, aucun tronquage ni réparation silencieuse ; tests 8k/50k et complexité. |
| AUD-07 | P1/P2 | Fragilité des prédicats géométriques en flottants pour contacts/échelles extrêmes. | **Rapporté ; à reproduire** | Jeux de tests dégénérés et transformations d'échelle ; décider prédicats exacts/adaptatifs ou tolérance documentée, sans inférer de géométrie historique ; comparer stabilité. |
| AUD-08 | P2 | `published-catalog.resolve` recopie le snapshot à chaque appel. | **Confirmé dans le code ; optimisation différée** | Le patch externe `deepFreeze + resolve() -> référence` change les garanties de mutabilité et peut exposer le cache à des objets inattendus. Mesurer 1/10/32 Mio, évaluer retour sélectif/de petites projections ou immutabilité explicitement contractualisée et testée. |
| AUD-09 | P2 | La conversion de cellules CSV multi-valeurs n'est pas paramétrable : une chaîne contenant une virgule peut rester une seule valeur. | **Confirmé dans le code** | Ajouter `list_separator` **explicite et versionné** dans le mapping de TEMPORA Assistant ; tenir compte du quoting CSV, de l'échappement et des cellules vides ; préserver la chaîne originale. |
| AUD-10 | P2 | Contrôle `safeDirectory` strict : racine de stockage résolue à travers un lien symbolique rejetée, pouvant impacter des emplacements macOS. | **Confirmé dans le code, impact macOS non vérifié** | Reproduire avec chemins macOS réels et symlinks légitimes ; distinguer vérification des répertoires sensibles et liens système ; éviter un relâchement général de la frontière du store. |
| AUD-11 | P3 | Changer la valeur `limit` en cours de pagination API peut donner HTTP 409. | **Comportement rapporté** | Documenter la stabilité du curseur et la nécessité de recommencer la pagination ; évolution optionnelle si exigences UX ; préserver le contrat existant. |

## Observations écartées / non-bugs

- Le traitement de payload sans `extensions` a été jugé correct par l'auditeur : absence de correctif requis sans nouvelle preuve.
- L'ordre des clés dans le hash canonique est intentionnel et documenté dans `CANONICAL_MODEL.md` ; ne pas le remplacer silencieusement par RFC 8785 : cela modifierait les empreintes de référence, les versions publiées et les vecteurs de test.
- Un fuzz HTTP de 60 000 requêtes sans réponse 500 est **rapporté** ; ne constitue pas une preuve d'absence de vulnérabilité.

## Autres zones non couvertes par l'audit externe

L'auteur externe signale ne pas avoir parcouru `apps/desktop`, `compatibility/alnop`, l'ensemble des schémas et les workflows GitHub. Les tests Desktop et les vérifications ALNOP existent mais un **audit de sûreté spécifique** reste à mener (IPC, Tauri/Electron, packaging, WebView, chemins, provenance, Windows Store, AI éventuelle). Ces points ne doivent pas être comptabilisés comme audités par Claude.

## Correctifs et gouvernance

Les corrections existantes PR #73–#76 ont été fusionnées avec leur CI ; elles ne valent pas clôture des AUD-01–04 ou AUD-06–11. L'initiative `ASSIST` est définie séparément dans [TEMPORA-ASSISTANT-CDC.md](TEMPORA-ASSISTANT-CDC.md) et son suivi dans [PLAN-IMPLEMENTATION.md](PLAN-IMPLEMENTATION.md).

## Suivi correctif AUD-02 (2026-11-08)

La [PR #78](https://github.com/MGhemri/tempora-framework/pull/78) a été fusionnée (commit `215479e83d80352eb193543f862da689cb1fc788`) : `acceptImport` exige désormais `review.batch_id` égal à l'identifiant recalculé, et la CLI demande `--batch-id` explicite. Le contrat CLI change intentionnellement ; l'ancien appel sans ID doit être rejeté. Les tests de substitution A/B à identifiants identiques, d'absence et de modification de l'ID ont été ajoutés. **Clôturé côté liaison au lot** après CI Linux/Windows ; l'identité de reviewer reste déclarative tant que AUD-04 n'est pas livré.

## AUD-03 — garde-fou de diagnostic (en cours)

La branche `fix/aud-03-publication-lock-diagnostics` ajoute un code d'erreur `STORE_LOCKED` lors de la présence de `.promotion-lock`, sans modifier ni effacer le verrou trouvé. Un test de contention vérifie ce fail-closed et la possibilité de réutiliser le store après nettoyage **explicite par le propriétaire de la fixture**. Ce n'est **pas** une récupération automatique après crash ; celle-ci nécessite un protocole multi-processus séparé et des essais Windows/macOS avant clôture de AUD-03.

## Rapport Antigravity complémentaire (commit a07f2ec)

Un second audit externe a été fourni le 2026-11-08 : voir [ANTIGRAVITY-2026-11-08.md](ANTIGRAVITY-2026-11-08.md) pour les constats **AG-01 à AG-07**, leur confrontation avec le `main` réel et les travaux programmés. Le défaut de quarantaine CR/LF et les suites Assistant absentes de `test:core` ont **déjà été corrigés dans la PR #91**. L'écart `desktopVersion` du preload est traité dans une nouvelle PR et **ne modifie pas rétroactivement l'installateur bêta 3 déjà publié**. Les alias ALNOP du noyau, les locales par défaut et les fallbacks Desktop restent à traiter en lots distincts.


## ASSIST-M1.1d — Contrôle du lecteur de cellules XLSX

[Issue #98](https://github.com/MGhemri/tempora-framework/issues/98) : chantier P1 en cours, non assimilé à une certification de sécurité. Les plafonds XML de 512 Kio de la PR #91 restent en vigueur malgré la proposition Antigravity à 16 Mio par XML. Contrôles obligatoires : formules jamais exécutées, caches non vérifiés, dates candidates, sélection explicite de feuille, contenu original immuable, erreurs contrôlées, CI Linux/Windows. Statut : **branche de développement ; fusion et qualification à confirmer**.


## Clôture ASSIST-M1.1d — 2026-11-08

[PR #99](https://github.com/MGhemri/tempora-framework/pull/99) fusionnée en `main` (`30ce4f65701debb7e77118c88135afced5df37d9`). Les contrôles Linux/Windows, navigateur, ALNOP minimal, hygiène Git et Snyk ont réussi. [Issue #98](https://github.com/MGhemri/tempora-framework/issues/98) close. Inspection de cellules XLSX uniquement, sans importer ni évaluer de formules ; suivi du GUI dans [issue #100](https://github.com/MGhemri/tempora-framework/issues/100). Les mentions précédentes « en cours » sont historiques et remplacées par ce statut de clôture.


## Suivi ASSIST-IPC-01 — Sessions natives sans privilèges renderer

[Issue #100](https://github.com/MGhemri/tempora-framework/issues/100) : première PR IPC Electron à qualifier. Risques contrôlés : fuite de chemins, réutilisation de sessions expirées, modification du fichier entre ouverture et sélection de feuille, archive XLSX hostile, introduction involontaire de nouvelles entrées IPC. Tests sur fichiers synthétiques, sélection native et ressources empaquetées obligatoires avant clôture. **Le travail GUI et le pont Tauri restent ouverts.**
