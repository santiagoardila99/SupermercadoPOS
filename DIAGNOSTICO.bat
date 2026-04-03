@echo off
set LOG=%~dp0diagnostico.txt
echo SupermercadoPOS - Diagnostico > %LOG%
echo Fecha: %date% %time% >> %LOG%
echo. >> %LOG%

echo Verificando Node.js... >> %LOG%
node --version >> %LOG% 2>&1
echo Node exitcode: %errorlevel% >> %LOG%

echo. >> %LOG%
echo Verificando npm... >> %LOG%
npm --version >> %LOG% 2>&1

echo. >> %LOG%
echo Carpeta backend: >> %LOG%
dir "%~dp0backend" >> %LOG% 2>&1

echo. >> %LOG%
echo Instalando backend... >> %LOG%
cd /d "%~dp0backend"
call npm install >> %LOG% 2>&1
echo npm install exitcode: %errorlevel% >> %LOG%

echo. >> %LOG%
echo Probando Node con SQLite nativo... >> %LOG%
node -e "const {DatabaseSync}=require('node:sqlite');console.log('SQLite OK')" >> %LOG% 2>&1

echo. >> %LOG%
echo === FIN DIAGNOSTICO === >> %LOG%

echo Diagnostico completado. Abriendo resultado...
start notepad "%LOG%"
pause
