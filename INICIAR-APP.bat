@echo off
title DISCORD CLONE
color 0A
cls
echo ========================================================
echo              INICIANDO DISCORD CLONE
echo ========================================================
echo.

if exist "dist-electron\win-unpacked\Discord Clone.exe" (
    echo [OK] Abrindo o executavel compilado...
    start "" "dist-electron\win-unpacked\Discord Clone.exe"
    exit
) else if exist "dist-electron\Discord Clone.exe" (
    echo [OK] Abrindo o executavel compilado...
    start "" "dist-electron\Discord Clone.exe"
    exit
) else (
    echo [INFO] Iniciando via Electron...
    npm run dev:electron
)
