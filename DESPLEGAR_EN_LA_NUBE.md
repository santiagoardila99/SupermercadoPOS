# 🌐 Desplegar SupermercadoPOS en Internet

Costo estimado: **~$7.25/mes** (servidor) + **~$12/año** (dominio)

---

## PASO 1 — Crear cuenta en GitHub (gratis)

GitHub guarda tu código y permite actualizaciones fáciles.

1. Ve a **https://github.com/signup**
2. Elige un nombre de usuario (ej: `mi-supermercado`)
3. Verifica tu email
4. Cuando te pregunte por preferencias, selecciona "Skip" o "Skip personalization"

---

## PASO 2 — Instalar Git en tu PC

1. Ve a **https://git-scm.com/download/win**
2. Descarga e instala Git (deja todas las opciones por defecto)
3. Reinicia tu PC

---

## PASO 3 — Subir el código a GitHub

Abre una terminal (CMD o PowerShell) en la carpeta `SupermercadoPOS` y ejecuta estos comandos **uno por uno**:

```bash
git init
git add .
git commit -m "SupermercadoPOS - versión inicial"
```

Luego:
1. Ve a **https://github.com/new**
2. Nombre del repositorio: `supermercado-pos`
3. Marca como **Privado** (Private)
4. Clic en **"Create repository"**
5. Copia los comandos que aparecen en la sección "...or push an existing repository from the command line"
6. Pégalos en tu terminal y ejecútalos

Ejemplo (los tuyos serán diferentes):
```bash
git remote add origin https://github.com/TU-USUARIO/supermercado-pos.git
git branch -M main
git push -u origin main
```

✅ El código ya está en GitHub.

---

## PASO 4 — Crear cuenta en Render.com

1. Ve a **https://render.com**
2. Clic en **"Get Started for Free"**
3. Regístrate con tu cuenta de GitHub (más fácil)
4. Autoriza a Render a acceder a tus repositorios

---

## PASO 5 — Desplegar el servidor en Render

1. En el dashboard de Render, clic en **"New +"** → **"Web Service"**
2. Conecta tu repositorio `supermercado-pos`
3. Render detecta el `render.yaml` automáticamente — clic en **"Apply"**

**Si te pide hacerlo manualmente, configura así:**

| Campo | Valor |
|-------|-------|
| Name | `supermercado-pos` |
| Region | `Oregon (US West)` |
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `node src/index.js` |
| Plan | **Starter ($7/mes)** |

4. En **"Environment Variables"** agrega:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Ve a https://generate-secret.vercel.app/64 y pega el resultado |
| `DB_PATH` | `/data` |

5. En **"Disks"** (sección avanzada):
   - Clic en **"Add Disk"**
   - Name: `pos-database`
   - Mount Path: `/data`
   - Size: `1 GB`

6. Clic en **"Create Web Service"**

⏳ El primer despliegue tarda 5-10 minutos.

Cuando termine verás una URL como: `https://supermercado-pos.onrender.com`
**¡Esa es tu app funcionando en internet!**

---

## PASO 6 — Comprar un dominio (opcional pero recomendado)

### Opción A — Namecheap (~$8-12/año)
1. Ve a **https://www.namecheap.com**
2. Busca el nombre que quieres (ej: `misupermercado.com`)
3. Agrégalo al carrito y compra
4. En el panel de Namecheap → **"Advanced DNS"**
5. Agrega un registro CNAME:
   - Host: `www`
   - Value: `supermercado-pos.onrender.com`
   - TTL: Automatic

### Opción B — Cloudflare (~$8-10/año, más potente)
1. Ve a **https://www.cloudflare.com/products/registrar/**
2. Compra tu dominio
3. Cloudflare maneja el DNS automáticamente

### Conectar el dominio a Render
1. En Render → tu servicio → **"Settings"** → **"Custom Domain"**
2. Agrega tu dominio (`www.misupermercado.com`)
3. Render te da las instrucciones exactas del DNS
4. HTTPS se configura **automáticamente** (certificado gratis)

---

## PASO 7 — Configura ALLOWED_ORIGINS

Una vez tengas el dominio, en Render → Environment Variables:

| Variable | Valor |
|----------|-------|
| `ALLOWED_ORIGINS` | `https://www.misupermercado.com,https://misupermercado.com` |

Luego haz **"Manual Deploy"** para aplicar el cambio.

---

## 🔄 Cómo actualizar la app en el futuro

Cada vez que hagas cambios en el código:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

**Render detecta el push automáticamente y redespliega en 3-5 minutos.**
No tienes que hacer nada más. ✅

---

## 💾 Cómo migrar tus datos actuales a la nube

Si ya tienes ventas, productos y clientes en la base de datos local:

1. Copia el archivo `backend/data/supermercado.db` a un lugar seguro
2. En Render → tu servicio → **"Shell"** (pestaña en la parte superior)
3. En el shell de Render, ejecuta:
   ```bash
   ls /data
   ```
4. Para subir el archivo, usa la API de Render o el Shell:
   - Opción fácil: usa **Render Shell** → `curl` para subir el archivo
   - O contacta a soporte de Render y ellos te ayudan

**Alternativa más simple:** empieza limpio en la nube y sigue usando la app local para el historial antiguo.

---

## 📱 App móvil en la nube

Una vez el servidor esté en la nube, en la app móvil:

1. En el campo de IP del servidor, escribe tu dominio:
   ```
   https://www.misupermercado.com
   ```
   (ya no necesitas estar en el mismo Wi-Fi)

---

## 💰 Resumen de costos

| Servicio | Costo |
|----------|-------|
| Render Web Service (Starter) | $7.00/mes |
| Render Persistent Disk (1 GB) | $0.25/mes |
| Dominio en Namecheap | ~$1.00/mes (~$12/año) |
| **Total** | **~$8.25/mes** |

---

## 🆘 Soporte

- **Render Docs:** https://render.com/docs
- **Render Community:** https://community.render.com
- **GitHub Docs:** https://docs.github.com/es

---

*Guía generada para SupermercadoPOS — Todos los cambios de código necesarios ya están aplicados.*
