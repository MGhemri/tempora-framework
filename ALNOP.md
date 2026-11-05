# ALNOP — Un profil du framework TEMPORA

ALNOP documente les opérations du FLN/ALN durant la guerre d’indépendance algérienne (1954–1962). Il constitue un profil du framework TEMPORA, avec un corpus de 263 notices, ses sources, ses règles historiques et une application de consultation en français et en arabe.

## Consulter le profil ALNOP

L’[application ALNOP sur Vercel](https://alnop.vercel.app/) donne accès à la carte, aux recherches, aux fiches, aux personnes, organisations et lieux, aux comparaisons et à l’observatoire documentaire. L’affichage s’adapte aux mobiles et à l’arabe de droite à gauche. Les propositions passent par le formulaire de contribution et une revue avant toute publication.

Le portail GitHub Pages présente le framework TEMPORA et donne accès à l’atlas ALNOP depuis sa navigation.

## Ce qui appartient au profil

Le manifeste `profiles/alnop/profile.json` définit notamment la fenêtre de validation 1954–1962 et les langues du profil. Les vocabulaires proviennent des données canoniques. L’adaptateur `src/profiles/alnop.js` présente les champs utiles au validateur TEMPORA sans modifier les notices d’origine.

Les Wilayas, les types d’opérations, les conventions d’identification et les exigences documentaires ALNOP ne sont pas des règles universelles du framework. Un autre profil définit son propre contexte ; il ne reprend pas automatiquement le contenu ALNOP.

## Méthode et données

Une notice peut couvrir plusieurs épisodes. Les coordonnées sont des repères documentés, sans prétention à une précision tactique artificielle. Les incertitudes, variantes et contradictions doivent rester explicites ; un contrôle technique réussi ne prouve pas la vérité historique.

- [Méthodologie historique et cartographique](./METHODOLOGIE.md)
- [Dictionnaire des données](./DATA_DICTIONARY.md)
- [Assertions, sources et contradictions](./PROVENANCE_POLICY.md)
- [Référentiels et revue](./ENTITY_REVIEW_GUIDE.md)
- [Contributions et revue éditoriale](./CONTRIBUTING.md)
- [Préparer un lot de propositions en local](./INGESTION.md)

Les exports historiques JSON et GeoJSON, les identifiants permanents et les routes existantes restent disponibles. Les [API v1](./API.md) et [v2](./API_V2.md) interrogent le corpus ALNOP ; elles ne sont pas des API génériques multi-profils TEMPORA.

### Citation académique recommandée

Citer la version du corpus réellement utilisée et ses conditions de réutilisation selon la [politique des versions et de citation](./RELEASE_POLICY.md). Contact : contact@connect-gm.com.
