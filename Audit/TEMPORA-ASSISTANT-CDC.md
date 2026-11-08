# Cahier des charges — TEMPORA Assistant

**Version de conception :** 0.1.0 (2026-11-08)  
**Statut :** spécification, **non implémentée**  
**Principe :** pipeline local à 5 étapes, déterministe, l'humain décide, sources intactes.

> **Finalité.** Permettre à des historiens d'intégrer des fichiers hétérogènes à TEMPORA v3 sans devoir écrire un mapping technique à la main. L'assistant détecte et propose mais ne publie pas, ne corrige pas silencieusement et ne transforme jamais des suppositions en faits historiques.

## 1. Préconditions et existant vérifié

- `src/framework/ingestion.js` expose `prepareImport` (rapport et lot reproductible), `acceptImport` (mise en staging `proposed`) et `createWorkingCorpus`.
- `src/framework/ingestion-formats.js` comprend **CSV, JSON, GeoJSON** en UTF-8, contrôle de doublons de clés JSON, décodage strict, 16 MiB et 100 000 lignes au maximum pour la couche ingestion existante. **Excel, TSV de détection automatique et dates floues francophones ne sont pas livrés.**
- `schemas/tempora.ingestion-mapping.schema.json` est **1.0.0**, autorise `format` parmi `json`, `csv`, `geojson`, un `delimiter` CSV parmi virgule/point-virgule/tabulation, des `fields` à pointeurs JSON. Il n'offre ni `list_separator`, ni `date_formats`, ni `xlsx`.
- `scripts/ingest-tempora.js` offre `import`, `validate`, `accept` et l'option `--write`, mais **pas** `tempora assist` ni GUI d'assistance. `accept` ne demande pas actuellement le `batch_id` de l'avis du relecteur (AUD-02).
- Le précontrôle expérimental `apps/desktop/bridge/visualization/file-preflight.cjs` (J8E) est privé et **n'est pas** un moteur d'import Excel ou de validation incrémentale.

L'assistant doit **réutiliser** validation canonique v3, profils, règles de vocabulaire, bundles et rapports existants, pas créer un second modèle historique.

## 2. Pipeline et états

```text
Fichier original (octets immuables)
  │ SHA-256 brut, taille, chemin local sous contrôle natif
  ▼
S1 DETECTER ── rapport des hypothèses de structure, jamais de transformation
  │ l'humain confirme format / feuille / encodage / séparateur
  ▼
S2 MAPPER ── propositions traçables ↔ champs canoniques du profil
  │ l'humain confirme et versionne mapping.json
  ▼
S3 NORMALISER ── règles choisies, conversions déterministes
  │ cellules ambiguës → quarantaine avec source_path + raison
  ▼
S4 PREVISUALISER ── recomputation et rapport déterministe
  │ créations / identiques / conflits / quarantaines ; aucune écriture
  ▼
S5 ACCEPTER ── review.batch_id + hashes + sélection + identité déclarée
    sortie locale proposed ; jamais « published » sans revue scientifique séparée
```

### S1 — Détecter

Formats cibles : `csv`, `tsv`, `json`, `geojson`, `xlsx`. Les fichiers texte tabulés sont traités comme des données tabulaires **uniquement après** identification confirmée des colonnes. Fichiers `.xls` anciens : non pris en charge initialement. Fichier Excel avec macros `.xlsm` : **refusé au jalon 1** pour éviter toute exécution ou import ambigu. Aucune macro ne doit être exécutée.

- Détection UTF-8/BOM (incompatibilité explicite avec l'ingestion courante si autre encodage), séparateur candidat parmi `,`, `;`, tabulation ; quoting RFC 4180 ; présence d'en-tête, types candidats (text, integer, decimal, date, coordinates, list) à partir d'un **échantillon borné**.
- CSV : ne jamais déduire qu'une virgule de cellule est le séparateur de liste sans règle confirmée.
- Excel : liste des feuilles, plage retenue, cellules non vides, en-têtes possibles, valeurs **et** formats originaux. Les formules, cellules fusionnées, dates sérialisées Excel, nombres perdant zéros initiaux, feuilles cachées et valeurs calculées sont affichés comme avertissements. **Ne jamais évaluer de formule**. Le moteur doit préciser s'il lit la valeur calculée mise en cache ou la formule brute, et mettre en quarantaine un résultat absent/ambigu.
- Échantillonnage reproductible : lignes consultées, règle de sélection, numéro de feuille et bornes enregistrés dans le rapport ; aucune confiance statistique inventée.
- Les octets originaux restent intacts. Hash brut et chemin relatif interne non exporté par défaut. Aucune sortie en écriture à l'étape 1.

### S2 — Mapper

Écran local à deux colonnes : **à gauche** noms/échantillons des colonnes sources et indices d'emplacement, **à droite** propriétés éligibles TEMPORA v3 selon profil (id, title fr/ar/autres langues, date début/fin, event_type, source_ids, site/role/lat/lon, territoires, etc.).

- Algorithmes de suggestion déterministes : correspondances exactes et alias de colonnes, normalisation Unicode explicitement versionnée, correspondances de types, exemples d'en-têtes, disponibilité des langues dans le profil, formats de dates observés. Aucune suggestion ne vaut validation.
- Pour chaque suggestion : `source_column`, `target_field`, `algorithm_id`, `algorithm_version`, `reason_codes`, `confidence_kind: 'heuristic'`, `state: 'suggested'`. **Pas de probabilité calibrée inventée**. La confirmation passe `state='confirmed_by_user'` dans les métadonnées de session, avec horodatage explicitement hors des hashes scientifiques.
- UI : aperçu de cellules inchangées, ambiguïtés visibles, glisser-déposer ou menus d'association, suppression d'une suggestion, aperçu du `mapping.json`.
- Sortie : mapping compatible avec le schéma existant **lorsque seules les capacités 1.0.0 sont utilisées**. Pour nouvelles options `list_separator`, `date_parsers`, `xlsx`, définir une **extension versionnée** (par ex. contrat assistant 1.1.0) et un compilateur déterministe vers les entrées 1.0.0 sans forcer l'ancien moteur à accepter un `format` inconnu.
- Les pointeurs JSON doivent conserver les mêmes contrôles anti-prototype-pollution et les mêmes règles de chemins du moteur courant.

### S3 — Normaliser

Tout changement est enregistré sous forme d'une règle explicite, vérifiée et versionnée ; chaque champ conserve valeur originale, normalisée, source, opérateur, succès ou diagnostic. Ne pas substituer une date inconnue par une date inventée.

| Entrée | Comportement prévu |
|---|---|
| `12/03/1956` | Conversion **uniquement** si format `DD/MM/YYYY` explicitement choisi ; sous format `MM/DD/YYYY`, résultat différent ; sans sélection, quarantaine `AMBIGUOUS_DATE_ORDER`. |
| `mars 1956` | Granularité mois : 1956-03-01 à 1956-03-31, précision `month`, texte original conservé ; gestion des années bissextiles. |
| `vers 1950` | **Ne pas créer une année exacte** : demander une politique de borne explicite `circa` ou mettre en quarantaine ; même avec des bornes configurées, marquer estimation/qualification séparément et vérifier le schéma `temporal-expression`. |
| `1956`, `1956-03`, `1956-03-12` | Réutiliser le parseur temporel existant lorsque sa sémantique est adaptée. |
| `attaque; sabotage` | Fractionner seulement si `list_separator:';'` confirmé ; distinguer l'usage du séparateur CSV du séparateur de valeurs **dans** la cellule. |
| `35,123 / -1,234` | Autoriser virgule décimale uniquement selon locale confirmée, puis ordre lat/lon confirmé ; rejeter latitude hors [-90,90], longitude hors [-180,180]. |
| Alias `reunión ficticia` | Appliquer les alias de la **taxonomie déclarée par le profil** (correctif AUD-05), pas une table universelle implicite. |
| Valeur manquante ou contradictoire | Inconnu explicite si le modèle le permet, sinon quarantaine. Pas de date, site, source ou attribution inventé. |

Prévenir les divergences de format : Unicode, espaces insécables, heures fuseaux et calendriers non grégoriens doivent soit avoir une règle explicite, soit produire un diagnostic. Un nombre interprété comme identifiant doit conserver sa représentation textuelle (notamment zéros initiaux).

Quarantaine : code stable, explication compréhensible, `source_path` (feuille + cellule ou ligne CSV), colonne, valeur source éventuellement masquée dans le rapport partagé, règle, candidats possibles. **Aucune exclusion silencieuse**.

### S4 — Prévisualiser

Utiliser `prepareImport` une fois la sortie tabulaire explicitement convertie en format d'entrée accepté, avec le corpus de base canonique validé.

- Rapport : `created`, `unchanged`, `conflict`, `quarantined`, échantillons et téléchargement local JSON/Markdown (écriture **uniquement sur action explicite**).
- Chaque cas conserve `row_index`, `source_path`, `cell/column` si disponible, `raw_sha256`, profil, mapping/version, normaliseur/version, `base_sha256`, diagnostic, identifiants des candidats, limites d'échantillonnage.
- `batch_id` de l'ingestion actuelle est calculé à partir des octets, du profil, du mapping et des taxonomies. **Extension requise :** s'assurer que toutes les options de normalisation, la feuille Excel et les résultats sélectionnés sont cryptographiquement engagés dans l'identité du lot, sans casser les anciens identifiants silencieusement.
- Recalcul de la prévisualisation à l'identique : même contenu + même contexte/version + mêmes paramètres → même sortie scientifique. Horodatage d'observation isolé du digest reproductible ou déclaré explicitement s'il y contribue.
- Aucun snapshot modifié tant que l'utilisateur n'a pas accepté.

### S5 — Accepter

**Garde-fou prioritaire AUD-02 :**

```js
// Contrat cible (schématique, pas code livré)
if (review.batch_id !== expected.report.batch_id) {
  throw IngestionError('REVIEW_BATCH_MISMATCH');
}
```

La décision doit porter sur : `batch_id`, `base_sha256`, `mapping_sha256`, `input_sha256`, `normalization_sha256` (si applicable), identifiants choisis, reviewer, raison, horodatage. Le moteur doit **recalculer** et vérifier les valeurs côté confiance, non croire un nom de fichier ou l'UI.

- Cas à refuser : revue absente, ancienne, d'un autre lot, autre profil ou autres règles, sélection changée, base obsolète, source altérée.
- Sortie `tempora-working-corpus` avec `editorial_status:'proposed'`, lien de revue et journal ; pas de publication, promotion, citation ou validation historique automatique.
- Les noms de reviewer restent une **identité déclarative** tant qu'authentification/signature (AUD-04) n'est pas livrée.

## 3. Architecture

### 3.1 `tempora-format` (noyau pur)

**Contrat cible :** fonctions pures, déterministes, **sans dépendance runtime tierce** (API standard du langage seulement) ; aucun accès disque, réseau, horloge, UI ou modèle d'IA. Garder la bibliothèque séparée des fonctions à effets.

```text
tempora-format (pure)
├─ sniff(bytes, {sampling_policy, allowed_formats})
├─ inspectTable(tableSample, options)
├─ suggestMapping(columns, profile, policy)
├─ normalizeCell(raw, rule, locale, context)
├─ normalizeRows(rows, mapping, rules)
├─ buildPreviewEnvelope(diagnostics, inputDigests)
└─ canonicalizeRules(rules) / deterministicDigestInputs(...)
```

La décompression Excel nécessitera un **adaptateur externe audité et isolé** : la contrainte « sans dépendance » s'applique au noyau pur, pas nécessairement au parseur OPC/ZIP. Limiter decompressed size, nombre de feuilles, cellules, chaînes partagées et profondeur XML ; aucune macro, expression, connexion ou lien externe exécuté. Les octets extraits sont des entrées non fiables soumises au noyau.

### 3.2 Adaptateurs d'entrée / IO

- `tempora-assist-io` : lecture explicitement autorisée, limites de taille, sniff et fichiers ZIP Office, écriture atomique **sur demande**, cache éphémère et nettoyage.
- Utiliser les primitives du système hôte ; **ne pas considérer les chemins soumis par un navigateur comme autorisés**.
- Capacité de cancellation, quotas, temps maximum, protection zip-bomb et XML entity expansion, refus des liens externes.
- S'assurer que le plafond de 16 MiB de l'ingestion actuelle et ses limites restent en vigueur jusqu'à qualification d'un nouveau chemin.

### 3.3 Interface locale

Commande cible `tempora assist` (pas encore disponible) : serveur web **local** sur loopback, port dynamique, jeton de session aléatoire, protection Host/Origin et CSRF, aucune requête réseau sortante, fermeture au départ de la session. Alternative future : intégration à TEMPORA Desktop via IPC natif typé après audit.

Écrans : dépôt/sélection → détection → mapping manuel visuel → normalisation explicite + quarantaine → rapport + décision. Résultat accessible clavier, internationalisation fr/en et affichage arabe RTL, fichiers sources jamais téléversés vers un service distant.

### 3.4 `tempora-assist-ml` (option différée)

- **Jamais requis** pour jalon 1. Modèle local ou exécution strictement opt-in ; aucune télémétrie/envoyée sans consentement spécifique.
- Ne peut **que proposer** mapping, extraction de dates/lieux d'un texte libre ou candidats de classification. Il ne peut choisir une date incertaine, écrire le canonique, publier, accepter un lot ni créer une preuve.
- Métadonnées : fournisseur, `model_id`, `model_version`, hash du modèle, paramètres, provenance, source, statut `suggested`, explication/limites et validation humaine. Les champs acceptés par le modèle canonique v3 doivent être respectés : en cas d'incompatibilité, enregistrer ces métadonnées dans l'enveloppe de travail versionnée, **pas** en ajoutant des champs arbitraires au canonique.
- IA indisponible : toutes les étapes déterministes fonctionnent inchangées. Tests de non-régression de la sortie sans ML.

## 4. Contrats à versionner

Proposition de fichiers : `assist-inspection.schema.json`, `assist-normalization-rules.schema.json`, `assist-review.schema.json` et éventuellement `assist-mapping.schema.json` comme **couche compilant** vers le mapping ingestion 1.0.0 actuel. Ne pas écrire `format:'xlsx'` dans le mapping 1.0.0 existant : le schéma le rejette.

Identités séparées :
- `raw_sha256` : octets originaux ;
- `sheet_id / range / source_path` : localisation précise ;
- `mapping_sha256` : mapping figé/versionné ;
- `normalization_sha256` : règles et paramètres, non le seul résultat ;
- `base_sha256` : snapshot canonique initial ;
- `batch_id` : engagement déterministe de toutes les données réellement examinées.
Les calculs de digest canoniques doivent utiliser les vecteurs TEMPORA actuels, **pas** présumer de RFC 8785.

## 5. Sécurité, reproductibilité et performance

- Limites explicites aux **octets originaux**, fichiers compressés, cellules, colonnes, formules, tailles de chaîne, CSV multiline, schémas et réponse HTTP ; budgets temps/RAM ; aucun parser à exécution de code.
- Mesurer sur corpus **fictifs synthétiques** CSV, TSV, Excel : 100, 1 000, 10 000 lignes et fichiers malicieux (bombes ZIP, UTF-8 invalide, valeurs numériques ambiguës).
- Détection reproductible et stable entre Linux/Windows ; attention aux fins de ligne et encodages, et à la valeur de date de classeur Excel.
- Conservation de l'intégralité des diagnostics, pas de résultat partiel présenté comme corpus complet.
- Traçabilité des conversions, versions, profil et lignes ; vérification de non-mutation du fichier source.
- CI : tests de propriétés des normaliseurs, cas limites, golden vectors, tests d'isolation « noyau pur », tests d'intégration avec `prepareImport` et contrôle humain `batch_id`.

## 6. Premier jalon (M1) — étapes 1 à 4, CSV + Excel, sans IA

M1 cible :
1. Détecter UTF-8/CSV et structure d'un `.xlsx` ordinaire, feuille explicitement choisie ; afficher hypothèses sans conversion automatique.
2. Mapper visuellement les colonnes, avec suggestions explicables et confirmation ; produire un mapping assistant versionné + conversion déterministe vers ingestion 1.0.0.
3. Normaliser `list_separator`, dates `DD/MM/YYYY`, `mars 1956` ; `vers 1950` en quarantaine jusqu'à politique d'approximation explicite. Vérifier coordonnée/alias sans inférence.
4. Prévisualiser et afficher rapport par ligne, sans aucune écriture implicite.
5. **S5 n'est pas dans la portée UI de M1** ; en revanche **AUD-02 doit être corrigé séparément avant toute acceptation via CLI ou interface**.

**Critères d'acceptation M1 :** exemples anonymisés, sources intactes, aucune écriture sans geste explicite, mêmes hashes/reports sur Windows et Linux, 100 % des ambiguïtés classées en quarantaine ou résolues par une règle confirmée, invalides jamais promus, fonctionnement hors connexion, tests de sécurité Excel et du serveur loopback, aucune dépendance ML.

La proposition « couvre 90 % des historiens » est un **objectif utilisateur à valider par enquête**, pas une statistique mesurée.

## 7. Exclusions

Pas d'OCR, pas de traitement implicite de PDF ou images, pas de correction historique, pas de géocodage réseau, pas de conversion d'unité territoriale présumée, pas de certification de documents sources, pas de support des fichiers Excel chiffrés, pas de modèle IA activé par défaut, pas de publication Microsoft Store automatique.
