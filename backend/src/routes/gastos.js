const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const TIPOS = {
  proveedor: 'Pago a Proveedor',
  nomina:    'Pago de Nómina',
  personal:  'Pago Personal',
  recogida:  'Recogida de Caja',
};

// ── Listar gastos ────────────────────────────────────────────────────────────
router.get('/', authMiddleware, (req, res) => {
  const { fecha, fecha_inicio, fecha_fin } = req.query;
  const db = getDB();

  let where = [];
  const params = [];

  if (fecha) {
    where.push("DATE(datetime(g.creado_en,'localtime')) = ?");
    params.push(fecha);
  } else {
    if (fecha_inicio) { where.push("DATE(datetime(g.creado_en,'localtime')) >= ?"); params.push(fecha_inicio); }
    if (fecha_fin)    { where.push("DATE(datetime(g.creado_en,'localtime')) <= ?"); params.push(fecha_fin); }
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const gastos = db.prepare(`
    SELECT g.*, u.nombre as usuario_nombre
    FROM gastos g
    LEFT JOIN users u ON g.usuario_id = u.id
    ${whereStr}
    ORDER BY g.creado_en DESC
  `).all(...params);

  // Totales por tipo
  const totales = {};
  let totalDia = 0;
  for (const g of gastos) {
    totales[g.tipo] = (totales[g.tipo] || 0) + g.valor;
    totalDia += g.valor;
  }

  res.json({ gastos, totales, total: totalDia });
});

// ── Crear gasto ──────────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  const { tipo, descripcion, valor, caja_id } = req.body;

  if (!tipo || !TIPOS[tipo]) {
    return res.status(400).json({ error: `Tipo inválido. Use: ${Object.keys(TIPOS).join(', ')}` });
  }
  const valorNum = parseFloat(valor);
  if (!valorNum || valorNum <= 0) {
    return res.status(400).json({ error: 'El valor debe ser mayor a 0' });
  }

  const db = getDB();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO gastos (id, tipo, descripcion, valor, caja_id, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, tipo, descripcion?.trim() || null, valorNum, caja_id || null, req.user.id);

  const gasto = db.prepare(`
    SELECT g.*, u.nombre as usuario_nombre
    FROM gastos g LEFT JOIN users u ON g.usuario_id = u.id
    WHERE g.id = ?
  `).get(id);

  res.status(201).json(gasto);
});

// ── Eliminar gasto (solo gerente) ─────────────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const gasto = db.prepare('SELECT * FROM gastos WHERE id = ?').get(req.params.id);
  if (!gasto) return res.status(404).json({ error: 'Gasto no encontrado' });
  if (req.user.rol !== 'gerente' && req.user.rol !== 'admin' && req.user.id !== gasto.usuario_id) {
    return res.status(403).json({ error: 'Sin permisos para eliminar este gasto' });
  }
  db.prepare('DELETE FROM gastos WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Gasto eliminado' });
});

module.exports = router;
