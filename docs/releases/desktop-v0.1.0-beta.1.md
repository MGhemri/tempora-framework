# TEMPORA Desktop Chromium 0.1.0 — bêta 1 (Windows x64)

**Préversion expérimentale, non signée. Ne pas utiliser comme version de production.**

TEMPORA Desktop utilise désormais Electron avec son propre Chromium. Cette édition **ne requiert pas Microsoft Edge WebView2** : elle a été installée et lancée avec succès sur une Windows Sandbox vierge, où les installations Tauri/WebView2 échouaient.

## Fonctionnalités disponibles
- Application Windows x64 avec interface de recherche bilingue.
- Navigation locale dans les fichiers JSON et GeoJSON (aperçu en lecture seule).
- Validation **canonique réelle** via TEMPORA Framework Engine **3.0.0** embarqué, indépendamment de Node.js système.
- Inventaires d’événements, sources, assertions, preuves déclarées et contradictions explicites.
- Dossiers de revue déclarés et brouillons humains non signés, sans modification automatique des corpus.
- Nouveau pictogramme Windows TEMPORA, dérivé du logo sablier noir et or fourni par le mainteneur.

## Qualification vérifiée
- Windows Sandbox : installation et affichage réussis, confirmation par le mainteneur.
- Corpus de référence conforme : 0 diagnostic ; empreinte canonique `869baa4aa744e886d38177e19962a619b95a4e72e435863e5ee21e91d16cd4d5`.
- Corpus de référence volontairement non conforme : 1 diagnostic `CANONICAL_SCHEMA_INVALID`, chemin `/events/0/schema_version` ; empreinte `21c088887e58e3a2d1c23b95d18afd524e937ff7fa6697708906001973ad82eb`.
- GitHub Actions : pipeline Electron avec `npm ci`, lockfile versionné, exécution des validations avec **Node et worker empaquetés**, tests Rust/Tauri historiques, Framework et documentation.
- Cette préversion contient un manifeste SHA-256 vérifiable à côté de l'installateur.

## Installation
1. Téléchargez `TEMPORA-Desktop-Chromium-0.1.0-x64-SETUP.exe` depuis cette release et `SHA256SUMS.txt`.
2. Vérifiez l'empreinte : `Get-FileHash .\TEMPORA-Desktop-Chromium-0.1.0-x64-SETUP.exe -Algorithm SHA256`.
3. Exécutez le programme d’installation NSIS et testez les corpus synthétiques.

## Limitations et sécurité
- **Code non signé** : Windows SmartScreen peut avertir ; ne désactivez pas vos protections système. Installez uniquement des binaires téléchargés depuis le dépôt officiel et vérifiés par SHA-256.
- **Pas encore de mise à jour automatique**, ni de signature de code, ni d’audit externe complet.
- Les tests approfondis de navigation interactive, copie de brouillons de revue, désinstallation/réinstallation restent à compléter.
- Les validations de schéma ne constituent **pas une certification historique** et ne remplacent jamais la revue humaine.
- Electron embarque Chromium : les correctifs de sécurité de ce runtime doivent être suivis dans les versions suivantes.
- Aucune télémétrie ni transmission volontaire des corpus par les fonctionnalités de recherche.

**Dépôt :** https://github.com/MGhemri/tempora-framework

**Version du moteur scientifique :** `tempora-framework@3.0.0`. **Version Desktop :** `0.1.0-beta.1` (canal de publication bêta ; le numéro interne de l'application reste 0.1.0).
