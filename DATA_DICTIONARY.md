# Dictionnaire des données ALNOP

## Source de vérité

`data/operations/` contient une fiche par fichier, `data/sources/` les notices bibliographiques, `data/territorial-units/` les unités ou catégories et `data/vocabularies.json` le vocabulaire contrôlé. `data/dataset.json` conserve les métadonnées et l’ordre du corpus initial. Modifier le canon, puis générer les fichiers publics ; ne pas modifier les copies à la main.

| Champ | Signification |
|---|---|
| id | Identifiant permanent attribué par le mainteneur ; fichier du même nom |
| schema_version | Profil de schéma, actuellement 2.0.0 |
| title.fr / title.ar | Titre fourni ; traduction absente représentée par null, y compris le français dans un brouillon reçu en arabe |
| start_date / end_date | Bornes earliest/latest, précision et certitude distinctes |
| locations | Plusieurs lieux possibles ; Point WGS84 [longitude, latitude] ou géométrie null |
| geometry_role | exact_site, approximate_site, representative_point ou unknown ; aucun rayon inventé |
| territorial_assignments | Références multiples, rôle et source_ids ; aucune attribution certaine calculée par regex |
| source_ids | Sources référencées, sans référence orpheline |
| description | Texte FR et éventuel texte AR ; aucune traduction automatique |
| event_type | Valeurs du vocabulaire contrôlé ; liste vide permise dans un brouillon seulement |
| commanders / outcomes / strategic_impact | Informations fournies par les sources ; facultatives, sans nombres inférés |
| editorial_status | proposed, under_review, published, disputed ou withdrawn ; seul published entre dans les exports publics |
| review_history | Décision, reviewer, référence, justification et date UTC |
| provenance | Commit de préparation/import, base de publication et présence d’une revue enregistrée |
| quality_flags / editorial_notes | Réserves documentaires ; aucun score de vérité |
| created_at / updated_at | Dates éditoriales pour les nouvelles fiches, distinctes des dates historiques |
| legacy | Objet initial immuable, conservé comme preuve de migration pour les 263 fiches |

## Incertitudes

Une année seule est conservée avec précision year et bornes annuelles ; elle ressort sous la forme `1956` dans v1. Une date inconnue reste null. Un intervalle ne devient pas une date exacte dans v1 : sa valeur y reste null, ses bornes étant disponibles dans canonical_metadata et les exports enrichis. Les statistiques distinguent les dates non déterminées.

Une localisation inconnue ne crée aucun point. Plusieurs sites restent distincts dans le canon et peuvent former un MultiPoint dans le GeoJSON enrichi ; la projection v1 ne choisit pas arbitrairement un site unique. Une géométrie représentative ne devient pas une localisation tactique exacte.

## Territoires

Les dix catégories héritées ont le type editorial_category et des validités inconnues. Elles ne constituent pas dix unités historiques équivalentes à toute date. Le champ legacy_territorial_label sert à préserver le libellé de compatibilité, pas à confirmer une attribution scientifique. Les opérations nouvelles ou révisées utilisent des références et preuves explicites. Sans territoire principal validé, les statistiques de classement primaire utilisent un groupe multiterritorial/non attribué ; les appartenances multiples restent visibles dans la fiche.

## Révision d’une fiche initiale

L’objet legacy et les métadonnées initiales restent inchangés. Une révision utilise publication_basis=human_review, des champs canoniques documentés et une nouvelle entrée de revue. Les valeurs non révisées de commandement, bilan ou impact sont conservées par l’adaptateur. Retirer une des 263 fiches exige un futur mécanisme de tombstone ; la suppression directe est actuellement bloquée.

## Formats publics

Les quatre chemins JSON/GeoJSON historiques sont générés depuis le canon. `/data/canonical/` expose JSON enrichi, JSON compatible, sources, GeoJSON, CSV UTF-8, rapports et manifeste SHA-256. Les brouillons et leurs sources non publiées sont exclus de ces exports. Un brouillon seul ne modifie pas l’empreinte du corpus publié.

Le manifeste décrit un snapshot validé, pas une release scientifique numérotée ni un DOI. Les versions de corpus, les assertions détaillées, les référentiels de personnes/organisations/lieux et les géométries surfaciques complètes restent à développer dans les étapes suivantes. Les licences existantes ne sont pas modifiées.

Un brouillon en arabe conserve son texte sous ar et laisse fr à null. La projection publique v1 nécessite un titre et une description français vérifiés ; aucune traduction n’est générée automatiquement.
## Assertions et contradictions

Les assertions sont des objets distincts, référencés par leur `subject` (identifiant d’opération). Elles possèdent une valeur, un statut documentaire, des passages sources, des liens de contradiction et un historique de revue. Leur état éditorial est distinct du statut de l’assertion. Le détail des champs et de la publication figure dans [la politique de provenance](PROVENANCE_POLICY.md).

L’export `data/canonical/claims.json` contient uniquement les assertions publiées sur des fiches publiées. Les sources correspondantes sont incluses dans `sources.json`, et les `claim_ids` dans les propriétés GeoJSON. Les réponses v1 des fiches concernées ajoutent `scientific_claims` sans remplacer les champs historiques.
