@echo off
title SupermercadoPOS - Iniciando...
color 0A

echo.
echo  ========================================
echo    SupermercadoPOS - Iniciando sistema
echo  ========================================
echo.

:: Cerrar procesos node anteriores para evitar conflictos de puerto
echo  [1/4] Cerrando procesos anteriores...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Copiar .env si no existe
if not exist "%~dp0backend\.env" (
    if exist "%~dp0backend\.env.example" copy "%~dp0backend\.env.example" "%~dp0backend\.env" >nul
)

:: Iniciar backend
echo  [2/4] Iniciando backend...
start "POS - Backend" cmd /k "color 0B && echo Backend SupermercadoPOS && echo. && cd /d "%~dp0backend" && node src/index.js"
timeout /t 4 /nobreak >nul

:: Iniciar frontend
echo  [3/4] Iniciando frontend...
start "POS - Frontend" cmd /k "color 0E && echo Frontend SupermercadoPOS && echo. && cd /d "%~dp0frontend" && npm run dev"
timeout /t 6 /nobreak >nul

:: Abrir navegador solo si no hay ya una instancia en puerto 3000
echo  [4/4] Verificando navegador...
netstat -ano | findstr ":3000.*LISTENING" >nul 2>&1
if errorlevel 1 (
    start "" "http://localhost:3000"
    echo  ✓ Navegador abierto en http://localhost:3000
) else (
    echo  ✓ Ya hay una instancia en http://localhost:3000
    echo    Recarga la pagina en tu navegador ^(F5^)
)

echo.
echo  ========================================
echo   Sistema listo en http://localhost:3000
echo  ========================================
echo.
echo  Para apagar: cierra "POS - Backend" y "POS - Frontend"
echo.
pause
