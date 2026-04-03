// Usa el SQLite NATIVO de Node.js 22+ (no requiere instalación ni Python)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// En producción usa /data (disco persistente de Render), en dev usa ./data local
const DB_DIR  = process.env.DB_PATH || path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'supermercado.db');

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(path.join(__dirname, '../uploads'), { recursive: true });

let db;

// Helper de transacciones (reemplaza db.transaction() de better-sqlite3)
function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getDB() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('gerente', 'cajero', 'admin')),
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      color TEXT DEFAULT '#6366f1'
    );

    CREATE TABLE IF NOT EXISTS distribuidores (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL,
      contacto TEXT,
      telefono TEXT,
      email TEXT,
      nit TEXT,
      direccion TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      codigo TEXT UNIQUE NOT NULL,
      codigo_barras TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id TEXT REFERENCES categorias(id),
      distribuidor_id TEXT REFERENCES distribuidores(id),
      precio_compra REAL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      iva_porcentaje REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      unidad TEXT DEFAULT 'unidad',
      es_pesable INTEGER DEFAULT 0,
      imagen_url TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cajas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activa INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      numero_factura TEXT UNIQUE NOT NULL,
      caja_id TEXT REFERENCES cajas(id),
      cajero_id TEXT REFERENCES users(id),
      subtotal REAL NOT NULL DEFAULT 0,
      descuento REAL DEFAULT 0,
      iva_total REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT DEFAULT 'efectivo',
      monto_recibido REAL DEFAULT 0,
      cambio REAL DEFAULT 0,
      estado TEXT DEFAULT 'completada',
      notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS venta_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      producto_id TEXT NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      iva_porcentaje REAL DEFAULT 0,
      descuento_item REAL DEFAULT 0,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS facturas_compra (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      numero_factura TEXT,
      distribuidor_id TEXT REFERENCES distribuidores(id),
      usuario_id TEXT REFERENCES users(id),
      total REAL DEFAULT 0,
      estado TEXT DEFAULT 'procesada',
      notas TEXT,
      imagen_url TEXT,
      procesada_por_ia INTEGER DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS factura_compra_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      factura_id TEXT NOT NULL REFERENCES facturas_compra(id) ON DELETE CASCADE,
      producto_id TEXT REFERENCES productos(id),
      nombre_producto_factura TEXT,
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      producto_id TEXT NOT NULL REFERENCES productos(id),
      tipo TEXT NOT NULL,
      cantidad REAL NOT NULL,
      stock_anterior REAL,
      stock_nuevo REAL,
      referencia_id TEXT,
      referencia_tipo TEXT,
      usuario_id TEXT REFERENCES users(id),
      notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sesiones_caja (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      caja_id TEXT REFERENCES cajas(id),
      cajero_id TEXT REFERENCES users(id),
      monto_apertura REAL DEFAULT 0,
      monto_cierre REAL,
      total_ventas REAL DEFAULT 0,
      total_transacciones INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'abierta',
      abierta_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      cerrada_en DATETIME
    );

    CREATE TABLE IF NOT EXISTS ia_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      usuario_id TEXT REFERENCES users(id),
      tipo TEXT,
      entrada TEXT,
      salida TEXT,
      accion_ejecutada TEXT,
      exitoso INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nombre TEXT NOT NULL,
      cedula TEXT UNIQUE,
      celular TEXT,
      direccion TEXT,
      cupo_disponible REAL DEFAULT 0,
      deuda_total REAL DEFAULT 0,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS creditos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      venta_id TEXT NOT NULL REFERENCES ventas(id),
      monto REAL NOT NULL,
      saldo_pendiente REAL NOT NULL,
      estado TEXT DEFAULT 'pendiente',
      notas TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devoluciones (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      venta_id TEXT NOT NULL REFERENCES ventas(id),
      tipo TEXT NOT NULL CHECK (tipo IN ('total', 'parcial')),
      monto_devuelto REAL NOT NULL DEFAULT 0,
      motivo TEXT,
      cajero_id TEXT REFERENCES users(id),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devolucion_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      devolucion_id TEXT NOT NULL REFERENCES devoluciones(id),
      venta_item_id TEXT NOT NULL REFERENCES venta_items(id),
      producto_id TEXT NOT NULL REFERENCES productos(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
    CREATE INDEX IF NOT EXISTS idx_productos_barras ON productos(codigo_barras);
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(creado_en);
    CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
    CREATE INDEX IF NOT EXISTS idx_creditos_cliente ON creditos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_devoluciones_venta ON devoluciones(venta_id);

    CREATE TABLE IF NOT EXISTS gastos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      tipo TEXT NOT NULL CHECK (tipo IN ('proveedor','nomina','personal','recogida')),
      descripcion TEXT,
      valor REAL NOT NULL CHECK (valor > 0),
      caja_id TEXT REFERENCES cajas(id),
      usuario_id TEXT REFERENCES users(id),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(creado_en);

    CREATE TABLE IF NOT EXISTS abonos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      valor REAL NOT NULL CHECK (valor > 0),
      descripcion TEXT,
      usuario_id TEXT REFERENCES users(id),
      caja_id TEXT REFERENCES cajas(id),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_abonos_cliente ON abonos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_abonos_fecha   ON abonos(creado_en);
  `);

  // Migraciones seguras (ignoran error si la columna ya existe)
  try { db.exec('ALTER TABLE ventas ADD COLUMN cliente_id TEXT REFERENCES clientes(id)'); } catch (_) {}

  seedInitialData();
}

function seedInitialData() {
  const config = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('inicializado');
  if (config) return;

  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT OR IGNORE INTO users (id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), 'Gerente Principal', 'gerente@supermercado.com', passwordHash, 'gerente');
  db.prepare('INSERT OR IGNORE INTO users (id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), 'Cajero 1', 'caja1@supermercado.com', bcrypt.hashSync('caja123', 10), 'cajero');

  const categorias = [
    { nombre: 'Lácteos', color: '#3b82f6' },
    { nombre: 'Carnes', color: '#ef4444' },
    { nombre: 'Verduras y Frutas', color: '#22c55e' },
    { nombre: 'Panadería', color: '#f59e0b' },
    { nombre: 'Bebidas', color: '#06b6d4' },
    { nombre: 'Aseo', color: '#8b5cf6' },
    { nombre: 'Enlatados', color: '#64748b' },
    { nombre: 'Granos y Cereales', color: '#d97706' },
    { nombre: 'Snacks', color: '#ec4899' },
    { nombre: 'Otros', color: '#6b7280' },
  ];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categorias (id, nombre, color) VALUES (?, ?, ?)');
  categorias.forEach(c => insertCat.run(uuidv4(), c.nombre, c.color));

  db.prepare('INSERT OR IGNORE INTO cajas (id, nombre) VALUES (?, ?)').run(uuidv4(), 'Caja 1');
  db.prepare('INSERT OR IGNORE INTO cajas (id, nombre) VALUES (?, ?)').run(uuidv4(), 'Caja 2');

  const catLacteos = db.prepare("SELECT id FROM categorias WHERE nombre = 'Lácteos'").get();
  const catBebidas = db.prepare("SELECT id FROM categorias WHERE nombre = 'Bebidas'").get();
  const catVerduras = db.prepare("SELECT id FROM categorias WHERE nombre = 'Verduras y Frutas'").get();
  const catGranos = db.prepare("SELECT id FROM categorias WHERE nombre = 'Granos y Cereales'").get();

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO productos (id, codigo, codigo_barras, nombre, categoria_id, precio_compra, precio_venta, iva_porcentaje, stock, unidad, es_pesable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  [
    [uuidv4(), 'P001', '7702001010106', 'Leche Entera 1L Alquería', catLacteos?.id, 2800, 3500, 0, 50, 'unidad', 0],
    [uuidv4(), 'P002', '7702001020105', 'Yogur Natural 200g', catLacteos?.id, 1800, 2200, 5, 30, 'unidad', 0],
    [uuidv4(), 'P003', '7501055300205', 'Gaseosa Coca-Cola 1.5L', catBebidas?.id, 4000, 5000, 19, 40, 'unidad', 0],
    [uuidv4(), 'VER001', null, 'Tomate Chonto x kg', catVerduras?.id, 1500, 2500, 0, 20, 'kg', 1],
    [uuidv4(), 'VER002', null, 'Cebolla Cabezona x kg', catVerduras?.id, 1200, 2000, 0, 15, 'kg', 1],
    [uuidv4(), 'VER003', null, 'Papa Pastusa x kg', catVerduras?.id, 900, 1500, 0, 30, 'kg', 1],
    [uuidv4(), 'P004', '7702354010018', 'Arroz Diana 500g', catGranos?.id, 1600, 2100, 0, 100, 'unidad', 0],
    [uuidv4(), 'P005', '7702354010025', 'Frijol Bolo 500g', catGranos?.id, 2200, 2800, 0, 60, 'unidad', 0],
  ].forEach(p => insertProd.run(...p));

  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('inicializado', 'true');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('contador_factura', '1000');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('nombre_negocio', 'Supermercado La Economía');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('nit', '900.123.456-7');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('direccion', 'Calle 10 # 5-23');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('telefono', '3001234567');
  db.prepare('INSERT OR IGNORE INTO configuracion VALUES (?, ?)').run('moneda', 'COP');

  console.log('✅ Base de datos inicializada con datos de muestra');
}

function getNextFacturaNumber() {
  const db = getDB();
  const config = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get('contador_factura');
  const numero = parseInt(config.valor) + 1;
  db.prepare('UPDATE configuracion SET valor = ? WHERE clave = ?').run(numero.toString(), 'contador_factura');
  return `FAC-${numero.toString().padStart(6, '0')}`;
}

module.exports = { getDB, getNextFacturaNumber, withTransaction };
