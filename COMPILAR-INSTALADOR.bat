@echo off
title COMPILADOR DO INSTALADOR (16 KB)
color 0E
cls
echo ========================================================
echo       RECOMPILANDO INSTALADOR-DISCORD.EXE
echo ========================================================
echo.
echo Compilando codigo em installer\Program.cs...

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /win32icon:build\icon.ico /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll /out:Instalador-Discord.exe installer\Program.cs

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] Instalador-Discord.exe compilado com sucesso!
    copy /Y Instalador-Discord.exe server\public\Instalador-Discord.exe >nul
    echo [SUCESSO] Copiado para server\public\Instalador-Discord.exe!
) else (
    echo.
    echo [ERRO] Ocorreu uma falha na compilacao.
)

echo.
pause
