# TVRW — Provenance des exports filtrés

Ce jalon prolonge les facettes scientifiques du J6 : les exports locaux JSON, GeoJSON, CSV et GraphML acceptent les mêmes filtres validés que les projections consultées. Le filtre est appliqué **avant pagination**, et l'export contient la page courante uniquement. Les critères (statut éditorial, référence typée, période déclarée) sont enregistrés dans le manifeste et contribuent à l'empreinte scientifique reproductible.

Il n'y a **aucune inférence historique**, aucun accès réseau, aucune modification du corpus canonique v3. Une date inconnue ne reçoit pas de borne fictive ; les exclusions sont comptées dans les diagnostics. Les formats ne sont pas interchangeables : GeoJSON reste réservé à GeoLab et GraphML à GraphLab. Les archives CSV incluent un manifeste détaché. L'enregistrement local exige toujours le dialogue natif et ne peut pas écraser silencieusement les fichiers existants.

Les analyses algorithmiques et les comparaisons de snapshots restent désactivées quand des facettes sont actives, tant qu'elles ne sont pas explicitement rendues compatibles. Test : `npm run test:visualization` depuis `apps/desktop`; recette Windows réelle et certification Store restent des contrôles distincts.
