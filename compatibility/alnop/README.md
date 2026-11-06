# Compatibilité ALNOP facultative

TEMPORA fonctionne sans ce dossier et sans le corpus ALNOP. Le profil, ses mappings,
les adaptateurs et le petit jeu de référence sont conservés ici pour tester la compatibilité.
Les anciennes entrées `src/profiles/alnop*.js` restent temporairement des alias.

## Test minimal hors réseau

```sh
npm ci
npm run test:compat:alnop:minimal
```

Le test vérifie les empreintes et la conversion réversible d'une notice, le rejet des
mappings incompatibles et l'exécution sans anciens modules, API ou corpus complet.
Les schémas v2 et le validateur local décrivent uniquement le contrat historique.

## Test complet sur une copie extérieure

La référence `2428a693393a4a635d5eeac3e3c8542498b8b9d6`
est définie par le SHA complet de `pin.json`, seule autorité pour la révision.
Cette référence reprend celle de la baseline existante, vérifiée sur le dépôt historique.

```sh
git clone https://github.com/MGhemri/aln-historical-operations-dataset ../alnop-reference
git -C ../alnop-reference checkout --detach 2428a693393a4a635d5eeac3e3c8542498b8b9d6
npm ci --prefix ../alnop-reference
npm run test:compat:alnop:full -- --alnop-dir ../alnop-reference
```

Le checkout doit être propre. Le contrôle refuse une autre révision et toute divergence
d'empreinte avant de charger les outils historiques. Il vérifie les 263 notices, leurs
sources, les archives, les conversions et les réponses API v1/v2 figées.
Le rapport est écrit dans `work/compatibility-alnop-result.json` ; `--output` permet
de choisir une autre destination privée. Il ne contient aucune notice.

Aucun téléchargement ne se produit pendant l'installation ou les tests du noyau.
La suite complète ne modifie ni le dépôt de référence ni les baselines.
Les textes suivis par Git sont comparés après normalisation CRLF vers LF ; les archives
binaires sont comparées octet pour octet. Les évolutions des références nécessitent une
revue explicite et ne sont jamais acceptées automatiquement après un échec.
