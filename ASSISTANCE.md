# Assistance à la revue scientifique

Ces outils produisent des diagnostics internes. Ils ne fusionnent aucune fiche, ne créent aucun lien de contradiction et ne modifient pas les décisions scientifiques. Les rapports contenant des brouillons restent hors des exports publics.

## Rapprocher deux fiches

`npm run quality:duplicates` compare les titres français et arabes ainsi que les variantes explicitement sourcées dans `aliases`. Chaque variante contient `value`, `language` et `source_ids`. Ses sources doivent appartenir à la fiche ; son ajout à une fiche initiale exige une révision revue.

Le rapport conserve les deux noms comparés et leurs références, la similarité, le chevauchement des dates, les lieux explicitement reliés et la distance entre sites revus. Des dates incompatibles sont une réserve de revue, pas une preuve automatique de distinction. Un même lieu, une même date ou une source commune ne suffisent pas à établir une identité.

L'algorithme `sourced-names-trigrams-v2` conserve les seuils documentés de la version précédente. Les six paires synthétiques existantes mesurent toujours une précision et un rappel de 0,75. Ces résultats ne mesurent pas la qualité historique du corpus.

## Constituer un benchmark historique

Le dossier `data/duplicate-assessments` accueille des annotations explicites : paire de fiches, décision `same_event`, `distinct_events` ou `uncertain`, justification, sources et passages précis. Le schéma `schemas/duplicate-assessment.schema.json` décrit les champs.

Une annotation `reviewed` exige une approbation liée à son contenu, les empreintes des deux fiches et celles de ses sources. Une modification ultérieure d'une fiche ou d'une source rend l'annotation périmée pour le calcul. Une décision incertaine ou non revue reste exclue. Les changements de décision doivent préserver les revues précédentes et recevoir une nouvelle approbation.

`work/duplicate-human-evaluation.json` indique les annotations utilisables, les faux positifs et faux négatifs, la précision et le rappel. Sans annotations suffisantes, les indicateurs sont `null`, jamais une performance supposée. Le registre historique est actuellement vide : aucune calibration historique n'est revendiquée. Une empreinte garantit la liaison à un contenu ; elle n'authentifie pas l'identité du reviewer.

## Examiner les divergences d'assertions

`npm run quality:conflicts` compare uniquement les assertions structurées partageant exactement un sujet et un prédicat. Il n'extrait pas de faits des récits historiques.

Le contexte optionnel précise le périmètre (`scope`), la population et la période : événement entier, période explicite ou période inconnue. Une période explicite exige deux dates ordonnées. Une comparaison sans contexte est signalée comme incomplète ; des contextes différents ne sont pas assimilés.

Les valeurs numériques peuvent être exactes ou des intervalles `{ "type": "interval", "lower": 10, "upper": 20 }`. Les unités doivent être identiques et renseignées. Des intervalles qui se recouvrent signalent une précision compatible. Zéro reste distinct d'une valeur inconnue. Les textes ne sont comparés que dans une langue commune ; aucune traduction ni équivalence sémantique n'est inventée. Une différence textuelle demande une lecture des sources.

Les liens de contradiction déjà enregistrés sont distingués des suggestions. Les rapports JSON et Markdown expliquent la raison de chaque comparaison, sans attribuer automatiquement le statut « contesté ».

## Consulter et comparer sur le site

La page [Comparer les fiches](docs/compare.html) est disponible dans le menu de l'atlas et depuis chaque fiche. Choisissez une fiche seule pour examiner ses sources ou ajoutez une deuxième fiche pour une lecture côte à côte. Les deux listes contiennent toutes les fiches publiées et peuvent être filtrées par identifiant, titre ou variante de nom.

Les dates conservent leurs intervalles, leur précision et leur certitude. Les localisations indiquent leur rôle géométrique et leur état de revue. Les attributions territoriales structurées sont séparées des libellés hérités. Les références partagées sont identifiées par leur identifiant permanent ; elles ne prouvent pas l'identité des événements.

Les assertions et leurs passages sources sont affichés par fiche. Les comparaisons d'assertions restent limitées à un même sujet et prédicat, au sein de cette fiche ; deux événements distincts ne sont pas assimilés pour produire une contradiction artificielle. Les textes originaux sont conservés et l'absence de traduction est signalée. L'interface fonctionne en français et en arabe, sur mobile et ordinateur.

Le bouton d'export produit un JSON contenant les fiches sélectionnées, leurs références, les assertions publiées, les comparaisons, l'empreinte du snapshot, la version archivée lorsqu'elle correspond et l'empreinte du moteur de calcul. Le lien de la page conserve la sélection et la langue au moment de l'affichage. Les données et le moteur sont vérifiés avant affichage ; une incohérence empêche l'affichage des résultats.

La page publique ne publie pas la liste interne des candidats, des brouillons ni des annotations de calibration. Un lien « Proposer une correction » ouvre le formulaire avec la fiche sélectionnée ; aucune modification directe du corpus n'est effectuée.

## Limites documentaires

Le corpus publié ne contient actuellement aucune assertion structurée. Un rapport vide signifie donc absence de comparaison structurée, pas absence de contradictions historiques. Les 263 fiches initiales et l'archive `data-2026.11.1` restent inchangées.

L'alimentation des annotations par une revue documentaire reste à réaliser. La documentation est accessible directement sur Vercel et GitHub Pages ; les diagnostics internes sont conservés comme artefacts des contrôles du dépôt.
