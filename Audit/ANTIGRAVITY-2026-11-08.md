# Audit Antigravity — comparaison du rapport au main actuel

**Date d'enregistrement :** 2026-11-08  
**Source :** rapport transmis par le mainteneur, intitulé *Audit Report: TEMPORA Framework & Assistant Subsystem*, réalisé sur le commit **`a07f2ec`**. Le rapport est **un instantané ancien**, antérieur aux PR #91 et #92. Les parcours en `file:///home/antigravity/...` sont des chemins locaux de la machine de l'auditeur, **pas des URL de preuve publiques**. Les constats sont évalués ci-dessous sur le `main` vérifié au moment de l'ouverture de cette PR.

## Synthèse vérifiée

| Identifiant | Priorité | Constats Antigravity | État vérifié sur main avant cette PR | Décision |
|---|---|---|---|---|
| AG-01 | **P0 (ancien défaut)** | Une cellule de liste contenant un retour ligne peut être normalisée à tort car `trim()` précède le contrôle CR/LF | **Corrigé PR #91** : contrôle de `source.includes('\r')||source.includes('\n')` avant découpage et `trim()` ; test désormais en CI | Maintenir tests de quarantaine, ajouter cas limites au lot de durcissement |
| AG-02 | **P0 (ancien défaut)** | Les quatre tests Assistant n'étaient pas exécutés par `npm run test:core` | **Corrigé PR #91** : toutes les suites Assistant, y compris le XLSX, figurent dans `test:core`; CI Windows/Linux et tests standalone réussis | Fermer ; surveiller toute nouvelle suite oubliée, privilégier couverture explicite contrôlée |
| AG-03 | **P2** | Synonymes `nom_operation`, `date_operation`, `identifiant_operation`, `type_action` codés en dur dans `assist-mapping.js` | **Corrigé — PR #95 fusionnée** : alias contextuels retirés du noyau ; manifeste versionné extérieur lié à ALNOP, suggestions toujours non confirmées | Extraire les alias liés aux opérations en option/version de profil ; préserver données et exemples via fixture/profil, vérifier le schéma de profil avant tout changement |
| AG-04 | **P2** | Repli `['fr','ar']` dans `compareClaims` sans contexte de profil | **Corrigé — PR #94 fusionnée** : repli direct `[]`, analyse principale continue de transmettre `corpus.profile.locales` explicitement | Définir comportement neutre et tester appels directs, corpus non-fr/ar et comparaisons multilingues avant modification |
| AG-05 | **P1 correctif mineur** | `preload.cjs` annonce `0.1.1-beta.2` alors que `electron/package.json` est `0.1.2-beta.3` | **Confirmé** ; corrigé dans la présente PR pour la branche source, et test révisé pour détecter de futures dérives | Contrat preload/package, pas de modification silencieuse d'une release binaire déjà publiée |
| AG-06 | **P3 / analyse UX** | Le bureau Electron/Tauri possède des chemins de prévisualisation à vocabulaire ALNOP (ex. `operations`, `nom_operation`, `type_action`) | **Correctif de neutralité en PR dédiée** : priorités génériques synchronisées Electron/Tauri, fallbacks ALNOP conservés, tests sur données fictives | Conserver compatibilité des exemples ALNOP ; ajouter adaptateur par profil ou chemins configurables ; tests sur corpus historiques non algériens et GeoJSON génériques |
| AG-07 | **Information** | Évaluation positive de la revue `batch_id`, du refus de certitude automatique et des barrières IPC | Avis **rapporté** ; liaison `batch_id` vérifiée dans le code PR #78 | Conserver les invariants et poursuivre audits de sécurité dédiés : appréciation positive ≠ preuve d'absence de faille |

### Portée du rapport externe

L'auditeur a exécuté un test local dans une copie temporaire, testé une partie ALNOP et inspecté les wrappers Desktop. Il rapporte une isolation IPC et des diagnostics solides. Ses résultats concernent le commit `a07f2ec` et **ne doivent pas être transposés aux builds Windows plus récents sans vérification**.

Le test de l'ancienne erreur AG-01 n'a pas été maquillé : l'activation de la CI en PR #91 l'a reproduite et le correctif a été testé avant fusion. La présente PR ne revendique donc **pas** avoir découvert ou réparé à nouveau AG-01/02.

## Plan programmé et critère de sortie

### AG-05 — Version desktop preload (immédiat, cette PR)

- Mettre `apps/desktop/electron/preload.cjs` en cohérence avec `apps/desktop/electron/package.json`.
- Le test `apps/desktop/electron/tests/host.test.cjs` lit la version du package et vérifie l'exactitude de celle exposée par le preload, plutôt que deux chaînes figées susceptibles de dériver ensemble.
- Vérifier les tests Electron sur Windows et Linux, la CI et la non-régression des IPC.
- **Limite de livraison** : une correction dans `main` ne réécrit **pas** l'installateur `desktop-v0.1.2-beta.3` déjà publié. Corriger les binaires à la prochaine préversion avec nouvelle version, provenance et qualification.

### AG-04 — Locale neutre des comparaisons (prochaine PR ciblée, avant interface Assistant)

1. Relever les appels à `compareClaims` et s'assurer que l'analyse fournit les locales du profil, dans l'ordre scientifique convenu.
2. Pour appel direct sans `languages`, définir un repli **neutre** (par ex. liste vide et `no_shared_language`), sans inventer une équivalence textuelle interlangue.
3. Tests adversariaux : valeurs textuelles fr/ar et en/es, appels sans langue, profils avec ordre de langues différent, conflits et compatibilité des résultats existants quand `languages` explicite.
4. CI Linux/Windows, référence scientifique déterministe, sans modifier les hashes canoniques.

### AG-03 — Alias contextuels et neutralité (PR dédiée après AG-04)

1. Établir une liste fermée d'alias génériques, et une liste d'alias contextuels actuels avec preuve de leur origine.
2. Étudier les capacités **réelles** de `schemas/tempora.profile.schema.json` avant de choisir où porter la configuration : manifeste de profil validé, ou enveloppe versionnée de mapping Assistant. **Ne pas insérer de clés arbitraires dans le modèle canonique v3.**
3. Introduire des suggestions d'alias de profil `state: suggested`, versionnées et visibles ; empêcher collisions, prototype pollution, alias non déclarés et conflit avec champs canoniques.
4. Migrer les fixtures/tests ALNOP ou synthétiques de manière explicite, sans supprimer d'exemples existants.
5. Golden tests multi-profils, tests de non-régression du `mapping.json` 1.0.0 et CI Linux/Windows.

### AG-06 — Prévisualiseurs génériques (après AG-03, avec tests desktop)

1. Qualifier l'ordre des fallbacks `events` / `operations` / `records` et `properties.title` / `nom_operation` sans privilégier accidentellement un profil particulier.
2. Prévoir un catalogue d'adaptateurs par profil, avec fallback compatible pour ALNOP géographique.
3. Tests Tauri et Electron sur corpus fictifs génériques, GeoJSON sans champs ALNOP, corpus ALNOP de démonstration ; vérifier labels, catégories et absence de création implicite de faits.
4. Préserver les barrières de navigation, les contraintes IPC et le mode hors connexion.

## Règles de clôture

Chaque constat doit avoir son test de régression et une PR spécifique, **verte sur tous les contrôles requis puis fusionnée**, avec actualisation de ce registre. Les travaux encore « programmés » ne sont ni livrés ni validés. Le suivi générique reste dans [REGISTRE.md](REGISTRE.md) et [PLAN-IMPLEMENTATION.md](PLAN-IMPLEMENTATION.md).
