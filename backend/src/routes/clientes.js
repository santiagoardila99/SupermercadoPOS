const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, withTransaction } = require('../database');
const { authMiddleware, requireRol } = require('../middleware/auth');

const router = express.Router();

// ── Listar clientes ─────────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { busqueda, activo } = req.query;
  const db = getDB();

  let where = [];
  const params = [];

  if (activo !== undefined) {
    where.push('c.activo = ?');
    params.push(parseInt(activo));
  } else {
    where.push('c.activo = 1');
  }

  if (busqueda) {
    where.push('(c.nombre LIKE ? OR c.cedula LIKE ? OR c.celular LIKE ?)');
    const q = `%${busqueda}%`;
    params.push(q, q, q);
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const clientes = db.prepare(`
    SELECT c.*,
      (c.cupo_disponible - c.deuda_total) as cupo_restante,
      COUNT(cr.id) as num_creditos
    FROM clientes c
    LEFT JOIN creditos cr ON cr.cliente_id = c.id AND cr.estado != 'pagado'
    ${whereStr}
    GROUP BY c.id
    ORDER BY c.nombre ASC
  `).all(...params);

  res.json(clientes);
});

// ── Crear cliente ───────────────────────────────────────────────────────────
router.post('/', authMiddleware, requireRol('cajero', 'gerente', 'admin'), (req, res) => {
  const { nombre, cedula, celular, direccion, cupo_disponible = 0 } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const db = getDB();
  const id = uuidv4();

  try {
    db.prepare(`
      INSERT INTO clientes (id, nombre, cedula, celular, direccion, cupo_disponible)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, nombre.trim(), cedula || null, celular || null, direccion || null, parseFloat(cupo_disponible) || 0);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un cliente con esa cédula' });
    }
    throw err;
  }

  res.status(201).json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(id));
});

// ── Obtener cliente con historial de créditos ───────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const creditos = db.prepare(`
    SELECT cr.*, v.numero_factura, v.total as total_venta,
           DATE(datetime(v.creado_en,'localtime')) as fecha_venta
    FROM creditos cr
    JOIN ventas v ON cr.venta_id = v.id
    WHERE cr.cliente_id = ?
    ORDER BY cr.creado_en DESC
  `).all(req.params.id);

  res.json({ ...cliente, cupo_restante: cliente.cupo_disponible - cliente.deuda_total, creditos });
});

// ── Actualizar cliente ──────────────────────────────────────────────────────
router.put('/:id', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { nombre, cedula, celular, direccion, cupo_disponible, activo } = req.body;
  const db = getDB();
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  try {
    db.prepare(`
      UPDATE clientes SET
        nombre           = COALESCE(?, nombre),
        cedula           = COALESCE(?, cedula),
        celular          = COALESCE(?, celular),
        direccion        = COALESCE(?, direccion),
        cupo_disponible  = COALESCE(?, cupo_disponible),
        activo           = COALESCE(?, activo)
      WHERE id = ?
    `).run(
      nombre || null, cedula || null, celular || null, direccion || null,
      cupo_disponible !== undefined ? parseFloat(cupo_disponible) : null,
      activo !== undefined ? (activo ? 1 : 0) : null,
      req.params.id
    );
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un cliente con esa cédula' });
    }
    throw err;
  }

  res.json(db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id));
});

// ── Registrar pago de crédito ───────────────────────────────────────────────
router.post('/:id/pagar', authMiddleware, (req, res) => {
  const { credito_id, monto } = req.body;
  const db = getDB();

  const credito = db.prepare(
    "SELECT * FROM creditos WHERE id = ? AND cliente_id = ? AND estado != 'pagado'"
  ).get(credito_id, req.params.id);
  if (!credito) return res.status(404).json({ error: 'Crédito no encontrado o ya pagado' });

  const montoNum = parseFloat(monto);
  if (!montoNum || montoNum <= 0) return res.status(400).json({ error: 'Monto inválido' });

  withTransaction(() => {
    const abono = Math.min(montoNum, credito.saldo_pendiente);
    const nuevoSaldo = credito.saldo_pendiente - abono;
    const nuevoEstado = nuevoSaldo <= 0 ? 'pagado' : 'pagado_parcial';

    db.prepare('UPDATE creditos SET saldo_pendiente = ?, estado = ? WHERE id = ?')
      .run(nuevoSaldo, nuevoEstado, credito_id);

    db.prepare('UPDATE clientes SET deuda_total = MAX(0, deuda_total - ?) WHERE id = ?')
      .run(abono, req.params.id);
  });

  const actualizado = db.prepare('SELECT * FROM creditos WHERE id = ?').get(credito_id);
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  res.json({ credito: actualizado, cliente });
});

// ── Detalle de deuda (créditos pendientes + items de cada venta) ────────────
router.get('/:id/deuda', authMiddleware, (req, res) => {
  try {
    const db = getDB();
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    let creditos = [];
    try {
      creditos = db.prepare(`
        SELECT cr.id, cr.venta_id, cr.monto, cr.saldo_pendiente, cr.estado, cr.creado_en,
               v.numero_factura, v.total as total_venta,
               datetime(v.creado_en,'localtime') as fecha_hora
        FROM creditos cr
        JOIN ventas v ON cr.venta_id = v.id
        WHERE cr.cliente_id = ? AND cr.estado NOT IN ('pagado')
        ORDER BY cr.creado_en ASC
      `).all(req.params.id);

      for (const cr of creditos) {
        try {
          cr.items = db.prepare(`
            SELECT vi.cantidad, vi.precio_unitario, vi.subtotal,
                   p.nombre as producto_nombre, p.unidad_medida
            FROM venta_items vi
            JOIN productos p ON vi.producto_id = p.id
            WHERE vi.venta_id = ?
          `).all(cr.venta_id);
        } catch (_) { cr.items = []; }
      }
    } catch (e) {
      console.error('Error al cargar créditos:', e.message);
    }

    let abonos_recientes = [];
    try {
      abonos_recientes = db.prepare(`
        SELECT a.valor, a.descripcion, datetime(a.creado_en,'localtime') as fecha_hora,
               u.nombre as usuario_nombre
        FROM abonos a
        LEFT JOIN users u ON a.usuario_id = u.id
        WHERE a.cliente_id = ?
        ORDER BY a.creado_en DESC LIMIT 10
      `).all(req.params.id);
    } catch (_) {}

    res.json({ cliente, creditos, abonos_recientes });
  } catch (err) {
    console.error('Error en /deuda:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Registrar abono general a la deuda ──────────────────────────────────────
router.post('/:id/abono', authMiddleware, (req, res) => {
  const { valor, descripcion, caja_id } = req.body;
  const db = getDB();

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const valorNum = parseFloat(valor);
  if (!valorNum || valorNum <= 0) return res.status(400).json({ error: 'El valor del abono debe ser mayor a 0' });
  if (valorNum > cliente.deuda_total + 0.01) {
    return res.status(400).json({ error: `El abono supera la deuda actual ($${Math.round(cliente.deuda_total).toLocaleString('es-CO')})` });
  }

  const abonoId = uuidv4();

  try {
    withTransaction(() => {
      db.prepare(`
        INSERT INTO abonos (id, cliente_id, valor, descripcion, usuario_id, caja_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(abonoId, req.params.id, valorNum, descripcion?.trim() || null, req.user.id, caja_id || null);

      db.prepare('UPDATE clientes SET deuda_total = MAX(0, deuda_total - ?) WHERE id = ?')
        .run(valorNum, req.params.id);

      let restante = valorNum;
      const creditosPendientes = db.prepare(
        "SELECT * FROM creditos WHERE cliente_id = ? AND estado != 'pagado' ORDER BY creado_en ASC"
      ).all(req.params.id);

      for (const cr of creditosPendientes) {
        if (restante <= 0) break;
        const aplicado = Math.min(restante, cr.saldo_pendiente);
        const nuevoSaldo = cr.saldo_pendiente - aplicado;
        db.prepare('UPDATE creditos SET saldo_pendiente = ?, estado = ? WHERE id = ?')
          .run(nuevoSaldo, nuevoSaldo <= 0.01 ? 'pagado' : 'pagado_parcial', cr.id);
        restante -= aplicado;
      }
    });
  } catch (err) {
    console.error('Error al registrar abono:', err.message);
    return res.status(500).json({ error: 'Error al registrar el abono. Reinicia el servidor.' });
  }

  const clienteActualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  res.json({ mensaje: 'Abono registrado exitosamente', cliente: clienteActualizado, abono_id: abonoId });
});

module.exports = router;
