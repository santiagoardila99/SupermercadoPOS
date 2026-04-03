# SupermercadoPOS — App de Escritorio (Electron)

Convierte la app web en un programa instalable en Windows, Mac o Linux.

## Requisitos
- Node.js 22 (el mismo que ya tienes)
- La carpeta `frontend/dist/` debe existir (ejecuta `npm run build` en frontend primero)

## Instalar dependencias de Electron (solo una vez)

```bash
cd electron
npm install
```

## Correr en modo desarrollo (prueba rápida)

```bash
# 1. Asegúrate de que el backend esté corriendo primero
cd backend && node src/index.js

# 2. En otra terminal:
cd electron && npm start
```

## Generar instalador (.exe para Windows)

```bash
# Primero construir el frontend
cd frontend && npm run build

# Luego construir el instalador
cd ../electron && npm run build:win
```

El archivo `.exe` aparecerá en `electron/dist-desktop/`.

## Lo que hace la app de escritorio

- Inicia el backend automáticamente al abrir la app
- La base de datos se guarda en `%AppData%/SupermercadoPOS/data/` (Windows)
- Se minimiza a la **bandeja del sistema** en vez de cerrarse
- Funciona **sin internet** (todo corre localmente)
- Splash screen mientras carga
