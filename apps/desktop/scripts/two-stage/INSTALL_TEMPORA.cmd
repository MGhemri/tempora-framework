@echo off
setlocal
cd /d "%~dp0"
echo TEMPORA Desktop - installation en deux etapes
echo 1. Microsoft Edge WebView2 Runtime
echo 2. TEMPORA Desktop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-TEMPORA.ps1"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
  echo.
  echo Installation interrompue. Consultez le message d'erreur ci-dessus.
  echo Recuperer WebView2 officiel : https://developer.microsoft.com/microsoft-edge/webview2/
  pause
  exit /b %INSTALL_EXIT%
)
echo Installation terminee.
exit /b 0
