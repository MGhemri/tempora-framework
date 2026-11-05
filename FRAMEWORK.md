# TEMPORA — Framework pour les corpus historiques

Le noyau TEMPORA fournit les contrats communs aux corpus historiques. Les profils déclarent les choix propres à chaque corpus. Les adaptateurs transforment les données d’origine en objets que le noyau sait valider et analyser.

## Architecture : noyau, profils et applications

| Niveau | Responsabilité |
|---|---|
| Noyau | Chargement des profils, validation, modèle canonique, ingestion et analyses |
| Profil | Période, langues, vocabulaires, règles de validation et mappings d’import |
| Adaptateur | Conversion des données d’origine et conservation de leur provenance |
| Application | Consultation du corpus et parcours de contribution du profil |

ALNOP fournit un exemple complet de profil et d’application de consultation. Les analyses v3 et les imports utilisent une copie de travail locale. [Profil ALNOP](./ALNOP.md) · [Modèle et migration](./CANONICAL_MODEL.md) · [Import local](./INGESTION.md) · [Analyses](./ANALYSIS.md)

## Valider un profil

```sh
npm run validate:profiles
npm run validate:profiles -- --profile profiles/alnop/profile.json
```

La première commande découvre les configurations publiées sous `profiles/`, vérifie leurs identifiants et valide les opérations ALNOP avec les vocabulaires actuels. La seconde vérifie un manifeste explicite, sans importer de corpus. Les formats et contraintes figurent dans `schemas/tempora.profile.schema.json`, version `1.0.0`.

Le profil ALNOP reprend la fenêtre annuelle de validation historique existante : 1954 à 1962 inclus. Il ne restreint pas artificiellement le dernier jour au 5 juillet. Cette fenêtre est une règle technique du profil, pas une preuve de date ni une mesure d'exhaustivité historique. Les vocabulaires restent lus depuis les données canoniques ; ils ne sont pas recopiés dans le profil.

## Charger une configuration

```js
const {loadProfile} = require('./src/framework/profile-loader');
const profile = loadProfile('/chemin/projet/profiles/alnop/profile.json', {
  rootDirectory: '/chemin/projet'
});
```

Le chargeur accepte uniquement un fichier JSON UTF-8 explicite, de taille inférieure ou égale à 128 Kio, situé dans la racine autorisée après résolution des liens. Aucun accès réseau n'est effectué. La découverte ne parcourt que les sous-répertoires immédiats du dossier fourni, chacun contenant `profile.json`.

Un profil peut hériter d'un parent par `extends`, chemin relatif vers un fichier situé dans la même racine autorisée. Les cycles et les chaînes trop longues sont refusés. Chaque parent doit lui-même être valide. Les objets sont fusionnés récursivement ; les tableaux sont remplacés intégralement. Une redéfinition de langues doit donc aussi adapter les alias dont les langues ne sont plus déclarées.

Le schéma valide la configuration résolue après héritage. Un manifeste enfant peut ne fournir que `extends` et les champs qu'il remplace. Les identifiants et espaces de noms doivent rester uniques dans un registre découvert.

La priorité est : parent, manifeste enfant, puis surcharges explicites. Les surcharges d'exécution concernent uniquement `parameters` et `severities` :

```js
const adjusted = loadProfile('/racine/profiles/example/profile.json', {
  rootDirectory: '/racine',
  parameters: {limits: {sample: 20}},
  severities: {'event-type': 'warning'}
});
```

Les surcharges de sévérité doivent désigner une règle existante. Les paramètres sont exposés à l'appelant ; ils ne reconfigurent pas automatiquement l'atlas ou les algorithmes ALNOP. Les résultats sont des objets gelés et indépendants, sans cache global partagé entre profils.

## Compatibilité et limites

Le contrat de chargement utilise la version de compatibilité `3.0.0`. La propriété `framework` accepte une plage bornée de la forme `>=3.0.0 <4.0.0` ; les expressions SemVer plus complexes ne sont pas prises en charge. Une version de schéma inconnue ou une plage incompatible provoque une erreur explicite. Cette version de contrat ne signifie pas que toutes les capacités d'une plateforme v3 sont disponibles.

Ce composant prend actuellement en charge le calendrier grégorien, les jours ISO de `0001` à `9999`, les bornes ouvertes ou inconnues dans les intervalles et le référentiel `EPSG:4326`. Un calendrier ou un CRS non pris en charge est refusé ; aucune conversion silencieuse n'est réalisée. Le contrôle du CRS du profil ne remplace pas une validation géométrique.

## Validation configurable

```js
const {createValidator} = require('./src/framework/validation');
const validator = createValidator(profile, {
  taxonomies: {
    event_types: ['type déclaré'],
    territorial_units: ['territoire déclaré']
  }
});
const result = validator.validate({
  id: 'EXAMPLE_1',
  start_date: {earliest: null, latest: null},
  event_type: ['type déclaré'],
  territory_ids: []
});
```

Les valeurs des taxonomies sont fournies par l'appelant. Le noyau ne lit pas de données métier et n'importe pas le profil ALNOP. Trois types de règles sont disponibles :

| Type | Contrôle |
|---|---|
| `required` | Valeur présente et non vide |
| `date_range` | Jours valides, bornes ordonnées et respect de la fenêtre du profil |
| `vocabulary` | Valeur ou liste de valeurs appartenant à une taxonomie fournie |

Les sévérités sont `error`, `warning` et `info`. Seuls les diagnostics `error` rendent `valid` faux. Chaque diagnostic conserve un code, le champ concerné et l'identifiant de règle. Un champ facultatif absent n'est pas rendu obligatoire par une autre règle ; utiliser `required` lorsque nécessaire. Les chemins de champs sont des propriétés explicites séparées par des points, sans exécution de code ni parcours des prototypes.

Les alias de vocabulaire doivent être déclarés avec langue, valeur et cible canonique. Leur correspondance est exacte ; les graphies originales ne sont pas modifiées. Une cible absente ou un alias ambigu est refusé. Ce mécanisme n'établit aucune identité de personne ou de lieu et ne traduit aucun texte.

Ces contrôles complètent les schémas et règles canoniques existants. Un résultat valide ne certifie ni la provenance documentaire ni la vérité d'un fait historique.

## Interface d'adaptateur

`defineAdapter` vérifie une interface composée de `id`, `formats`, `parse` et `serialize`. Il conserve les fonctions fournies et fige les métadonnées. Il n'implémente pas à lui seul une ingestion CSV/GeoJSON, une quarantaine ou une publication. Les adaptateurs doivent déclarer leurs limites et être testés séparément.

## Erreurs et compatibilité ALNOP

Les erreurs de configuration utilisent `ProfileError` avec `code`, `message` et `details`. Les codes distinguent notamment schéma invalide, incompatibilité de version, calendrier non pris en charge, chemin interdit, héritage cyclique et taxonomie absente.

Un chemin absent ou des options d'appel invalides sont également refusés par des erreurs typées (`PROFILE_ARGUMENT_INVALID`, `PROFILE_ROOT_INVALID`) avant tout accès au fichier.

L'adaptateur `src/profiles/alnop.js` projette les champs utiles pour ces règles sans modifier les objets d'origine. Le validateur Python historique lit désormais sa fenêtre annuelle depuis le même profil. Les chemins d'exports et les routes API v1/v2 restent identiques. Aucun nouvel endpoint TEMPORA n'est annoncé par ce guide.

## Modèle canonique et migration

Le [modèle canonique TEMPORA v3](./CANONICAL_MODEL.md) fournit les schémas versionnés, les invariants temporels et spatiaux et une migration ALNOP réversible sur une copie intacte. La commande `npm run migrate:tempora` vérifie le parcours sans écrire dans les données de production.

## Importer des propositions

Le [pipeline d’import local](./INGESTION.md) utilise des mappings versionnés pour préparer et contrôler des propositions JSON, CSV et GeoJSON. Les notices acceptées restent proposées dans une copie de travail privée.

## Analyses documentaires

Le [guide des analyses](./ANALYSIS.md) décrit les rapprochements, la comparaison des assertions, la couverture et l’évaluation sur des cas fictifs annotés.


## Vérifier l’éligibilité d’une proposition v3

Le module `src/framework/editorial-review.js` sépare la validation technique du corpus et la décision de diffusion. Une politique de revue associe un profil précis à une liste de relecteurs autorisés, un quorum, une durée de validité des approbations et une règle pour les assertions contestées. Le mainteneur choisit ces paramètres et conserve la politique dans son espace de travail.

- `reviewPolicy(profile, options)` construit la politique à partir de ces choix explicites.
- `contentDigest(record)` calcule l’empreinte du contenu, indépendamment du statut éditorial.
- `recordDecision({corpus, policy, journal, decision})` retourne le journal complété par une décision liée à la précédente. Le journal et le corpus d’entrée restent utilisables comme références.
- `validatePublicationEligibility({corpus, policy, journal, subjects, asOf})` vérifie les sujets choisis et leurs dépendances documentaires à une date UTC explicite.

L’approbation porte sur le contenu exact et sur des preuves liées au sujet. Elle consigne la décision sur les droits de redistribution et la sensibilité. Un changement de contenu ou l’expiration des décisions exige une nouvelle revue. La liste des relecteurs contrôle les identifiants déclarés. L’identité réelle et l’autorisation d’utiliser la politique relèvent du mainteneur. Le journal est un document de travail privé. Pour une vérification ancrée, conserver l’empreinte terminale SHA-256 dans un registre contrôlé indépendamment du journal. Transmettre cette empreinte à `verifyReviewJournal({corpus, policy, journal, expectedHead})` ou au contrôle d’éligibilité via `expectedHead`. Une chaîne réécrite ou tronquée peut rester cohérente en interne. La comparaison avec l’empreinte indépendante détecte cet écart. Le choix du registre et l’authentification des relecteurs relèvent de l’hôte.

Pour contrôler une évolution du code contre l’état de référence ALNOP, lancer `npm run check:tempora:baseline`. Le résultat JSON compare les collections, les exports, les archives et un ensemble de réponses des API v1 et v2. Une évolution autorisée du corpus nécessite une nouvelle référence validée.


## Préparer et activer un snapshot local

Le module de publication produit une projection publique des objets sélectionnés et de leurs dépendances éligibles. Une demande privée contient `corpus`, `policy`, `journal`, `subjects`, la date UTC `asOf` et `release` avec `id`, `source_commit`, `citation_author` et `rights_notice`. Pour succéder à une version active, joindre son bundle vérifié dans `previous`.

```sh
npm run publication:tempora -- prepare --request demande.json --journal-head EMPREINTE_JOURNAL
npm run publication:tempora -- prepare --request demande.json --journal-head EMPREINTE_JOURNAL --write
npm run publication:tempora -- verify --bundle chemin-du-bundle.json
```

La première commande simule la préparation. La seconde ajoute le bundle immuable sous `work/tempora-v3/publication/<profil>/<version>.bundle.json`. Il contient un manifeste, un snapshot JSON, un GeoJSON et un résumé CSV. Les exports conservent les bornes temporelles et distinguent les rôles géographiques. Les extensions privées, citations textuelles et décisions de revue restent dans l’espace de travail. Une notice retirée laisse un identifiant de retrait. La préparation exige au moins un objet éligible.

L’opérateur de promotion vérifie le SHA-256 du manifeste et consigne son motif à une date UTC explicite. Son identifiant appartient à la politique de revue et diffère de celui des personnes qui ont approuvé la sélection ou enregistré les retraits du lot.

```sh
npm run publication:tempora -- promote --request demande.json --journal-head EMPREINTE_JOURNAL --sha256 EMPREINTE --reviewer OPERATEUR --at DATE_UTC --reason MOTIF --write
npm run publication:tempora -- rollback --request demande.json --sha256 EMPREINTE_ACTIVE --target VERSION_PRECEDENTE --reviewer OPERATEUR --at DATE_UTC --reason MOTIF --write
```

La promotion vérifie de nouveau l’éligibilité, les octets du bundle et l’identité de la version active précédente. Un verrou local sérialise les changements de pointeur. Le remplacement atomique de ce pointeur rend le bundle actif. Le retour arrière sélectionne la version précédente déjà activée et conserve les bundles sur disque. Si un arrêt brutal laisse le verrou en place, vérifier que le processus est arrêté avant de retirer le verrou. Le test de panne porte sur un échec avant le remplacement du pointeur.

Cette procédure s’exécute sur un stockage local privé. La vérification des empreintes contrôle l’intégrité du bundle. Le mainteneur contrôle la provenance de la demande et de la politique de revue. Les API ALNOP utilisent leur circuit de compatibilité historique.

Le SHA-256 terminal est fourni par `--journal-head` depuis le registre de confiance indépendant. Le bundle comprend le corpus canonique public, la projection de lecture, les exports, les droits déclarés, la citation, le rapport expurgé et les sommes SHA-256. La liste SHA-256 couvre les artefacts de contenu. Le manifeste couvre aussi cette liste et porte sa propre empreinte de métadonnées.

```sh
npm run publication:tempora -- export --bundle version.bundle.json --write
npm run publication:tempora -- verify --directory chemin/vers/version.files
```

L’export local crée un dossier immuable avec un `manifest.json`. La commande de vérification contrôle les noms, les octets et la cohérence des fichiers avec la projection publique.

## Consulter des versions publiées par l’API locale

L’adaptateur Node écoute uniquement sur l’interface locale. Sélectionner explicitement le dossier de publication et chacun des profils activés.

```sh
npm run serve:tempora -- --store work/tempora-v3/publication --profile synthetic-history --port 8787
```

Le contrat OpenAPI 3.1 est disponible à `/api/v3/openapi.json` et l’état du service à `/health`. Le préfixe `/api/v3` identifie le contrat générique. Sous `/profiles/{profileId}`, l’API fournit les versions, événements, sources, entités, assertions, relations, géométries et statistiques documentaires. Les archives activées se consultent avec `release=<id>`. Une version simplement préparée ne figure pas dans le catalogue.

Les listes acceptent `limit` et `cursor`. Les événements peuvent être filtrés par dates, type, langue, présence d’une source ou référence géographique. La recherche `q` compare le texte des titres et descriptions sans distinction de casse. `spatial?format=geojson` renvoie une collection GeoJSON dans le champ `data` avec la précision déclarée. Les erreurs fournissent `code`, `message` et `field` lorsqu’un paramètre est identifié. Un curseur reste lié à la version et aux filtres de sa requête.

Les versions explicites sont immuables et les réponses ont un ETag. L’option `--cors-origin` restreint les requêtes navigateur à une origine choisie. L’adaptateur local exerce des limites de taille. Un éventuel hôte en ligne devra définir ses propres limites de débit.

## Installer le SDK et la CLI hors du dépôt

Le manifeste de distribution est séparé du dépôt de développement. Le paquet CommonJS est marqué privé et sa version de travail `3.0.0-dev.0` est indépendante du numéro de schéma. La commande de paquetage copie une liste explicite de fichiers génériques. Le tarball utilise Ajv et ajv-formats comme dépendances d’exécution.

```sh
npm run pack:tempora -- --out work --write
npm install /chemin/vers/tempora-framework-3.0.0-dev.0.tgz
npx tempora --help
npx tempora profile validate profil.json
```

Omettre `--write` pour lister les fichiers sans produire de tarball. La CLI renvoie des résultats JSON pour les commandes de traitement et un code de sortie 1 en cas d’erreur. Les écritures exigent un répertoire explicite avec `--output-root`. Les anciennes commandes npm restent disponibles pendant la transition.

```js
const {profiles, canonical, ingestion, analysis, review, publication, api} = require('tempora-framework');
const profile = profiles.load('profil.json');
const corpus = ingestion.createCorpus(profile, {event_types: [], territorial_units: []});
console.log(canonical.validateCorpus(corpus));
```

Le SDK expose les types TypeScript et les schémas via `tempora-framework/schemas/profile`, `tempora-framework/schemas/mapping` et `tempora-framework/schemas/v3/corpus`. Les erreurs du SDK peuvent inclure un `code` et des détails structurés. La CI installe le tarball dans un répertoire distinct et vérifie le parcours synthétique de l’import à la lecture HTTP.
