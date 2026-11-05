# Guide de l'API REST v1 (Développeurs & Chercheurs)

L'**API REST v1** fournit un accès programmatique direct, filtrable et géoréférencé aux **263 opérations militaires documentées** de l'Armée de Libération Nationale (1954–1962).

Elle est conçue pour les chercheurs en sciences humaines numériques (*Digital Humanities*), les data scientists, les historiens et les développeurs souhaitant intégrer ces données dans des applications web, mobiles ou des projets SIG.

---

## Informations Clés

| Propriété | Spécification |
| :--- | :--- |
| **URL de Base** | `https://alnop.vercel.app/api/v1` |
| **Version actuelle** | `v1.0.0` |
| **Authentification** | **Aucune (100% Libre, Publique et Gratuite)** |
| **CORS** | `Access-Control-Allow-Origin: *` (autorisé depuis n'importe quel domaine web) |
| **Mise en cache** | Edge CDN mondial (`s-maxage=86400` — latence < 15 ms) |
| **Formats de sortie** | JSON (`application/json`) et GeoJSON RFC 7946 (`application/geo+json`) |
| **Licence** | [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) |
| **Attribution requise** | `Auteur : Ghemri M. — Source : ALN Historical Operations Dataset (1954–1962)` |

---

## Répertoire des Endpoints

### 1. Index & Métadonnées : `GET /api/v1`
Retourne la version de l'API, le total des opérations, la licence et la liste des routes.
```bash
curl -X GET "https://alnop.vercel.app/api/v1"
```

---

### 2. Collection des Opérations : `GET /api/v1/operations`
Permet d'interroger et de filtrer l'ensemble du corpus avec des paramètres combinables.

#### Paramètres d'URL supportés :
* `wilaya` : Code de la Wilaya (`W1`, `W2`, `W3`, `W4`, `W5`, `W6`, `W7`, `ZAA`, `ZAO`, `EMG`) ou liste séparée par des virgules (ex: `?wilaya=W1,W3`).
* `year` : Année de début (`1954` à `1962`) (ex: `?year=1956`).
* `type` : Filtre partiel insensible à la casse sur le type d'action (ex: `?type=embuscade`).
* `q` ou `search` : Recherche plein-texte multi-champs en français et en arabe (ex: `?q=souika`).
* `date_from` / `date_to` : Filtrage par intervalle de dates (`YYYY-MM-DD`).
* `format` : `json` (par défaut) ou `geojson` (FeatureCollection SIG standard RFC 7946).
* `limit` : Nombre de fiches par page (défaut : `50`, maximum : `300`).
* `page` : Numéro de la page (défaut : `1`).
* `sort` : Ordre chronologique : `date_asc` (par défaut) ou `date_desc`.

#### Exemples de requêtes :
```bash
# Opérations de l'année 1954 (Déclenchement)
curl -X GET "https://alnop.vercel.app/api/v1/operations?year=1954"

# Embuscades dans la Wilaya I (Aurès)
curl -X GET "https://alnop.vercel.app/api/v1/operations?wilaya=W1&type=embuscade"

# Export GeoJSON direct pour la Zone Autonome d'Alger (ZAA)
curl -X GET "https://alnop.vercel.app/api/v1/operations?wilaya=ZAA&format=geojson"
```

---

### 3. Fiche Unitaire : `GET /api/v1/operations/:id`
Récupère l'intégralité d'une notice par son identifiant unique. Tolère les variantes `OP_1956_042` ou `OP-1956-042`.
```bash
curl -X GET "https://alnop.vercel.app/api/v1/operations/OP_1954_001"
```

---

### 4. Statistiques & Agrégations : `GET /api/v1/stats`
Renvoie la répartition globale (ou filtrée) par année (1954–1962), par Wilaya et par type d'action militaire.
```bash
curl -X GET "https://alnop.vercel.app/api/v1/stats"
```

---

### 5. Référentiel des Wilayas : `GET /api/v1/wilayas`
Retourne le répertoire des 10 circonscriptions territoriales historiques de la Révolution avec leurs codes, dénominations bilingues FR/AR et codes couleur officiels.
```bash
curl -X GET "https://alnop.vercel.app/api/v1/wilayas"
```

---

## Exemples d'Intégration Rapide

### Python (avec `requests` et `pandas`)

```python
import requests
import pandas as pd

# 1. Interroger l'API pour l'année 1956
res = requests.get(
    "https://alnop.vercel.app/api/v1/operations",
    params={"year": "1956", "limit": 100}
)
res.raise_for_status()

payload = res.json()
print(f"Total opérations 1956 : {payload['meta']['total']}")

# 2. Conversion directe en DataFrame Pandas
df = pd.DataFrame(payload["data"])
print(df[["id", "nom_operation", "date_debut", "wilaya_label_fr"]].head())
```

---

### JavaScript (ES6+ / Node.js / Fetch)

```javascript
async function getWilaya3Battles() {
  const url = "https://alnop.vercel.app/api/v1/operations?wilaya=W3&type=bataille";
  const res = await fetch(url);
  const { meta, data } = await res.json();
  
  console.log(`Trouvé ${meta.total} batailles documentées en Wilaya III :`);
  data.forEach(op => {
    console.log(`- [${op.date_debut}] ${op.nom_operation}`);
  });
}

getWilaya3Battles();
```

---

### Intégration en direct dans QGIS (Flux GeoJSON)

Pour afficher les 263 opérations dans **QGIS** en temps réel sans télécharger de fichier :
1. Dans QGIS : **Couche > Ajouter une couche > Ajouter une couche vecteur**.
2. Source : Sélectionner **Protocole : HTTP(S), cloud, etc.**.
3. URL : `https://alnop.vercel.app/api/v1/operations?format=geojson`
4. Cliquer sur **Ajouter**. Les marqueurs et tous leurs attributs s'affichent instantanément sur votre fond de carte.

---

## Citation Scientifique & Licence

Les données sont publiées sous licence **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. Tout usage dans un article, un mémoire ou un projet numérique doit mentionner :

> **Citation recommandée :**  
> Ghemri M., *Atlas historique et cartographie des opérations de l'ALN (1954–1962)*, API REST v1.0, 2026. URL : https://alnop.vercel.app/
