# Audit — registre des constats, correctifs et travaux en cours

**Périmètre :** TEMPORA Framework 3.x, TEMPORA Desktop, TVRW et futur TEMPORA Assistant. Ce dossier est une **source de suivi** versionnée ; ce n'est ni une preuve de certification indépendante ni un journal d'approbation historique. Dernière mise à jour initiale : 2026-11-08.

## Navigation

**Point de reprise obligatoire : [POINT-DE-REPRISE.md](POINT-DE-REPRISE.md)** — état et preuves de fusion les plus récents, P0 ouverts, version Store et prochaine priorité. Les listes 2026-11-08 ci-dessous sont conservées comme historique.

| Document | Finalité |
|---|---|
| [REGISTRE.md](REGISTRE.md) | Constat, preuve, priorité, état, correction retenue, test exigé et lien de PR |
| [ANALYSE-PATCH-CLAUDE.md](ANALYSE-PATCH-CLAUDE.md) | Revue du patch externe transmis ; choix d'intégration et restrictions |
| [TEMPORA-ASSISTANT-CDC.md](TEMPORA-ASSISTANT-CDC.md) | Spécification fonctionnelle et scientifique du pipeline assisté en cinq étapes |
| [PLAN-IMPLEMENTATION.md](PLAN-IMPLEMENTATION.md) | Jalons réalisables, dépendances, critères d'acceptation et backlog |

## Règles de gestion

1. **Aucune correction sans preuve reproductible.** Toute entrée doit distinguer constat externe, vérification sur le dépôt, décision et résultat des tests.
2. **Ne jamais assimiler validation technique et vérité historique.** Les sorties des algorithmes, dates normalisées et suggestions humaines ou ML sont des projections ou propositions.
3. **Ne pas modifier silencieusement le schéma canonique v3, les empreintes, les formats publiés ou les contrats d'API.** Tout changement de contrat exige versionnement, migration, tests et documentation.
4. **Politique de publication :** branche de travail + PR, vérification CI Linux/Windows, merge seulement après résultats verts ; Microsoft Partner Center jamais soumis automatiquement.
5. **Protection des sources :** aucune modification des octets originaux ; liaison par empreintes, références de ligne/cellule, profil et version de mapping.
6. **État explicite :** `à vérifier`, `confirmé`, `spécifié`, `en cours`, `corrigé / CI validée`, `différé`. Une recommandation n'est pas un correctif implémenté.

## État de référence (au 2026-11-08)

- PR [#73](https://github.com/MGhemri/tempora-framework/pull/73) : exemples Electron NSIS/AppX et installation réelle en CI ; fusionnée.
- PR [#74](https://github.com/MGhemri/tempora-framework/pull/74) : démonstrateur ALNOP v3 distinct du GeoJSON ; fusionnée.
- PR [#75](https://github.com/MGhemri/tempora-framework/pull/75) : précontrôle expérimental de lecture par blocs, **sans** ouverture de grands corpus ; fusionnée.
- PR [#76](https://github.com/MGhemri/tempora-framework/pull/76) : résolution de la taxonomie `event_type` depuis le profil, avec régression ; fusionnée.
- Les travaux sur l'assistant de préparation des imports sont **spécifiés, non implémentés** dans ce dossier. Les fonctions existantes `prepareImport`, `acceptImport`, et le format `tempora.ingestion-mapping.schema.json` constituent les points d'intégration.

## Mise à jour d'un constat

Lorsqu'une PR modifie un comportement : consigner le commit, les tests de non-régression, les limites et l'impact éventuel sur le format publié dans [REGISTRE.md](REGISTRE.md). Les décisions majeures doivent rester vérifiables et réversibles.

## Audit Antigravity — 2026-11-08

Le rapport externe portant sur le commit `a07f2ec` est intégré sous forme d'un [registre vérifié et plan de correction](ANTIGRAVITY-2026-11-08.md). AG-01 (quarantaine CR/LF) et AG-02 (tests Assistant oubliés dans CI) sont déjà corrigés par la PR #91 ; AG-05 (version Electron preload) est corrigé dans une PR dédiée ; AG-04 puis AG-03 et AG-06 sont planifiés, avec tests et migration de compatibilité. Les jugements positifs sur la sécurité rapportés par l'auditeur ne valent pas qualification indépendante.
