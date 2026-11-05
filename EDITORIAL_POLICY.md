# Politique éditoriale

Une contribution est une proposition, pas une preuve de vérité. Distinguer source, fait rapporté, interprétation et décision éditoriale. Les contradictions doivent coexister avec leurs références ; aucune fusion ou correction historique automatique.

Les assertions disposent maintenant d’un modèle et d’une validation dédiés. Voir [Assertions, sources et contradictions](PROVENANCE_POLICY.md) pour enregistrer deux versions divergentes sans remplacer le contenu de la fiche. Cette revue distincte ne vaut pas arbitrage sur la visibilité d’une fiche entière `disputed`.

| État | Transitions possibles | Responsable |
|---|---|---|
| proposed | under_review, needs_information, rejected | Mainteneur |
| needs_information | proposed, under_review, rejected | Auteur et mainteneur |
| under_review | published, needs_information, rejected | Mainteneur habilité, décision documentée |
| published | under_review, disputed, withdrawn | Mainteneur, justification et références |
| disputed | under_review, published, withdrawn | Mainteneur après réexamen |
| rejected | under_review | Mainteneur après élément nouveau |
| withdrawn | under_review | Mainteneur après réexamen |

Ces états décrivent le suivi éditorial. `needs_information` et `rejected` concernent les propositions ; ils ne sont pas des états de fiches publiées. Les états ne sont pas encore un mécanisme automatique de permissions. Les protections de branche et le nombre obligatoire de reviewers sont à configurer par le responsable ; les fichiers de politique seuls ne les imposent pas.

Toute décision doit citer l'Issue/PR et le commit, préciser la raison, les sources et les personnes intervenant selon leur rôle public. Une demande de réexamen peut être ouverte dans une nouvelle Issue référant la décision antérieure. Les suppressions doivent conserver une trace non sensible ; ne pas recycler les identifiants.

Les décisions sur la visibilité des fiches contestées, les droits, le nombre de validateurs et les traductions restent dans docs/DECISIONS_PENDING.md. Aucune modification de licence n'est implicite dans une contribution.

Les changements de données publiques sont désormais comparés à la base Git et doivent ajouter une approbation liée au contenu par `content_sha256`. Les imports initiaux ne reçoivent aucune approbation inventée. Voir [le guide des référentiels et de revue](ENTITY_REVIEW_GUIDE.md) pour les commandes et les limites administratives de ce contrôle.
