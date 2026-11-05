# ADR 001 — Import canonique conservateur, en prévisualisation

Statut historique : cette proposition a été remplacée par ADR 002, qui relie désormais le canon aux exports publics.

Le modèle d'import 2.0.0 stocke chaque fiche séparément et conserve son objet legacy complet. Les dates partielles deviennent des intervalles avec précision explicite et certitude inconnue. Les traductions absentes restent nulles. Aucun territoire canonique n'est attribué par expression régulière. Les points hérités sont représentatifs, à revoir ; aucune précision métrique n'est inventée.

Les sources sont dédupliquées uniquement lorsque leur objet JSON est identique ; un hash identifie cette représentation, pas l'identité bibliographique d'une œuvre. Leurs métadonnées complètes restent dans `legacy`. Les fiches déjà publiques gardent `published` avec `human_review_recorded:false`, sans prétendre à une nouvelle validation scientifique.

Les schémas actuels décrivent strictement le profil d'import initial. Les territoires approuvés, géométries multiples, assertions et entités exigent des schémas complémentaires avant leur saisie. Ils ne sont pas simulés par des référentiels vides.

La racine legacy demeure la source publique durant cette étape. `data/` et `generated/` constituent une prévisualisation versionnée. Ce double état est temporaire : ne pas éditer les deux représentations. L'import refuse d'écraser un fichier canonique déjà modifié. Le gel de phase 0 protège les quatre exports publics.

Avant bascule : valider le modèle scientifique ; étendre le modèle des références territoriales et de provenance ; adapter la publication aux nouvelles fiches ; distinguer les invariants des 263 originaux des ajouts autorisés ; relier la génération canonique aux chemins legacy et au déploiement. Aucune migration irréversible ou modification de licence n'est effectuée.
