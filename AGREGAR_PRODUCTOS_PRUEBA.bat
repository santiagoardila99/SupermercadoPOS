@echo off
title Agregar Productos de Prueba
color 0A

echo.
echo  === AGREGAR PRODUCTOS DE PRUEBA AL POS ===
echo.

cd /d "%~dp0backend"

echo  Ejecutando script...
echo.

node agregar_productos_prueba.js

echo.
echo  Presiona cualquier tecla para cerrar...
pause >nul
