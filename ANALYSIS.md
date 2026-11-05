# TEMPORA — Analyses documentaires

Les analyses locales v3 produisent des pistes de revue à partir d’un corpus et de son profil. Chaque rapport identifie le corpus par son empreinte SHA-256 et indique les versions des méthodes, les paramètres et le périmètre de calcul.

## Produire un rapport

Pour analyser la copie v3 du corpus ALNOP créée par la migration locale, indiquer son chemin. La commande écrit le rapport JSON sur la sortie standard.

```sh
npm run --silent quality:tempora -- --base work/tempora-v3/corpus-v3.json
```

Le périmètre par défaut est `published`. Utiliser `--scope working` pour une copie de travail qui inclut les propositions et les notices en revue. Conserver ces rapports dans un espace privé. L’option `--parameters fichier.json` permet de fixer `title_threshold`, `shared_place_threshold`, `entity_threshold`, `nearby_km` et `max_pairs`. Le plafond du nombre de paires déclenche une erreur explicite si le calcul le dépasse.

## Interpréter les résultats

| Analyse | Éléments fournis |
|---|---|
| Doublons possibles | Similarité des titres dans les langues disponibles, relation entre dates, lieux, types et sources en commun |
| Entités à examiner | Noms et variantes du même type d’entité, preuves des graphies et périodes de validité |
| Assertions divergentes | Sujet et prédicat communs, valeurs, unités, contexte, références et motif de comparaison |
| Couverture | Comptages et identifiants par période de départ, territoire, type, langue et disponibilité des preuves |

Un rapprochement de titre ou de nom propose une revue humaine. Les noms récurrents et les homonymes peuvent produire des rapprochements erronés. Le rapprochement lexical peut manquer une description dans une autre langue quand les titres et variantes n’ont pas de forme commune.

Pour les assertions, une différence numérique porte sur des valeurs comparables seulement quand le contexte et l’unité sont établis. Les intervalles qui se recouvrent, les unités distinctes, le zéro et les valeurs inconnues restent séparés. Les textes sont comparés dans les langues communes déclarées. Les divergences textuelles et les contradictions déjà signalées ont leurs propres motifs.

## Comparer deux événements

```sh
npm run --silent quality:tempora -- --base corpus.json --event EVENEMENT_A --event EVENEMENT_B
```

Le rapport distingue la relation des dates de départ et celle des périodes complètes. Des bornes insuffisantes donnent un résultat indéterminé. Le rapport complet fournit aussi une séquence triée sur la première borne de départ connue.

Pour la proximité, la distance entre deux centres utilise les points dont le rôle de site et la précision sont déclarés. La fourchette combine les rayons de précision fournis. Elle reste indicative et dépend de ces déclarations. Les points représentatifs sont exclus de ce calcul.

## Comparer deux états du corpus

```sh
npm run --silent quality:tempora -- --base actuel.json --compare precedent.json
```

La comparaison exige le même profil, le même périmètre et la même méthode de couverture. Elle donne les empreintes, dénominateurs et écarts par groupe. Un événement avec plusieurs territoires, types ou langues contribue à plusieurs groupes. Les parts se lisent par rapport au total des événements du périmètre. Les années déclarées et sans notice ont un compte de zéro. Les périodes ouvertes ou inconnues sont regroupées à part.

Les comptages mesurent la densité documentaire du corpus. Leur interprétation dépend notamment de la sélection des sources, de leur conservation, de leur numérisation et des contributions. Un groupe vide indique l’absence de notice observée dans le périmètre analysé.

## Évaluer les pistes de revue

```sh
npm run --silent quality:tempora:reference
```

Ce jeu indépendant est fictif et utilise un profil anglais et espagnol. Les labels sont fixés par les scénarios. Le rapport indique les vrais et faux positifs et négatifs, la précision, le rappel et le score F1 par tâche et sous-groupe. Les mesures de contradiction portent sur la détection de valeurs potentiellement incompatibles. Les contradictions déjà enregistrées sont exclues de cette évaluation.

Pour un autre jeu fictif, utiliser `--annotations fichier.json` avec la version `1.0.0`, la portée `synthetic`, l’empreinte `corpus_sha256`, le `protocol` et des `cases` déclarant `task`, deux `ids`, le booléen `expected`, le sous-groupe `group` et la justification `rationale`. Les tâches disponibles sont `duplicates`, `entities` et `claims`. Les mesures publiées par cette commande concernent uniquement les scénarios annotés.
