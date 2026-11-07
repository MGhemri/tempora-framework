# TEMPORA Desktop 0.1.1 — Bêta 2 (Windows x64)

**Préversion publique non signée, destinée à la qualification.** Le framework académique demeure `tempora-framework@3.0.0`.

## Nouveautés depuis la Bêta 1

- **Brouillons de revue humains** : transfert au presse-papiers natif depuis le processus Electron principal. Le brouillon est borné à 16 Kio et doit conserver `document_type=tempora.review_draft`, `status=draft`, `approved=false`, `signed=false`, et une empreinte canonique de corpus SHA-256. Aucune revue n'est écrite ou approuvée automatiquement.
- **Séparation renforcée** : politique Content Security Policy locale, blocage des demandes réseau du renderer Electron, aucune navigation Web externe autorisée.
- **Distribution indépendante de WebView2** : Chromium fourni avec Electron, compatible avec la Windows Sandbox vierge précédemment utilisée par le mainteneur.
- **Verrouillage des dépendances** et test du moteur TEMPORA réellement empaqueté, confirmant l'acceptation d'un corpus synthétique valide et le rejet d'un corpus invalide.
- Le logo sablier TEMPORA noir et or demeure présent sur l'application Windows.

## Installation et intégrité

Télécharger `TEMPORA-Desktop-Chromium-0.1.1-beta.2-x64-SETUP.exe`, `SHA256SUMS.txt`, et `RELEASE-PROVENANCE.txt` depuis cette préversion. Contrôler l'empreinte sous PowerShell :

```powershell
Get-FileHash .\TEMPORA-Desktop-Chromium-0.1.1-beta.2-x64-SETUP.exe -Algorithm SHA256
```

Comparer avec la ligne associée dans `SHA256SUMS.txt`. Le programme est **non signé**. Ne pas désactiver SmartScreen ou les protections de Windows.

## Essais de référence déjà confirmés sur la Bêta 1

- Corpus canonique conforme : aucun diagnostic, empreinte `869baa4aa744e886d38177e19962a619b95a4e72e435863e5ee21e91d16cd4d5`.
- Corpus canonique non conforme : diagnostic `CANONICAL_SCHEMA_INVALID` à `/events/0/schema_version`, empreinte `21c088887e58e3a2d1c23b95d18afd524e937ff7fa6697708906001973ad82eb`.

La Bêta 2 doit également être **essayée manuellement** sur Windows Sandbox, particulièrement la copie du brouillon de revue, la navigation, la réinstallation et la désinstallation. La validation de schéma ne prouve pas la véracité des événements historiques.

## Limitations

Pas de signature de code, de mise à jour automatique, ni de certification de sécurité externe. Le client est une **préversion**, pas une distribution stable. L'utilisation de Chromium embarqué implique de suivre les mises à jour de sécurité d'Electron ; aucune mise à jour automatique silencieuse n'est activée. Aucune importation ne modifie automatiquement les corpus.

Développement académique ouvert : https://github.com/MGhemri/tempora-framework
