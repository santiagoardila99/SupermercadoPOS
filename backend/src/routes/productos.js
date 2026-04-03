const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { authMiddleware, requireRol } = require('../middleware/auth');

const router = express.Router();

// Buscar producto por código (escáner o código personalizado)
router.get('/buscar', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
  const db = getDB();
  const producto = db.prepare(`
    SELECT p.*, c.nombre as categoria_nombre, d.nombre as distribuidor_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN distribuidores d ON p.distribuidor_id = d.id
    WHERE (p.codigo = ? COLLATE NOCASE OR p.codigo_barras = ? COLLATE NOCASE) AND p.activo = 1
  `).get(q, q);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

// Listar todos los productos con filtros
router.get('/', authMiddleware, (req, res) => {
  const { categoria, buscar, pagina = 1, limite = 50, stock_bajo } = req.query;
  const db = getDB();
  let where = ['p.activo = 1'];
  const params = [];

  if (categoria) { where.push('p.categoria_id = ?'); params.push(categoria); }
  if (buscar) {
    where.push('(p.nombre LIKE ? OR p.codigo LIKE ? OR p.codigo_barras LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  if (stock_bajo === 'true') { where.push('p.stock <= p.stock_minimo'); }

  const offset = (parseInt(pagina) - 1) * parseInt(limite);
  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM productos p ${whereStr}`).get(...params).cnt;
  const productos = db.prepare(`
    SELECT p.*, c.nombre as categoria_nombre, d.nombre as distribuidor_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN distribuidores d ON p.distribuidor_id = d.id
    ${whereStr}
    ORDER BY p.nombre ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limite), offset);

  res.json({ productos, total, pagina: parseInt(pagina), limite: parseInt(limite) });
});

// Obtener un producto
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const producto = db.prepare(`
    SELECT p.*, c.nombre as categoria_nombre, d.nombre as distribuidor_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    LEFT JOIN distribuidores d ON p.distribuidor_id = d.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

// Crear producto
router.post('/', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const {
    codigo, codigo_barras, nombre, descripcion, categoria_id, distribuidor_id,
    precio_compra, precio_venta, iva_porcentaje, stock, stock_minimo, unidad, es_pesable
  } = req.body;

  if (!codigo || !nombre || precio_venta === undefined) {
    return res.status(400).json({ error: 'Código, nombre y precio de venta son requeridos' });
  }

  const db = getDB();
  const existente = db.prepare('SELECT id FROM productos WHERE codigo = ?').get(codigo);
  if (existente) return res.status(409).json({ error: 'Ya existe un producto con ese código' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO productos (id, codigo, codigo_barras, nombre, descripcion, categoria_id, distribuidor_id,
      precio_compra, precio_venta, iva_porcentaje, stock, stock_minimo, unidad, es_pesable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, codigo, codigo_barras || null, nombre, descripcion || null, categoria_id || null,
    distribuidor_id || null, precio_compra || 0, precio_venta, iva_porcentaje || 0,
    stock || 0, stock_minimo || 5, unidad || 'unidad', es_pesable ? 1 : 0);

  // Registrar movimiento si hay stock inicial
  if (stock > 0) {
    db.prepare(`
      INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, notas)
      VALUES (?, ?, 'entrada', ?, 0, ?, ?, 'Stock inicial')
    `).run(uuidv4(), id, stock, stock, req.user.id);
  }

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);

  // Emitir evento en tiempo real
  if (req.app.get('io')) {
    req.app.get('io').emit('producto:creado', producto);
  }

  res.status(201).json(producto);
});

// Actualizar producto
router.put('/:id', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const {
    codigo, codigo_barras, nombre, descripcion, categoria_id, distribuidor_id,
    precio_compra, precio_venta, iva_porcentaje, stock_minimo, unidad, es_pesable, activo
  } = req.body;

  const db = getDB();
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

  // Verificar código único si cambió
  if (codigo && codigo !== producto.codigo) {
    const existente = db.prepare('SELECT id FROM productos WHERE codigo = ? AND id != ?').get(codigo, req.params.id);
    if (existente) return res.status(409).json({ error: 'Ya existe un producto con ese código' });
  }

  db.prepare(`
    UPDATE productos SET
      codigo = COALESCE(?, codigo),
      codigo_barras = COALESCE(?, codigo_barras),
      nombre = COALESCE(?, nombre),
      descripcion = COALESCE(?, descripcion),
      categoria_id = COALESCE(?, categoria_id),
      distribuidor_id = COALESCE(?, distribuidor_id),
      precio_compra = COALESCE(?, precio_compra),
      precio_venta = COALESCE(?, precio_venta),
      iva_porcentaje = COALESCE(?, iva_porcentaje),
      stock_minimo = COALESCE(?, stock_minimo),
      unidad = COALESCE(?, unidad),
      es_pesable = COALESCE(?, es_pesable),
      activo = COALESCE(?, activo),
      actualizado_en = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(codigo || null, codigo_barras !== undefined ? codigo_barras : null, nombre || null,
    descripcion !== undefined ? descripcion : null, categoria_id || null, distribuidor_id || null,
    precio_compra !== undefined ? precio_compra : null, precio_venta !== undefined ? precio_venta : null,
    iva_porcentaje !== undefined ? iva_porcentaje : null, stock_minimo !== undefined ? stock_minimo : null,
    unidad || null, es_pesable !== undefined ? (es_pesable ? 1 : 0) : null,
    activo !== undefined ? (activo ? 1 : 0) : null, req.params.id);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);

  if (req.app.get('io')) {
    req.app.get('io').emit('producto:actualizado', actualizado);
  }

  res.json(actualizado);
});

// Ajustar stock manualmente
router.post('/:id/ajustar-stock', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { cantidad, tipo = 'ajuste', notas } = req.body;
  if (cantidad === undefined) return res.status(400).json({ error: 'Cantidad requerida' });

  const db = getDB();
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

  const stockAnterior = producto.stock;
  let stockNuevo;
  if (tipo === 'ajuste') {
    stockNuevo = cantidad; // ajuste directo
  } else if (tipo === 'entrada') {
    stockNuevo = stockAnterior + cantidad;
  } else {
    stockNuevo = Math.max(0, stockAnterior - cantidad);
  }

  db.prepare('UPDATE productos SET stock = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(stockNuevo, req.params.id);
  db.prepare(`
    INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), req.params.id, tipo, Math.abs(cantidad), stockAnterior, stockNuevo, req.user.id, notas || null);

  const actualizado = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);

  if (req.app.get('io')) {
    req.app.get('io').emit('producto:stock', { id: req.params.id, stock: stockNuevo });
  }

  res.json({ producto: actualizado, movimiento: { stock_anterior: stockAnterior, stock_nuevo: stockNuevo } });
});

// Historial de movimientos de un producto
router.get('/:id/movimientos', authMiddleware, (req, res) => {
  const db = getDB();
  const movimientos = db.prepare(`
    SELECT m.*, u.nombre as usuario_nombre
    FROM movimientos_inventario m
    LEFT JOIN users u ON m.usuario_id = u.id
    WHERE m.producto_id = ?
    ORDER BY m.creado_en DESC
    LIMIT 100
  `).all(req.params.id);
  res.json(movimientos);
});

module.exports = router;
