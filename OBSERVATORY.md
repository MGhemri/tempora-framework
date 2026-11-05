# Observatoire des lacunes documentaires

[Ouvrir l’observatoire](docs/observatory.html)

L’observatoire décrit la documentation actuellement publiée dans ALNOP. Il ne mesure ni l’intensité réelle des opérations, ni l’exhaustivité historique de la guerre. Une sélection vide signifie **« aucune fiche actuellement recensée »**, jamais « aucune opération historique ».

## Utiliser le tableau

Choisir une période, un territoire structuré, un type, une précision de début ou la présence d’une géométrie, puis appliquer la sélection. La recherche porte sur les titres et descriptions. Le tableau se regroupe par année de début, territoire ou type documenté. Les boutons de langue conservent les filtres appliqués ; le bouton retour du navigateur restaure les sélections précédentes.

Les filtres reprennent les règles de l’API v2 : dates partielles acceptées, bornes inclusives et sélection par chevauchement de l’intervalle enregistré. Les débuts inconnus sont exclus d’une sélection temporelle. Les attributions territoriales doivent être explicites ; le texte d’une ancienne étiquette n’est pas transformé en preuve.

Les catégories territoriales initiales sont présentes dans le tableau, mais les 263 fiches initiales n’ont pas encore d’attributions structurées revues. Elles figurent donc dans « Sans attribution structurée ». Zéro dans une catégorie ne signifie pas une absence historique dans ce territoire.

## Définition des indicateurs

| Indicateur | Ce qui est compté |
|---|---|
| Fiches recensées | Fiches publiées correspondant à la sélection |
| Références distinctes | Identifiants de sources des fiches et de leurs assertions publiées, comptés une fois par groupe |
| Sans référence de fiche | Fiches dont `source_ids` est vide ; les preuves d’assertions restent distinguées |
| Sans source primaire identifiée | Fiches sans référence explicitement classée primaire et revue, au niveau de la fiche ou d’une assertion publiée |
| Début partiel ou incertain | Début dont la précision n’est pas le jour ou dont la certitude n’est pas `documented` |
| Localisation à préciser | Au moins un lieu sans géométrie, sans rôle `exact_site`, ou sans revue enregistrée de localisation |
| Sans attribution structurée | Fiches sans `territorial_assignments` |
| Avec assertions contestées | Fiches ayant au moins une assertion publiée `contested` ; chaque fiche compte une fois |
| Sans trace de revue enregistrée | Fiches dont `human_review_recorded` n’est pas vrai |
| Contributions en attente | **Non mesuré** : les messages reçus ne constituent pas une file éditoriale publique fiable |

Ces indicateurs peuvent se cumuler. Ils ne forment ni une note de vérité ni un classement de fiabilité des personnes ou des sources. Zéro assertion contestée ne prouve pas l’absence de désaccord historique : seuls les désaccords déjà documentés et publiés peuvent être comptés.

Une référence distincte est un identifiant de notice, pas nécessairement un document historiquement distinct. Deux notices proches ne sont pas fusionnées automatiquement.

## Sources primaires : classement explicite

Le champ facultatif `source_classification` accepte `primary`, `secondary`, `unknown` ou `not_recorded`. Les valeurs primaire et secondaire exigent une revue liée à l’empreinte du contenu et le statut bibliographique `reviewed`. Une modification ultérieure invalide cette approbation.

Le titre, l’URL, la langue, le pays d’origine ou l’ancien libellé `type_source` ne déclenchent aucun classement automatique. L’absence de classement ne signifie pas qu’aucune source primaire n’existe. Aucun classement historique nouveau n’est attribué aux sources initiales par cette livraison.

## Regroupements et incertitudes

- Une fiche compte une fois selon son année de début enregistrée. Une année partielle n’est pas convertie en date exacte et un événement n’est pas répété sur toutes les années de sa durée.
- Une fiche dont l’intervalle chevauche une période sélectionnée peut apparaître dans une année de début antérieure à cette période.
- Une fiche peut apparaître dans plusieurs territoires ou types. Ne pas additionner ces lignes pour obtenir un total de fiches.
- Les références peuvent être communes à plusieurs années, territoires ou types : leurs effectifs par ligne ne sont pas additifs.
- Les années inconnues, territoires non attribués et types non renseignés restent visibles dans des catégories séparées.
- Les périodes jusqu’à 200 années d’écart affichent les années intermédiaires sans fiche. Pour une plage plus étendue, seules les années enregistrées sont affichées, avec un avertissement explicite.

## Exporter et reproduire

Les exports JSON et CSV conservent l’empreinte du snapshot, l’identifiant de version lorsqu’il correspond exactement aux données, les filtres appliqués et le regroupement. Ils indiquent aussi `coverage-v1` et les empreintes des modules de calcul et de filtrage. Le panneau « Reproduire cette sélection » permet de conserver ces modules avec le rapport, pour distinguer une évolution du calcul d’une évolution des données.

Le JSON contient les trois tableaux ; le CSV contient le tableau choisi. Le CSV est en UTF-8 avec marqueur d’encodage, indique les regroupements non additifs et conserve « non mesuré » pour les contributions. Les textes ressemblant à des formules de tableur sont neutralisés dans le CSV ; les données d’origine restent intactes dans le JSON.

Le rapport complet non filtré est aussi disponible dans `data/coverage/report.json`, accompagné de `year.csv`, `territory.csv` et `type.csv`. Ces rapports sont des produits dérivés du snapshot : ils ne modifient ni le corpus ni les anciennes archives.

L’API `/api/v2/coverage` conserve ses champs existants et ajoute `documentary_report`, calculé par le même module que le navigateur. Les mêmes filtres d’opérations y sont applicables. L’observatoire fonctionne également sur GitHub Pages à partir des fichiers publiés, sans dépendre d’un serveur d’écriture.

Les empreintes des opérations, sources, assertions et territoires sont vérifiées avant d’afficher les chiffres. Si un téléchargement échoue ou si les octets ne correspondent pas au manifeste, les résultats sont masqués et un message d’erreur est présenté. Un échec ne devient pas un tableau de zéros.

Commandes mainteneur : `npm run build:coverage`, `npm run check:coverage`. La construction complète et la CI vérifient aussi les copies du modèle et des filtres utilisées par le navigateur.

## Limites et suite

Les propositions en attente, les contradictions non encore saisies et le caractère primaire des notices non classées ne peuvent pas être déduits automatiquement. Le rapport ne nécessite aucune donnée personnelle ni accès aux messages de contribution.

L’examen historique des sources, la calibration des rapprochements, les pages détaillées d’entités et les analyses avancées restent des travaux distincts. Les contrôles logiciels et les compteurs ne remplacent pas cette revue scientifique.
