# TEMPORA Desktop 1.0.0 — Dossier de préparation de la première version stable

**Statut : CANDIDAT SOURCE — NON SIGNÉ, NON CERTIFIÉ ET NON PUBLIÉ.**

Date : 10 novembre 2026.
Base de développement : main 71568bb0716ab825b0891644690f056f4f93bbb8.
Le SHA du commit fusionné et les CI sont à consigner après validation.

## Périmètre

TEMPORA Desktop **1.0.0** vise une application Windows x64 Electron/Chromium
hors ligne, avec TEMPORA Framework 3.0.0, canonique v3, Assistant à
relecture humaine et Workbench scientifique. Le numéro 1.0.0 est cohérent
entre package Electron, lockfile, frontend, preload, interface et tests.

L'identité Microsoft Store est **conservée** pour migrer depuis 0.2.0 :
- Store Product ID : 9P4MN0S3823T
- Identity Name : GhemriM.TEMPORADesktop
- Publisher : CN=C5BC3837-BBC8-425E-916B-4B6F77BD7455
- AppX ApplicationId : TEMPORADesktop dans les deux configurations
- NSIS appId : org.tempora.framework.desktop.chromium
- Architecture : Windows x64 uniquement.

Le writer scientifique M1.5 reste systématiquement désactivé dans
les applications empaquetées. TensorFlow et les mises à jour automatiques
ne sont pas activés.

## Réalisation CI à contrôler

Le workflow existant Desktop Foundation doit construire NSIS + AppX,
contrôler AppxManifest version **1.0.0.0** et identité officielle,
tester l'installateur NSIS, les exemples installés et le moteur
scientifique embarqué, puis livrer deux artefacts distincts :
- TEMPORA-Desktop-1.0.0-x64-NSIS-UNSIGNED-TEST-CANDIDATE
- TEMPORA-Desktop-1.0.0-x64-STORE-CANDIDATE-UNSIGNED-NOT-SUBMITTED

Chaque artefact accompagne les binaires de SHA256SUMS.txt et
RELEASE-PROVENANCE.json. Les hashes SHA-256 sont ceux des fichiers
EXE et AppX directement, **pas du ZIP GitHub Actions**. Le manifeste
consigne le SHA Git, les versions, l'identité, l'architecture, le statut
non signé et le fait que la CI ne publie pas.

Les workflows de génération AppX séparée et de signature Authenticode
restent manuels, limités à main. Le workflow signé refuse de produire
une release sans certificats; le certificat, les secrets, la signature
et la certification Store ne sont pas simulés.

## Matrice de recette — résultats non inventés

| ID | Gate | État |
| --- | --- | --- |
| ST-01 | Versions 1.0.0 identiques, lock cohérent, Store Name et Publisher inchangés | Code préparé, CI requise |
| ST-02 | SDK TEMPORA 3.0.0 embarqué, exemples synthétiques et ALNOP, hors ligne | CI requise |
| ST-03 | Écriture packagée M1.5 refusée même avec flag d'environnement | CI requise |
| ST-04 | NSIS install + exemples + runtime + désinstallation sur runner Windows | CI requise ; VM propre distincte |
| ST-05 | AppX Manifest version 1.0.0.0, identité, AppId, x64, SHA-256 exact | CI requise ; fichier réel à revérifier |
| ST-06 | Windows 10 propre sans Node ni WebView2, GUI et dialogues natifs, clavier, antivirus | **NON EFFECTUÉ : manuel** |
| ST-07 | Windows 11 propre, lancement/restart, offline, données en lecture seule, accessibilité | **NON EFFECTUÉ : manuel** |
| ST-08 | Upgrade Microsoft Store 0.2.0 vers 1.0.0, Package Family Name et données préservés | **NON EFFECTUÉ : manuel** |
| ST-09 | EXE NSIS et app signés Authenticode, signatures Valides si diffusion hors Store | **NON EFFECTUÉ : certificat requis** |
| ST-10 | Dépendances Electron/Node, licences, sécurité et plan de rollback contrôlés | **NON EFFECTUÉ : validation responsable** |
| ST-11 | Package 1.0.0 exact certifié par Microsoft, décision distincte de soumission et publication | **NON EFFECTUÉ : Partner Center** |

Une CI verte ne remplace ni les VM vierges, ni la validation du signer
du NSIS, ni la certification et la mise à disposition Microsoft Store.

## Comment finaliser la sortie

1. Après fusion, récupérer les artefacts des workflows **main** au SHA
   exact, vérifier les empreintes EXE et AppX et archiver une copie
   durable hors de la rétention GitHub Actions (30 jours).
2. Tester Windows 10 et 11, interface visible, sélection de fichiers,
   corpus valides/invalides, revue humaine, clavier et hors ligne.
3. Installer sur un poste avec la **vraie version 0.2.0 Store**
   puis monter à 1.0.0 ; confirmer le Package Family Name et l'absence
   de perte des informations utilisateur.
4. Pour diffusion EXE, produire manuellement un candidat réellement
   signé avec les certificats autorisés et contrôler les signatures.
5. Vérifier licences, versions et sécurité de Chromium, Electron et Node.
6. Soumettre manuellement l'AppX exact dans Partner Center, attendre
   sa certification, puis décider séparément de sa publication.

## Limites scientifiques maintenues

Moteur de validation et algorithmes déterministes ne démontrent pas
la véracité des faits historiques. Les P0 SEC-WIN-01/02, SCI-01,
REC-01 et DUR-01 restent ouverts pour une **future persistance
scientifique native**, qui n'est pas une fonction de TEMPORA Desktop 1.0.0
en lecture seule. Aucune publication automatique, aucune IA active.

**Décision : NO-GO pour diffusion publique tant que les gates de canal
et les essais manuels applicables n'ont pas été attestés.**


## Qualification CI vérifiée après fusion — 10 novembre 2026

**PR #125 fusionnée.** HEAD de PR testé :
d09a92d98b835d5952f938bdf07ed6742b9779d9.
Merge main vérifié :
7efbc9f0a0d548db735d63a938e7890ee8134d44.

Trois workflows sur la PR, terminés avec succès :
- Framework #42901764418 — success
- Documentation UI #42901763870 — success
- Desktop Foundation Windows #42901763858 — success
  (NSIS, installation/exemples/moteur, AppX 1.0.0.0, identité/architecture,
   test de refus de la persistance packagée et preuves SHA-256)

Quatre workflows **après fusion sur le SHA exact de main**, tous success :
- Framework #42902639642
- Documentation UI #42902639864
- Publish GitHub Pages #42902639849
- Desktop Foundation Windows #42902639887

**Artefacts issus de main** (run Windows #42902639887) :
- NSIS unsigned test candidate
  TEMPORA-Desktop-1.0.0-x64-NSIS-UNSIGNED-TEST-CANDIDATE
  ID GitHub 13803013793 ; archive 144141043 octets
  expiration déclarée 10/12/2026 21:17:39 UTC.
- AppX Store unsigned candidate
  TEMPORA-Desktop-1.0.0-x64-STORE-CANDIDATE-UNSIGNED-NOT-SUBMITTED
  ID GitHub 13803004531 ; archive 196474806 octets
  expiration déclarée 10/12/2026 21:17:44 UTC.

CI : https://github.com/MGhemri/tempora-framework/actions/runs/42902639887

Chaque archive doit contenir SHA256SUMS.txt et
RELEASE-PROVENANCE.json, produits par la CI à partir des fichiers EXE
et AppX. **Leurs valeurs exactes ne sont pas recopiées ici** : elles
doivent être vérifiées sur les fichiers téléchargés, puis archivées.
La taille ci-dessus est celle du ZIP Actions, pas celle du binaire interne.

Résultat : ST-01 à ST-05 disposent désormais de preuves automatisées
sur main ; ce n'est **pas** un certificat Microsoft, une vérification
sur Windows vierge ni une signature Authenticode.

**NO-GO public conservé** : ST-06/07/08 (Win10, Win11, upgrade Store),
ST-09 (signature NSIS hors Store), ST-10 (revue sécurité/licences)
et ST-11 (certification, choix de soumission et publication).
Aucun tag desktop-v1.0.0, aucune GitHub Release ni aucun upload Store
n'ont été créés par ce lot. Une nouvelle release ne doit pas être
annoncée avant sa propre décision humaine de publication.
