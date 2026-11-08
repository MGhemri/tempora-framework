# TEMPORA Desktop 0.1.2 — Bêta 3 (Windows x64, Electron)

**Préversion publique expérimentale et non signée**, destinée aux tests scientifiques et à la qualification Windows. **Ce n'est pas une version stable ni une certification Microsoft Store.**

- Tag : `desktop-v0.1.2-beta.3`
- Application Electron : `0.1.2-beta.3`
- Moteur embarqué **pinned npm** : `tempora-framework@3.0.0` (inchangé)
- Architecture : Windows x64 / Electron Chromium ; installateur NSIS
- Licence : se reporter aux métadonnées du projet et aux crédits des exemples.

## Nouveautés depuis la bêta 2

- **Trois exemples hors ligne dans l'installateur** : un corpus canonique v3 fictif, un extrait géographique ALNOP GeoJSON, et un démonstrateur canonique v3 ALNOP de cinq événements et cinq assertions spatiales ; données sources et références de révision incluses.
- **Prévisualisation GeoJSON ALNOP plus lisible** : titres `nom_operation` et types `type_action` quand présents, sans prétendre valider l'histoire.
- **Qualification CI renforcée** : test du moteur Node effectivement empaqueté, validation du corpus d'exemple, test d'installation silencieuse NSIS et inventaire des ressources après installation.
- Code source / documents d'audit : jalons J8C, J8D, J8E, correction de taxonomie et correction de liaison `review.batch_id` dans le dépôt. **Attention :** les corrections récentes du Framework sur `main` (y compris `AUD-02`) ne sont **pas** incluses dans le package npm `tempora-framework@3.0.0` déjà publié et épinglé dans l'installateur.

## Fichiers de release

- `TEMPORA-Desktop-0.1.2-beta.3-x64-SETUP.exe` — installateur expérimental Windows x64 non signé.
- `SHA256SUMS.txt` — somme SHA-256 du binaire publié.
- `RELEASE-PROVENANCE.txt` — commit source, moteur embarqué, hash des exécutables Node/worker et avertissements.

Comparer l'empreinte :

```powershell
Get-FileHash .\TEMPORA-Desktop-0.1.2-beta.3-x64-SETUP.exe -Algorithm SHA256
```

Vérifier qu'elle correspond à `SHA256SUMS.txt` dans **cette même release**. Ne pas désactiver Windows Defender ou SmartScreen.

## Portée de la validation

La chaîne de publication ne s'exécute que sur la branche protégée `main`, après réussite des tests Framework Windows/Linux. L'installateur est reconstruit sur Windows, puis son moteur et ses exemples sont testés sur les ressources empaquetées et après installation NSIS. Cela ne remplace **pas** une recette manuelle complète du GUI dans Windows Sandbox ni un audit de sécurité externe.

Le rôle `representative_point` des géométries ALNOP reste explicite ; aucune localisation approximative n'est présentée comme l'emplacement exact d'une opération.

## Limitations

Pas de signature Authenticode, de soumission Microsoft Partner Center, de mise à jour automatique, de validation historique automatique, de support garanti des corpus 100k ni d'inférence ML intégrée. Ne pas utiliser cette bêta pour des décisions de publication scientifique sans revue humaine.

Documentation : https://github.com/MGhemri/tempora-framework
