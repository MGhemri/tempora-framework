# TEMPORA Framework

**TEMPORA aide à préparer, valider et analyser des corpus historiques.** Un profil déclare les langues, la période, les vocabulaires et les règles documentaires d’un corpus. Le noyau réutilise les mêmes contrats entre profils.

[Site et guides TEMPORA](https://mghemri.github.io/tempora-framework/)

## Démarrage

Le parcours du framework utilise Node.js 20 ou supérieur et npm. Le parcours de référence exécute une analyse sur un profil fictif indépendant, en anglais et en espagnol.

```sh
git clone https://github.com/MGhemri/tempora-framework.git
cd tempora-framework
npm ci
npm run test:e2e:synthetic
```

Le parcours synthétique vérifie le noyau, puis installe le tarball dans un projet indépendant. Il couvre l’import, la revue, la publication et la lecture par l’API. La compatibilité historique se vérifie séparément avec `npm run test:compat:alnop`.

## Fonctionnalités disponibles

| Usage | Fonctionnalité | Documentation |
|---|---|---|
| Définir un corpus | Profils JSON versionnés, héritage et validation configurable | [Architecture et profils](FRAMEWORK.md) |
| Structurer les données | Modèle canonique v3 et traçabilité des sources et assertions | [Modèle canonique](CANONICAL_MODEL.md) |
| Intégrer des propositions | Import local JSON, CSV et GeoJSON, simulation et quarantaine | [Ingestion](INGESTION.md) |
| Examiner les données | Rapprochements à revoir, assertions divergentes et couverture documentaire | [Analyses](ANALYSIS.md) |
| Préparer une décision éditoriale | Journal privé, empreinte du contenu et contrôle d’éligibilité | [Éligibilité d’une proposition](FRAMEWORK.md#vérifier-léligibilité-dune-proposition-v3) |

La préparation et l’activation locale de snapshots v3 sont disponibles. L’API générique lit les versions activées via un serveur local. Le SDK et la CLI sont disponibles sous forme de [tarball de développement](FRAMEWORK.md#installer-le-sdk-et-la-cli-hors-du-dépôt). [Journal des versions du framework](CHANGELOG.md)

Pour vérifier les exports, activer une version locale ou revenir à la précédente, consulter le [guide de publication locale](FRAMEWORK.md#préparer-et-activer-un-snapshot-local).

## Organisation

- [Noyau TEMPORA](src/framework/) pour les profils, le canon, l’ingestion, les analyses et la revue.
- [Schémas](schemas/) pour les contrats versionnés.
- [Profils](profiles/) pour les exemples synthétiques et leurs mappings.
- [Tests](tests/) pour les cas de référence, les profils indépendants et la compatibilité ALNOP.

## Profil de compatibilité ALNOP

ALNOP est facultatif. Ses contrats et adaptateurs sont regroupés dans [compatibility/alnop](compatibility/alnop/README.md). Le corpus, l’atlas et les API historiques appartiennent au [dépôt ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset).

```sh
npm run test:compat:alnop:minimal
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Le test complet exige une copie extérieure propre à la révision définie dans `compatibility/alnop/pin.json`. Il ne télécharge rien implicitement. Le corpus complet, les exports et les anciennes API ont été retirés de ce dépôt. Quelques fichiers de transition restent réservés pour examen ; les tests et builds du framework fonctionnent sans eux.

## Vérifications du framework

```sh
npm test
npm run test:standalone
npx playwright install chromium
npm run test:browser
```

`test:standalone` installe et teste une copie contenant seulement les fichiers génériques. La suite navigateur contrôle les 14 pages TEMPORA et l’absence des exports ALNOP dans l’artefact publié.

## Générer le site documentaire

```sh
npm run build:site
npm run check:site
npm run build:site -- --output work/pages
```

Les guides sont générés à partir des documents Markdown de référence. Le déploiement Pages utilise l’export isolé du site TEMPORA. La compatibilité ALNOP dispose de sa propre suite facultative.

## Contribuer

Pour une évolution du noyau, indiquer le comportement attendu et les profils concernés. Les propositions documentaires ALNOP suivent le parcours de contribution du profil. [Guide de contribution](CONTRIBUTING.md)

Le code est distribué sous licence MIT. Les droits des corpus et des documents restent définis par leurs propriétaires. [Licence](LICENSE) · [Sécurité](SECURITY.md)
