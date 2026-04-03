const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, getNextFacturaNumber, withTransaction } = require('../database');
const { authMiddleware, requireRol } = require('../middleware/auth');

const router = express.Router();

// Crear venta (el corazón del POS)
router.post('/', authMiddleware, (req, res) => {
  const { caja_id, items, metodo_pago, monto_recibido, descuento = 0, notas, cliente_id } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta debe tener al menos un producto' });
  }

  const db = getDB();

  // Validar crédito/fiado
  let clienteCredito = null;
  if (metodo_pago === 'credito') {
    if (!cliente_id) return res.status(400).json({ error: 'Debe asignar un cliente para ventas a crédito' });
    clienteCredito = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(cliente_id);
    if (!clienteCredito) return res.status(404).json({ error: 'Cliente no encontrado' });
  }

  const numeroFactura = getNextFacturaNumber();

  // Calcular totales
  let subtotal = 0;
  let ivaTotalVenta = 0;
  const itemsConPrecio = [];

  for (const item of items) {
    const producto = db.prepare('SELECT * FROM productos WHERE id = ? AND activo = 1').get(item.producto_id);
    if (!producto) return res.status(404).json({ error: `Producto ${item.producto_id} no encontrado` });
    // Stock puede quedar negativo — se permite la venta y queda reflejado en estadísticas

    const precioUnit = item.precio_unitario_override || producto.precio_venta;
    const ivaPct = producto.iva_porcentaje || 0;
    const descItem = item.descuento_item || 0;
    const subtotalItem = precioUnit * item.cantidad * (1 - descItem / 100);
    const ivaItem = subtotalItem * (ivaPct / 100);

    subtotal += subtotalItem;
    ivaTotalVenta += ivaItem;
    itemsConPrecio.push({ ...item, producto, precioUnit, ivaPct, descItem, subtotalItem });
  }

  const total = subtotal - descuento;

  // Validar cupo si es crédito
  if (metodo_pago === 'credito' && clienteCredito) {
    const cupoRestante = clienteCredito.cupo_disponible - clienteCredito.deuda_total;
    if (total > cupoRestante) {
      return res.status(400).json({
        error: `Cupo insuficiente. Disponible: $${cupoRestante.toLocaleString('es-CO')} · Venta: $${total.toLocaleString('es-CO')}`,
      });
    }
  }

  const cambio = monto_recibido ? Math.max(0, monto_recibido - total) : 0;

  // Insertar venta en transacción
  const ventaId = uuidv4();
  const insertVenta = () => withTransaction(() => {
    db.prepare(`
      INSERT INTO ventas (id, numero_factura, caja_id, cajero_id, cliente_id, subtotal, descuento, iva_total, total, metodo_pago, monto_recibido, cambio, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ventaId, numeroFactura, caja_id || null, req.user.id, cliente_id || null,
      subtotal, descuento, ivaTotalVenta, total,
      metodo_pago || 'efectivo', metodo_pago === 'credito' ? 0 : (monto_recibido || 0), cambio, notas || null);

    for (const item of itemsConPrecio) {
      db.prepare(`
        INSERT INTO venta_items (id, venta_id, producto_id, cantidad, precio_unitario, iva_porcentaje, descuento_item, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), ventaId, item.producto_id, item.cantidad, item.precioUnit, item.ivaPct, item.descItem, item.subtotalItem);

      // Reducir stock (no para pesables si no se quiere trackear)
      const stockNuevo = item.producto.stock - item.cantidad; // puede quedar negativo
      db.prepare('UPDATE productos SET stock = ? WHERE id = ?').run(stockNuevo, item.producto_id);

      db.prepare(`
        INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id)
        VALUES (?, ?, 'venta', ?, ?, ?, ?, 'venta', ?)
      `).run(uuidv4(), item.producto_id, item.cantidad, item.producto.stock, stockNuevo, ventaId, req.user.id);
    }

    // Si es crédito: crear registro de crédito y actualizar deuda del cliente
    if (metodo_pago === 'credito' && cliente_id) {
      db.prepare(`
        INSERT INTO creditos (id, cliente_id, venta_id, monto, saldo_pendiente, estado)
        VALUES (?, ?, ?, ?, ?, 'pendiente')
      `).run(uuidv4(), cliente_id, ventaId, total, total);

      db.prepare('UPDATE clientes SET deuda_total = deuda_total + ? WHERE id = ?')
        .run(total, cliente_id);
    }

    // Actualizar sesión de caja si existe
    const sesionAbierta = db.prepare("SELECT id, total_ventas, total_transacciones FROM sesiones_caja WHERE caja_id = ? AND estado = 'abierta'").get(caja_id);
    if (sesionAbierta) {
      db.prepare('UPDATE sesiones_caja SET total_ventas = total_ventas + ?, total_transacciones = total_transacciones + 1 WHERE id = ?')
        .run(total, sesionAbierta.id);
    }
  });

  insertVenta();

  const venta = db.prepare(`
    SELECT v.*, u.nombre as cajero_nombre, c.nombre as cliente_nombre
    FROM ventas v
    LEFT JOIN users u ON v.cajero_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.id = ?
  `).get(ventaId);

  const itemsGuardados = db.prepare(`
    SELECT vi.*, p.nombre as producto_nombre, p.codigo
    FROM venta_items vi JOIN productos p ON vi.producto_id = p.id
    WHERE vi.venta_id = ?
  `).all(ventaId);

  const resultado = { ...venta, items: itemsGuardados };

  if (req.app.get('io')) {
    req.app.get('io').emit('venta:nueva', { id: ventaId, total, cajero: req.user.nombre });
  }

  res.status(201).json(resultado);
});

// Obtener venta por ID o número de factura
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const venta = db.prepare(`
    SELECT v.*, u.nombre as cajero_nombre
    FROM ventas v LEFT JOIN users u ON v.cajero_id = u.id
    WHERE v.id = ? OR v.numero_factura = ?
  `).get(req.params.id, req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  const items = db.prepare(`
    SELECT vi.*, p.nombre as producto_nombre, p.codigo, p.unidad,
           COALESCE((
             SELECT SUM(di.cantidad)
             FROM devolucion_items di
             JOIN devoluciones d ON di.devolucion_id = d.id
             WHERE di.venta_item_id = vi.id
           ), 0) as cantidad_devuelta
    FROM venta_items vi JOIN productos p ON vi.producto_id = p.id
    WHERE vi.venta_id = ?
  `).all(venta.id);

  res.json({ ...venta, items });
});

// Anular venta
router.post('/:id/anular', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { motivo } = req.body;
  const db = getDB();
  const venta = db.prepare("SELECT * FROM ventas WHERE id = ? AND estado = 'completada'").get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada o ya anulada' });

  withTransaction(() => {
    db.prepare("UPDATE ventas SET estado = 'anulada', notas = ? WHERE id = ?")
      .run(motivo || 'Anulada por gerente', req.params.id);

    // Devolver stock
    const items = db.prepare('SELECT * FROM venta_items WHERE venta_id = ?').all(req.params.id);
    for (const item of items) {
      const prod = db.prepare('SELECT stock FROM productos WHERE id = ?').get(item.producto_id);
      const nuevoStock = prod.stock + item.cantidad;
      db.prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevoStock, item.producto_id);
      db.prepare(`
        INSERT INTO movimientos_inventario (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id, notas)
        VALUES (?, ?, 'entrada', ?, ?, ?, ?, 'devolucion', ?, ?)
      `).run(uuidv4(), item.producto_id, item.cantidad, prod.stock, nuevoStock, req.params.id, req.user.id, 'Devolución por anulación de venta');
    }
  });

  if (req.app.get('io')) {
    req.app.get('io').emit('venta:anulada', { id: req.params.id });
  }

  res.json({ mensaje: 'Venta anulada correctamente' });
});

// ── Devolución parcial o total de una venta ─────────────────────────────────
router.post('/:id/devolucion', authMiddleware, requireRol('cajero', 'gerente', 'admin'), (req, res) => {
  const { tipo, items, motivo } = req.body;
  if (!['total', 'parcial'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de devolución inválido. Use "total" o "parcial"' });
  }

  const db = getDB();
  const venta = db.prepare(`
    SELECT * FROM ventas WHERE id = ? AND estado = 'completada'
  `).get(req.params.id);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada o no está en estado completada' });

  const ventaItems = db.prepare(`
    SELECT vi.*, p.nombre as producto_nombre, p.stock as stock_actual
    FROM venta_items vi
    JOIN productos p ON vi.producto_id = p.id
    WHERE vi.venta_id = ?
  `).all(venta.id);

  // Verificar que no haya una devolución total previa
  const devTotal = db.prepare(`
    SELECT id FROM devoluciones WHERE venta_id = ? AND tipo = 'total'
  `).get(venta.id);
  if (devTotal) return res.status(409).json({ error: 'Esta venta ya tiene una devolución total registrada' });

  let itemsADevolver = [];
  let montoDevuelto = 0;

  if (tipo === 'total') {
    itemsADevolver = ventaItems.map(vi => ({
      venta_item_id: vi.id,
      producto_id:   vi.producto_id,
      cantidad:      vi.cantidad,
      precio_unitario: vi.precio_unitario,
      subtotal:      vi.subtotal,
    }));
    montoDevuelto = venta.total;

  } else {
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debe especificar los items a devolver' });
    }
    // Sumar cantidades ya devueltas parcialmente por item
    const yaDevuelto = db.prepare(`
      SELECT di.venta_item_id, SUM(di.cantidad) as cant_dev
      FROM devolucion_items di
      JOIN devoluciones d ON di.devolucion_id = d.id
      WHERE d.venta_id = ?
      GROUP BY di.venta_item_id
    `).all(venta.id);
    const devMap = {};
    for (const r of yaDevuelto) devMap[r.venta_item_id] = r.cant_dev;

    for (const item of items) {
      if (!item.cantidad || item.cantidad <= 0) continue;
      const vi = ventaItems.find(v => v.id === item.venta_item_id);
      if (!vi) return res.status(400).json({ error: `Item ${item.venta_item_id} no pertenece a esta venta` });
      const yaDevCant = devMap[vi.id] || 0;
      const disponible = vi.cantidad - yaDevCant;
      if (item.cantidad > disponible) {
        return res.status(400).json({ error: `Solo quedan ${disponible} unidades disponibles para devolver de "${vi.producto_nombre}"` });
      }
      itemsADevolver.push({
        venta_item_id:  vi.id,
        producto_id:    vi.producto_id,
        cantidad:       item.cantidad,
        precio_unitario: vi.precio_unitario,
        subtotal:       vi.precio_unitario * item.cantidad,
      });
      montoDevuelto += vi.precio_unitario * item.cantidad;
    }
    if (itemsADevolver.length === 0) {
      return res.status(400).json({ error: 'No se seleccionó ningún producto para devolver' });
    }
  }

  const devolucionId = uuidv4();

  withTransaction(() => {
    db.prepare(`
      INSERT INTO devoluciones (id, venta_id, tipo, monto_devuelto, motivo, cajero_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(devolucionId, venta.id, tipo, montoDevuelto, motivo || null, req.user.id);

    for (const item of itemsADevolver) {
      db.prepare(`
        INSERT INTO devolucion_items (id, devolucion_id, venta_item_id, producto_id, cantidad, precio_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), devolucionId, item.venta_item_id, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal);

      // Restaurar stock
      const prod = db.prepare('SELECT stock FROM productos WHERE id = ?').get(item.producto_id);
      const nuevoStock = prod.stock + item.cantidad;
      db.prepare('UPDATE productos SET stock = ? WHERE id = ?').run(nuevoStock, item.producto_id);
      db.prepare(`
        INSERT INTO movimientos_inventario
          (id, producto_id, tipo, cantidad, stock_anterior, stock_nuevo, referencia_id, referencia_tipo, usuario_id, notas)
        VALUES (?, ?, 'entrada', ?, ?, ?, ?, 'devolucion', ?, ?)
      `).run(
        uuidv4(), item.producto_id, item.cantidad, prod.stock, nuevoStock,
        devolucionId, req.user.id,
        `Devolución ${tipo} - Factura ${venta.numero_factura}${motivo ? ' - ' + motivo : ''}`
      );
    }

    if (tipo === 'total') {
      db.prepare("UPDATE ventas SET estado = 'devuelta' WHERE id = ?").run(venta.id);
    }
  });

  if (req.app.get('io')) {
    req.app.get('io').emit('venta:devolucion', { venta_id: venta.id, tipo, monto: montoDevuelto });
  }

  res.json({
    mensaje: `Devolución ${tipo} registrada correctamente`,
    devolucion_id: devolucionId,
    monto_devuelto: montoDevuelto,
    tipo,
  });
});

// Listar ventas con filtros
router.get('/', authMiddleware, (req, res) => {
  const { fecha_inicio, fecha_fin, cajero_id, estado, pagina = 1, limite = 30 } = req.query;
  const db = getDB();
  let where = [];
  const params = [];

  if (fecha_inicio) { where.push("DATE(datetime(v.creado_en, 'localtime')) >= ?"); params.push(fecha_inicio); }
  if (fecha_fin) { where.push("DATE(datetime(v.creado_en, 'localtime')) <= ?"); params.push(fecha_fin); }
  if (cajero_id) { where.push('v.cajero_id = ?'); params.push(cajero_id); }
  if (estado) { where.push('v.estado = ?'); params.push(estado); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (parseInt(pagina) - 1) * parseInt(limite);

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM ventas v ${whereStr}`).get(...params).cnt;
  const ventas = db.prepare(`
    SELECT v.*, u.nombre as cajero_nombre
    FROM ventas v LEFT JOIN users u ON v.cajero_id = u.id
    ${whereStr}
    ORDER BY v.creado_en DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limite), offset);

  res.json({ ventas, total, pagina: parseInt(pagina) });
});

module.exports = router;
