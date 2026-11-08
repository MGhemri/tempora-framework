# Plan d'implémentation et journal de travail

**Date de référence :** 2026-11-08. Les jalons ci-dessous expriment **un plan**, pas des fonctionnalités disponibles. Les corrections de sécurité sont prioritaires sur les améliorations de confort.

## Statuts actuels

| Lot | État | Référence / résultat | Étape suivante |
|---|---|---|---|
| TVRW J8C — installateurs Electron et exemples | **fusionné** | [PR #73](https://github.com/MGhemri/tempora-framework/pull/73), CI Windows verte | Qualification GUI Windows Sandbox indépendante |
| TVRW J8D — démonstrateur ALNOP v3 | **fusionné** | [PR #74](https://github.com/MGhemri/tempora-framework/pull/74) | Conservation explicite du statut non certifié |
| TVRW J8E — précontrôle de fichiers | **fusionné** | [PR #75](https://github.com/MGhemri/tempora-framework/pull/75) | Validation incrémentale future et analyse de races filesystem |
| AUD-05 — alias `event_type` | **fusionné** | [PR #76](https://github.com/MGhemri/tempora-framework/pull/76) | Aucun autre changement nécessaire sans nouveau cas |
| AUD-02 — revue `batch_id` | **fusionné / CI verte** | [PR #78](https://github.com/MGhemri/tempora-framework/pull/78) | Conserver la revue explicite dans TEMPORA Assistant M2 |
| AUD-03 — verrou publication | **à implémenter** | [ANALYSE-PATCH-CLAUDE.md](ANALYSE-PATCH-CLAUDE.md) | Choix d'un protocole récupérable sûr |
| AUD-04 — authenticité/revue | **à concevoir** | [REGISTRE.md](REGISTRE.md) | Threat model + trust roots + signatures |
| ASSIST-M1 — CSV/XLSX détecter à prévisualiser | **CDC rédigé ; non codé** | [TEMPORA-ASSISTANT-CDC.md](TEMPORA-ASSISTANT-CDC.md) | Architecture + contrats/fixtures puis modules purs |

## ORDRE DES LIVRAISONS

### AUD-FIX-01 — Lier la revue au bon lot (P0 — terminé, PR #78)

**Dépendances :** `src/framework/ingestion.js`, `scripts/ingest-tempora.js`, `tests/framework-ingestion.test.js`, documentation CLI.  
**Actions :**
1. Introduire `review.batch_id` obligatoire et le comparer au `expected.report.batch_id` **recalculé**. Préférer un code d'erreur `REVIEW_BATCH_MISMATCH` distinct.
2. Définir le parcours CLI : l'utilisateur doit confirmer le `batch_id` affiché dans le rapport, ou une autre mécanique documentée garantissant une revue effective de CE lot ; pas de simple confiance dans le chemin de fichier.
3. Préserver `base_sha256`, empreintes du mapping et du contenu, journal `proposed` et caractère explicite de `--write`. Étudier si la réutilisation du `batch_id` à base différente doit être redéfinie : **ne pas modifier silencieusement les digests existants**.
4. Tests : refus A vs B à identifiants identiques, champ manquant, base stale, mapping modifié, sélection falsifiée ; compatibilité et CLI sur Linux + Windows.

**Résultat :** tests Linux/Windows réussis et correction fusionnée dans `main`. Terminé lorsque : tous les tests + la CI sont verts et les décisions de revue ne sont plus réutilisables d'un lot vers un autre dans l'interface/CLI. Une identité déclarée ne vaut pas authentification cryptographique.

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


## ASSIST-M1.1a — Inspection CSV/TSV pure, sans import (PR en cours)

Le module privé `src/framework/assist-inspection.js` lit **uniquement un échantillon d'octets déjà transmis**, de maximum 64 Kio. Il vérifie UTF-8/BOM et NUL, compare des candidats virgule/point-virgule/tabulation en respectant les champs entre guillemets et les retours à la ligne, puis produit une suggestion traçable ou signale une ambiguïté ; même en cas de suggestion unique, `selected_delimiter` demeure `null` en attendant l'utilisateur.

Il ne lit pas de chemin, ne déduit aucun type historique, ne parse pas un classeur Excel, n'ajoute aucun mapping confirmé, ne modifie pas les octets originaux et ne crée aucune prévisualisation canonique. Il ne remplace pas le parseur d'ingestion ni le futur `tempora-format` autonome : ce jalon est un prototype pur et extractible, couvert par des tests de reproductibilité et d'entrées hostiles.

**Statut :** prototype pur M1.1a fusionné et CI Linux/Windows verte — [PR #84](https://github.com/MGhemri/tempora-framework/pull/84). Il ne constitue toujours pas une fonctionnalité de l'interface.

## ASSIST-M1.3a — Règles pures de dates et de listes (PR en cours)

Le module privé `src/framework/assist-normalization.js` traite des **cellules préalablement décodées**, sans I/O ni effet de bord. L'utilisateur doit fournir une règle versionnée (`DD/MM/YYYY`, `FR_MONTH_YEAR`, `CIRCA_YEAR` avec `year_radius` explicite, ou séparateur de liste `;`, `,`, `|`). La sortie contient les octets textuels originaux, une proposition de bornes calendaires ou un tableau de chaînes ; aucune date ou liste n'est validée tacitement par ingestion v3.

Les mois français exacts conservent la précision `month` et les années bissextiles ; `vers 1950` reste en quarantaine sans politique d'approximation explicite. Un rayon d'années défini par l'utilisateur produit une **plage qualifiée d'approximative**, jamais une date exacte. Formats incompatibles, cellules vides, chaînes ambiguës et valeurs invalides demeurent en quarantaine avec code stable. Tests sur des données fictives ; **prototype non relié au mapping, à `prepareImport`, au Desktop ni à une acceptation humaine**.

**Statut :** prototype pur M1.3a fusionné, CI Linux/Windows verte — [PR #87](https://github.com/MGhemri/tempora-framework/pull/87). La fonction reste privée, sans GUI ni import automatisé. Aucune élévation de capacité des corpus et aucun changement du modèle canonique v3.

## Bilan des intégrations du 2026-11-08

- **Desktop** : [release `desktop-v0.1.2-beta.3`](https://github.com/MGhemri/tempora-framework/releases/tag/desktop-v0.1.2-beta.3) publiée après construction Electron NSIS, validation des exemples hors ligne et installation réelle en CI. Moteur npm embarqué `tempora-framework@3.0.0` ; pas de signature Windows ni certification Microsoft Store.
- **ASSIST-M1.1a** : [PR #84](https://github.com/MGhemri/tempora-framework/pull/84) fusionnée — inspection bornée CSV/TSV, sans inférence et sans écriture.
- **ASSIST-M1.3a** : [PR #87](https://github.com/MGhemri/tempora-framework/pull/87) fusionnée — dates explicites, précision mensuelle, année approximative sous politique de rayon confirmée, listes à séparateur confirmé et quarantaine.
- **Étapes encore nécessaires pour M1** : adaptateur Excel non exécutant, éditeur de mapping et contrats versionnés, prévisualisation réutilisant `prepareImport`, tests de parcours complet local. **Aucun assistant graphique complet n'est livré à ce stade.**


## ASSIST-M1.2a — Suggestions de mapping et compilation confirmée (PR en cours)

Le module privé `src/framework/assist-mapping.js` propose des correspondances entre **en-têtes explicitement fournis** et champs TEMPORA via une table de synonymes Unicode versionnée. Chaque proposition est étiquetée `suggested`, explique sa règle et reste **non sélectionnée** ; même une correspondance exacte ne vaut pas validation.

L'utilisateur doit fournir une liaison `confirmed_by_user` pour chaque champ retenu, avec le séparateur CSV également confirmé. Le compilateur produit un **`mapping.json` strictement conforme au contrat ingestion 1.0.0** (id, version, profil, champs avec JSON pointers échappés), sans introduire de clés incompatibles. Les titres localisés respectent les langues déclarées par le profil. Les en-têtes dangereux ou dupliqués, colonnes inconnues, champs hors schéma, conflits et validations manquantes sont rejetés par des codes stables. Des tests comparent la sortie à `checkMapping`, le validateur en place.

**Limites :** ceci n'est pas encore l'éditeur visuel à deux colonnes, ne lie pas automatiquement une inspection à une confirmation, ne traite pas XLSX, ne convertit pas dates/listes et ne valide pas un corpus ni sa provenance historique. Pas de réseau, fichier écrit, nouvelle API SDK ou modification du schéma canonique v3.

**Statut :** jalon M1.2a fusionné, CI Linux/Windows verte — [PR #89](https://github.com/MGhemri/tempora-framework/pull/89). Le mapping reste un noyau privé sans interface utilisateur.

## ASSIST-M1.4a — Parcours CSV de prévisualisation reproductible (PR en cours)

Un test d'intégration sur des données entièrement fictives relie **`inspectDelimitedSample` → `suggestColumnMappings` → confirmation humaine simulée par un choix explicite `confirmed_by_user` → `compileConfirmedCsvMapping` → `checkMapping` → `prepareImport`**.

Les assertions vérifient : aucun mapping provenant uniquement de suggestions, aucun effet de bord sur les octets source ou le corpus, empreinte de fichier, lignes source, diagnostic de date invalide en quarantaine, état `proposed`, et prévisualisation reproductible. Le test prouve **l'intégration des noyaux**, pas l'existence d'un éditeur visuel : ce parcours requiert aujourd'hui un appel programmatique aux fonctions privées, sans déploiement d'un serveur web ou de GUI.

**Statut :** test proposé, en attente de CI Linux/Windows et fusion.


## ASSIST-M1.1b — Inventaire structurel XLSX borné (PR en cours)

Un nouvel adaptateur privé `src/assist-io/xlsx-inventory.js` examine **en mémoire** les octets d'un conteneur XLSX pour identifier les feuilles de calcul et leur état `visible`, `hidden` ou `veryHidden`, sans accéder aux cellules et sans évaluer de formules. Il expose l'empreinte brute SHA-256, les noms de feuilles, les références OPC internes, les limites et un indicateur explicite `selected_sheet:null` tant qu'aucun choix humain n'a eu lieu.

Le lecteur ZIP est volontairement conservateur : plafond 16 Mio d'entrée et de taille totale annoncée après décompression, maximum 512 entrées, maximum 128 feuilles, 512 Kio par partie XML inspectée, rejet des archives chiffrées, ZIP64, data descriptors, chemins dangereux, doublons de parties, chevauchements, liens externes, macros, OLE, ActiveX et extensions exécutables. Les parties XML inspectées refusent DTD et déclarations d'entités ; elles ne sont pas chargées depuis le réseau. Tests adversariaux avec classeurs fictifs fabriqués en mémoire, CRC et décompression bornée.

**Limites importantes :** il s'agit d'un **inventaire de classeur**, pas encore d'un lecteur de lignes et de cellules Excel, ni d'un parseur XML/OPC généraliste certifié ; certains XLSX valides utilisant d'autres caractéristiques ZIP seront rejetés. L'adaptateur n'importe rien, ne modifie aucun fichier et ne compile pas de mapping canonique. L'inspection ultérieure des cellules devra être confiée à un parseur XML/OPC audité avec des limites propres et une politique explicite pour les résultats de formules et les dates sérialisées Excel. Le contrôle automatique des tests Assistant a également été ajouté à `npm run test:core` afin de rendre les régressions visibles dans la CI Linux/Windows et le checkout standalone.

**Statut :** implémentation proposée, soumise à CI et revue avant fusion.
