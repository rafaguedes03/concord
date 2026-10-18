@echo off
title DISCORD CLONE - SERVIDOR DE VOZ E TELA (45.184.120.69:3002)
color 0B
cls
echo ========================================================
echo        DISCORD CLONE - SERVIDOR DE HOSPEDAGEM
echo ========================================================
echo.
echo [IP PUBLICO CONFIGURADO]: 45.184.120.69
echo [PORTA]: 3002 (Aberta no roteador/firewall)
echo.
echo ========================================================
echo LINKS PARA SEUS AMIGOS:
echo ========================================================
echo 1. Pagina Web para download direto:
echo    http://45.184.120.69:3002
echo.
echo 2. Download direto do instalador leve (16 KB):
echo    http://45.184.120.69:3002/download/Instalador-Discord.exe
echo.
echo 3. O arquivo "Instalador-Discord.exe" (16 KB) tambem esta
echo    na raiz desta pasta pronto para voce enviar por WhatsApp/Discord!
echo ========================================================
echo.
echo Iniciando servidor Node.js na porta 3002...
echo Pressione Ctrl+C para encerrar quando desejar.
echo.

node server/server.js
pause
