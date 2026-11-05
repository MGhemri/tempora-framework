# Assertions, sources et contradictions

## Fonctionnement

Une assertion relie une fiche (`subject`, identifiant d’opération), une propriété (`predicate`) et une valeur (`value`) à des passages précis de sources (`evidence`). Elle complète la fiche sans remplacer son titre, ses dates ou son bilan. Un statut décrit cette assertion, jamais la valeur globale d’un document ou de son auteur.

Les assertions sont stockées individuellement dans `data/claims/<id>.json`. Les identifiants permanents commencent par `CLM_`. Le schéma `schemas/claim.schema.json` est validé avec les autres données. Les exemples non historiques restent dans les tests et leur publication est refusée.

| Champ | Sens |
|---|---|
| `subject` | Identifiant permanent de la fiche concernée |
| `predicate` | Propriété précise, nommée par le mainteneur ; même nom pour comparer deux assertions |
| `value` | Nombre, booléen, valeur inconnue `null`, ou texte `{fr, ar}` ; aucune traduction automatique |
| `unit` | Unité facultative, explicitée par la source |
| `evidence[]` | `source_id`, passage `locator` obligatoire, court extrait `quotation` facultatif |
| `status` | `supported`, `contested`, `unverified`, `withdrawn` |
| `editorial_status` | `proposed`, `under_review`, `published`, `withdrawn` |
| `contradicts[]` | Identifiants d’assertions divergentes, relation décidée par revue humaine |
| `review_history[]` | Décisions, raison, référence de revue, personne et date |
| `created_at`, `updated_at` | Dates éditoriales UTC, distinctes des dates historiques |

Les textes peuvent être uniquement arabes ou uniquement français ; l’autre langue reste `null`. L’interface utilise la langue disponible sans présenter une traduction inventée. Un nombre n’est ni additionné ni moyenné avec une autre assertion. `null` désigne une valeur inconnue, pas zéro.

## Revue et publication

1. Le mainteneur crée une assertion `proposed`, vérifie la source bibliographique et relève une page, un chapitre, un paragraphe ou un autre passage identifiable.
2. La proposition passe en revue. Le mainteneur documente le choix du prédicat, le statut et les éventuels liens de contradiction.
3. La publication exige une fiche déjà publiée, au moins une référence précise et une dernière décision `approved` explicitant la raison et la référence de revue. La date de revue doit être comprise entre la création et la mise à jour de l’assertion.
4. `npm run validate:canonical`, `npm run build`, `npm test` et `npm run test:browser` vérifient les références, la génération et l’affichage avant publication.

Une trace de revue dans JSON ne vérifie pas l’identité du reviewer : les permissions du dépôt et les protections de branche restent nécessaires. Le nombre obligatoire de reviewers n’est pas fixé par cette livraison. Une référence de revue vers le dépôt reste conservée dans les données téléchargeables ; l’interface Vercel n’en fait pas un lien vers GitHub.

Une assertion `unverified` peut être publiée avec avertissement uniquement si une revue approuve explicitement cette présentation et qu’un passage source est fourni. Une affirmation sans référence reste un brouillon. `supported` signifie « étayée par les passages cités », pas « vérité définitive ».

## Contradictions

Deux assertions divergentes gardent leurs valeurs et leurs sources. Le lien `contradicts` est explicite, jamais calculé à partir d’un désaccord numérique ou d’une similarité de texte. Les deux extrémités doivent concerner la même fiche et le même prédicat et porter le statut `contested`. Un lien à sens unique est affiché depuis les deux assertions.

Une contradiction publiée ne peut pointer vers un brouillon. Les deux assertions doivent être revues et publiées ensemble pour que le lecteur puisse consulter les deux versions. Le choix de publier ce dossier appartient au mainteneur. Il ne bascule pas automatiquement la fiche entière vers l’état `disputed`, dont la politique de visibilité reste à décider.

Les assertions et leurs preuves apparaissent dans la fiche FR/AR, dans `data/canonical/claims.json` et sous le champ additionnel `scientific_claims` des fiches compatibles v1 qui en possèdent. Sans assertion publiée, la réponse v1 initiale reste identique. Les sources utilisées exclusivement par des brouillons sont exclues des exports.

Le manifeste SHA-256 couvre aussi `claims.json` et les sources correspondantes. Le nombre de fiches du corpus reste distinct du nombre d’assertions.

## Limites actuelles

La revue est un travail du mainteneur dans les fichiers versionnés ; il n’existe pas encore d’écran d’administration ou d’API v2. Aucun fait historique n’est extrait automatiquement des 263 fiches initiales. Les champs de bilan hérités restent conservés ; les assertions constituent un complément, pas une conversion scientifique automatique de ces champs.

Un retrait éditorial exclut l’assertion de la publication courante ; son fichier et sa décision restent dans l’historique du dépôt. Les fichiers publics ne constituent pas encore une archive de versions scientifiques. Ne pas effacer un dossier de contradiction pour masquer un désaccord : un retrait ou une correction exige une décision documentée.
