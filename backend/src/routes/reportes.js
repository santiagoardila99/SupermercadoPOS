const express = require('express');
const { getDB } = require('../database');
const { authMiddleware, requireRol } = require('../middleware/auth');

const router = express.Router();

// ── Reporte de caja completo para un día ─────────────────────────────────────
router.get('/caja', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { fecha } = req.query;
  const dia = fecha || new Date().toISOString().split('T')[0];
  const db = getDB();

  const ventasPorMetodo = db.prepare(`
    SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
    FROM ventas
    WHERE DATE(creado_en) = ? AND estado = 'completada'
    GROUP BY metodo_pago
  `).all(dia);

  const resumenVentas = db.prepare(`
    SELECT
      COUNT(*) as total_ventas,
      SUM(total) as ingreso_bruto,
      SUM(descuento) as descuento_general,
      SUM(iva_total) as iva_total,
      SUM(CASE WHEN cliente_id IS NOT NULL THEN 1 ELSE 0 END) as ventas_con_cliente
    FROM ventas
    WHERE DATE(creado_en) = ? AND estado = 'completada'
  `).get(dia);

  const descuentosItems = db.prepare(`
    SELECT
      COUNT(CASE WHEN vi.descuento_item > 0 THEN 1 END) as items_con_descuento,
      SUM(vi.descuento_item) as total_descuentos_item,
      COUNT(DISTINCT CASE WHEN vi.descuento_item > 0 THEN vi.venta_id END) as ventas_con_descuento
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    WHERE DATE(v.creado_en) = ? AND v.estado = 'completada'
  `).get(dia);

  const detalleDescuentos = db.prepare(`
    SELECT p.nombre as producto, p.codigo,
           vi.cantidad, vi.precio_unitario, vi.descuento_item, vi.subtotal,
           v.numero_factura, v.creado_en
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    JOIN productos p ON vi.producto_id = p.id
    WHERE DATE(v.creado_en) = ? AND v.estado = 'completada' AND vi.descuento_item > 0
    ORDER BY v.creado_en DESC
  `).all(dia);

  const resumenDevoluciones = db.prepare(`
    SELECT COUNT(*) as cantidad, SUM(monto_devuelto) as total_devuelto,
           COUNT(CASE WHEN tipo='total'   THEN 1 END) as totales,
           COUNT(CASE WHEN tipo='parcial' THEN 1 END) as parciales
    FROM devoluciones WHERE DATE(creado_en) = ?
  `).get(dia);

  const detalleDevoluciones = db.prepare(`
    SELECT d.tipo, d.monto_devuelto, d.motivo, d.creado_en,
           v.numero_factura, u.nombre as cajero
    FROM devoluciones d
    JOIN ventas v ON d.venta_id = v.id
    LEFT JOIN users u ON d.cajero_id = u.id
    WHERE DATE(d.creado_en) = ?
    ORDER BY d.creado_en DESC
  `).all(dia);

  const resumenGastos = db.prepare(`
    SELECT tipo, COUNT(*) as cantidad, SUM(valor) as total
    FROM gastos WHERE DATE(creado_en) = ?
    GROUP BY tipo
  `).all(dia);

  const detalleGastos = db.prepare(`
    SELECT g.tipo, g.descripcion, g.valor, g.creado_en, u.nombre as usuario
    FROM gastos g
    LEFT JOIN users u ON g.usuario_id = u.id
    WHERE DATE(g.creado_en) = ?
    ORDER BY g.creado_en DESC
  `).all(dia);

  const totalGastos    = resumenGastos.reduce((s, g) => s + (g.total || 0), 0);
  const totalRecogidas = resumenGastos.find(g => g.tipo === 'recogida')?.total || 0;
  const gastosSinRecog = totalGastos - totalRecogidas;

  const resumenAbonos = db.prepare(`
    SELECT COUNT(*) as cantidad, SUM(valor) as total
    FROM abonos WHERE DATE(creado_en) = ?
  `).get(dia);

  const detalleAbonos = db.prepare(`
    SELECT a.valor, a.descripcion, a.creado_en, c.nombre as cliente, c.cedula
    FROM abonos a
    JOIN clientes c ON a.cliente_id = c.id
    WHERE DATE(a.creado_en) = ?
    ORDER BY a.creado_en DESC
  `).all(dia);

  const resumenCreditos = db.prepare(`
    SELECT COUNT(*) as cantidad, SUM(monto) as total
    FROM creditos WHERE DATE(creado_en) = ?
  `).get(dia);

  const ventasCredito = db.prepare(`
    SELECT v.numero_factura, v.total, v.creado_en, c.nombre as cliente, c.cedula
    FROM ventas v
    JOIN clientes c ON v.cliente_id = c.id
    WHERE DATE(v.creado_en) = ? AND v.metodo_pago = 'credito' AND v.estado = 'completada'
    ORDER BY v.creado_en DESC
  `).all(dia);

  const ventasPorHora = db.prepare(`
    SELECT strftime('%H', creado_en) as hora, COUNT(*) as cantidad, SUM(total) as total
    FROM ventas WHERE DATE(creado_en) = ? AND estado = 'completada'
    GROUP BY hora ORDER BY hora
  `).all(dia);

  const listaVentas = db.prepare(`
    SELECT v.numero_factura, v.total, v.metodo_pago, v.descuento, v.creado_en,
           u.nombre as cajero, c.nombre as cliente
    FROM ventas v
    LEFT JOIN users u ON v.cajero_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE DATE(v.creado_en) = ? AND v.estado = 'completada'
    ORDER BY v.creado_en DESC
  `).all(dia);

  const topProductos = db.prepare(`
    SELECT p.nombre, p.codigo,
           SUM(vi.cantidad) as cantidad, SUM(vi.subtotal) as total
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    JOIN productos p ON vi.producto_id = p.id
    WHERE DATE(v.creado_en) = ? AND v.estado = 'completada'
    GROUP BY p.id ORDER BY total DESC LIMIT 10
  `).all(dia);

  const efectivoVentas   = ventasPorMetodo.find(m => m.metodo_pago === 'efectivo')?.total || 0;
  const abonosTotal      = resumenAbonos.total || 0;
  const efectivoEsperado = efectivoVentas + abonosTotal - totalGastos;

  res.json({
    fecha: dia,
    ventas:       { resumen: resumenVentas, porMetodo: ventasPorMetodo, porHora: ventasPorHora, lista: listaVentas, topProductos },
    descuentos:   { resumen: descuentosItems, detalle: detalleDescuentos },
    devoluciones: { resumen: resumenDevoluciones, detalle: detalleDevoluciones },
    gastos:       { resumen: resumenGastos, detalle: detalleGastos, totalGastos, totalRecogidas, gastosSinRecog },
    abonos:       { resumen: resumenAbonos, detalle: detalleAbonos },
    creditos:     { resumen: resumenCreditos, detalle: ventasCredito },
    caja:         { efectivo_ventas: efectivoVentas, abonos_recibidos: abonosTotal, gastos_pagados: gastosSinRecog, recogidas: totalRecogidas, efectivo_esperado: efectivoEsperado },
  });
});

// ── Resumen diario ───────────────────────────────────────────────────────────
router.get('/diario', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { fecha } = req.query;
  const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
  const db = getDB();

  const resumen = db.prepare(`
    SELECT
      COUNT(*) as total_transacciones,
      SUM(CASE WHEN estado='completada' THEN 1   ELSE 0    END) as ventas_completadas,
      SUM(CASE WHEN estado='anulada'    THEN 1   ELSE 0    END) as ventas_anuladas,
      SUM(CASE WHEN estado='completada' THEN total    ELSE 0 END) as ingresos_totales,
      SUM(CASE WHEN estado='completada' THEN iva_total ELSE 0 END) as iva_total,
      AVG(CASE WHEN estado='completada' THEN total    ELSE NULL END) as ticket_promedio,
      MAX(CASE WHEN estado='completada' THEN total    ELSE 0    END) as venta_maxima,
      MIN(CASE WHEN estado='completada' AND total>0 THEN total ELSE NULL END) as venta_minima
    FROM ventas WHERE DATE(creado_en) = ?
  `).get(fechaConsulta);

  const porMetodoPago = db.prepare(`
    SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
    FROM ventas WHERE DATE(creado_en) = ? AND estado = 'completada'
    GROUP BY metodo_pago
  `).all(fechaConsulta);

  const topProductos = db.prepare(`
    SELECT p.nombre, p.codigo, SUM(vi.cantidad) as cantidad_vendida, SUM(vi.subtotal) as total_vendido
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    JOIN productos p ON vi.producto_id = p.id
    WHERE DATE(v.creado_en) = ? AND v.estado = 'completada'
    GROUP BY p.id ORDER BY total_vendido DESC LIMIT 10
  `).all(fechaConsulta);

  const ventasPorHora = db.prepare(`
    SELECT strftime('%H', creado_en) as hora, COUNT(*) as ventas, SUM(total) as ingresos
    FROM ventas WHERE DATE(creado_en) = ? AND estado = 'completada'
    GROUP BY hora ORDER BY hora
  `).all(fechaConsulta);

  res.json({ fecha: fechaConsulta, resumen, porMetodoPago, topProductos, ventasPorHora });
});

// ── Resumen mensual ──────────────────────────────────────────────────────────
router.get('/mensual', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { año, mes } = req.query;
  const ahora = new Date();
  const añoConsulta = año || ahora.getFullYear();
  const mesConsulta = mes || (ahora.getMonth() + 1).toString().padStart(2, '0');
  const periodo = `${añoConsulta}-${mesConsulta.toString().padStart(2, '0')}`;
  const db = getDB();

  const resumenMes = db.prepare(`
    SELECT
      COUNT(CASE WHEN estado='completada' THEN 1 END) as ventas_completadas,
      SUM(CASE WHEN estado='completada' THEN total    ELSE 0 END) as ingresos_totales,
      SUM(CASE WHEN estado='completada' THEN iva_total ELSE 0 END) as iva_total,
      AVG(CASE WHEN estado='completada' THEN total    ELSE NULL END) as ticket_promedio
    FROM ventas WHERE strftime('%Y-%m', creado_en) = ?
  `).get(periodo);

  const ventasPorDia = db.prepare(`
    SELECT DATE(creado_en) as fecha,
           COUNT(CASE WHEN estado='completada' THEN 1 END) as ventas,
           SUM(CASE WHEN estado='completada'  THEN total ELSE 0 END) as ingresos
    FROM ventas WHERE strftime('%Y-%m', creado_en) = ?
    GROUP BY DATE(creado_en) ORDER BY fecha
  `).all(periodo);

  const gastosPorDia = db.prepare(`
    SELECT DATE(creado_en) as fecha, SUM(valor) as total_gastos
    FROM gastos WHERE strftime('%Y-%m', creado_en) = ?
    GROUP BY DATE(creado_en) ORDER BY fecha
  `).all(periodo);

  const topProductos = db.prepare(`
    SELECT p.nombre, p.codigo, SUM(vi.cantidad) as cantidad_vendida, SUM(vi.subtotal) as total_vendido
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    JOIN productos p ON vi.producto_id = p.id
    WHERE strftime('%Y-%m', v.creado_en) = ? AND v.estado = 'completada'
    GROUP BY p.id ORDER BY total_vendido DESC LIMIT 15
  `).all(periodo);

  const porMetodo = db.prepare(`
    SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
    FROM ventas WHERE strftime('%Y-%m', creado_en) = ? AND estado = 'completada'
    GROUP BY metodo_pago
  `).all(periodo);

  const resumenGastos = db.prepare(`
    SELECT tipo, COUNT(*) as cantidad, SUM(valor) as total
    FROM gastos WHERE strftime('%Y-%m', creado_en) = ?
    GROUP BY tipo
  `).all(periodo);

  res.json({ periodo, resumenMes, ventasPorDia, gastosPorDia, topProductos, porMetodo, resumenGastos });
});

// ── Resumen anual ─────────────────────────────────────────────────────────────
router.get('/anual', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const { año } = req.query;
  const añoConsulta = año || new Date().getFullYear();
  const db = getDB();

  const resumenAño = db.prepare(`
    SELECT
      COUNT(CASE WHEN estado='completada' THEN 1 END) as ventas_completadas,
      SUM(CASE WHEN estado='completada' THEN total    ELSE 0 END) as ingresos_totales,
      SUM(CASE WHEN estado='completada' THEN iva_total ELSE 0 END) as iva_total,
      AVG(CASE WHEN estado='completada' THEN total    ELSE NULL END) as ticket_promedio
    FROM ventas WHERE strftime('%Y', creado_en) = ?
  `).get(añoConsulta.toString());

  const ventasPorMes = db.prepare(`
    SELECT strftime('%m', creado_en) as mes,
           COUNT(CASE WHEN estado='completada' THEN 1 END) as ventas,
           SUM(CASE WHEN estado='completada'  THEN total ELSE 0 END) as ingresos
    FROM ventas WHERE strftime('%Y', creado_en) = ?
    GROUP BY mes ORDER BY mes
  `).all(añoConsulta.toString());

  const gastosPorMes = db.prepare(`
    SELECT strftime('%m', creado_en) as mes, SUM(valor) as total_gastos
    FROM gastos WHERE strftime('%Y', creado_en) = ?
    GROUP BY mes ORDER BY mes
  `).all(añoConsulta.toString());

  const topProductos = db.prepare(`
    SELECT p.nombre, p.codigo, SUM(vi.cantidad) as cantidad_vendida, SUM(vi.subtotal) as total_vendido
    FROM venta_items vi
    JOIN ventas v ON vi.venta_id = v.id
    JOIN productos p ON vi.producto_id = p.id
    WHERE strftime('%Y', v.creado_en) = ? AND v.estado = 'completada'
    GROUP BY p.id ORDER BY total_vendido DESC LIMIT 20
  `).all(añoConsulta.toString());

  res.json({ año: añoConsulta, resumenAño, ventasPorMes, gastosPorMes, topProductos });
});

// ── Stock bajo ───────────────────────────────────────────────────────────────
router.get('/stock-bajo', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const db = getDB();
  const productos = db.prepare(`
    SELECT p.*, c.nombre as categoria_nombre
    FROM productos p LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.stock <= p.stock_minimo AND p.activo = 1
    ORDER BY (p.stock_minimo - p.stock) DESC
  `).all();
  res.json({ productos, total: productos.length });
});

// ── Dashboard rápido ─────────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, requireRol('gerente', 'admin'), (req, res) => {
  const db = getDB();
  const hoy = new Date().toISOString().split('T')[0];
  const mesActual = hoy.substring(0, 7);

  const ventasHoy      = db.prepare(`SELECT COUNT(*) as transacciones, SUM(total) as total FROM ventas WHERE DATE(creado_en)=? AND estado='completada'`).get(hoy);
  const ventasMes      = db.prepare(`SELECT SUM(total) as total FROM ventas WHERE strftime('%Y-%m',creado_en)=? AND estado='completada'`).get(mesActual);
  const gastosHoy      = db.prepare(`SELECT SUM(valor) as total FROM gastos WHERE DATE(creado_en)=?`).get(hoy);
  const recogidaHoy    = db.prepare(`SELECT SUM(valor) as total FROM gastos WHERE DATE(creado_en)=? AND tipo='recogida'`).get(hoy);
  const abonosHoy      = db.prepare(`SELECT SUM(valor) as total FROM abonos WHERE DATE(creado_en)=?`).get(hoy);
  const devHoy         = db.prepare(`SELECT COUNT(*) as cantidad, SUM(monto_devuelto) as total FROM devoluciones WHERE DATE(creado_en)=?`).get(hoy);
  const efectivoHoy    = db.prepare(`SELECT SUM(total) as total FROM ventas WHERE DATE(creado_en)=? AND estado='completada' AND metodo_pago='efectivo'`).get(hoy);
  const descuentosHoy  = db.prepare(`SELECT SUM(vi.descuento_item) as total FROM venta_items vi JOIN ventas v ON vi.venta_id=v.id WHERE DATE(v.creado_en)=? AND v.estado='completada'`).get(hoy);
  const stockBajo      = db.prepare(`SELECT COUNT(*) as cnt FROM productos WHERE stock<=stock_minimo AND activo=1`).get();
  const totalProductos = db.prepare(`SELECT COUNT(*) as cnt FROM productos WHERE activo=1`).get();
  const ultimasVentas  = db.prepare(`
    SELECT v.numero_factura, v.total, v.metodo_pago, v.creado_en, u.nombre as cajero
    FROM ventas v LEFT JOIN users u ON v.cajero_id=u.id
    WHERE v.estado='completada' ORDER BY v.creado_en DESC LIMIT 6
  `).all();

  const efectivoEsperado = (efectivoHoy.total || 0) + (abonosHoy.total || 0) - (gastosHoy.total || 0);

  res.json({
    hoy: {
      transacciones: ventasHoy.transacciones || 0,
      total:         ventasHoy.total || 0,
      gastos:        gastosHoy.total || 0,
      recogida:      recogidaHoy.total || 0,
      abonos:        abonosHoy.total || 0,
      devoluciones:  devHoy,
      descuentos:    descuentosHoy.total || 0,
      efectivo_esperado: efectivoEsperado,
    },
    mes: { total: ventasMes.total || 0 },
    inventario: { stock_bajo: stockBajo.cnt, total_productos: totalProductos.cnt },
    ultimas_ventas: ultimasVentas,
  });
});

module.exports = router;
