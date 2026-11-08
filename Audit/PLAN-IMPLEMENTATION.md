# Plan d'implémentation et journal de travail

**Date de référence :** 2026-11-08. Les jalons ci-dessous expriment **un plan**, pas des fonctionnalités disponibles. Les corrections de sécurité sont prioritaires sur les améliorations de confort.

## Statuts actuels

| Lot | État | Référence / résultat | Étape suivante |
|---|---|---|---|
| TVRW J8C — installateurs Electron et exemples | **fusionné** | [PR #73](https://github.com/MGhemri/tempora-framework/pull/73), CI Windows verte | Qualification GUI Windows Sandbox indépendante |
| TVRW J8D — démonstrateur ALNOP v3 | **fusionné** | [PR #74](https://github.com/MGhemri/tempora-framework/pull/74) | Conservation explicite du statut non certifié |
| TVRW J8E — précontrôle de fichiers | **fusionné** | [PR #75](https://github.com/MGhemri/tempora-framework/pull/75) | Validation incrémentale future et analyse de races filesystem |
| AUD-05 — alias `event_type` | **fusionné** | [PR #76](https://github.com/MGhemri/tempora-framework/pull/76) | Aucun autre changement nécessaire sans nouveau cas |
| AUD-02 — revue `batch_id` | **spécifié / prioritaire** | [REGISTRE.md](REGISTRE.md) | PR fonctionnelle + tests de substitutions A/B + CLI |
| AUD-03 — verrou publication | **à implémenter** | [ANALYSE-PATCH-CLAUDE.md](ANALYSE-PATCH-CLAUDE.md) | Choix d'un protocole récupérable sûr |
| AUD-04 — authenticité/revue | **à concevoir** | [REGISTRE.md](REGISTRE.md) | Threat model + trust roots + signatures |
| ASSIST-M1 — CSV/XLSX détecter à prévisualiser | **CDC rédigé ; non codé** | [TEMPORA-ASSISTANT-CDC.md](TEMPORA-ASSISTANT-CDC.md) | Architecture + contrats/fixtures puis modules purs |

## ORDRE DES LIVRAISONS

### AUD-FIX-01 — Lier la revue au bon lot (P0)

**Dépendances :** `src/framework/ingestion.js`, `scripts/ingest-tempora.js`, `tests/framework-ingestion.test.js`, documentation CLI.  
**Actions :**
1. Introduire `review.batch_id` obligatoire et le comparer au `expected.report.batch_id` **recalculé**. Préférer un code d'erreur `REVIEW_BATCH_MISMATCH` distinct.
2. Définir le parcours CLI : l'utilisateur doit confirmer le `batch_id` affiché dans le rapport, ou une autre mécanique documentée garantissant une revue effective de CE lot ; pas de simple confiance dans le chemin de fichier.
3. Préserver `base_sha256`, empreintes du mapping et du contenu, journal `proposed` et caractère explicite de `--write`. Étudier si la réutilisation du `batch_id` à base différente doit être redéfinie : **ne pas modifier silencieusement les digests existants**.
4. Tests : refus A vs B à identifiants identiques, champ manquant, base stale, mapping modifié, sélection falsifiée ; compatibilité et CLI sur Linux + Windows.

**Terminé lorsque :** tous les tests + la CI sont verts et les décisions de revue ne sont plus réutilisables d'un lot vers un autre dans l'interface/CLI. Une identité déclarée ne vaut pas authentification cryptographique.

### ASSIST-00 — Architecture, tests et formats

- Fixer les frontières `tempora-format` pur, IO/Excel isolé, serveur web loopback et moteur d'ingestion v3 ; inventorier les dépendances et l'exposition publique.
- Définir contrats versionnés de détection, suggestions, normalisation, mapping assistant, quarantaine et aperçu ; garder les anciennes `schemas/tempora.ingestion-mapping.schema.json` 1.0.0 et hashes.
- Fixtures : CSV ambigu point-virgule/virgule, TSV multi-lignes, mois français, `12/03/1956`, `vers 1950`, zéros initiaux, XLSX multi-feuilles avec formules et valeurs manquantes, fichiers ZIP hostile, encodage invalide.
- CI exécutable indépendante du Desktop ; tests de déterminisme sans réseau.

### ASSIST-01 — Détection pure et adaptateurs bornés (M1.1)

- `sniff` et `inspect` purement déterministes, plus adaptateur CSV/TSV et lecteur XLSX en sandbox de parsing sans exécution de macros ni liens externes.
- Rapport en lecture seule : format, encodage, feuille, séparateur, cellules et colonnes candidates, diagnostic des cas ambigus ; budgets entrée et décompression.
- Tests fichiers inchangés, stabilité des prédictions Windows/Linux, dates Excel, erreurs cellules fusionnées.

### ASSIST-02 — Mapping manuel confirmé (M1.2)

- Éditeur deux colonnes, suggestions par règles de noms/types, affichage de la raison et de la version, contrôle de chaque association par l'utilisateur.
- Export d'un mapping versionné **compatible via compilateur** avec ingestion 1.0.0, schéma de mapping assistant pour capacités supplémentaires.
- Tests de conservation des noms de colonnes et des pointeurs ; refus des chemins réservés / tentative d'injection.

### ASSIST-03 — Normalisation explicite (M1.3)

- Règles de listes, dates exactes ou granuleuses, coordonnées, alias de profil ; `vers 1950` en quarantaine sans politique de bornes.
- Original source+cellule intact, copie normalisée distincte, transformations versionnées et diagnostics audités.
- Golden vectors avant/après, dates bissextiles, valeurs ambiguës et fuseaux ; jamais d'interprétation historique.

### ASSIST-04 — Prévisualisation et rapport sans écriture (M1.4)

- Conversion déterministe de l'output `tempora-format` vers `prepareImport` ; vérifier les limites en vigueur et ne pas affirmer pouvoir traiter 100 000 lignes en production.
- Afficher créés / inchangés / conflits / quarantaine et source_path, feuille, cellule, raisons, profil et hachages.
- Tests absence totale de fichier créé avant approbation, mêmes résultats scientifiques et identité du lot à contextes égaux, isolation des sessions.

### ASSIST-05 — Acceptation et journal (M2)

- Geste explicite, décision humaine liée au `batch_id` corrigé par AUD-FIX-01, preuves affichées, sortie locale `proposed`.
- Versionnement du contrat de revue, absence de publication automatique, conservation des diagnostics et des quarantaines.

### ASSIST-ML — Suggestions IA hors du chemin critique (M3, différé)

- Module facultatif local `tempora-assist-ml`; seulement suggestions identifiées, hash/version de modèle, approbation manuelle ; aucun réseau implicitement, aucune auto-validation. Évaluer exactitude, hallucinations et reproductibilité **avant** activation.

## Autres correctifs de l'audit

| Lot | Objectif | Condition de départ |
|---|---|---|
| AUD-FIX-02 | Gestion du verrou : diagnostic `STORE_LOCKED`, puis récupération explicite sûre | Modèle de menace et tests multi-processus |
| AUD-FIX-03 | Authentification de publication par signature | Protocole cryptographique versionné + politique de clés |
| AUD-PERF-01 | Blocking algorithmique évolutif | Benchmarks synthétiques, plafond CPU/RAM, rappel des candidats mesuré |
| AUD-GEO-01 | Plafonds de sommets, robustesse de géométrie | Reproduction des faux négatifs de l'audit externe |
| AUD-PERF-02 | Catalogue API sans copie excessive | Contrat d'immuabilité étudié, benchmarks 1/10/32 Mio |
| AUD-FORMAT-01 | Listes CSV, dates floues | Intégré au lot ASSIST-03 via contrat versionné |
| AUD-PORT-01 | Racines du store sur macOS | CI ou validation macOS avec chemins système |
| AUD-API-01 | Pagination HTTP et `limit` | Documentation de curseur avant évolution de contrat |

## Définition du « terminé »

- Tests positifs **et adversariaux** sur code livré ; revue des diff et documentation en dépôt.
- Compatibilité Windows/Linux et Desktop si applicable ; pas de nouveau workflow permanent sans justification.
- Données originales non altérées, hachages et versions préservés, provenance visible.
- Les sorties de l'assistant et les analyses restent `proposed` / candidates ; la décision humaine est documentée, la signature seulement si une authentification réelle existe.
- Le dossier `Audit/` est mis à jour dans la même PR clôturant un constat (statut, version, références, résultats, limites).
