# TEMPORA — point de reprise vérifié (10 novembre 2026)

> **Lire cette page en premier**, puis `REPRISE-TRAVAUX.md` pour les règles de sécurité et `TEMPORA-ETAT-AVANCEMENT.md` pour le détail des jalons. Cette page remplace les indications historiques « PR #114 draft » ou « J9 en développement » dispersées dans les anciennes sections. Vérifier le HEAD et les CI GitHub avant toute nouvelle intervention.

## Base de développement livrée

- Dépôt : https://github.com/MGhemri/tempora-framework
- Branche stable : `main` ; HEAD observé après PR #117 : `ed709c4e4ff291fc66bca57437a12172b6a5ac9e`.
- PR #114 (M15-20 + candidat Store 0.2.0) : **fusionnée** le 10/11, merge `3c2b7bb752538a8990dad88b1527b0a422c56ca5`.
- PR #115 (clôture audit Store) : **fusionnée**, merge `e0eb3ca44fe6ee7e14ce5f78166d566d574b3848`.
- PR #116 (M1.5 REC-01, contrôle de cohérence des preuves) : **fusionnée**, merge `57cde355965324ed104559ff767c1c925dcee97f`, HEAD testé `3f6166dd2ee5adad10fe51bb309ef4adc144e6d0`.
- PR #117 (TVRW J9 GeoLab interactif) : **fusionnée**, merge `ed709c4e4ff291fc66bca57437a12172b6a5ac9e`, HEAD testé `e63db25273239018bbb0f170972399c41631d457`.
- Ancien incident CI #111 : **clos**, car NSIS Electron officiel est de nouveau opérationnel ; la voie Tauri/WebView2 est archivée.

## Preuves de CI attachées aux HEAD de PR

| Lot | Framework | Documentation | Desktop Foundation |
| --- | --- | --- | --- |
| PR #116 | [42864910071](https://github.com/MGhemri/tempora-framework/actions/runs/42864910071) success | [42864909686](https://github.com/MGhemri/tempora-framework/actions/runs/42864909686) success | [42864910230](https://github.com/MGhemri/tempora-framework/actions/runs/42864910230) success |
| PR #117 | [42866739173](https://github.com/MGhemri/tempora-framework/actions/runs/42866739173) success | [42866739167](https://github.com/MGhemri/tempora-framework/actions/runs/42866739167) success | [42866738978](https://github.com/MGhemri/tempora-framework/actions/runs/42866738978) success |

**Attention :** les CI `main` sont distinctes. Le merge de #117 a déclenché Framework `42867617074`, Docs `42867617234` et Desktop `42867617274` ; revérifier leurs conclusions avant de les citer comme succès. Une nouvelle PR change de HEAD et exige sa propre qualification.

## Fonctionnalités acquises

- TEMPORA Framework `3.0.0` et modèle canonique v3.
- Application Windows officielle Electron/Chromium x64, moteur Node épinglé, exemples synthétiques/ALNOP, packaging NSIS et AppX candidat en CI.
- Assistant d'inspection, mapping, revue humaine et simulation d'acceptation. Persistance expérimentale non packagée **désactivée** pour les installateurs.
- M1.5 REC-01 : vérification de cohérence temporelle d'un inventaire de fichiers, en lecture seule, y compris substitutions « toujours valides ». Ce n'est **ni** un snapshot atomique NTFS **ni** une autorisation de récupération.
- TVRW J9 : coordonnées Point auto-ajustées, gestion de l'antiméridien, regroupement visuel, zoom/panoramique et tests immuables. **Sans carte de fond, sans requête réseau, sans vérité historique inférée.**

## Distribution Store : étape volontairement non franchie

La version `0.2.0` est candidate AppX x64 **non soumise, non publiée, non certifiée pour ce nouveau SHA**.

Le build Windows de la PR #117 contient un artefact temporaire
`TEMPORA-Desktop-0.2.0-x64-STORE-CANDIDATE-NOT-PUBLISHED` (ID `13788106637`, run `42866738978`, expiration annoncée le **24/11/2026**). Il est attaché au **HEAD de PR**, pas au dernier merge `main`. Les candidats antérieurs ont été construits **avant** J9 ; ne pas les appeler « package actuel ». Avant Partner Center : requalifier un **AppX du SHA final exact**, sauvegarder une copie et son SHA-256 du fichier AppX, tester Windows vierge, version/identité, migration et fonctionnement hors ligne. Partner Center exige une décision manuelle distincte.

## Premier lot à reprendre — vrais P0 non fermés

1. **SEC-WIN-01/02 + SCI-01** : autorité hôte↔Rust résistante à la falsification, liaison des deux décisions humaines et des cinq SHA, fermeture des races Win32 et garanties d'objets par handles.
2. **REC-01** : procédure opérateur explicitement autorisée (conservation, reprise/abandon), jamais de purge/promote silencieux ; distinction preuve de journal et validation scientifique.
3. **DUR-01** : essais de coupure OS/power-loss instrumentée sur NTFS ; les arrêts `process.exit` ne démontrent pas cette propriété.
4. **PACK-01/GUI-01** : tests Store/NSIS sur Windows 10/11 propre, accessibilité, upgrade, signature, lancement hors ligne.
5. **TVRW** : fonds de cartes locaux/versionnés avec droits vérifiés, interactions entre vues, corpus volumineux, UI et tests d'accessibilité.
6. **TensorFlow** ensuite : contrats et provenance d'inférence, jeu d'évaluation, supervision humaine. Pas d'activation IA à ce stade.

**Rythme d'exécution demandé :** lots suffisamment substantiels (code + tests + audit), branches éphémères et PR, qualifications au HEAD final uniquement. N'effectuer **aucune** soumission/passage en production Store, release npm/GitHub ou activation de writer packagé sans décision distincte. Ne jamais compter le nombre de commits comme preuve d'avancement.
