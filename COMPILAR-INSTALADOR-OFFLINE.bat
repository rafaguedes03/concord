@echo off
title COMPILADOR DO INSTALADOR OFFLINE (AUTO CONTIDO)
color 0E
cls
cd /d "%~dp0"
echo ========================================================
echo     COMPILANDO INSTALADOR-CONCORD.EXE (AUTO CONTIDO)
echo ========================================================
echo.

echo [1/3] Gerando o app (vite build + electron-builder)...
call npm run build:exe
if %errorlevel% neq 0 goto erro
if not exist "dist-electron\win-unpacked\Concord.exe" (
    echo [ERRO] dist-electron\win-unpacked\Concord.exe nao encontrado.
    goto erro
)

echo.
echo [2/3] Compactando dist-electron\win-unpacked em build-temp\app.zip...
if not exist build-temp mkdir build-temp
if exist build-temp\app.zip del /q build-temp\app.zip
powershell -NoProfile -Command "[AppContext]::SetSwitch('Switch.System.IO.Compression.ZipFile.UseBackslash', $false); Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path 'dist-electron\win-unpacked').Path, (Join-Path (Get-Location) 'build-temp\app.zip'), 'Optimal', $false)"
if %errorlevel% neq 0 goto erro

echo.
echo [3/3] Compilando installer\Program.cs com o app.zip embutido...
set "PORT=3002"
set "SERVER_URL=localhost"
if exist "server\.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("server\.env") do set "%%a=%%b"
if not exist build-temp mkdir build-temp
> build-temp\ServerConfig.cs echo namespace ConcordInstaller { static class ServerConfig { public const string Url = "http://%SERVER_URL%:%PORT%"; } }
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /win32icon:build\icon.ico /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:Microsoft.CSharp.dll /resource:build-temp\app.zip,app.zip /out:concord.exe installer\Program.cs build-temp\ServerConfig.cs
if %errorlevel% neq 0 goto erro

copy /Y concord.exe server\public\concord.exe >nul
if %errorlevel% neq 0 goto erro
copy /Y build-temp\app.zip server\public\app.zip >nul
if %errorlevel% neq 0 goto erro

echo.
echo [SUCESSO] concord.exe gerado (nao precisa de internet para instalar).
echo [SUCESSO] Copiado para server\public\ junto com app.zip.
echo.
pause
exit /b 0

:erro
echo.
echo [ERRO] Ocorreu uma falha na compilacao.
echo.
pause
exit /b 1
