@echo off
chcp 65001 >nul
title GERAR ATUALIZACAO DO CONCORD
color 0E
cls
cd /d "%~dp0"
echo ========================================================
echo       GERANDO ATUALIZACAO (app.asar + app.zip)
echo ========================================================
echo.
for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version"`) do set "CURRENT_VERSION=%%v"
echo Versao atual: %CURRENT_VERSION%
set "UPDATE_VERSION="
set "UPDATE_NOTES="
set /p "UPDATE_VERSION=Nova versao (Enter = incrementa o patch): "
set /p "UPDATE_NOTES=Notas da atualizacao: "
echo.

echo [1/4] Atualizando a versao...
node scripts\bump-version.js
if %errorlevel% neq 0 goto erro

echo.
echo [2/4] Gerando o app (vite build + electron-builder)...
call npm run build:exe
if %errorlevel% neq 0 goto erro
if not exist "dist-electron\win-unpacked\resources\app.asar" (
    echo [ERRO] dist-electron\win-unpacked\resources\app.asar nao encontrado.
    goto erro
)

echo.
echo [3/4] Compactando dist-electron\win-unpacked em server\public\app.zip...
if exist server\public\app.zip del /q server\public\app.zip
powershell -NoProfile -Command "[AppContext]::SetSwitch('Switch.System.IO.Compression.ZipFile.UseBackslash', $false); Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path 'dist-electron\win-unpacked').Path, (Join-Path (Get-Location) 'server\public\app.zip'), 'Optimal', $false)"
if %errorlevel% neq 0 goto erro

echo.
echo [4/4] Copiando app.asar para server\public\app.asar...
copy /Y dist-electron\win-unpacked\resources\app.asar server\public\app.asar >nul
if %errorlevel% neq 0 goto erro

echo.
echo [SUCESSO] Atualizacao gerada em server\public\:
echo   - version.json  (versao nova)
echo   - app.asar      (usado pelo auto-update do app)
echo   - app.zip       (usado pelo instalador online)
echo Envie esses 3 arquivos para o servidor.
goto fim

:erro
echo.
echo [ERRO] Ocorreu uma falha ao gerar a atualizacao.

:fim
echo.
pause
