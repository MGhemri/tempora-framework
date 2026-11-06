# Versions du framework TEMPORA

## 3.0.0-dev.0 — version de travail

- Noyau testé hors des données ALNOP sur deux profils synthétiques.
- Contrats de profils et modèle canonique v3, avec validation technique et empreintes reproductibles.
- Import local JSON, CSV et GeoJSON, y compris les lots multi-types, la quarantaine et la sélection explicite.
- Revue liée au contenu et à une empreinte de journal conservée séparément.
- Versions immuables vérifiables, exports publics et API v3 locale en lecture seule.
- SDK CommonJS, types TypeScript et CLI distribuables dans un tarball indépendant.
- Recherche de rapprochements par index lexical et mesures sur corpus synthétiques.

## Transition depuis les outils du profil historique

Les scripts npm historiques restent disponibles pour la compatibilité. Pour un nouveau projet, utiliser le SDK ou la CLI du tarball, puis fournir un manifeste de profil et des mappings explicites. Le [guide du framework](FRAMEWORK.md) décrit le parcours. Le [guide de migration](CANONICAL_MODEL.md) couvre le modèle canonique et l’aller-retour avec ALNOP.

Le code du framework relève de la [licence MIT](LICENSE). Chaque publication de données porte ses droits et sa citation propres. Les versions archivées du corpus ALNOP figurent dans le [journal des données](https://github.com/MGhemri/aln-historical-operations-dataset/blob/2428a693393a4a635d5eeac3e3c8542498b8b9d6/CHANGELOG.md).

## Changements en cours de finalisation

- Compatibilité ALNOP facultative, avec référence externe épinglée et contrôle des empreintes.
- Tests et CI du framework indépendants du corpus historique ; tests navigateur dédiés aux guides TEMPORA.
- Exemple d’ingestion synthétique et métadonnées logicielles TEMPORA.
- Les copies historiques restantes font l’objet d’un retrait contrôlé séparé.

Les notes de versions des données sont conservées dans le [dépôt ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset/blob/2428a693393a4a635d5eeac3e3c8542498b8b9d6/CHANGELOG.md).
