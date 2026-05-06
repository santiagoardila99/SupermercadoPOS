# Guía de Configuración — Flujo N8N Control Financiero WhatsApp

## Mapa del flujo (18 nodos)

```
Webhook WhatsApp
      │
   ¿Es Audio?
   ├── SÍ → Descargar Audio → Whisper → Preparar Texto (Audio) ─┐
   └── NO ──────────────────────────── Preparar Texto (WhatsApp)─┤
                                                                  │
                                              Clasificar con Claude IA
                                                       │
                                              Parsear Respuesta IA
                                                       │
                                                ¿Es Consulta?
                 ┌─────── SÍ ────────────────────────┤
                 │                                    └── NO ────────────────────┐
          Leer Mes (Consulta)                                            Leer Mes (Registro)
                 │                                                               │
     Calcular Métricas (Consulta)                                     Guardar Transacción
                 │                                                               │
     Generar Mensaje (Consulta)                                    Calcular Métricas (Registro)
                 │                                                               │
     Enviar WhatsApp (Consulta)                                    Generar Mensaje (Registro)
                                                                                │
                                                                   Enviar WhatsApp (Registro)
```

---

## PASO 1 — Importar el flujo en n8n

1. Abre tu instancia de n8n (n8n.cloud o self-hosted)
2. Clic en **"+ Add workflow"** (esquina superior izquierda)
3. Menú de 3 puntos (⋮) → **"Import from file"**
4. Selecciona el archivo `n8n-finanzas-whatsapp.json`
5. El flujo aparece con todos los nodos ya conectados

---

## PASO 2 — Variables de entorno

Ve a **Settings → n8n settings → Environment variables** y agrega:

| Variable | Valor | Cómo obtenerla |
|---|---|---|
| `CLAUDE_API_KEY` | `sk-ant-api03-...` | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | `sk-proj-...` | platform.openai.com → API Keys |
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxxxxx` | console.twilio.com → Dashboard |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` | Twilio WhatsApp Sandbox number |
| `GOOGLE_SHEET_ID` | `1BxiMV...` | URL de tu Google Sheet (entre /d/ y /edit) |

> En n8n self-hosted: agrégalas en el archivo `.env` del servidor.

---

## PASO 3 — Crear credenciales en n8n

### 3.1 Twilio Basic Auth
1. Ve a **Credentials → New**
2. Tipo: **HTTP Basic Auth**
3. Nombre: `Twilio Basic Auth`
4. User: tu `TWILIO_ACCOUNT_SID` (ej: `ACxxxxxxx`)
5. Password: tu `TWILIO_AUTH_TOKEN` (consola Twilio → Auth Token)
6. Guardar

### 3.2 Google Sheets OAuth
1. Ve a **Credentials → New**
2. Tipo: **Google Sheets OAuth2 API**
3. Nombre: `Google Sheets OAuth`
4. Sigue el flujo OAuth para conectar tu cuenta Google
5. Guardar

> Una vez creadas, abre cada nodo de Google Sheets y Twilio en el flujo y selecciona las credenciales correctas.

---

## PASO 4 — Configurar Google Sheets

Crea un Google Sheet con exactamente estas hojas y columnas:

### Hoja: `transacciones`
```
id | fecha | tipo | categoria | valor | descripcion | mes | fuente
```
- La fila 1 debe ser el header (exactamente esos nombres)
- Ejemplo primera fila de datos:
  `1234567890 | 2026-05-06 | gasto | comida | 30000 | almuerzo | 2026-05 | whatsapp`

### Hoja: `presupuestos` (opcional, para la app)
```
mes | categoria | presupuesto | gastado | porcentaje
```

---

## PASO 5 — Configurar Twilio WhatsApp

### Opción A — Sandbox (para pruebas, gratis)
1. Consola Twilio → **Messaging → WhatsApp Sandbox**
2. Copia el número del sandbox (ej: `+14155238886`)
3. Envía desde tu WhatsApp: `join <código-sandbox>` al número
4. En **"When a message comes in"** pega la URL del webhook de n8n

### Opción B — Número propio (producción, $5-15/mes)
1. Twilio → comprar número con capacidad WhatsApp
2. Registrar número en Meta Business → WhatsApp Business API
3. Configurar el webhook

---

## PASO 6 — Obtener la URL del Webhook en n8n

1. Abre el nodo **"Webhook WhatsApp"** en el flujo
2. En la parte inferior verás la URL de producción:
   ```
   https://tu-instancia.n8n.cloud/webhook/finanzas-whatsapp
   ```
3. Copia esa URL
4. Pégala en Twilio → **Sandbox Settings → "When a message comes in"**
5. Método: `HTTP POST`

---

## PASO 7 — Activar el flujo

1. Toggle **"Active"** en la esquina superior derecha del editor
2. El flujo ya está escuchando mensajes

---

## PASO 8 — Probar manualmente en n8n

Para testear sin WhatsApp real:

1. Clic en el nodo **"Webhook WhatsApp"**
2. Clic en **"Listen for test event"**
3. Desde Postman o curl, envía:

```bash
curl -X POST https://tu-instancia.n8n.cloud/webhook-test/finanzas-whatsapp \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=gasté 30 mil en comida&From=whatsapp:+573001234567"
```

4. Verifica que el flujo ejecuta todos los nodos correctamente

---

## Notas importantes por nodo

### Nodo: Clasificar con Claude IA
- Usa `claude-sonnet-4-6` (balance costo/velocidad)
- Timeout: 30s (más que suficiente, Claude responde en 2-3s)
- El prompt está en español colombiano y reconoce: "30 mil", "2 millones", "medio millón"

### Nodo: Leer Mes (Consulta/Registro)
- Filtra por la columna `mes` con el valor `YYYY-MM`
- Si no hay datos del mes, retorna array vacío (el Code siguiente lo maneja)

### Nodo: Guardar Transacción
- El `id` usa `Date.now()` (timestamp en ms) para ser único
- Los campos vacíos (descripcion null) se guardan como cadena vacía

### Nodo: ¿Es Audio?
- Twilio envía `MediaContentType0: audio/ogg` para notas de voz de WhatsApp
- Si el campo no existe, la condición es `false` (ruta texto)

---

## Costo estimado de operación

| Acción | Costo Claude | Costo OpenAI (Whisper) |
|---|---|---|
| Mensaje de texto | ~$0.001 | $0 |
| Nota de voz (30s) | ~$0.001 | ~$0.003 |
| Consulta mensual | ~$0.001 | $0 |

Con 100 registros/mes: **< $0.50/mes en IA**

---

## Troubleshooting común

| Error | Causa | Solución |
|---|---|---|
| Webhook no recibe datos | URL incorrecta en Twilio | Verificar URL en nodo Webhook |
| Claude retorna texto sin JSON | Prompt incompleto | Revisar que el System prompt esté completo |
| Google Sheets error 403 | Credencial expirada | Re-autenticar en Credentials |
| Audio no transcribe | URL de audio requiere auth | Verificar que Descargar Audio usa Twilio Basic Auth |
| `$env.X` vacío | Variable no configurada | Agregar en Settings → Environment variables |
