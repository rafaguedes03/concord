@echo off
cd /d "%~dp0"
set "PORT=3002"
set "SERVER_URL=localhost"
if exist "server\.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("server\.env") do set "%%a=%%b"
title DISCORD CLONE - SERVIDOR DE VOZ E TELA (%SERVER_URL%:%PORT%)
color 0B
cls
echo ========================================================
echo        DISCORD CLONE - SERVIDOR DE HOSPEDAGEM
echo ========================================================
echo.
echo [IP PUBLICO CONFIGURADO]: %SERVER_URL%
echo [PORTA]: %PORT% (Aberta no roteador/firewall)
echo [LIVEKIT]: TCP 7880 e 7881, UDP 7882 (Abertas no roteador/firewall)
echo.
echo ========================================================
echo LINKS PARA SEUS AMIGOS:
echo ========================================================
echo 1. Pagina Web para download direto:
echo    http://%SERVER_URL%:%PORT%
echo.
echo 2. Download direto do instalador leve (16 KB):
echo    http://%SERVER_URL%:%PORT%/download/concord.exe
echo.
echo 3. O arquivo "concord.exe" (16 KB) tambem esta
echo    na raiz desta pasta pronto para voce enviar por WhatsApp/Discord!
echo ========================================================
echo.
echo Iniciando servidor Node.js na porta %PORT%...
echo Pressione Ctrl+C para encerrar quando desejar.
echo.

node server/server.js
pause
