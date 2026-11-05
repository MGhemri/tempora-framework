# Méthodologie scientifique, historique et cartographique

> **Atlas Historique de l'ALN & Dataset des Opérations Militaires (1954–1962)**  
> *Projet de recherche en humanités numériques et histoire militaire de la Révolution algérienne.*

---

## 1. Cadre historique et périodisation

L'objectif de ce projet est de documenter, qualifier, géolocaliser et sourcer rigoureusement les actions armées, embuscades, batailles, sabotages et opérations de guérilla conduits par le Front de Libération Nationale (FLN) et l'Armée de Libération Nationale (ALN) entre le 1er novembre 1954 et juillet 1962.

### Évolution de la structuration territoriale (1954–1962)
L'organisation politico-militaire de la Révolution n'a pas été figée : elle a connu plusieurs mutations fondamentales que ce dataset respecte scrupuleusement :

1. **Novembre 1954 (Les 5 Zones du déclenchement)** :
   - Zone I : Aurès-Nemencha (Mostefa Ben Boulaïd)
   - Zone II : Nord-Constantinois (Didouche Mourad)
   - Zone III : Kabylie (Krim Belkacem)
   - Zone IV : Algérois (Rabah Bitat)
   - Zone V : Oranie (Larbi Ben M'hidi)
   - *Règle méthodologique* : Les actions antérieures au 20 août 1956 sont décrites dans leur zone de départ (ex. les attaques de Biskra au 1er novembre 1954 relèvent de la Zone I). On n'applique pas rétroactivement un rattachement ultérieur.

2. **Août 1956 (Le Congrès de la Soummam et les 6 Wilayas)** :
   - Le Congrès de la Soummam réorganise le territoire national en six Wilayas historiques (Wilayas I à VI) et dote la capitale d'un statut particulier : la **Zone Autonome d'Alger (ZAA)**, commandée par Yacef Saâdi.

3. **1958–1960 (Fédération de France & Armée des Frontières)** :
   - Structuration de la **Fédération de France du FLN** (dite « 7e Wilaya »), ouvrant un second front urbain en métropole (sabotages de dépôts pétroliers de Mourepiane, actions ciblées contre les infrastructures policières et industrielles).
   - Structuration de la Base de l'Est (Ghardimaou) et de la Base de l'Ouest (Oujda) sous l'autorité de l'État-Major Général (EMG).

4. **Printemps–Été 1962 (La Zone Autonome d'Oran - ZAO)** :
   - Créée en avril 1962 sous le commandement du capitaine Djelloul Nemiche (dit « Bakhti »), la **Zone Autonome d'Oran (ZAO)** est mise en place pour encadrer la population algérienne des faubourgs (Médina Jdida, Les Planteurs, El Hamri, Médioni), ériger des lignes d'autodéfense face aux attentats de l'OAS, maintenir un réseau sanitaire clandestin et sécuriser le scrutin d'autodétermination de juillet 1962.

---

## 2. Principes géographiques et conventions cartographiques

### A. Lieux repères vs positions tactiques métriques
Dans une guerre de guérilla asymétrique, les combats se déroulent fréquemment sur des massifs entiers (Djebel Tessala, Djebel Amour, Monts du Dahra, Aurès), dans des gorges escarpées ou le long de routes d'embuscades de plusieurs kilomètres :
- **Ancrage communal et orographique** : Chaque coordonnée GPS `[longitude, latitude]` (au standard WGS84 / EPSG:4326) représente un ancrage géographique avéré : commune historique, douar, col (*teniet*), point d'eau (*aïn* ou *oued*), ou sommet de massif (*djebel*).
- **Précision explicite** : Les coordonnées n'ont pas la prétention d'indiquer l'emplacement métrique de chaque tiraillement au fusil ou de chaque poste de repli, mais fournissent un positionnement scientifique vérifiable à l'échelle de la région militaire concernée.

### B. Le Grand Sud et les limites sahariennes
- Contrairement aux découpages coloniaux ou aux frontières administratives post-indépendance, les limites des Wilayas sahariennes (Wilaya VI et prolongements de la Wilaya V) n'étaient pas des frontières linéaires étanches.
- **Principe de neutralité cartographique** : Aucun polygone artificiel n'a été inventé dans le Sahara. Les actions documentées (Timimoun, Ouargla, Touggourt, Djanet, Hassi Messaoud) sont rigoureusement rattachées à leur structure historique sans déduction géométrique extrapolée.

---

## 3. Corpus et précautions critiques d'interprétation

Le corpus consolidé comprend **263 opérations militaires documentées**. La lecture des données impose plusieurs règles critiques propres aux humanités numériques :

1. **Une notice n'est pas un simple décompte de « bataille isolée »** :
   - Une notice constitue une unité d'analyse documentaire.
   - Un lieu ou une zone de maquis peut regrouper plusieurs épisodes d'affrontements s'étant déroulés sur plusieurs jours ou lors de ratissages successifs (ex: Opérations Challe, Jumelles, Couronne).
2. **Unification des variantes toponymiques** :
   - Les sources orales et écrites présentent parfois des translittérations divergentes. Par exemple, la **Bataille des Ghoualem** et de **Sidi Ghalem** (18–20 juillet 1956) désigne le même engagement majeur sous deux toponymes usuels ; ils sont ainsi réunis dans une notice synthétique avec mention explicite des variantes.
3. **Conservation des divergences historiographiques de datation** :
   - Lorsque des sources académiques ou des rapports d'archives divergent (ex: datation de la bataille de *Fellaoucene*, de *Bou Atrous* ou d'*El Merdja*), les dates alternatives ne sont pas masquées : elles sont signalées dans le champ `description` et `deroulement`.
4. **Distinction des types d'actions** :
   - Le dataset catégorise chaque événement selon une typologie militaire stricte : *Offensive coordonnée*, *Embuscade*, *Accrochage*, *Attaque de poste militaire*, *Sabotage d'infrastructure*, *Guérilla urbaine & Fidaï*, *Bataille rangée*, *Résistance défensive*.

---

## 4. Appareil critique et traçabilité des sources

Chaque opération militaire fait l'objet d'un croisement méthodique entre plusieurs sources indépendantes :

- **Revues scientifiques universitaires (Portail ASJP / CERIST)** :
  - Consultation systématique des articles de la *Revue d'histoire maghrébine*, de la revue *El-Bahith*, de *Recherches historiques*, etc. (ex. études spécialisées sur la bataille du rail dans le secteur oranais, les sabotages ferroviaires, la logistique des armes).
- **Centre de Recherche en Anthropologie Sociale et Culturelle (CRASC)** :
  - Publications de référence de la revue scientifique ***Insaniyat*** (notamment les travaux de Saddek Benkada sur la Zone Autonome d'Oran, les analyses des structures territoriales et de la crise de l'été 1962).
- **Archives institutionnelles & Dépêches historiques** :
  - Dépêches d'archives de l'**Algérie Presse Service (APS)**, dossiers de mémoire du journal *El Moudjahid*, publications du Ministère des Moudjahidine et des Ayants droit.
- **Archives militaires & sources contradictoires** :
  - Journaux des Marches et Opérations (JMO) du Service Historique de la Défense (SHD), rapports du Centre de Recherche de la Gendarmerie Nationale (CRGN), synthèses de la presse quotidienne d'époque (1954–1962).

---

## 5. Formats, Science Ouverte et Réutilisation Scientifique

Ce corpus est mis à disposition dans un esprit de **Science Ouverte** (*Open Data / Open Science*) :

- **GeoJSON standardisé (RFC 7946)** : `operations_fln_1954_1962.geojson` directement exploitable sous QGIS, ArcGIS, Mapbox, Leaflet, Keplr.gl ou Python (GeoPandas).
- **JSON hiérarchique documenté** : `operations_fln_1954_1962.json` contenant la totalité des métadonnées, bilans estimés, commandements et bibliographie.
- **Interopérabilité & Traitement Computationnel** : L'utilisation de ce corpus pour le traitement automatique des langues (TAL / NLP), l'analyse quantitative et la recherche computationnelle en histoire est encouragée sous mention de la paternité du projet.

### Contact & Correspondance académique
Pour toute question méthodologique, suggestion d'archives ou signalement d'ajustement historique, l'auteur (**Ghemri M.**) est joignable à l'adresse suivante :  
 **contact@connect-gm.com**

### Citation académique recommandée
```bibtex
@dataset{aln_operations_dataset_2026,
  author       = {Ghemri, M.},
  title        = {FLN/ALN Historical Military Operations Dataset (1954–1962): Base de données géospatiale et corpus documentaire},
  year         = {2026},
  publisher    = {GitHub / Vercel},
  version      = {v0.1.0-dev},
  url          = {https://alnop.vercel.app/},
  note         = {Contact: contact@connect-gm.com}
}
```
