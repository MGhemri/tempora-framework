# TEMPORA — checkpoint opérationnel post-PR #122 / #123

Date : 10 novembre 2026. Main HEAD : 8303f14de625453de9fa83f7de7b6635efe3bf20.

## Travail fusionné

- PR #122, merge 515cd84ce6c5df99325b09c6054d4e64ba4866b7 : la sonde native Windows utilise NtCreateFile RootDirectory relatif à des handles épinglés pour créer exclusivement ses fichiers de verrou et staging. Le writer scientifique packagé reste désactivé. CI PR Framework 42894941041, Docs 42894941018, Desktop Windows 42894941063 : success. CI main 42895938001, 42895937903, 42895937799 : success.
- PR #123, merge 8303f14de625453de9fa83f7de7b6635efe3bf20 : GraphLab J11 affiche les arêtes déclarées selon un layout déterministe, sans relations inférées ; multiarêtes/boucles et références kind+namespace+id restent distinctes. Boutons accessibles au clavier et sélection partagée. CI PR à jour 42896763955, 42896764282, 42896764243 : success. CI postmerge main 42897587821, 42897587594, 42897587702 : vérifier avant de revendiquer success.

## Microsoft Store

Le propriétaire déclare avoir publié Desktop 0.2.0 à partir de la CI #42854145980, artefact #13781418953, commit 3c2b7bb. La mise à disposition effective et le SHA de l'AppX uploadé ne sont pas vérifiés ici. Ces lots postérieurs ne sont pas encore diffusés sur le Store. Aucune soumission automatique.

## Restant en P0 — à ne pas effacer

1. SEC-WIN-01/02 : créer aussi les sous-répertoires de façon handle-relative et fermer la dépendance au renommage absolu ; tester ACL, jonctions, volumes et processus concurrents sur Windows réel.
2. SCI-01 : lier les deux décisions humaines et les cinq SHA à une autorité hôte–Rust authentifiée, pas seulement à un champ booléen SDK.
3. REC-01 : reprise ou abandon après incident explicitement demandé et journalisé par l'opérateur ; ni purge ni promotion silencieuse.
4. DUR-01 : tests de coupures OS/alimentation sur NTFS, pas seulement arrêt de processus.
5. TVRW J12 : navigation croisée Geo/Graph/Chronos, volumes importants, accessibilité et ressources locales avec droits vérifiés. TensorFlow après évaluation des contrats scientifiques.

Aucun writer canonique actif dans les installateurs, changement de schéma v3, release npm/GitHub ou Store automatique.