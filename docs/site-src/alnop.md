# ALNOP, profil de compatibilité

ALNOP documente les opérations du FLN et de l’ALN pendant la guerre d’indépendance algérienne. Son projet historique porte le corpus, l’atlas, les archives et les API v1 et v2.

TEMPORA utilise ALNOP pour vérifier que la migration conserve les données et que les références historiques restent stables. Le SDK, la CLI et les tests synthétiques fonctionnent sans ce corpus.

- [Dépôt historique ALNOP](https://github.com/MGhemri/aln-historical-operations-dataset)
- [Atlas et contributions ALNOP](https://alnop.vercel.app/)
- [Modèle canonique et migration](canonical.html)

```sh
npm run test:compat:alnop:minimal
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

La suite complète exige une copie propre à la révision épinglée dans `compatibility/alnop/pin.json`. Aucun corpus distant n’est téléchargé automatiquement.
