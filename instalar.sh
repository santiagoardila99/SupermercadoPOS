#!/bin/bash
echo ""
echo "🛒 ======================================"
echo "   SupermercadoPOS - Instalación"
echo "======================================"
echo ""

# Backend
echo "📦 Instalando dependencias del backend..."
cd backend && npm install
cp .env.example .env
cd ..

# Frontend
echo "📦 Instalando dependencias del frontend..."
cd frontend && npm install
cd ..

echo ""
echo "✅ ======================================"
echo "   ¡Instalación completa!"
echo ""
echo "Para iniciar el sistema:"
echo "  Terminal 1: cd backend && npm start"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Luego abre: http://localhost:3000"
echo ""
echo "Usuarios:"
echo "  👔 Gerente: gerente@supermercado.com / admin123"
echo "  🛒 Cajero:  caja1@supermercado.com  / caja123"
echo "======================================"
