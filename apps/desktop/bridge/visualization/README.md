# TVRW J1A — Contrats de projections dérivées (privés)

Implémentation de base pour **TEMPORA Visual Research Workbench**, sans rendre
le nouveau code public dans `tempora-framework@3.0.0` et sans modifier
`schemas/tempora/v3/`.

## Surface réelle (J1A uniquement)

- `contracts.cjs` : `ref`, `refKey`, `refs`, `selection`,
  `diagnostics`, `projection`. Ces fonctions sont pures et utilisent
  uniquement l'entrée publique `require('tempora-framework').canonical`.
- `schemas/tempora/visualization/` : références typées,
  sélection globale versionnée et enveloppes de projections non canoniques.
- `apps/desktop/tests/visualization/j1a-contracts.test.mjs` :
  fixtures entièrement **synthétiques**, immutabilité, empreintes,
  filtres, ambiguïtés d'identifiants, invalides, limites et troncature.

**Ce qui n'est PAS livré ici :** projections Geo/Graph/Chronos,
IPC 2.0, projet natif, index, export, découverte automatique, cartes,
jobs, pagination réelle, nouvelle API npm, modèles ML ou changements UI.

## Contrat de reproductibilité

L'empreinte `scientific_sha256` inclut la version de projection,
l'algorithme, l'empreinte de ses paramètres, le digest canonique
du corpus, la version du moteur, le mode, les filtres, les dénominateurs,
les diagnostics et les résultats. Elle **exclut** le champ informatif
`generated_at`.

La projection refuse tout corpus invalide : mode `validated`
uniquement en J1A. Une future prévisualisation `unvalidated-preview`
ne peut pas être acceptée implicitement ni exploiter des analyses historiques.

Les références utilisent **`kind + namespace + id`**, identiquement
à la grammaire `Reference` de TEMPORA v3, jamais un titre ou `id` seul.
Les résultats sont au plus 250 objets / 256 KiB, les références de
sélection au plus 256, les diagnostics au plus 200. Aucun corpus n'est
écrit, aucune requête externe n'est effectuée.

## Compatibilité, déploiement et retour arrière

Cette tranche n'ajoute **aucune** commande à la WebView ou au worker
en production. Le protocole 1.0.0, `health`, `corpus.validate` et
`corpus.digest` restent inchangés.

Une prochaine PR J2 définira l'IPC 2.0 et les handles de corpus éphémères
avant toute exploitation par l'interface. Retirer le dossier
`apps/desktop/bridge/visualization`, les trois schémas et leurs tests
restaure exactement le comportement fonctionnel pré-J1A.

**Règle scientifique :** conformité technique != vérité historique.
L'empreinte de projection n'est pas une signature humaine ou une attestation
de validité factuelle.

## Tests

Depuis `apps/desktop` :

```sh
npm run test:visualization
```

Tous les tests doivent s'exécuter dans la CI Desktop Electron et la
CI Foundation, sans corpus historique réel.
