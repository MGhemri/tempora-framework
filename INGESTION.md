# TEMPORA — Import local et prévisualisation

Le pipeline TEMPORA prépare des **propositions d’événements** à partir de fichiers JSON, CSV ou GeoJSON. Il utilise un profil, un corpus de travail v3 et un mapping déclaratif. Il conserve les octets du fichier d’origine et permet de revoir les résultats avant de créer une nouvelle copie locale. Le formulaire public ALNOP, les API et la publication du corpus continuent d’utiliser leurs circuits existants.

## Préparer et vérifier

Pour partir du corpus ALNOP actuel, créer une copie v3 si elle n’existe pas déjà :

```sh
npm run migrate:tempora -- --write
```

Prévisualiser un fichier local en choisissant le mapping correspondant :

```sh
npm run ingest:tempora -- import --base work/tempora-v3/corpus-v3.json --input lot.csv --mapping profiles/alnop/imports/csv.json --report markdown
```

Sans `--write`, la commande ne crée aucun fichier. `--report json` fournit les diagnostics par ligne pour un traitement automatique ; sans option de rapport, la commande affiche les comptes et l’empreinte du lot. Pour obtenir le JSON sans la bannière npm, utiliser `npm run --silent ingest:tempora`.

| Résultat | Signification |
|---|---|
| `create` | Identifiant libre et proposition valide techniquement |
| `unchanged` | Même identifiant et contenu mappé équivalent, dans le lot ou dans la base |
| `conflict` | Identifiant déjà utilisé avec un autre contenu, ou désaccord dans le lot |
| `quarantined` | Ligne non exploitable : champ, date, source, géométrie ou règle bloquante |

Une ligne en quarantaine ne bloque pas les autres identifiants. Si son identifiant est reconnaissable, une autre ligne de ce même identifiant est bloquée en conflit. Un JSON mal formé, des clés dupliquées, un encodage illisible, des nombres JSON hors précision prise en charge, ou des guillemets CSV qui rendent les limites des lignes ambiguës rejettent le fichier entier. Aucune ligne n’est devinée ou abandonnée silencieusement.

## Mappings par profil

Le [schéma de mapping 1.0.0](schemas/tempora.ingestion-mapping.schema.json) déclare le format, l’identifiant et la version du profil, les champs et les options. Il n’exécute ni code ni requête réseau. Les chemins utilisent JSON Pointer : `~1` désigne `/` et `~0` désigne `~`. Les langues doivent être déclarées dans le profil.

| Format ALNOP | Mapping fourni | Structure attendue |
|---|---|---|
| JSON | [json.json](profiles/alnop/imports/json.json) | Objet dont `/operations` est un tableau au format historique ALNOP |
| CSV | [csv.json](profiles/alnop/imports/csv.json) | En-têtes explicites, séparateur virgule, dates historiques dans `date_debut` et `date_fin` |
| GeoJSON | [geojson.json](profiles/alnop/imports/geojson.json) | `FeatureCollection`, champs dans `properties`, géométrie dans `geometry` |

Le CSV préparé n’est pas l’export CSV aplati existant. Il attend les champs que décrit son mapping. Cet exemple est **fictif et réservé à un test local** :

```csv
id,nom_operation,nom_operation_ar,date_debut,type_action,longitude,latitude,geometry_role
TEST_IMPORT_1,Notice fictive de vérification,اختبار,1956,Embuscade,,,
```

Un autre profil peut utiliser ses propres colonnes et vocabulaires. Une base vide se prépare avec `--profile profil.json --taxonomies taxonomies.json` à la place de `--base`. Le fichier de taxonomies associe chaque vocabulaire déclaré à sa liste de valeurs. Les sources et territoires à référencer doivent déjà exister dans la base de travail.

Pour un JSON générique, `records_pointer` indique le tableau de lignes ; une valeur vide désigne un tableau à la racine. Le CSV prend un séparateur explicite parmi virgule, point-virgule et tabulation, gère les guillemets doublés et les cellules sur plusieurs lignes. Les champs CSV sont conservés comme texte avant conversion déclarée. Le GeoJSON doit utiliser les coordonnées WGS84 standard ; un autre CRS n’est ni supposé ni reprojeté.

## Ce que la normalisation conserve

- **Identifiant et texte** : l’identifiant explicite est contrôlé après retrait des espaces externes. Les textes non vides, accents et caractères bidirectionnels sont conservés. Une traduction manquante reste inconnue.
- **Dates** : année, mois et jour gardent leur précision. Un champ vide reste inconnu. Un objet temporel canonique complet peut être fourni en JSON pour un intervalle ou une borne ouverte.
- **Vocabulaires** : seules les correspondances exactes avec un alias déclaré sont normalisées. Les règles et sévérités du profil s’appliquent au résultat.
- **Lieu** : le mapping peut lire une géométrie, ou une paire longitude/latitude. Il ne complète jamais la paire. Une géométrie présente requiert un rôle déclaré dans la ligne ou le mapping. Les mappings historiques ALNOP JSON/GeoJSON déclarent le rôle de point représentatif pour leurs coordonnées approximatives ; le CSV demande un rôle explicite. Le pipeline ne déduit ni précision métrique ni lieu exact.
- **Sources** : `source_ids` référence une source ou une liste de sources existantes ; `evidence` permet d’indiquer `source_id`, `locator` et `quotation` dans un tableau JSON. Ces deux modes sont exclusifs. Un identifiant inconnu est bloquant. Les références bibliographiques intégrées à un ancien export restent dans l’original et ne deviennent pas des liens inventés.

Les chemins mappés, l’objet original et les références de transformation sont conservés avec la proposition. Le lot conserve le fichier à l’octet près, y compris son éventuel BOM UTF-8. Les champs non mappés sont conservés dans l’original et ne sont pas intégrés automatiquement au modèle. Le journal contient la source, son empreinte, le profil, le mapping, leurs versions, la date, les diagnostics et le résultat par ligne.

## Enregistrer le lot et accepter une sélection

Pour conserver une prévisualisation, ajouter `--write` à `import`. La commande indique le chemin `local_output` du fichier de lot dans `work/tempora-v3/ingestion/`. Il contient les diagnostics JSON, le rapport Markdown, les ajouts proposés et l’entrée originale. Il peut contenir des données non publiées : ce répertoire est privé et exclu des sites et de Git.

Relire le rapport, puis sélectionner les identifiants à accepter. Remplacer les chemins et valeurs ci-dessous par ceux du lot local :

```sh
npm run ingest:tempora -- accept --base work/tempora-v3/corpus-v3.json --batch CHEMIN_DU_LOT --id IDENTIFIANT --reviewer REVUE_LOCALE --reason "Motif de la sélection" --write
```

`--id` peut être répété. Seules les lignes `create` sont sélectionnables. La commande recalcule le lot avant de l’appliquer et refuse une base modifiée depuis la prévisualisation. Elle crée une **nouvelle copie** et inscrit une décision d’acceptation locale ; les événements restent `proposed`. Le libellé de revue est déclaré par la personne qui exécute la commande ; ce n’est ni une authentification ni une approbation scientifique.

Vérifier le résultat ou l’utiliser comme base du prochain import :

```sh
npm run ingest:tempora -- validate --base CHEMIN_DE_LA_COPIE
```

Les fichiers existants ne sont jamais écrasés. Réimporter les mêmes octets avec le même mapping, profil et vocabulaires conserve l’identité du lot. Après acceptation, les notices au contenu équivalent sont `unchanged`, sans nouvel ajout. Des octets différents peuvent produire le même contenu mappé ; les différences non mappées restent consultables dans l’original. Un conflit ne déclenche ni fusion, ni correction, ni suppression. Préparer un nouveau lot après correction de l’entrée ou traiter la divergence dans une revue distincte.

## Périmètre et limites

Entrées UTF-8 jusqu’à 16 Mio et 100 000 lignes ; artefacts locaux jusqu’à 128 Mio. Ces bornes protègent le traitement, elles ne sont pas des résultats de benchmark. Une proposition correspond à une notice d’événement et à une localisation mappée, qui peut contenir une géométrie à plusieurs points. Les autres objets canoniques restent disponibles dans la base, mais ne sont pas créés par les mappings d’événements de cette version.

Le pipeline s’arrête à l’acceptation locale. Il ne publie pas d’archives, ne modifie pas la base ALNOP et n’expose pas les brouillons par l’API. La revue scientifique et les décisions de publication restent distinctes du contrôle technique.
