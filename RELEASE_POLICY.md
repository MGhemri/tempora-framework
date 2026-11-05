# Versions du corpus et reproductibilité

Les versions des données sont distinctes des versions du logiciel et de l’API. Une version `data-AAAA.MM.N` conserve les exports exacts d’un commit, leur manifeste, une citation et un journal des changements. Elle ne signifie ni exhaustivité du corpus ni validation historique supplémentaire.

[Consulter les versions et télécharger une archive](docs/releases.html)

## Contenu d’une version

Chaque archive ZIP contient les JSON canonique et compatible, le GeoJSON, le CSV UTF-8, les sources, les assertions, les référentiels, les rapports de qualité et le manifeste du snapshot. Elle comprend également `release.json`, `CITATION.cff`, `CHANGELOG.md`, `SHA256SUMS.txt` et une copie de la licence existante au commit source.

Les métadonnées indiquent l’identifiant de version, la date UTC de publication, le commit source complet, le nombre de fiches, la version du schéma, l’empreinte du corpus, l’empreinte du manifeste et les limites de revue. L’empreinte SHA-256 du ZIP est publiée **à l’extérieur** de l’archive dans le manifeste de version et `archive.sha256`, pour éviter toute référence circulaire.

Les URL sous `data/releases/<version>/` restent permanentes sur Vercel et GitHub Pages. Une version enregistrée ne doit pas être modifiée, remplacée ou supprimée. Une correction exige une nouvelle version ; le contrôle des changements Git refuse la modification des fichiers déjà enregistrés dans `data/releases`.

L’archive utilise le format ZIP sans compression, avec des chemins triés, CRC-32 et en-têtes fixes. La date technique fixe dans les en-têtes ZIP ne correspond pas à la date historique ni à la publication : la date UTC réelle figure dans les métadonnées. Cette convention garantit une archive identique octet pour octet, indépendamment du système et de la bibliothèque de compression.

## Préparer une publication

1. Valider les données, les références, les revues et les tests ; reconstruire les exports et enregistrer le commit source.
2. Exécuter `npm run release:prepare` avec `--id`, `--source` (SHA complet), `--date` (UTC, suffixe Z), `--summary` et `--changes` (tableau JSON de changements).
3. Exécuter `npm run build:releases`, puis `npm run check:releases -- --sources` pour reproduire les octets à partir du commit source.
4. Examiner les deux fichiers préparés dans `data/releases`, les téléchargements générés et la citation. Ajouter ces fichiers dans un nouveau commit.
5. Après validation, pousser un tag Git portant exactement le même identifiant que la version. Dans le dépôt historique ALNOP, le workflow `release-data.yml` vérifie les tests et la reproduction avant de publier les assets sur GitHub Releases.

Le commit source désigne les exports archivés. Le tag pointe sur le commit qui enregistre l’archive et son manifeste ; ces deux commits peuvent donc différer. Aucune date de revue scientifique, approbation historique ou identité de validateur n’est inventée pour archiver le corpus initial.

Une commande de préparation ne crée ni tag ni publication distante. Un identifiant déjà présent est refusé. Le workflow ne remplace pas une GitHub Release existante ; une reprise de publication doit être examinée par le mainteneur.

## Vérifier et reproduire

- Comparer l’empreinte SHA-256 du ZIP téléchargé avec `archive.sha256` ou le manifeste public.
- Extraire l’archive, puis vérifier les empreintes de `SHA256SUMS.txt` ; le manifeste du snapshot contrôle aussi les exports.
- Pour reconstruire avec Git, récupérer le commit source indiqué et exécuter `npm run check:releases -- --sources` depuis un checkout contenant les archives et ce commit dans son historique.
- Conserver ensemble les exports, le manifeste, la version et les paramètres de requête utilisés pour une analyse.

Le build ordinaire vérifie les archives stockées sans exiger l’historique Git complet. La CI de validation et de release reproduit également les sources. Les fichiers `.env`, les identifiants de connexion et les messages de contribution ne sont jamais sélectionnés pour constituer une archive.

## API et version courante

`/api/v2/releases` liste les versions ; `/api/v2/releases/<id>` renvoie le manifeste d’une version. `/api/v2/releases/current` reste le manifeste des données courantes du site.

`meta.dataset_release` contient un identifiant uniquement si le manifeste courant correspond exactement à une archive enregistrée. Si les données ou les exports évoluent avant la prochaine publication, cette valeur redevient `null` ; les versions anciennes restent téléchargeables. L’empreinte courante demeure disponible dans `meta.snapshot_sha256`.

### Citation académique recommandée

ALNOP (année de publication). *ALN Historical Operations Dataset (1954–1962)*, version `data-AAAA.MM.N`. Ajouter l’URL du manifeste de cette version, son empreinte et, pour une analyse reproductible, le commit source et les paramètres de sélection.

Chaque archive propose un `CITATION.cff`. Le fichier à la racine du dépôt décrit la dernière version archivée ; il ne prétend pas que toute modification ultérieure du site est déjà publiée dans cette version. Contact : contact@connect-gm.com.

## Licences, DOI et limites

Les licences et droits existants sont conservés ; cette livraison ne tranche pas la répartition juridique entre logiciel, données et textes. Aucun document tiers intégral n’est téléchargé ou redistribué pour produire ces archives.

Aucun DOI n’est créé ou promis. Une connexion Zenodo peut être activée séparément par le responsable après examen des droits et des métadonnées. Le DOI ne remplacera ni l’identifiant de version ni les contrôles d’intégrité. Référence du format de citation : [Citation File Format](https://citation-file-format.github.io/).

Une archive préserve les réserves du corpus initial : imports non revus, attributions territoriales à examiner, points représentatifs et autres notices. Les contrôles techniques ne constituent pas une certification scientifique. La gestion de retraits légalement justifiés et des références de remplacement reste une décision éditoriale distincte.
