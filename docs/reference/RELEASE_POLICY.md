# Politique de versions et de publication de TEMPORA

TEMPORA distingue strictement **cinq versions** qui ne doivent pas être confondues :

1. **Logiciel TEMPORA** : version du SDK, du moteur et de la CLI (`3.0.0`
   à la rédaction de cette politique), régie par un historique logiciel et SemVer.
2. **Contrats et schémas** : version du modèle canonique, des profils et des mappings.
3. **Profil de corpus** : version des vocabulaires, contraintes et paramètres propres au corpus.
4. **Corpus publié** : identifiant de snapshot, manifeste et empreintes des fichiers.
5. **Algorithmes d'analyse** : versions des méthodes et de leurs paramètres.

## État actuel

Le framework dispose d'une **distribution locale** (voir
[`distribution/package.json`](../../distribution/package.json)).
La distribution npm publique et un tag stable `v3.0.0` ne sont pas annoncés ;
la propriété `private: true` ne doit pas être retirée sans revue explicite.
La [checklist de qualification](RELEASE_CHECKLIST.md) définit les validations obligatoires et les conditions de passage à une version stable.

## Préparer une version logicielle

- Exécuter les suites génériques du framework et la recette en installation autonome :
  `npm test`, `npm run test:standalone`, `npm run test:e2e:synthetic`.
- Vérifier `npm run check:site`, l'API OpenAPI 3.1, les exemples et le paquet local.
- Examiner le contenu exact du tarball et l'absence d'archives, de sources
  historiques et de secrets ALNOP.
- Contrôler les licences, la sécurité, les changements de contrats et le changelog.
- Ne publier le paquet, les tags ou une release qu'après approbation du mainteneur.

Les modifications incompatibles doivent suivre une politique SemVer documentée,
sans changement silencieux des schémas.

## Publier un corpus avec TEMPORA

Un nouveau corpus est préparé dans un espace de travail. L'admissibilité à la
publication exige une **revue humaine**, des preuves et des droits vérifiés.
Le constructeur produit un snapshot immuable avec manifeste et SHA-256.
Une correction génère une nouvelle version ; un rollback réactive une version
antérieure sans modifier les archives.

La vérification d'une publication ne démontre pas que les faits historiques sont
exhaustifs ou exacts. Les limites, contradictions et incertitudes demeurent explicites.

Voir [`FRAMEWORK.md`](FRAMEWORK.md) et [le guide de publication](../guides/publication.html).

## Versions historiques ALNOP

**Les releases de données ALNOP ne sont pas des releases TEMPORA.**
Pour leurs archives, conditions de citation et politique de versionnement, consulter
[le dépôt ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset)
et sa [politique historique](https://github.com/MGhemri/aln-historical-operations-dataset/blob/main/RELEASE_POLICY.md).

La suite de compatibilité du framework est épinglée à un commit ALNOP distinct
dans [`compatibility/alnop/pin.json`](../../compatibility/alnop/pin.json). Modifier cet
ancrage exige une revue et la régénération explicitement approuvée des références.
