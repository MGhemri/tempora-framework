# TEMPORA Desktop 1.0.0 — protocole de recette Windows 10/11

**Statut : protocole prêt, aucun essai Windows 10/11 vierge ou migration
Microsoft Store réelle n'est attesté par ce document.** Aucune publication,
signature ni installation n'est automatique.

## Préparer les archives et vérifier l'intégrité

Récupérer les deux ZIP de [la CI main 1.0.0 #42902639887](https://github.com/MGhemri/tempora-framework/actions/runs/42902639887) :
NSIS #13803013793 et AppX #13803004531, expiration annoncée le
10 décembre 2026. Décompresser chaque ZIP dans un dossier séparé.

Le vérificateur utilise Node 22 et lit les fichiers sans les exécuter :

    node apps/desktop/electron/scripts/verify-release-evidence.cjs D:\TEMPORA-NSIS --source-sha 7efbc9f0a0d548db735d63a938e7890ee8134d44
    node apps/desktop/electron/scripts/verify-release-evidence.cjs D:\TEMPORA-AppX --source-sha 7efbc9f0a0d548db735d63a938e7890ee8134d44

Le mode facultatif --both exige que les deux binaires soient dans le
même dossier. Le script compare le hash SHA-256 **des octets de chaque
EXE ou AppX présent**, le manifeste SHA256SUMS.txt et la provenance
JSON au SHA Git demandé. Il vérifie les identifiants et rejette une
revendication de signature non présente dans les métadonnées de CI.
Ce contrôle ne valide **ni Authenticode, ni la signature Store**.

## Windows 10 et Windows 11 : machine propre

Utiliser une VM Windows 10 x64 et une VM Windows 11 x64, et noter
leur édition, version et build, hors ligne et en ligne. Sans Node ni
WebView2 installés pour les parcours de l'utilisateur (le vérificateur
de ZIP peut fonctionner sur une machine distincte).

Le script PowerShell de prévol est en **lecture seule** : il ne lit pas
les corpus, ne capture aucun nom d'utilisateur, n'installe et ne
désinstalle rien ; il sauvegarde seulement un rapport de configuration :

    powershell.exe -NoProfile -File apps/desktop/electron/scripts/stable-windows-preflight.ps1 -Phase Inventory -ReportPath .\work\stable-1.0.0\inventory.json

Exécuter **manuellement** et documenter : installation NSIS (test non
signé, usage limité à l'environnement de qualification), lancement du
GUI, fermeture, redémarrage, choix/annulation de fichier, contrôle
canonique v3, Assistant avec documents fictifs, refus du writer M1.5,
exemples ALNOP, GeoLab/GraphLab/Chronos, mode hors ligne,
navigation clavier/lecteur d'écran, antivirus/SmartScreen,
désinstallation et nettoyage attendu.

Chaque essai exige un verdict humain PASS / FAIL / NON TESTÉ et la
référence du binaire. Les traces de recherche privées ne doivent
jamais être committées dans Audit.

## Microsoft Store : vraie migration 0.2.0 vers 1.0.0

Ne pas tenter de sideloader l'AppX unsigned de la CI. Une migration
qualifiable utilise les **véritables installations Store** sur un
poste de test autorisé, ainsi qu'un package 1.0.0 soumis et certifié
via Partner Center selon le processus du mainteneur.

Avant la mise à niveau sur un compte possédant la version Store 0.2.0 :

    powershell.exe -NoProfile -File apps/desktop/electron/scripts/stable-windows-preflight.ps1 -Phase BeforeUpgrade -ReportPath .\work\stable-1.0.0\before.json

Après mise à niveau **manuelle par le canal officiel** :

    powershell.exe -NoProfile -File apps/desktop/electron/scripts/stable-windows-preflight.ps1 -Phase AfterUpgrade -BaselinePath .\work\stable-1.0.0\before.json -ReportPath .\work\stable-1.0.0\after.json

Le script refuse une version initiale hors 0.2.0.*, une version cible
hors 1.0.0.*, ou le changement de Package Family Name Microsoft.
La continuité des préférences et l'absence de perte de données demandent
une vérification humaine distincte ; le script ne lit jamais ces données.

## Signature pour un EXE distribué hors Microsoft Store

La signature du vrai NSIS proposé à la distribution doit être Valid
dans Get-AuthenticodeSignature, et l'exécutable installé doit être
vérifié séparément. Pour exiger la validité de l'EXE dans la sonde :

    powershell.exe -NoProfile -File apps/desktop/electron/scripts/stable-windows-preflight.ps1 -Phase Inventory -ReportPath .\work\stable-1.0.0\signed-exe.json -NsisInstaller D:\TEMPORA-SIGNED-SETUP.exe -RequireValidNsisSignature

Les artefacts non signés de la CI échouent intentionnellement à cette
condition ; un résultat positif ne vaut pas validation de la
chaîne d'approvisionnement complète.

## Décision GO/NO-GO

- NSIS externe : signatures réelles, essais propres Windows 10/11,
  GUI, accessibilité, dépendances et antivirus acceptés.
- Store : identité officielle, upgrade et données préservés,
  certification Microsoft propre à la 1.0.0 et décision séparée de
  publication.
- Les rapports machine ne démontrent pas la sécurité du modèle historique,
  la durabilité M1.5 ou la véracité d'une source.

**Aucune release stable publique ne doit être annoncée sans procès-verbal
de qualification et validation du mainteneur.**
