# TEMPORA Framework

**TEMPORA aide à préparer, valider et analyser des corpus historiques.** Un profil déclare les langues, la période, les vocabulaires et les règles documentaires d’un corpus. Le noyau réutilise les mêmes contrats entre profils.

## Démarrage

La CI utilise Node.js 20 et Python 3.11. Le parcours de référence exécute une analyse sur un profil fictif indépendant, en anglais et en espagnol.

```sh
git clone https://github.com/MGhemri/tempora-framework.git
cd tempora-framework
npm ci
npm run quality:tempora:reference
npm test
```

La commande `npm run test:framework` vérifie les frontières du noyau et exécute les tests d’ingestion et d’analyse dans une copie contenant uniquement les modules génériques, leurs schémas et les données synthétiques. La compatibilité ALNOP est vérifiée séparément avec `npm run check:tempora:baseline`.

## Fonctionnalités disponibles

| Usage | Fonctionnalité | Documentation |
|---|---|---|
| Définir un corpus | Profils JSON versionnés, héritage et validation configurable | [Architecture et profils](FRAMEWORK.md) |
| Structurer les données | Modèle canonique v3 et traçabilité des sources et assertions | [Modèle canonique](CANONICAL_MODEL.md) |
| Intégrer des propositions | Import local JSON, CSV et GeoJSON, simulation et quarantaine | [Ingestion](INGESTION.md) |
| Examiner les données | Rapprochements à revoir, assertions divergentes et couverture documentaire | [Analyses](ANALYSIS.md) |
| Préparer une décision éditoriale | Journal privé, empreinte du contenu et contrôle d’éligibilité | [Éligibilité d’une proposition](FRAMEWORK.md#vérifier-léligibilité-dune-proposition-v3) |

La finalisation v3 se poursuit sur les snapshots publiables, l’API générique, le SDK et la qualification à grande échelle. Ce dépôt distribue le code source, les schémas, les tests et les guides du framework en développement.

## Organisation

- [Noyau TEMPORA](src/framework/) pour les profils, le canon, l’ingestion, les analyses et la revue.
- [Schémas](schemas/) pour les contrats versionnés.
- [Profils](profiles/) pour les règles métier et les mappings.
- [Tests](tests/) pour les cas de référence, les profils indépendants et la compatibilité ALNOP.

## Profil de référence ALNOP

ALNOP est un profil historique de TEMPORA sur les opérations du FLN et de l’ALN pendant la guerre d’indépendance algérienne. Ce dépôt fournit sa configuration, ses adaptateurs et le corpus de référence qui permet d’exécuter les tests de compatibilité et de vérifier les archives. Le projet historique porte l’atlas, les API publiques et les publications de données ALNOP. [Guide ALNOP](ALNOP.md) · [Atlas](https://alnop.vercel.app/) · [Dépôt historique](https://github.com/MGhemri/aln-historical-operations-dataset)

Pour vérifier le profil et simuler la migration de ses 263 notices vers une copie de travail v3.

```sh
npm run validate:profiles
npm run migrate:tempora
npm run check:tempora:baseline
```

Le contrôle d’intégrité des archives est disponible ici avec `npm run check:releases`. La reconstruction depuis les commits historiques s’exécute dans le dépôt ALNOP avec `npm run check:releases -- --sources`. [Versions et citation ALNOP](RELEASE_POLICY.md)

## Contribuer

Pour une évolution du noyau, indiquer le comportement attendu et les profils concernés. Les propositions documentaires ALNOP suivent le parcours de contribution du profil. [Guide de contribution](CONTRIBUTING.md)

Le code est distribué sous licence MIT. Les droits et références des données et documents sont décrits séparément dans la politique de publication. [Licence](LICENSE) · [Politique des données](RELEASE_POLICY.md)
