# TEMPORA Desktop — exemples inclus dans Windows / Windows bundled examples

Deux fichiers petits et **en lecture seule** destinés à tester l'inspecteur et la visualisation. Distribués en tant que ressources de l'installateur NSIS Windows, sous `examples/` dans le dossier d'installation (pas d'écriture dans les documents de l'utilisateur).

1. `synthetic-canonical-v3.json` — corpus **entièrement fictif**, modèle canonique TEMPORA v3. Ouvrir dans Documents, valider avec le moteur TEMPORA puis essayer les projections Chronos/Atlas. Le point [-1.5, 35.1] est purement pédagogique.
2. `alnop-canonical-v3-demo.json` — **démonstrateur canonique v3** construit à partir des cinq géométries déjà publiées dans l'extrait GeoJSON ALNOP. Il conserve les identifiants, les dates exactes déclarées et les dates de fin inconnues, les rôles `representative_point` et les métadonnées de provenance. Il n'importe **aucune preuve comme validation historique** (`sources` et `claims` restent vides). Ouvrir dans TEMPORA pour tester GeoLab, Chronos et les facettes par type.
3. `alnop-geographic-sample.geojson` — **5 notices historiques publiées par ALNOP**, une par wilaya historique W1–W5 au moment de l'extraction, sous-ensemble de l'export GeoJSON. Ouvrir dans l'inspecteur GeoJSON de TEMPORA ou dans un logiciel SIG. **Ce fichier n'est pas un corpus TEMPORA v3** et ne doit pas être envoyé tel quel à la validation canonique. La conversion via mapping ALNOP GeoJSON reste distincte et ne garantit pas automatiquement la validité canonique.

## Attribution et traçabilité ALNOP

Source figée : https://github.com/MGhemri/aln-historical-operations-dataset/blob/2428a693393a4a635d5eeac3e3c8542498b8b9d6/operations_fln_1954_1962.geojson (commit 2428a693393a4a635d5eeac3e3c8542498b8b9d6).
Dataset : ALN Historical Operations Dataset, Ghemri M. Licence annoncée par l'export géographique : **CC BY 4.0** https://creativecommons.org/licenses/by/4.0/. Conserver cette attribution et l'URL source lors de redistribution. Les sources primaires ou secondaires associées à chaque notice sont conservées dans `properties.sources` (jusqu'à deux pour préserver la taille). Un changement de sélection, une omission de champs et l'ajout de `geometry_role` sont des modifications explicites du présent extrait.

**Attention scientifique :** les points peuvent être des coordonnées représentatives et non des localisations exactes d'événements. Les notices ne sont ni certifiées ni exhaustives, et ne prouvent pas les assertions historiques. Ne pas considérer une coordonnée cartographique comme une certitude géodésique ou l'extrait comme les 263 notices du jeu complet.

Aucun téléchargement réseau n'est nécessaire à l'installation. La distribution du contenu ALNOP est limitée à cet extrait attribué. Pour le corpus complet et ses mises à jour : consulter le dépôt ALNOP, et vérifier la licence des données avant toute nouvelle redistribution.

**Distinction de formats :** le fichier `alnop-canonical-v3-demo.json` est un sous-ensemble canonique **de démonstration**, non un export certifié du corpus ALNOP complet. La migration officielle v2 vers v3 reste assurée par `compatibility/alnop/adapters/alnop-migration.js`; cette conversion pédagogique GeoJSON n'y substitue rien. Ne pas interpréter l'absence de preuves importées comme une absence de sources dans ALNOP.
