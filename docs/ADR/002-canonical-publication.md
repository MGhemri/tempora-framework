# ADR 002 — Publication depuis le corpus canonique

Statut : mis en œuvre, remplace la prévisualisation technique décrite dans ADR 001. Décision réversible, sans modification de licence ou de fait historique par inférence.

## Décision

`data/` devient la source des fichiers utilisés par l’atlas et l’API v1. `npm run build` valide puis génère les exports et la documentation. `npm run check:canonical` vérifie les fichiers générés versionnés et leurs copies publiques. Les quatre fichiers initiaux sont reproduits sans changement de contenu sur le corpus de départ.

Le snapshot immuable `migrations/legacy-initial.json` et le contrat v1 de phase 0 protègent les 263 IDs et les objets initiaux. Les tests de contrat sont exécutés sur ce snapshot, afin de ne plus bloquer un ajout légitime. Une révision documentée conserve les valeurs initiales dans legacy.

## Revue et publication

Un statut published dans une nouvelle fiche exige des sources, un type contrôlé, human_review_recorded=true et une dernière décision approved avec référence, date, reviewer et justification. Ces vérifications assurent une trace structurée ; elles ne certifient pas l’identité du reviewer ni l’authenticité d’une approbation externe. La revue effective et la fusion restent sous la responsabilité du mainteneur. Le nombre obligatoire de reviewers et les protections de branche restent des décisions de gouvernance.

Les propositions reçues par SMTP ont des pièces jointes Markdown et JSON. Un outil prépare une nouvelle opération en brouillon dans work/prepared, sur choix explicite d’un ID par le mainteneur. Il ne déduit ni type d’action, territoire, traduction, source bibliographique structurée ou coordonnées. Aucun envoi ne modifie directement le canon.

## Compatibilité

Les anciens objets restent identiques. Les fiches nouvelles ou révisées disposent en plus de canonical_metadata pour préserver précision, territoires multiples et revue. Les attributs non exprimables exactement en v1 restent inconnus, plutôt que de produire une fausse précision. Les expressions régulières historiques sont réservées aux anciennes fiches ; les nouveaux territoires proviennent du canon.

## Déploiement

Vercel exécute les validations et tests Node avant la publication ; GitHub Pages vérifie aussi les exports, les tests et le validateur Python avant l’envoi des fichiers. Un échec interrompt le déploiement. Les rapports JSON et Markdown de validation sont conservés comme artefacts CI. Les versions publiées précédemment restent disponibles pour revenir à un déploiement antérieur en cas d’incident.

## Limites

Pas d’arbitrage historique automatique, d’édition publique du corpus, de fusion de doublons ou de publication automatique après réception SMTP. Les dix catégories territoriales initiales restent éditoriales et sans frontières inventées. La politique de retrait, les versions scientifiques, le modèle complet d’assertions et l’API v2 restent à traiter.
