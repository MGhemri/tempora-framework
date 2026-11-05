# API REST v2 — Données et provenance

L’API v2 donne accès au corpus publié, sans compte ni clé, en lecture seule. Elle complète l’API v1, dont les URL et les réponses existantes sont conservées. Les brouillons et les contributions reçues par courriel ne sont pas exposés.

Base : `https://alnop.vercel.app/api/v2`

[Consulter le contrat OpenAPI](https://alnop.vercel.app/api/v2/openapi.json) · [Télécharger sa copie statique](../data/api-v2/openapi.json)

GitHub Pages héberge la documentation et les téléchargements ; les requêtes d’API s’exécutent sur Vercel.

## Ressources

| Route après `/api/v2` | Contenu |
|---|---|
| `/operations` et `/operations/{id}` | Fiches canoniques, précision, provenance et original conservé |
| `/operations/{id}/evidence` | Assertions publiées, contradictions et sources associées |
| `/sources` et `/sources/{id}` | Notices bibliographiques utilisées dans la publication |
| `/places`, `/persons`, `/organizations` | Référentiels publiés ; détail par `/{id}` |
| `/territorial-units` et `/territorial-units/{id}` | Unités et classifications éditoriales, avec leur statut de revue |
| `/claims` et `/claims/{id}` | Assertions publiées et passages sources |
| `/stats` | Effectifs du corpus, années de début, précisions et types |
| `/coverage` | Qualité et lacunes des métadonnées du corpus |
| `/releases` et `/releases/{id}` | Versions archivées, dates UTC, provenance et téléchargements |
| `/releases/current` | Manifeste du snapshot courant et empreintes |
| `/exports` | Liens locaux des formats publics et leurs empreintes |
| `/openapi.json` | Contrat OpenAPI 3.1 |

Les référentiels et assertions peuvent être vides tant qu’aucun contenu n’a été revu et publié. Une collection vide ne signifie pas une absence historique.

## Pagination et réponse

Les collections acceptent `page` (à partir de 1) et `limit` (20 par défaut, maximum 200). La réponse contient `data` et `meta` : `total`, `count`, `page`, `limit`, `has_next`, `sort`, `snapshot_sha256`, `dataset_release` et `corpus_is_incomplete`.

`total` compte les fiches correspondant au filtre, pas toutes les opérations ayant historiquement existé. `corpus_is_incomplete` vaut toujours `true`.

`dataset_release` indique la version archivée correspondant exactement au manifeste courant. Si les exports évoluent avant une nouvelle publication, cette valeur redevient `null`. Le snapshot reste identifié par son empreinte SHA-256 ; `/releases/current` expose son manifeste. Les archives et leurs citations sont disponibles sur [la page des versions](docs/releases.html), selon [la politique de publication](RELEASE_POLICY.md). Une version technique préserve les réserves historiques et ne vaut pas nouvelle validation scientifique.

## Filtres

| Paramètre | Règle |
|---|---|
| `q` | Sous-chaîne dans titres/descriptions des opérations ; dans les noms des entités, titres/auteurs des sources ou prédicats/valeurs des assertions selon la ressource. Casse et diacritiques normalisés, aucune traduction automatique. |
| `source_id` | Identifiants séparés par des virgules ; au moins une correspondance. Pour une source, filtre son propre identifiant. |
| `status` | Seul `published` est accepté ; une demande de brouillons reçoit une erreur 400. |
| `sort` | `id` ou `-id` ; pour les opérations également `start_date` ou `-start_date`. |
| `from`, `to` | Opérations : bornes inclusives `YYYY`, `YYYY-MM` ou `YYYY-MM-DD`, sélection par chevauchement. |
| `date_precision` | Précision du début : `day`, `month`, `year`, `range`, `unknown`. |
| `territory`, `territory_role` | Appartenances structurées explicites, jamais déduites du texte hérité. Rôles : `primary`, `secondary`, `cross_territorial`, `uncertain`. |
| `type` | Types d’événements ; les valeurs héritées sont conservées. |
| `has_geometry` | `true` ou `false` ; ne garantit pas une localisation exacte. |
| `min_sources` | Minimum de références au niveau de la fiche d’opération, entier positif ou nul. |
| `bbox` | `ouest,sud,est,nord`, WGS84 ; ouest supérieur à est traverse l’antiméridien. |
| `format` | Opérations : `json` ou `geojson`. |
| `subject`, `claim_status` | Assertions : identifiant d’opération et statut `supported`, `contested` ou `unverified`. |

Les familles de filtres se combinent par **ET**, les listes de `source_id`, `date_precision`, `territory`, `territory_role` et `type` par **OU**. Territoire et rôle doivent correspondre à la même attribution. Un identifiant valide mais inconnu produit une collection vide ; une syntaxe ou un paramètre non pris en charge produit une erreur 400. Les paramètres répétés sont refusés : utiliser une liste séparée par des virgules.

Les bornes partielles ne sont développées que pour comparer les intervalles. Les données renvoyées gardent leur précision initiale. L’intervalle comparé va de la première borne du début à la dernière borne de fin connue ; à défaut de fin, aux bornes du début. Un début inconnu est exclu des filtres temporels. Le tri utilise la première borne connue du début, puis l’identifiant croissant ; les dates inconnues restent à la fin dans les deux sens.

Les dix catégories initiales sont des classifications éditoriales, pas dix territoires historiquement équivalents. Les attributions canoniques initiales restent à revoir : un filtre v2 `territory=W1` peut donc être vide alors que le classement de compatibilité v1 affiche des fiches. Ce comportement évite de transformer une ancienne étiquette en preuve d’appartenance.

## GeoJSON

`format=geojson` renvoie une `FeatureCollection`, paginée comme le JSON, avec le même `meta`. Les géométries nulles sont conservées. Plusieurs points connus produisent un `MultiPoint`. Les propriétés contiennent la fiche canonique et les rôles de précision des localisations.

Une BBOX sélectionne une fiche si au moins un point connu intersecte la boîte. Elle n’est pas un test d’exactitude géographique : les points représentatifs peuvent aussi être sélectionnés et restent signalés dans les propriétés. Cette livraison n’ajoute pas de polygones historiques supposés.

## Statistiques et lacunes

`/stats` et `/coverage` acceptent les filtres des opérations, sans pagination, tri ni changement de format. Les sources comptées dans les statistiques sont celles des fiches sélectionnées et de leurs assertions. Les types multiples peuvent compter une fiche dans plusieurs catégories ; les années représentent les années de début enregistrées.

`/coverage` expose les dates inconnues, absences de géométrie, attributions territoriales non structurées, sources manquantes, imports restant à revoir et assertions contestées. `pending_contributions` vaut `null` : les messages reçus ne constituent pas une file éditoriale publique mesurable. Une sélection vide indique « aucune fiche actuellement recensée », jamais « aucune opération historique ».

Ces indicateurs mesurent la documentation d’ALNOP. Ils ne calculent ni un taux de couverture de la guerre ni une intensité militaire réelle. Le champ additionnel `documentary_report` fournit les tableaux par année, territoire structuré et type, ainsi que les métadonnées à compléter. Il utilise le même moteur que [l’observatoire documentaire](docs/observatory.html). Les empreintes du modèle et du filtrage sont indiquées dans `meta` pour identifier le calcul. Voir [la méthode de l’observatoire](OBSERVATORY.md).

## Exemples

[Premières fiches](https://alnop.vercel.app/api/v2/operations?limit=2) · [Fiche initiale](https://alnop.vercel.app/api/v2/operations/OP_1954_001) · [Preuves associées](https://alnop.vercel.app/api/v2/operations/OP_1954_001/evidence)

```sh
curl 'https://alnop.vercel.app/api/v2/operations?from=1956&to=1956&limit=20'
curl 'https://alnop.vercel.app/api/v2/operations?format=geojson&limit=20'
curl 'https://alnop.vercel.app/api/v2/coverage?from=1900&to=1900'
```

Pour vérifier les exemples après déploiement : `npm run smoke:api:v2`. Cette commande effectue uniquement des lectures GET, y compris les cas 400, 404, sélection vide et cache 304. Elle enregistre le résultat dans `work/api-v2-smoke.json`.

## Erreurs, cache et limites

Les erreurs suivent `{error:{code,message}}` : 400 pour une requête invalide, 404 pour une ressource absente, 405 pour une méthode interdite, 413 pour une représentation supérieure à 4 Mio, 500 si le snapshot ne peut être chargé. Aucune pile d’erreur interne n’est exposée. Les réponses d’erreur ne sont pas mises en cache.

GET et OPTIONS sont autorisés. Les réponses 200 possèdent un `ETag` calculé sur la représentation renvoyée ; `If-None-Match` permet une réponse 304. CORS autorise la lecture publique et expose l’ETag. Le cache annonce 60 secondes côté client et 300 secondes côté cache partagé. Une instance conserve son snapshot validé en mémoire pendant sa durée de vie.

L’API vérifie les empreintes des collections chargées. Son interface de lecture est séparée du stockage sur fichiers pour permettre une autre implémentation ultérieure. Il n’existe aucun endpoint public d’écriture.

Les tests vérifient la structure OpenAPI et les réponses par JSON Schema, les filtres, les limites, la BBOX traversant l’antiméridien, les erreurs, les preuves contradictoires et les exemples HTTP. Ils ne remplacent ni une revue historique ni des mesures de performance à grande échelle.

Références techniques : [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) et [fonctions Node.js Vercel](https://vercel.com/docs/functions/runtimes/node-js).
