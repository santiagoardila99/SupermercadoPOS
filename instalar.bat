@echo off
echo.
echo ======================================
echo    SupermercadoPOS - Instalacion
echo ======================================
echo.

echo Instalando dependencias del backend...
cd backend
call npm install
copy .env.example .env
cd ..

echo.
echo Instalando dependencias del frontend...
cd frontend
call npm install
cd ..

echo.
echo ======================================
echo    Instalacion completa!
echo.
echo Para iniciar:
echo   Terminal 1: cd backend ^&^& npm start
echo   Terminal 2: cd frontend ^&^& npm run dev
echo.
echo Abre: http://localhost:3000
echo ======================================
pause
