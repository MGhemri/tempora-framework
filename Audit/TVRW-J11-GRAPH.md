# TVRW J11 — GraphLab : relations déclarées et navigation accessible

## Changement fonctionnel

Le graphe n'est plus un seul grand cercle de points arbitraires.
Une projection graphique **purement visuelle** construit des groupes
de connexité à partir des arêtes explicitement déclarées par le moteur,
en conservant les multiarêtes, boucles et identités typées complètes
(kind + namespace + id). Aucun lien n'est inventé entre groupes.

- Disposition déterministe à partir du résultat paginé, sans hasard,
  sans réseau, sans dépendance graphique ni modification de corpus.
- Les nœuds sont navigables via des **boutons clavier** (tabulation,
  Enter/Espace), avec état de sélection ARIA et maintien du focus après
  le rendu. La sélection rejoint le mécanisme partagé de TEMPORA entre vues.
- Chaque référence reste identifiée par kind / namespace / id :
  deux identifiants homonymes d'espaces de noms différents ne fusionnent pas.
- Les arêtes invalides ou non explicitement déclarées ne sont pas représentées.
  Leur nombre est signalé et le tableau de données original reste disponible.
- Vue limitée aux 50 arêtes de la page courante ; les groupes visuels ne sont
  **ni** communautés historiques, **ni** causalité, **ni** classement.
- Les tests couvrent l'ordre stable, la séparation des namespaces, les
  arêtes parallèles, les boucles, les entrées invalides, 50 arêtes/100 nœuds
  et l'immutabilité.

## Limites

Les parcours scientifiques du graphe demeurent exclusivement dans le worker
TEMPORA, où ils disposent de leurs propres contrats et empreintes. Ce module
front-end n'écrit pas le modèle canonique et ne modifie aucune projection
scientifique, aucun algorithme de recherche, aucune autorisation de sauvegarde.

Aucune activation de persistance, TensorFlow, release, soumission ou
publication Microsoft Store. La version Store 0.2.0 publiée auparavant ne
contient pas J11. CI Linux et Windows obligatoire avant fusion.
