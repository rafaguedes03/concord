#!/usr/bin/env bash
# Gera o instalador .deb do Concord (Debian, Ubuntu, Mint, Pop!_OS...)
set -euo pipefail
cd "$(dirname "$0")"

echo "========================================================"
echo "     COMPILANDO INSTALADOR LINUX (.deb) DO CONCORD"
echo "========================================================"
echo

for cmd in node npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "[ERRO] '$cmd' nao encontrado. Instale o Node.js antes de continuar."
        exit 1
    fi
done

# node_modules instalado no Windows nao traz os binarios nativos do Linux (rollup)
if [ ! -d node_modules ] || ! ls node_modules/@rollup/rollup-linux-* >/dev/null 2>&1; then
    echo "[0/2] Instalando dependencias para Linux (npm install)..."
    npm install
    if ! ls node_modules/@rollup/rollup-linux-* >/dev/null 2>&1; then
        echo "Binario nativo do rollup ausente, reinstalando do zero..."
        rm -rf node_modules package-lock.json
        npm install
    fi
    echo
fi

echo "[1/2] Gerando o app (vite build + electron-builder --linux deb)..."
rm -f dist-electron/*.deb
npm run build:deb

DEB=$(ls -t dist-electron/*.deb 2>/dev/null | head -n 1 || true)
if [ -z "$DEB" ]; then
    echo "[ERRO] Nenhum .deb encontrado em dist-electron/."
    exit 1
fi

echo
echo "[2/2] Copiando para server/public/concord.deb..."
cp -f "$DEB" server/public/concord.deb

echo
echo "[SUCESSO] Instalador gerado: $DEB"
echo "[SUCESSO] Copiado para server/public/concord.deb"
echo
echo "Para instalar:  sudo apt install ./$DEB"
