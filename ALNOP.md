# ALNOP — Profil de compatibilité de TEMPORA

**ALNOP est un banc d'essai facultatif ; il n'est ni le moteur, ni une dépendance d'exécution du framework TEMPORA.**

Le corpus ALNOP étudie les opérations FLN/ALN de la guerre d'indépendance algérienne (1954–1962).
Ses 263 notices, son atlas, ses archives et les API historiques v1/v2 appartiennent au
[dépôt ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset) et à
[l'application historique](https://alnop.vercel.app/).

## Ce qui reste dans TEMPORA

Le dossier [`compatibility/alnop/`](compatibility/alnop/README.md) fournit :
- le manifeste de profil, les mappings et les adaptateurs de migration ;
- une fixture minimale, les schémas historiques utiles et les empreintes de contrôle ;
- la référence Git épinglée [`pin.json`](compatibility/alnop/pin.json) ;
- une suite minimale sans réseau et une suite complète facultative contre le dépôt ALNOP externe.

Le moteur `src/framework/`, l'API v3, le SDK, la CLI et les publications TEMPORA fonctionnent
sans ce profil et sans ses données. Les anciennes copies du corpus et les anciennes API ne
sont plus présentes dans ce dépôt.

## Vérifier la compatibilité

```sh
npm ci
npm run test:compat:alnop:minimal
```

Pour exécuter le contrôle complet sur une copie **propre** du dépôt ALNOP, placer cette copie
à la révision précise de `compatibility/alnop/pin.json`, puis lancer :

```sh
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Le test complet vérifie les 263 notices, la migration aller-retour, l'ingestion,
les fichiers et archives archivés et les contrats API historiques. Aucune référence
n'est régénérée automatiquement après un échec.

## Documentation scientifique du corpus

Les méthodes historiques, droits et citations propres à ALNOP sont publiés et maintenus
dans le [dépôt historique](https://github.com/MGhemri/aln-historical-operations-dataset).
Pour les méthodes **génériques** de TEMPORA, voir [le modèle canonique](CANONICAL_MODEL.md),
[l'ingestion](INGESTION.md), [les analyses](ANALYSIS.md) et
[la documentation du framework](FRAMEWORK.md).

Un test de compatibilité réussi garantit un contrat logiciel de référence, non
l'exhaustivité ni la véracité historique de chaque notice.
