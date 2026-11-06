# TEMPORA — Modèle canonique v3 et migration

Le modèle canonique TEMPORA `3.0.0` distingue les événements, sources, assertions, entités, expressions temporelles, assertions spatiales, relations, revues, évaluations et versions de corpus. Les schémas sont versionnés indépendamment du manifeste de profil `1.0.0`.

Cette représentation est utilisée par la validation, l’ingestion, les analyses, la revue, la publication et l’API v3. La distribution reste une préversion locale `3.0.0-rc.1`.

## Schémas et validation

- [Schéma du corpus](../../schemas/tempora/v3/corpus.schema.json)
- [Définitions communes et objets](../../schemas/tempora/v3/model.schema.json)
- [Événement](../../schemas/tempora/v3/event.schema.json), [source](../../schemas/tempora/v3/source.schema.json), [assertion](../../schemas/tempora/v3/claim.schema.json), [entité](../../schemas/tempora/v3/entity.schema.json)
- [Temps](../../schemas/tempora/v3/temporal-expression.schema.json), [espace](../../schemas/tempora/v3/spatial-assertion.schema.json), [relation](../../schemas/tempora/v3/relation.schema.json)
- [Revue](../../schemas/tempora/v3/review.schema.json), [évaluation](../../schemas/tempora/v3/assessment.schema.json), [version de corpus](../../schemas/tempora/v3/corpus-release.schema.json)

Les identifiants `$id` sont des URN de schéma, pas des adresses réseau. Pour un validateur JSON Schema externe, enregistrer le schéma de profil, `model.schema.json`, puis le schéma d’objet souhaité. Le validateur fourni effectue cet enregistrement localement, sans accès réseau.

```js
const {validateCorpus} = require('./src/framework/canonical');
const result = validateCorpus(corpus);
// result.valid, result.errors, result.warnings, result.scope
```

Les contrôles couvrent la structure, les références typées, l’unicité des ID dans un espace de noms, l’appartenance au profil, ses vocabulaires et règles, les bornes temporelles et les géométries. Les sévérités du profil restent respectées. Un corpus natif peut employer d’autres langues, périodes et types d’événements ; le noyau ne lit aucune donnée ALNOP.

Un ID d’événement reste indépendant de son titre. Les références contiennent `kind`, `namespace` et `id`. Un corpus représente un profil ; les références vers un autre espace de noms sont refusées à cette étape. Les propriétés supplémentaires de domaine vont dans `extensions`, sous une clé d’espace de noms.

## Métadonnées de profil

Le manifeste 1.0.0 peut déclarer des références de mappings par identifiant et version dans `mappings`. Chaque identifiant doit être unique dans le profil. Le champ facultatif `provenance` décrit la référence et l’origine du manifeste. Ces métadonnées restent déclaratives. Le chargement d’un mapping s’effectue séparément, par une entrée explicite.

## Sérialisation et empreintes

`canonicalStringify` produit du JSON compact sans marqueur d’encodage ni saut de ligne final. Les clés sont triées suivant les unités UTF-16 de JavaScript. Lors de l’émission JSON, les clés qui sont des indices de tableau ECMAScript apparaissent d’abord dans l’ordre numérique. Les valeurs des tableaux gardent leur ordre, y compris les collections du corpus. Le tri métier des collections se fait avant la sérialisation, lorsque le contrat de l’artefact le prévoit.

Le texte conserve ses caractères sans normalisation Unicode. Les nombres suivent la sérialisation JSON de JavaScript, avec `-0` représenté par `0` et rejet des nombres non finis. `digest` calcule SHA-256 sur les octets UTF-8 de cette représentation et renvoie 64 caractères hexadécimaux minuscules. L’empreinte d’un fichier distribué porte sur ses octets exacts, y compris les éventuels séparateurs de lignes. Le vecteur binaire de référence est vérifié sur Linux et Windows.

## Informations et provenance

Les titres, descriptions et libellés sont des objets indexés par langue. Une langue absente n’est pas traduite automatiquement. Une valeur inconnue est `null` ; zéro reste une valeur distincte.

Chaque enregistrement distingue son statut éditorial, sa provenance et ses extensions. Les assertions gardent séparément sujet, prédicat, valeur, unité, contexte, sources précises et contradictions explicites. Les noms d’entités peuvent conserver langue, rôle et validité historique. Les relations sont typées et disposent de leur propre provenance.

La validation est **technique**. Elle ne certifie pas un fait historique et n’autorise pas la publication. Le statut `unspecified` signifie qu’aucun statut équivalent n’a été déclaré pour cet objet. Une publication héritée sans revue enregistrée reste signalée ; aucune approbation rétrospective n’est inventée. Les règles éditoriales ALNOP restent appliquées par les outils existants avant la migration. Le pipeline générique de revue et de publication sera livré séparément.

## Temps historique

`TemporalExpression` conserve `original`, `calendar`, `kind`, `earliest`, `latest`, `precision` et `certainty`.

- `exact`, `month` et `year` distinguent jour, mois et année. Les bornes d’un mois ou d’une année décrivent son étendue, sans prétendre connaître un jour exact.
- `interval` représente des bornes inclusives, éventuellement ouvertes d’un côté.
- `before` porte seulement une borne supérieure exclusive ; `after` seulement une borne inférieure exclusive. Leur précision est `range`.
- `unknown` conserve deux bornes nulles et la précision `unknown`.

`temporalRelation` renvoie `before`, `after`, `contemporary`, `overlap` ou `indeterminate`. `contemporary` désigne ici le même jour exact. `overlap` signifie que les intervalles documentaires se recouvrent ; il ne prouve pas la simultanéité des événements.

Seul le calendrier grégorien, de `0001` à `9999`, est implémenté. Les dates antérieures et les autres calendriers nécessiteront une évolution explicite du contrat et des conversions documentées ; ils sont actuellement refusés.

## Espace historique

Les géométries acceptées sont `Point`, `MultiPoint`, `LineString`, `Polygon`, `MultiPolygon` et `null`, en `EPSG:4326`, avec des positions à deux coordonnées dans l’ordre longitude/latitude. Les rôles distinguent notamment site exact, point représentatif, aire approximative, zone d’opération et territoire administratif. Une géométrie nulle conserve le rôle `unknown`.

Précision en mètres, méthode de géocodage et version de référentiel sont explicites et peuvent rester inconnues. Aucune valeur métrique n’est déduite du nombre de décimales. Les événements peuvent avoir plusieurs assertions spatiales et plusieurs territoires ; ceux-ci peuvent porter des périodes de validité.

Les contrôles topologiques portent sur la fermeture, l’aire non nulle, les auto-intersections, les trous et les recouvrements de composantes. Ils travaillent sur des segments plans en coordonnées WGS84. Les polygones traversant l’antiméridien sont refusés explicitement. Ce composant n’est pas un moteur SIG géodésique ; il ne corrige ni ne reprojette une géométrie. Les limites numériques des calculs en virgule flottante restent à considérer pour les géométries proches de la dégénérescence.

## Migration ALNOP v2 vers TEMPORA v3

```sh
npm run test:compat:alnop:minimal
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Les tests comparent les données et les conversions en mémoire. Le rapport reste sous `work/`, exclu de Git et du site. Une copie de migration peut contenir des propositions non publiées et doit rester privée. La référence historique et ses archives ne sont jamais réécrites.

| ALNOP v2 | TEMPORA v3 |
|---|---|
| Opérations et identifiants | Événements avec les mêmes ID |
| Sources et identifiants | Sources séparées avec les mêmes ID |
| Assertions et preuves | Assertions, unités, contextes et références précises |
| Personnes, organisations, lieux et territoires | Entités typées, noms et validités |
| Localisations, participants et rattachements | Assertions spatiales et relations explicites |
| Historiques de revue | Objets de revue avec décisions et références conservées |
| Évaluations de doublons | Évaluations séparées, sans fusion automatique |
| Manifestes de versions existantes | Descriptions des versions historiques, avec leurs empreintes d’origine |

L’adaptateur conserve l’objet original de chaque enregistrement dans `extensions.alnop.original`. Les métadonnées, l’ordre des collections et les autres champs du corpus sont préservés dans l’enveloppe de migration. Cela permet la restitution des champs ALNOP qui n’ont pas encore de correspondance générique, sans les supprimer ni leur inventer une interprétation.

Chaque transformation conserve méthode, version, chemin source et empreinte du corpus d’entrée. Les ID des nouveaux objets dérivés sont déterministes ; les ID historiques restent inchangés. Une empreinte de contenu contrôle l’intégrité, sans constituer une signature ni une preuve d’authenticité documentaire.

Le retour est garanti pour une copie de migration intacte. Si la représentation TEMPORA a été modifiée, le retour refuse de perdre silencieusement les changements. Une migration inverse de données éditées exigera un mapping explicite et une revue. Les décisions de revue conservées portent sur leur contenu ALNOP original ; elles ne valent pas nouvelle approbation de la représentation v3.

Les manifestes d’archives conservent leur version de corpus historique et leurs empreintes. Aucune archive v3 n’est créée et aucune archive existante n’est réécrite. Un CSV aplati ne permet pas cette garantie de restitution ; utiliser le JSON canonique pour les données riches.

## Périmètre suivant

Le [pipeline local d’ingestion](./INGESTION.md) peut préparer des propositions JSON, CSV et GeoJSON dans une copie de travail v3. La publication générique, l’API multi-profils, le SDK et les benchmarks de charge sont disponibles et disposent de tests séparés.
