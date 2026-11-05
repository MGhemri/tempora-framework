# Sécurité de TEMPORA

## Entrées et limites

Les fichiers JSON, CSV et GeoJSON sont des entrées non fiables. L’ingestion borne leur taille, leur profondeur et leur nombre de lignes. Le JSON ambigu ou aux nombres non représentables échoue. Les pointeurs des mappings sont déclaratifs. Les références de profil restent dans une racine explicite, avec contrôle des liens symboliques. Le noyau utilise ses schémas locaux et ne suit pas les URL citées par les sources.

Une géométrie peut être invalide ou trop coûteuse à traiter. Les schémas bornent les positions prises en charge et les contrôles refusent notamment les anneaux invalides. Le budget d’analyse limite les comparaisons. Les opérations dépassant leurs limites doivent échouer avant la publication.

## Données privées et publication

Les entrées originales, décisions éditoriales et identifiants des relecteurs restent dans l’espace de travail. Le constructeur public retient les notices sélectionnées et leurs dépendances approuvées. Des tests introduisent des marqueurs fictifs dans les champs privés et contrôlent leur absence dans les artefacts et réponses HTTP. Les champs destinés à être publics exigent une revue humaine des droits, de la sensibilité et des citations. Les exports CSV neutralisent les préfixes de formule. Un consommateur HTML doit échapper les chaînes qu’il affiche.

La vérification recalcule les sommes et contrôle la cohérence entre les fichiers. L’empreinte terminale de revue provient d’un registre indépendant. L’authentification, le contrôle d’accès au registre et la conservation des secrets relèvent de l’hôte.

## Exposition du service

L’adaptateur Node écoute sur la boucle locale. Il ne sert que les versions activées, applique des limites de requête et de réponse et filtre les détails d’erreur. Un hôte distant doit définir ses propres limites de débit, permissions et règles CORS. Le dossier des versions activées et ses pointeurs doivent être accessibles en écriture aux seuls opérateurs autorisés.

Le paquet d’exécution est testé par installation depuis le tarball. La CI audite ses dépendances d’exécution. Les politiques propres aux corpus et les droits de redistribution restent distincts de la licence MIT du logiciel.
