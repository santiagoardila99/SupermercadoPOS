const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { getDB, withTransaction } = require('../database');
const { authMiddleware, requireRol } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Categorías
router.get('/categorias', authMiddleware, (req, res) => {
  const db = getDB();
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY nombre').all();
  res.json(categorias);
});

router.post('/categorias', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { nombre, descripcion, color } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const db = getDB();
  const id = uuidv4();
  db.prepare('INSERT INTO categorias (id, nombre, descripcion, color) VALUES (?, ?, ?, ?)').run(id, nombre, descripcion || null, color || '#6366f1');
  res.status(201).json(db.prepare('SELECT * FROM categorias WHERE id = ?').get(id));
});

// Distribuidores
router.get('/distribuidores', authMiddleware, (req, res) => {
  const db = getDB();
  const distribuidores = db.prepare('SELECT * FROM distribuidores WHERE activo = 1 ORDER BY nombre').all();
  res.json(distribuidores);
});

router.post('/distribuidores', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { nombre, contacto, telefono, email, nit, direccion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const db = getDB();
  const id = uuidv4();
  db.prepare(`INSERT INTO distribuidores (id, nombre, contacto, telefono, email, nit, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, nombre, contacto || null, telefono || null, email || null, nit || null, direccion || null);
  res.status(201).json(db.prepare('SELECT * FROM distribuidores WHERE id = ?').get(id));
});

// Facturas de compra
router.get('/facturas-compra', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { pagina = 1, limite = 20 } = req.query;
  const db = getDB();
  const offset = (parseInt(pagina) - 1) * parseInt(limite);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM facturas_compra').get().cnt;
  const facturas = db.prepare(`
    SELECT fc.*, d.nombre as distribuidor_nombre, u.nombre as usuario_nombre
    FROM facturas_compra fc
    LEFT JOIN distribuidores d ON fc.distribuidor_id = d.id
    LEFT JOIN users u ON fc.usuario_id = u.id
    ORDER BY fc.creado_en DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limite), offset);
  res.json({ facturas, total });
});

router.post('/facturas-compra', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { distribuidor_id, numero_factura, items, notas } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La factura debe tener al menos un producto' });
  }

  const db = getDB();
  const facturaId = uuidv4();
  let totalFactura = 0;

  withTransaction(() => {
    for (const item of items) {
      const subtotalItem = item.cantidad * item.precio_unitario;
      totalFactura += subtotalItem;

      if (item.producto_id) {
        const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(item.producto_id);
        if (prod) {
          const stockNuevo = prod.stock + item.cantidad;
          db.prepare('UPDATE productos SET stock = ?, precio_compra = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?')
            .run(stockNuevo, item.precio_unitario, item.producto_id);
          db.prepare(`
            INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id)
            VALUES (?, ?, 'compra', ?, ?, ?, ?, 'factura_compra', ?)
          `).run(uuidv4(), item.producto_id, item.cantidad, prod.stock, stockNuevo, facturaId, req.user.id);
        }
      }
    }

    db.prepare(`
      INSERT INTO facturas_compra (id, numero_factura, distribuidor_id, usuario_id, total, notas)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(facturaId, numero_factura || null, distribuidor_id || null, req.user.id, totalFactura, notas || null);

    for (const item of items) {
      db.prepare(`
        INSERT INTO factura_compra_items (id, factura_id, producto_id, nombre_producto_factura, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), facturaId, item.producto_id || null, item.nombre_producto || null, item.cantidad, item.precio_unitario, item.cantidad * item.precio_unitario);
    }
  });

  if (req.app.get('io')) {
    req.app.get('io').emit('inventario:actualizado', { tipo: 'factura_compra', id: facturaId });
  }

  res.status(201).json({ id: facturaId, total: totalFactura });
});

// Subir imagen de factura para procesamiento IA (preparado para conectar)
router.post('/facturas-compra/upload-imagen', authMiddleware, requireRol('gerente', 'admin'), upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

  // STUB: En producción, aquí iría la llamada a OpenAI Vision o Google Vision
  // para extraer los datos de la factura automáticamente
  const respuestaSimulada = {
    imagen_url: `/uploads/${req.file.filename}`,
    procesada: false,
    mensaje: 'Imagen recibida. La extracción automática de datos con IA estará disponible próximamente.',
    productos_detectados: [],
    // Cuando se conecte la IA, aquí vendrán:
    // productos_detectados: [{ nombre, cantidad, precio_unitario }]
  };

  res.json(respuestaSimulada);
});

// Usuarios
router.get('/usuarios', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const db = getDB();
  const usuarios = db.prepare('SELECT id, nombre, email, rol, activo, creado_en FROM users ORDER BY nombre').all();
  res.json(usuarios);
});

router.post('/usuarios', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  const db = getDB();
  const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existe) return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  const bcrypt = require('bcryptjs');
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, nombre, email, password_hash, rol) VALUES (?, ?, ?, ?, ?)').run(id, nombre, email, bcrypt.hashSync(password, 10), rol);
  res.status(201).json({ id, nombre, email, rol });
});

// Cajas
router.get('/cajas', authMiddleware, (req, res) => {
  const db = getDB();
  const cajas = db.prepare('SELECT * FROM cajas WHERE activa = 1').all();
  res.json(cajas);
});

// Sesiones de caja
router.post('/cajas/:cajaId/abrir', authMiddleware, (req, res) => {
  const { monto_apertura = 0 } = req.body;
  const db = getDB();
  const abierta = db.prepare("SELECT id FROM sesiones_caja WHERE caja_id = ? AND estado = 'abierta'").get(req.params.cajaId);
  if (abierta) return res.status(409).json({ error: 'Esta caja ya está abierta' });
  const id = uuidv4();
  db.prepare('INSERT INTO sesiones_caja (id, caja_id, cajero_id, monto_apertura) VALUES (?, ?, ?, ?)').run(id, req.params.cajaId, req.user.id, monto_apertura);
  res.status(201).json({ id, mensaje: 'Caja abierta correctamente' });
});

router.post('/cajas/:cajaId/cerrar', authMiddleware, (req, res) => {
  const { monto_cierre } = req.body;
  const db = getDB();
  const sesion = db.prepare("SELECT * FROM sesiones_caja WHERE caja_id = ? AND estado = 'abierta'").get(req.params.cajaId);
  if (!sesion) return res.status(404).json({ error: 'No hay caja abierta' });
  db.prepare("UPDATE sesiones_caja SET estado = 'cerrada', monto_cierre = ?, cerrada_en = CURRENT_TIMESTAMP WHERE id = ?").run(monto_cierre || 0, sesion.id);
  res.json({ mensaje: 'Caja cerrada', resumen: sesion });
});

// Configuración del negocio
router.get('/configuracion', authMiddleware, (req, res) => {
  const db = getDB();
  const config = db.prepare('SELECT * FROM configuracion').all();
  const obj = {};
  config.forEach(c => obj[c.clave] = c.valor);
  res.json(obj);
});

router.put('/configuracion', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const db = getDB();
  const updateConfig = db.prepare('INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)');
  withTransaction(() => {
    for (const [clave, valor] of Object.entries(req.body)) updateConfig.run(clave, valor);
  });
  res.json({ mensaje: 'Configuración actualizada' });
});

module.exports = router;
