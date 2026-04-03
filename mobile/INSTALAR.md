# SupermercadoPOS — App Móvil

App React Native (Expo) para gestionar el supermercado desde el celular.

## Requisitos
- Node.js 18 o superior (ya lo tienes si corres el POS)
- Celular Android o iPhone con la app **Expo Go** instalada
  - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
  - iOS: https://apps.apple.com/app/expo-go/id982107779

## Instalación (solo la primera vez)

1. Abre una terminal en esta carpeta (`mobile/`)
2. Ejecuta:
   ```
   npm install
   ```

## Correr la app

1. Asegúrate de que el backend del POS esté corriendo (ARRANCAR.bat)
2. En la carpeta `mobile/`, ejecuta:
   ```
   npx expo start
   ```
3. Aparece un **código QR** en la terminal
4. Con el celular en la misma red Wi-Fi:
   - Android: abre la app **Expo Go** y escanea el QR
   - iPhone: escanea el QR con la cámara nativa

## Primer inicio en el celular

Cuando abra la app, te pedirá la **IP del servidor**:
- Es la IP local del PC donde corre el backend
- En Windows: abre CMD y escribe `ipconfig`, busca "Dirección IPv4"
- Ejemplo: `192.168.1.15`

## Funciones disponibles

| Pantalla   | Qué puedes hacer |
|------------|-----------------|
| Dashboard  | Ver ventas del día, efectivo en caja, gastos, métodos de pago, últimas ventas |
| Productos  | Buscar productos, editar precio y stock, ver alertas de stock bajo |
| Informes   | Informe completo del día (ventas, gastos, devoluciones, descuentos, caja) con navegación por fechas |

## Generar APK para Android (sin necesidad de Expo Go)

```
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Esto genera un archivo `.apk` que puedes instalar directamente en el celular.
