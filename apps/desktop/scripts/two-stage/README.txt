TEMPORA Desktop / Installation Windows en deux etapes (EXPERIMENTAL)

Cette archive contient le programme d'installation TEMPORA et son
orchestrateur. Il manque volontairement l'installateur Microsoft si
vous ne l'avez pas ajoute vous-meme : aucune version de provenance
inconnue n'est redistribuee.

1. Telechargez Microsoft Edge WebView2 Runtime, section
   "Evergreen Standalone Installer", architecture x64, depuis
   https://developer.microsoft.com/microsoft-edge/webview2/
2. Placez le fichier officiel
   MicrosoftEdgeWebView2RuntimeInstallerX64.exe
   a cote de INSTALL_TEMPORA.cmd et Install-TEMPORA.ps1.
3. Double-cliquez sur INSTALL_TEMPORA.cmd.
4. Le script verifie la signature Microsoft, installe WebView2
   uniquement s'il manque, et exige une version WebView2
   enregistree dans Windows AVANT d'ouvrir l'installateur TEMPORA.
5. Terminez l'installation TEMPORA puis ouvrez l'application.

En cas d'echec de WebView2, TEMPORA n'est pas installe par ce lanceur.
L'installateur ne contourne pas les restrictions de Windows Sandbox.
L'installation peut necessiter un redemarrage ou les droits administrateur
selon la configuration de Microsoft Edge Update.

Les installateurs CI de TEMPORA ne sont pas signes; ceci n'est PAS
une release publique. Utilisez exclusivement les binaires de la
page officielle Microsoft et le depot TEMPORA que vous controlez.

Diagnostic uniquement (sans installation):
powershell.exe -NoProfile -File .\Install-TEMPORA.ps1 -CheckOnly

Aucun runtime n'est installe automatiquement par la verification.
Pour des fichiers deja telecharges, vous pouvez aussi appeler:
.\Install-TEMPORA.ps1 -WebView2InstallerPath "C:\path\MicrosoftEdgeWebView2RuntimeInstallerX64.exe" -TemporaInstallerPath "C:\path\tempora-desktop_setup.exe"
