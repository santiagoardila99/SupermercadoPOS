const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http  = require('http');

// ── Configuración ─────────────────────────────────────────────────────────────
const BACKEND_PORT = 3001;
const BACKEND_URL  = `http://localhost:${BACKEND_PORT}`;
const isDev        = !app.isPackaged;

let mainWindow = null;
let backendProcess = null;
let tray = null;

// ── Iniciar backend (Node.js) embebido ───────────────────────────────────────
function startBackend() {
  const backendPath = isDev
    ? path.join(__dirname, '../backend/src/index.js')
    : path.join(process.resourcesPath, 'backend/src/index.js');

  const nodeExec = isDev ? 'node' : process.execPath;

  backendProcess = spawn(nodeExec, [backendPath], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(BACKEND_PORT),
      DB_PATH: path.join(app.getPath('userData'), 'data'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => console.log('[Backend]', d.toString().trim()));
  backendProcess.stderr.on('data', (d) => console.error('[Backend ERR]', d.toString().trim()));
  backendProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[Backend] salió con código ${code}`);
    }
  });

  console.log('[Electron] Backend iniciado en', BACKEND_URL);
}

// ── Esperar que el backend responda ──────────────────────────────────────────
function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) resolve();
        else tryAgain(n);
      }).on('error', () => tryAgain(n));
    };
    const tryAgain = (n) => {
      if (n <= 0) { reject(new Error('Backend no responde')); return; }
      setTimeout(() => check(n - 1), 500);
    };
    check(retries);
  });
}

// ── Crear ventana principal ───────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    title: 'SupermercadoPOS',
    icon: path.join(__dirname, '../frontend/public/icon-512.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Sin menú nativo para dar aspecto de app
    autoHideMenuBar: true,
    backgroundColor: '#111827',
    show: false, // mostrar cuando cargue
  });

  // Cargar la app
  mainWindow.loadURL(BACKEND_URL);

  // Mostrar cuando cargue completamente
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Abrir links externos en el navegador, no en Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Al cerrar: minimizar a bandeja en vez de salir
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Bandeja del sistema (System Tray) ────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../frontend/public/icon-192.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir SupermercadoPOS', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('SupermercadoPOS');
  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ── Lifecycle de Electron ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Pantalla de splash mientras carga el backend
  const splash = new BrowserWindow({
    width: 400, height: 300,
    frame: false, alwaysOnTop: true,
    backgroundColor: '#111827',
    icon: path.join(__dirname, '../frontend/public/icon-512.png'),
  });
  splash.loadURL(`data:text/html,
    <html><body style="margin:0;background:#111827;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#fff">
      <div style="width:72px;height:72px;background:#2563eb;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:900;margin-bottom:20px">S</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:8px">SupermercadoPOS</div>
      <div style="color:#6b7280;font-size:13px">Iniciando sistema...</div>
    </body></html>
  `);

  try {
    startBackend();
    await waitForBackend();
    createWindow();
    createTray();
    splash.destroy();
  } catch (err) {
    splash.destroy();
    dialog.showErrorBox('Error al iniciar',
      'No se pudo iniciar el servidor interno.\n\n' + err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // En macOS las apps se mantienen aunque se cierren las ventanas
  if (process.platform !== 'darwin') {
    // No salimos — la app sigue en la bandeja
  }
});

app.on('activate', () => {
  // macOS: abrir ventana al hacer clic en el dock
  if (mainWindow) mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});
