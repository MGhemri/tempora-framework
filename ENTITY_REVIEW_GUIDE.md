# Référentiels, revue des changements et doublons candidats

## Consultation sur le site

La page [Personnes, organisations et lieux](docs/entities.html) permet de rechercher un identifiant ou une variante de nom, de filtrer par référentiel et de consulter une entrée publiée. Elle est accessible depuis le menu de l'atlas et les liens d'entités du comparateur. Les liens directs conservent l'identifiant et la langue.

La recherche consulte également un index des mentions déjà présentes dans les fiches publiées : champs de commandement, localisations et descriptions. Ces résultats sont séparés des entrées revues, affichent le champ d'origine et renvoient à la fiche et à ses sources. Les récits ne sont pas automatiquement classés comme personnes, organisations ou lieux. Aucune entité ni relation d'identité n'est créée par cette recherche.

La recherche ignore la casse et les accents, conserve les limites de mots et accepte les termes de grade « akid », « colonel » et « العقيد » comme facultatifs devant un nom recherché. Cette tolérance de saisie ne crée pas de variante historique dans les données. « Oran » dans les lieux et « akid lotfi » dans les personnes retrouvent ainsi les mentions existantes du corpus.

La liste des mentions est paginée par dix fiches. Le corpus complet et la bibliographie ne sont plus téléchargés à l'ouverture : ils sont chargés uniquement pour le détail d'une entrée revue. L'index compact des mentions est chargé à la première recherche, vérifié contre son empreinte et lié au snapshot courant. Il peut être reproduit et contrôlé avec `npm run build:entity-search` et `npm run check:entity-search`.

Chaque détail conserve les noms, leurs langues, leurs périodes et leurs sources. Les relations d'identité revues sont consultables sans fusion d'identifiants. Pour les lieux, une géométrie absente reste absente ; une position connue affiche ses coordonnées longitude/latitude, sa précision et ses références.

Les opérations associées proviennent exclusivement de `participants[].entity_id` et de `locations[].place_id`. Aucune recherche de nom dans les récits ou les commandements hérités ne crée de lien. Chaque rôle et ses références sont conservés. L'export JSON contient l'entrée sélectionnée, les opérations explicitement reliées, leurs sources, l'empreinte du snapshot et la version archivée correspondante lorsqu'elle existe.

Les fichiers sont vérifiés contre le manifeste avant affichage. Les brouillons et hypothèses d'identité internes ne sont pas accessibles, même avec leur identifiant. L'interface est disponible en français et en arabe, sur mobile et ordinateur. Une traduction absente est signalée sans remplacer le texte original. Les trois référentiels publiés sont actuellement vides : leur alimentation nécessite une revue documentaire réelle.

## Référentiels réutilisables

Les répertoires `data/persons`, `data/organizations` et `data/places` accueillent les personnes, organisations et lieux, avec les préfixes permanents `PER_`, `ORG_` et `PLC_`. Ils sont initialement vides : aucun nom n’est extrait des 263 fiches sans vérification humaine.

Le schéma `schemas/entity.schema.json` conserve un libellé FR/AR, les variantes, la langue, le script facultatif, la période d’usage et les sources de chaque nom. L’ancienne graphie reste enregistrée lors d’une correction. Une langue inconnue n’est pas traduite automatiquement. Une position inconnue reste sans géométrie ; une géométrie connue exige des sources et un rôle de précision explicite.

Les relations `same_as_candidate` restent des hypothèses internes. Seule une relation `same_as` avec sources et approbation explicite est exportée. Même alors, les deux identifiants sont conservés : ce mécanisme ne fusionne pas les fiches et ne crée pas de redirection automatique.

Une opération révisée peut référencer des personnes ou organisations via `participants` (identifiant, rôle, sources), et des lieux via `locations[].place_id` avec ses sources. Une opération publiée ne peut référencer une entité en brouillon. Les noms seuls ne prouvent ni l’identité ni le rôle.

Les exports `data/canonical/persons.json`, `organizations.json` et `places.json` contiennent uniquement les entités publiées. Leurs sources sont incluses dans `sources.json` et leurs empreintes dans le manifeste. Les liens structurés sont disponibles dans le JSON canonique ; les pages de consultation détaillée des entités et l’API v2 restent à développer.

## Revue liée au contenu exact

La validation Git compare les fichiers canoniques à la version précédant le changement. Une nouvelle publication, une modification de donnée publique ou un retrait exige une nouvelle décision `approved`, ajoutée à l’historique existant. Les suppressions de fichiers sont refusées pour conserver les identifiants. Les propositions non publiées restent modifiables.

L’approbation comporte `content_sha256`, l’empreinte du contenu approuvé. Les clés des objets sont ordonnées avant calcul ; les historiques de revue sont exclus du calcul pour éviter une dépendance circulaire. Les valeurs, les sources, les noms, les liens, les dates éditoriales et le statut font partie du contenu.

Parcours mainteneur :

1. Finaliser le contenu, le statut et la date de mise à jour.
2. Calculer l’empreinte avec `npm run review:changes -- --digest data/operations/IDENTIFIANT.json` (adapter la collection et le fichier).
3. Ajouter une décision avec le reviewer, la raison, la référence HTTP(S) de revue, sa date et ce `content_sha256`.
4. Comparer au commit de base avec `npm run review:changes -- --base SHA_COMPLET_DU_COMMIT`.
5. Exécuter les validations, reconstruire les exports et faire relire avant fusion.

Une modification après approbation invalide l’empreinte. Les builds vérifient les empreintes présentes sur les objets publiés ou marqués revus. Le contrôle Git exige leur présence lors des changements publics ; il n’invente pas une revue rétrospective des imports initiaux.

Ce dispositif vérifie une trace et son contenu, pas l’identité réelle du reviewer. Les protections de branche et les autorisations du dépôt doivent toujours être administrées par le responsable. Le nombre obligatoire de reviewers reste une décision à valider. Les changements des schémas, du vocabulaire global ou des politiques nécessitent également une revue de code ; ce contrôle ciblé ne constitue pas un système complet de permissions.

## Rapport des doublons candidats

`npm run quality:duplicates` produit `work/duplicate-candidates.json` et `.md`, sans modifier le corpus. Les opérations publiées, proposées et en revue sont comparées. Les rapports ne sont pas copiés vers le site public, afin de ne pas y exposer les propositions non publiées. Ils sont joints aux diagnostics du contrôle GitHub.

L’algorithme compare les titres par trigrammes après normalisation Unicode, casse, diacritiques FR/AR, tatweel et variantes d’alif. Les textes originaux restent intacts. Il présente séparément la similarité du titre, le chevauchement des intervalles de début, les lieux explicitement partagés, les types et la distance entre sites revus lorsque cette comparaison est possible. Les points représentatifs ne servent pas à la comparaison spatiale. La proximité seule ne déclenche pas une correspondance.

Les seuils par défaut sont des paramètres techniques : similarité du titre de 0,5, ou 0,25 avec un même lieu référencé et un chevauchement des dates. Le seuil de proximité de 10 km ne sert qu’à expliquer un candidat. Aucun seuil n’établit une identité historique.

Sur les 263 fiches initiales, cette première configuration produit **135 paires candidates**. Il ne s’agit pas de 135 doublons confirmés. Le mainteneur doit examiner les textes, les dates et les sources ; aucune fusion, suppression ou modification de statut n’est exécutée.

## Évaluation et limites

`npm run quality:benchmark` évalue six paires synthétiques annotées dans `tests/fixtures/duplicate-pairs.json`. Résultat : trois correspondances retrouvées, un faux positif et une correspondance manquée, soit précision et rappel de 0,75 sur ce seul petit jeu. Ces chiffres ne mesurent pas la qualité sur le corpus historique.

Le faux positif illustre un même titre à des dates différentes ; le cas manqué illustre une correspondance FR/AR sans similarité lexicale. Les translittérations non documentées ne sont pas devinées. Une calibration sur des cas historiques annotés, l’optimisation pour de grands corpus restent à faire. Cette première version parcourt les paires de fiches ; aucune performance à 10 000 fiches n’est revendiquée.

## Prochaine étape

L’API v2 expose ces ressources avec une pagination, des filtres et un contrat documentés. Le moteur de rapprochement utilise désormais les variantes de noms sourcées ; voir le [guide de l’assistance](ASSISTANCE.md). Les politiques de fusion/scission/retrait, les versions scientifiques et les protections administratives du dépôt restent distinctes de cette livraison.
