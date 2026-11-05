# Documentation de l'API REST v1 — ALN Historical Operations Dataset (1954–1962)

Bienvenue sur la documentation officielle de l'**API REST v1** du jeu de données des opérations militaires de l'Armée de Libération Nationale (ALN) durant la Guerre de Libération algérienne (1954–1962).

Cette API publique fournit un accès programmatique direct, filtrable et géoréférencé aux **263 actions militaires documentées**, couvrant les 6 Wilayas historiques, les Zones Autonomes d'Alger et d'Oran, la Base de l'Est et la 7e Wilaya (Fédération de France du FLN).

---

## Informations Générales

| Propriété | Valeur |
| :--- | :--- |
| **URL de Base (Production)** | `https://alnop.vercel.app/api/v1` |
| **Version actuelle** | `v1.0.0` |
| **Authentification** | **Aucune (100% Ouverte et Gratuite)** |
| **CORS** | `Access-Control-Allow-Origin: *` (autorisé pour toute application web tierce) |
| **Mise en cache** | Edge CDN Vercel (`Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`) |
| **Format par défaut** | `application/json; charset=utf-8` |
| **Format cartographique** | `application/geo+json; charset=utf-8` (RFC 7946 via paramètre `?format=geojson`) |
| **Licence des données** | [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) |
| **Mention d'attribution obligatoire** | `Auteur : Ghemri M. — Source : ALN Historical Operations Dataset (1954–1962)` |
| **Contact académique & recherche** | `contact@connect-gm.com` |

---

## Récapitulatif des Endpoints

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | [`/api/v1`](#1-informations--index-de-lapi) | Index du service, version, métadonnées globales et liste des endpoints |
| `GET` | [`/api/v1/operations`](#2-liste-des-opérations-avec-filtres) | Liste des opérations avec filtres combinables, recherche plein texte, pagination et mode GeoJSON |
| `GET` | [`/api/v1/operations/:id`](#3-fiche-unitaire-dune-opération) | Fiche détaillée d'une opération par son identifiant unique (ex: `OP_1956_042`) |
| `GET` | [`/api/v1/stats`](#4-statistiques--agrégations) | Métriques globales et ventilations (par année, par wilaya, par type d'action) |
| `GET` | [`/api/v1/wilayas`](#5-référentiel-des-wilayas-historiques) | Référentiel des 10 Wilayas et Zones Autonomes (codes, intitulés FR/AR, couleurs) |

---

## Format Standard des Réponses

Sauf en cas de demande explicite en GeoJSON (`?format=geojson`), toutes les réponses sont encapsulées dans un format standardisé garantissant l'intégrité, la traçabilité et le respect de la licence d'attribution :

```json
{
  "meta": {
    "api_version": "v1",
    "status": "success",
    "total": 263,
    "count": 50,
    "page": 1,
    "limit": 50,
    "total_pages": 6,
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Ghemri M. (ALN Historical Operations Dataset)",
    "documentation": "https://alnop.vercel.app/api/docs",
    "timestamp": "2026-11-03T22:30:00.000Z",
    "applied_filters": {}
  },
  "data": [
    { ... }
  ]
}
```

---

## 1. Informations & Index de l'API

### `GET /api/v1`

Retourne la description du service, le nombre total d'opérations indexées, la licence et la liste des endpoints disponibles.

#### Exemple de requête :
```bash
curl -X GET "https://alnop.vercel.app/api/v1"
```

---

## 2. Liste des Opérations avec Filtres

### `GET /api/v1/operations`

Permet d'interroger la base de données selon des filtres précis combinables entre eux.

### Paramètres d'URL (Query String)

| Paramètre | Type | Description | Exemple |
| :--- | :--- | :--- | :--- |
| `wilaya` | `string` | Code Wilaya (`W1`, `W2`, `W3`, `W4`, `W5`, `W6`, `W7`, `ZAA`, `ZAO`, `EMG`) ou liste séparée par virgule | `?wilaya=W1,W3` |
| `year` | `string` | Année de début (`1954` à `1962`) ou liste séparée par virgule | `?year=1956` |
| `type` | `string` | Filtre partiel insensible à la casse sur le type d'action militaire | `?type=embuscade` |
| `q` ou `search` | `string` | Recherche plein texte (titre FR/AR, description, ville/région, commandement, impact, identifiant) | `?q=souika` |
| `date_from` | `string` | Filtrer les opérations débutant à partir de cette date (`YYYY-MM-DD`) | `?date_from=1956-08-20` |
| `date_to` | `string` | Filtrer les opérations débutant avant ou à cette date (`YYYY-MM-DD`) | `?date_to=1958-12-31` |
| `format` | `string` | Format de retour : `json` (défaut) ou `geojson` (FeatureCollection SIG) | `?format=geojson` |
| `sort` | `string` | Ordre chronologique : `date_asc` (par défaut) ou `date_desc` | `?sort=date_desc` |
| `limit` | `integer` | Nombre d'éléments par page (défaut: `50`, maximum: `300`). Toute valeur non entière ou hors limites renvoie `HTTP 400`. | `?limit=25` |
| `page` | `integer` | Numéro de la page (défaut: `1`, minimum: `1`). Toute valeur non entière ou < 1 renvoie `HTTP 400`. | `?page=2` |

>
> **Contrat GeoJSON & SIG (ALNOP-004) :**
> Lorsque `format=geojson` est demandé, la réponse GeoJSON applique fidèlement l'ensemble des filtres temporels, territoriaux et thématiques (`wilaya`, `year`, `q`, etc.), mais **n'applique pas de pagination** (`limit` et `page` sont ignorés). Cela garantit aux outils SIG (QGIS, Leaflet, Mapbox) une couverture cartographique complète sans troncature arbitraire.
>
> **Tri déterministe (ALNOP-014) :**
> Le tri chronologique (`date_asc` par défaut ou `date_desc`) utilise l'identifiant canonique unique `id` comme second critère de bris d'égalité, garantissant l'absence totale de sauts ou de doublons lors du parcours de pages successives.

#### Exemples de requêtes :

**Toutes les opérations de l'année 1954 :**
```bash
curl -X GET "https://alnop.vercel.app/api/v1/operations?year=1954"
```

**Recherche d'opérations d'embuscade dans l'Aurès (Wilaya I) :**
```bash
curl -X GET "https://alnop.vercel.app/api/v1/operations?wilaya=W1&type=embuscade"
```

**Export GeoJSON direct des opérations de la Zone Autonome d'Alger (ZAA) :**
```bash
curl -X GET "https://alnop.vercel.app/api/v1/operations?wilaya=ZAA&format=geojson"
```

---

## 3. Fiche Unitaire d'une Opération

### `GET /api/v1/operations/:id`

Récupère la notice complète d'une opération selon son identifiant unique.
*Format d'identifiant tolérant : accepte `OP_1956_042`, `OP-1956-042`, `op_1956_042`.*

#### Exemple de requête :
```bash
curl -X GET "https://alnop.vercel.app/api/v1/operations/OP_1954_001"
```

#### Exemple de réponse JSON :
```json
{
  "meta": {
    "api_version": "v1",
    "status": "success",
    "total": 1,
    "count": 1,
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Ghemri M. (ALN Historical Operations Dataset)",
    "documentation": "https://alnop.vercel.app/api/docs",
    "timestamp": "2026-11-03T22:30:00.000Z",
    "applied_filters": {
      "id": "OP_1954_001"
    }
  },
  "data": {
    "id": "OP_1954_001",
    "nom_operation": "Déclenchement du 1er Novembre 1954 (« Toussaint rouge »)",
    "date_debut": "1954-11-01",
    "date_fin": "1954-11-01",
    "wilaya_concernee": "Toutes zones (Zones I à V)",
    "wilaya_code": "W1",
    "wilaya_label_fr": "Wilaya I (Aurès)",
    "wilaya_label_ar": "الولاية الأولى (الأوراس - النمامشة)",
    "wilaya_color": "#c0392b",
    "type_action": "Attaques coordonnées et sabotages simultanés",
    "localisation": {
      "region_ou_ville": "Ensemble du territoire algérien (Aurès, Kabylie, Mitidja, Nord-Constantinois, Oranie)",
      "coordonnees_approximatives": {
        "latitude": 35.15,
        "longitude": 6.55
      }
    },
    "description": "Série d'une trentaine d'attentats et sabotages coordonnés...",
    "impact_strategique": "Acte fondateur marquant le passage officiel à la lutte armée...",
    "commandement_aln": [
      "Mustapha Ben Boulaïd",
      "Didouche Mourad",
      "Krim Belkacem",
      "Rabah Bitat",
      "Larbi Ben M'hidi"
    ],
    "bilan_et_pertes": {
      "aln": "Quelques blessés et interpellés",
      "forces_francaises": "7 morts militaires et policiers",
      "civils": "1 colon et 1 instituteur tués"
    },
    "sources": [
      {
        "titre": "Déclaration du 1er Novembre 1954 (Secrétariat général du FLN)",
        "type_source": "Archive institutionnelle / Document fondateur",
        "url": "https://www.el-mouradia.dz/"
      }
    ]
  }
}
```

---

## 4. Statistiques & Agrégations

### `GET /api/v1/stats`

Renvoie des indicateurs synthétiques sur la totalité du jeu de données ou sur un sous-ensemble filtré (accepte les mêmes filtres que `/api/v1/operations`).

#### Exemple de requête :
```bash
curl -X GET "https://alnop.vercel.app/api/v1/stats"
```

#### Exemple de réponse JSON :
```json
{
  "meta": {
    "api_version": "v1",
    "status": "success",
    "total": 263,
    "count": 1,
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Ghemri M. (ALN Historical Operations Dataset)",
    "timestamp": "2026-11-03T22:30:00.000Z"
  },
  "data": {
    "total_operations": 263,
    "by_year": {
      "1954": 11,
      "1955": 17,
      "1956": 51,
      "1957": 53,
      "1958": 54,
      "1959": 20,
      "1960": 18,
      "1961": 18,
      "1962": 21
    },
    "by_wilaya": {
      "W1": { "code": "W1", "label_fr": "Wilaya I (Aurès)", "count": 29 },
      "W2": { "code": "W2", "label_fr": "Wilaya II (Nord-Constantinois)", "count": 31 },
      "W3": { "code": "W3", "label_fr": "Wilaya III (Kabylie)", "count": 34 },
      "W4": { "code": "W4", "label_fr": "Wilaya IV (Algérois)", "count": 33 },
      "ZAA": { "code": "ZAA", "label_fr": "Zone Autonome d'Alger", "count": 25 },
      "ZAO": { "code": "ZAO", "label_fr": "Zone Autonome d'Oran (ZAO)", "count": 14 },
      "W5": { "code": "W5", "label_fr": "Wilaya V (Oranie)", "count": 30 },
      "W6": { "code": "W6", "label_fr": "Wilaya VI (Sahara)", "count": 23 },
      "EMG": { "code": "EMG", "label_fr": "Base de l'Est & EMG", "count": 20 },
      "W7": { "code": "W7", "label_fr": "7e Wilaya (Fédération de France)", "count": 24 }
    },
    "top_action_types": [
      { "type": "Embuscade", "count": 68 },
      { "type": "Bataille rangée", "count": 47 },
      { "type": "Attaque de poste fortifié", "count": 38 },
      { "type": "Opération de guérilla urbaine", "count": 35 }
    ]
  }
}
```

---

## 5. Référentiel des Wilayas Historiques

### `GET /api/v1/wilayas`

Retourne le répertoire complet des 10 circonscriptions territoriales de la Révolution avec leurs codes, dénominations bilingues et codes couleur.

#### Exemple de requête :
```bash
curl -X GET "https://alnop.vercel.app/api/v1/wilayas"
```

---

## Codes HTTP et Gestion d'Erreurs Standardisée

Toutes les erreurs renvoyées par l'API respectent un schéma JSON standardisé et prévisible (ALNOP-005, ALNOP-006, ALNOP-009) sans jamais divulguer de détails d'infrastructure ou de traces internes :

| Code HTTP | Signification | Contexte |
| :--- | :--- | :--- |
| `200 OK` | Succès | Requête traitée avec succès. |
| `204 No Content` | Succès (Preflight) | Réponse aux requêtes de pré-vol CORS (`OPTIONS`). |
| `400 Bad Request` | Paramètre invalide | Paramètre malformé (`limit`, `page`, `year`, plage de dates chronologiquement inversée). |
| `404 Not Found` | Ressource introuvable | Identifiant d'opération inexistant. |
| `405 Method Not Allowed` | Méthode interdite | Utilisation d'une méthode autre que `GET` ou `OPTIONS`. |
| `500 Internal Server Error` | Erreur serveur | Erreur interne inattendue (message assaini sans fuite technique). |

#### Schéma d'erreur standard (400, 404, 405, 500) :
```json
{
  "status": "error",
  "error": "Bad Request",
  "message": "Le paramètre 'limit' doit être un nombre entier positif compris entre 1 et 300."
}
```

---

## Exemples d'Intégration Programmatique

### Python (avec `requests` et `pandas`)

```python
import requests
import pandas as pd

# 1. Récupération des opérations de l'année 1956
url = "https://alnop.vercel.app/api/v1/operations"
params = {
    "year": "1956",
    "limit": 100
}

response = requests.get(url, params=params)
response.raise_for_status()

payload = response.json()
print(f"Total opérations 1956 : {payload['meta']['total']}")

# 2. Conversion directe en DataFrame Pandas
df = pd.DataFrame(payload["data"])
print(df[["id", "nom_operation", "date_debut", "wilaya_code"]].head())
```

---

### JavaScript (ES6+ / Node.js / Navigateur)

```javascript
// Récupérer les opérations de la Zone Autonome d'Alger (ZAA)
async function fetchAlgerOperations() {
  const url = new URL('https://alnop.vercel.app/api/v1/operations');
  url.searchParams.set('wilaya', 'ZAA');
  url.searchParams.set('limit', '50');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  
  const { meta, data } = await res.json();
  console.log(`Chargé ${data.length} opérations sur un total de ${meta.total}`);
  
  data.forEach(op => {
    console.log(`[${op.date_debut}] ${op.nom_operation} (${op.wilaya_label_fr})`);
  });
}

fetchAlgerOperations();
```

---

### R (avec `httr2` et `jsonlite`)

```r
library(httr2)
library(jsonlite)

# Requête vers l'API v1
req <- request("https://alnop.vercel.app/api/v1/operations") |>
  req_url_query(wilaya = "W3", year = "1957")

resp <- req_perform(req)
body <- resp_body_json(resp)

# Affichage des métadonnées et opérations
cat("Nombre d'opérations trouvées :", body$meta$total, "\n")
operations_df <- as.data.frame(do.call(rbind, body$data))
```

---

### Import direct dans QGIS / Leaflet (GeoJSON)

Pour afficher directement les opérations dans **QGIS** sans télécharger de fichier :
1. Dans QGIS, allez dans **Couche > Ajouter une couche > Ajouter une couche vecteur**.
2. Sélectionnez **Protocole : HTTP(S), cloud, etc.**
3. Collez l'URL GeoJSON :
   `https://alnop.vercel.app/api/v1/operations?format=geojson`
4. Cliquez sur **Ajouter**. Les points GPS avec l'intégralité des attributs (titre, bilans, sources, impact) s'affichent instantanément dans votre projet SIG !

---

## Conditions d'Utilisation et Citation

Ce jeu de données et son API sont mis à disposition selon les termes de la licence **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**.

Vous êtes libre de :
* **Partager** — copier, distribuer et communiquer le matériel par tous moyens et sous tous formats.
* **Adapter** — remixer, transformer et créer à partir du matériel pour toute utilisation, y compris commerciale.

**Sous réserve de respecter la mention d'attribution suivante dans vos publications, visualisations ou applications :**

> **Citation recommandée :**
> Ghemri M., *Jeu de données historiques et cartographie interactive des opérations de l'ALN (1954–1962)*, API REST v1.0, 2026. URL : https://alnop.vercel.app/
## Assertions sourcées : complément facultatif

Une fiche peut inclure le champ additionnel `scientific_claims` lorsqu’elle possède des assertions publiées après revue. Chaque assertion conserve sa valeur, son statut documentaire, ses passages sources, ses liens de contradiction et son historique de revue. Les champs historiques de la fiche restent conservés ; aucune version divergente n’est choisie automatiquement.

Sans assertion publiée, ce champ est absent. Les statistiques de fiches restent distinctes du nombre d’assertions. L’export complet des assertions publiées se trouve dans `data/canonical/claims.json`. Voir [la politique de provenance](PROVENANCE_POLICY.md) pour la sémantique et les limites.
## API v2 et provenance

L’API v1 reste disponible avec ses contrats de compatibilité. La nouvelle API v2 expose les fiches canoniques, les sources, les assertions, les référentiels et les indicateurs documentaires. Voir [le guide de l’API v2](API_V2.md) pour les filtres, la pagination et le contrat OpenAPI.
