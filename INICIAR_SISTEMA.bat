@echo off
title SupermercadoPOS
color 0A
cls

echo.
echo  ==========================================
echo    SupermercadoPOS - Sistema de Caja
echo  ==========================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js no esta instalado.
    echo  Abriendo descarga...
    start "" "https://nodejs.org/dist/v20.11.1/node-v20.11.1-x64.msi"
    echo  Instala Node.js y luego vuelve a ejecutar este archivo.
    pause
    exit
)

for /f "tokens=*" %%v in ('node --version') do set NODEVER=%%v
echo  Node.js %NODEVER%: OK

:: Limpiar node_modules fallidos anteriores
if exist "%~dp0backend\node_modules\better-sqlite3" (
    echo  Limpiando instalacion anterior con errores...
    rmdir /s /q "%~dp0backend\node_modules"
)

:: ---- INSTALAR BACKEND ----
if not exist "%~dp0backend\node_modules" (
    echo.
    echo  [1/2] Instalando backend...
    cd /d "%~dp0backend"
    call npm install 2>&1
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  *** ERROR instalando backend ***
        echo  Revisa los mensajes de error arriba.
        echo.
        pause
        exit /b 1
    )
    if not exist "%~dp0backend\.env" (
        copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul 2>&1
    )
    echo  Backend instalado OK
)

:: ---- INSTALAR FRONTEND ----
if not exist "%~dp0frontend\node_modules" (
    echo.
    echo  [2/2] Instalando frontend (puede tardar 2-3 min)...
    cd /d "%~dp0frontend"
    call npm install 2>&1
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  *** ERROR instalando frontend ***
        echo  Revisa los mensajes de error arriba.
        echo.
        pause
        exit /b 1
    )
    echo  Frontend instalado OK
)

:: ---- INICIAR SERVIDORES ----
echo.
echo  Iniciando servidores...
echo.

cd /d "%~dp0backend"
if not exist ".env" copy ".env.example" ".env" >nul 2>&1

start "POS-Backend" cmd /k "cd /d "%~dp0backend" && echo Iniciando backend... && node src/index.js"
timeout /t 4 /nobreak >nul

start "POS-Frontend" cmd /k "cd /d "%~dp0frontend" && echo Iniciando frontend... && npm run dev"
timeout /t 7 /nobreak >nul

start "" "http://localhost:3000"

echo  ==========================================
echo    SISTEMA LISTO!
echo.
echo    URL:     http://localhost:3000
echo    Gerente: gerente@supermercado.com / admin123
echo    Cajero:  caja1@supermercado.com  / caja123
echo  ==========================================
echo.
echo  Hay 2 ventanas negras abiertas (backend y frontend).
echo  No las cierres mientras uses el sistema.
echo.
pause
