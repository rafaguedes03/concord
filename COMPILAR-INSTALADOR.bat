@echo off
title COMPILADOR DO INSTALADOR (16 KB)
color 0E
cls
cd /d "%~dp0"
echo ========================================================
echo       RECOMPILANDO INSTALADOR-DISCORD.EXE
echo ========================================================
echo.
echo Compilando codigo em installer\Program.cs...
set "PORT=3002"
set "SERVER_URL=localhost"
if exist "server\.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("server\.env") do set "%%a=%%b"
if not exist build-temp mkdir build-temp
> build-temp\ServerConfig.cs echo namespace ConcordInstaller { static class ServerConfig { public const string Url = "http://%SERVER_URL%:%PORT%"; } }

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /win32icon:build\icon.ico /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll /out:concord.exe installer\Program.cs build-temp\ServerConfig.cs

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] concord.exe compilado com sucesso!
    copy /Y concord.exe server\public\concord.exe >nul
    echo [SUCESSO] Copiado para server\public\concord.exe!
) else (
    echo.
    echo [ERRO] Ocorreu uma falha na compilacao.
)

echo.
pause
