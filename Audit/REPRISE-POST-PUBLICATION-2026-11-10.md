# TEMPORA — reprise après publication déclarée et deux lots livrés

**Date :** 10 novembre 2026.
**Dépôt :** MGhemri/tempora-framework.
**Main HEAD après PR #120 :** d052bc9685c5174af7c8a7bb505fb30177753357.

## Store : distinguer la déclaration et les preuves

Le propriétaire déclare avoir **publié TEMPORA Desktop 0.2.0** dans
Microsoft Partner Center. Le package qu'il a utilisé est déclaré comme
artefact de GitHub Actions #42854145980, artefact #13781418953,
commit main 3c2b7bb752538a8990dad88b1527b0a422c56ca5.

Cette déclaration de publication n'est pas une validation indépendante
de la fiche publique, de la certification propre au binaire ou du hash
du fichier AppX effectivement distribué. Issue #113 conservée ouverte
pour vérification de la provenance. Les changements fusionnés
après 3c2b7bb ne figurent pas dans ce build déclaré.

## Livraisons de développement effectives

1. PR #119 — TVRW J10 : frise Chronos fondée sur les jours grégoriens,
   plages d'incertitude explicites, fins inconnues préservées, pas
   d'imputation ni de changement canonique. Merge 6f12ed91.
   CI PR : Framework 42886970506, Docs 42886970501,
   Desktop 42886970403, toutes success.
   CI main postmerge : Framework 42887873193, Docs 42887873294,
   Desktop 42887873374, toutes success.
2. PR #120 — M1.5 SCI-01 sous-lot : le worker produit la cinquième
   empreinte mapping_sha256 ; hôte, gate de consentement, coordinateur,
   workflow et replay la lient aux quatre autres SHA, avec tests
   d'altération/refus. Merge d052bc968.
   CI PR : Framework 42889142432, Docs 42889142439,
   Desktop 42889142667, toutes success.
   CI main postmerge : runs 42889909414 / 42889909535 /
   42889909219, conclusion à re-vérifier avant de les invoquer.

## Premier bloc prioritaire de reprise

**SEC-WIN-01/02 + SCI-01 :** terminer la frontière hôte–Rust et
les écritures exclusivement fondées sur des handles sûrs ; vérifier
la liaison des deux décisions humaines, du mapping et des cinq SHA
à des buffers canoniques revalidés. Ajouter des tests Win32 adversariaux
sur jonctions, substitutions, ACL, volumes et simultanéité.

**REC-01 :** workflow de récupération avec action opérateur indépendante,
jamais de suppression/promotion implicite. Les snapshots forensic J9
restent des contrôles consultatifs, non atomiques.

**DUR-01 :** tests reproductibles de pannes OS/power-loss sur NTFS.
Les tests de sortie ou de crash Rust ne prouvent pas la durabilité
après coupure physique.

**TVRW J11–J12 :** liens entre les six vues, accessibilité, graphes
volumineux et fonds de carte locaux licites. Ensuite seulement
conception/évaluation TensorFlow ; aucune inférence non supervisée.

## Invariants maintenus

- Application Windows officielle : Electron/Chromium x64 ;
  Tauri/WebView2 est une archive de développement.
- SDK npm tempora-framework 3.0.0 et canonique v3 inchangés.
- Aucun nouveau writer scientifique activé dans les applications
  packagées ; aucun consentement automatique, nettoyage de verrou,
  publication Store, release npm ou GitHub lancée.
- Chaque nouveau lot comprend du code utile, des tests adversariaux,
  une PR vérifiée sur son HEAD exact, puis un point de reprise Audit.
