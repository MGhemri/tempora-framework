# TVRW J9 — Explorateur géographique local (sans fond de carte)

## Livré
- Affichage auto-ajusté aux coordonnées **Point** réellement déclarées dans la page projetée (max. 100 lignes).
- Arc de longitude minimal, y compris les observations de part et d'autre de l'antiméridien.
- Zoom, déplacement au pointeur et réinitialisation, avec boutons accessibles au clavier.
- Regroupement purement **visuel** par cellule écran pour éviter les marqueurs superposés.
- Marqueurs pleins pour `exact_site`, contours pour les autres rôles ; rayons en tirets indiquant la précision *déclarée*, non une mesure démontrée.
- Écart explicite pour les géométries non ponctuelles/invalides, consultables dans le tableau existant.

## Limites scientifiques et techniques
Le graphe SVG est une **projection graphique de coordonnées**, et non une vraie carte topographique ou un SIG certifié.
Aucune tuile, donnée externe, géocodage, limite administrative, connexion réseau ni requalification d'une géométrie n'est introduit.
La déformation aux hautes latitudes, l'agrégation visuelle et l'étendue auto-ajustée ne constituent **aucune** inférence historique, spatiale ou statistique. Les coordonnées, rôles, précisions et sources restent inchangés dans le corpus canonique.
L'affichage utilise uniquement les lignes paginées en cours ; aucune assertion sur la couverture historique complète.

## Tests
`apps/desktop/tests/visualization/j9-geo-layout.test.mjs` vérifie la carte régionale, l'antiméridien, les clusters, les géométries ignorées et l'immuabilité.
`npm run build` vérifie le renderer TypeScript ; `npm run test:visualization` vérifie le layout pur.
Les tests d'accessibilité/gestes sur Windows propre restent à faire ; ce lot ne change ni le SDK v3 ni la politique de publication.
