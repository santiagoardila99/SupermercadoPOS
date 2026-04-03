@echo off
title Instalacion Frontend
cmd /k "cd /d "%~dp0frontend" && echo Instalando... && npm install && echo. && echo LISTO - Cierra esta ventana"
