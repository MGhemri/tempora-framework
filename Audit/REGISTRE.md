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

 
## Git hygiene — one-shot cleanup (2026-11-08)

Suite à la fusion de la PR #103, audit explicite des anciennes branches documentaires. Trois branches sont des reliquats de PRs déjà fusionnées via *squash* (les différences de commit ne prouvent pas du travail encore absent) :

- `docs/audit-assistant-m1-status` : PR #88 fusionnée, SHA `25540e55cc45f656c240eae9daa9db72d8f4d3ae`.
- `docs/audit-close-ag03-ag04-ag06` : PR #97 fusionnée, SHA `919bcb407d3f3826a2dea0f54eae216bd8ae3588`.
- `docs/audit-close-assist-m11d` : PR #101 fusionnée, SHA `fa79ba179da321f03568b877e57cfb2c502c0218`.

**Suppression conditionnelle, non encore acquise au moment de la rédaction :** réutiliser `validate-framework.yml` plutôt que créer un workflow permanent, après intégration de la PR de nettoyage sur `main` déclenchée par le marqueur `[branch-hygiene-setup]`. Le script exige PR effectivement fusionnée, propriétaire du dépôt, identité de branche et SHA de tête exact, aucun usage par une PR ouverte, branche non protégée, relecture atomique du SHA avant suppression. Préserver `release/enable-npm-publishing` (travail distinct) et `main`. Confirmer les résultats du workflow avant d'annoncer la suppression.


### ASSIST-M1.2d — Garde-fous confirmation CSV (suivi en PR)

Vérifier jeton éphémère, absence d'auto-acceptation, contrôle des associations dans le processus principal, invalidation si source/profil/choix change, compilation uniquement CSV, blocage Excel, erreurs stables et absence d'écriture. La conformité au mapping d'ingestion ne constitue pas une validation scientifique. **Statut : en validation, pas de release.**


### ASSIST-M1.3b — Normalization dry-run, risque de confusion avec la validation scientifique

La nouvelle prévisualisation est uniquement technique, plafonnée à 64 lignes, avec résultats `normalized/quarantined/unconfigured`. Aucun `acceptImport` ni `prepareImport` n'est appelé : ne pas présenter ces statuts comme les statuts canoniques de l'ingestion. Les transformations non explicitement choisies restent `unconfigured`. Invalidation obligatoire des confirmations et du dry-run lors de toute nouvelle proposition, modification de source ou expiration de session. **À qualifier par CI ; pas de release.**


### ASSIST-M1.4a — Source et corpus existant, sans acceptation

Décision de sécurité : preview canonique calculé par le seul moteur TEMPORA 3.0.0. Le renderer ne reçoit que le rapport résumé et les premiers diagnostics ; pas de candidate, pas de bundle, pas de jeton d'acceptation. Limites worker 4 Mio / réponse 256 Kio, source 128 Kio, corpus 2 Mio. Tous les fichiers sont sélectionnés dans des dialogues natifs et l'entrée source est revérifiée. Le résultat reste un aperçu technique, non une décision historique. Tests adversariaux (protocole strict, profil, replay, digest, absence de mutation) et empaquetage requis avant fusion.


### ASSIST-M1.4b — Revue humaine provisoire, aucune persistance

Vérifications obligatoires : sélection individuelle non précochée, identité + motif + date UTC, jeton de revue non rejouable, relecture empreintes source et corpus, refus des conflits/quarantaines, refus des aperçus tronqués, SDK `ingestion.accept` isolé en mémoire, aucune écriture réseau/disque, journal et résultat clairement étiquetés comme **simulation**. Tests réels sur worker Windows empaqueté exigés. Pas de release.


### CI Windows Electron — blocage externe HTTP 504 lors de l'assemblage (2026-11-09)

La PR #110 a subi deux exécutions de packaging Electron NSIS interrompues par `Response code 504 (Gateway Time-out)` après le téléchargement d'Electron, avant l'étape de smoke-test du worker empaqueté. Une reprise automatique strictement limitée aux erreurs réseau transitoires (3 tentatives) a confirmé un **blocage réseau persistant**. Ne pas déclarer le packaging qualifié ni fusionner la PR tant que cette étape est rouge. Ne pas désactiver `signAndEditExecutable`, les vérifications d'intégrité ou les validations de ressources pour forcer la réussite.

**Mesure compensatoire de diagnostic :** exécuter les tests du worker TEMPORA et la simulation de revue sur le runtime Node 3.0.0 effectivement préparé pour l'installateur, **avant** `electron-builder`. Cela distingue une erreur scientifique/IPC du téléchargement d'outillage Windows, mais ne remplace pas la recette de l'installateur complet. Préserver la branche tant que la PR n'est pas fusionnée.


### Qualification Windows — incident externe GitHub Releases HTTP 504 (2026-11-09)

Lors de la nouvelle campagne de tests M1.4b (PR #110), **Tauri NSIS** a échoué sur `https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.13/nsis-3.13.zip` avec `http status: 504` après compilation réussie de l'exécutable Rust. Le packaging **Electron NSIS** rencontre simultanément des `Response code 504 (Gateway Time-out)` lors du téléchargement des outils de traitement des exécutables. Il s'agit de dépendances externes de construction ; aucune erreur propre au code Assistant n'a été établie par ces échecs.

Le smoke-test séparé ajouté au job Electron exécute avec succès les tests de revue humaine sur le **runtime Node 3.0.0 Windows réellement mis en place** avant le packaging. Cette réussite ne remplace pas le contrôle des ressources du **paquet Electron final**, encore inaccessible tant que le téléchargement échoue. **Décision : PR ouverte, pas de fusion, branche conservée, pas de release**, et relance de CI lorsque la disponibilité des releases GitHub est rétablie. Éviter tout miroir non vérifié et toute désactivation des protections de packaging.
