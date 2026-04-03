const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// MÓDULO DE IA - PREPARADO PARA CONECTAR CON OpenAI/Gemini
// ============================================================
// Para activar la IA real, agregar al .env:
//   OPENAI_API_KEY=sk-...
// Y descomentar las secciones correspondientes.
// ============================================================

const OPENAI_AVAILABLE = !!process.env.OPENAI_API_KEY;

// Chat de IA para el usuario
router.post('/chat', authMiddleware, async (req, res) => {
  const { mensaje, contexto } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

  const db = getDB();
  const logId = uuidv4();

  let respuesta = '';
  let accionEjecutada = null;

  if (OPENAI_AVAILABLE) {
    // ==================== INTEGRACIÓN OPENAI ====================
    // const OpenAI = require('openai');
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const completion = await openai.chat.completions.create({
    //   model: 'gpt-4o',
    //   messages: [
    //     { role: 'system', content: SYSTEM_PROMPT },
    //     { role: 'user', content: mensaje }
    //   ]
    // });
    // respuesta = completion.choices[0].message.content;
    // ============================================================
  } else {
    // Respuestas inteligentes sin IA real (basadas en patrones)
    respuesta = await procesarMensajeLocal(mensaje, db, req.user);
    accionEjecutada = respuesta.accion;
    respuesta = respuesta.texto;
  }

  // Guardar log
  db.prepare(`
    INSERT INTO ia_logs (id, usuario_id, tipo, entrada, salida, accion_ejecutada, exitoso)
    VALUES (?, ?, 'chat', ?, ?, ?, 1)
  `).run(logId, req.user.id, mensaje, respuesta, accionEjecutada ? JSON.stringify(accionEjecutada) : null);

  res.json({
    respuesta,
    accion: accionEjecutada,
    ia_activa: OPENAI_AVAILABLE,
    mensaje_sistema: OPENAI_AVAILABLE ? null : '💡 IA básica activa. Para activar IA completa, configura tu API key de OpenAI.'
  });
});

async function procesarMensajeLocal(mensaje, db, user) {
  const msg = mensaje.toLowerCase().trim();

  // Cambiar precio
  const matchPrecio = msg.match(/(?:cambiar?|actualizar?|modificar?|poner?)\s+(?:el\s+)?precio\s+(?:de\s+)?(.+?)\s+(?:a|en)\s+\$?\s*(\d+[\.,]?\d*)/i);
  if (matchPrecio) {
    const nombreProd = matchPrecio[1].trim();
    const nuevoPrecio = parseFloat(matchPrecio[2].replace(',', '.'));
    const producto = db.prepare("SELECT * FROM productos WHERE nombre LIKE ? AND activo = 1").get(`%${nombreProd}%`);
    if (producto) {
      db.prepare('UPDATE productos SET precio_venta = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoPrecio, producto.id);
      return {
        texto: `✅ Precio de **${producto.nombre}** actualizado a $${nuevoPrecio.toLocaleString('es-CO')} COP.`,
        accion: { tipo: 'actualizar_precio', producto_id: producto.id, precio_nuevo: nuevoPrecio }
      };
    }
    return { texto: `❌ No encontré el producto "${nombreProd}". Verifica el nombre.`, accion: null };
  }

  // Consultar stock
  const matchStock = msg.match(/(?:cuánto|cuanto|cantidad|stock)\s+(?:hay|tiene|quedan?)\s+(?:de\s+)?(.+)/i);
  if (matchStock) {
    const nombre = matchStock[1].trim();
    const producto = db.prepare("SELECT * FROM productos WHERE nombre LIKE ? AND activo = 1").get(`%${nombre}%`);
    if (producto) {
      const alerta = producto.stock <= producto.stock_minimo ? ' ⚠️ **Stock bajo**' : '';
      return {
        texto: `📦 **${producto.nombre}**: ${producto.stock} ${producto.unidad}s en stock.${alerta}`,
        accion: null
      };
    }
    return { texto: `❌ No encontré el producto "${nombre}".`, accion: null };
  }

  // Agregar stock
  const matchAgregarStock = msg.match(/(?:agregar?|añadir?|sumar?|entró?|llegó?)\s+(\d+)\s+(?:unidades?\s+(?:de\s+)?|kg\s+(?:de\s+)?)?(.+)/i);
  if (matchAgregarStock) {
    const cantidad = parseInt(matchAgregarStock[1]);
    const nombre = matchAgregarStock[2].trim();
    const producto = db.prepare("SELECT * FROM productos WHERE nombre LIKE ? AND activo = 1").get(`%${nombre}%`);
    if (producto) {
      const stockNuevo = producto.stock + cantidad;
      db.prepare('UPDATE productos SET stock = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?').run(stockNuevo, producto.id);
      return {
        texto: `✅ Agregadas **${cantidad} unidades** de **${producto.nombre}**. Stock actual: ${stockNuevo}`,
        accion: { tipo: 'ajustar_stock', producto_id: producto.id, cantidad, stock_nuevo: stockNuevo }
      };
    }
    return { texto: `❌ No encontré el producto "${nombre}".`, accion: null };
  }

  // Ventas del día
  if (msg.includes('ventas') && (msg.includes('hoy') || msg.includes('día') || msg.includes('dia'))) {
    const hoy = new Date().toISOString().split('T')[0];
    const stats = db.prepare("SELECT COUNT(*) as n, SUM(total) as t FROM ventas WHERE DATE(creado_en) = ? AND estado = 'completada'").get(hoy);
    return {
      texto: `📊 **Ventas de hoy**: ${stats.n || 0} transacciones por $${(stats.t || 0).toLocaleString('es-CO')} COP.`,
      accion: null
    };
  }

  // Stock bajo
  if (msg.includes('stock bajo') || msg.includes('poco stock') || msg.includes('sin stock') || msg.includes('agotado')) {
    const prods = db.prepare("SELECT nombre, stock, stock_minimo FROM productos WHERE stock <= stock_minimo AND activo = 1 LIMIT 10").all();
    if (prods.length === 0) return { texto: '✅ Todos los productos tienen stock suficiente.', accion: null };
    const lista = prods.map(p => `• **${p.nombre}**: ${p.stock} (mínimo: ${p.stock_minimo})`).join('\n');
    return { texto: `⚠️ **Productos con stock bajo**:\n${lista}`, accion: null };
  }

  // Buscar producto
  if (msg.includes('buscar') || msg.includes('encontrar') || msg.includes('existe')) {
    const match = msg.match(/(?:buscar?|encontrar?|existe)\s+(.+)/i);
    if (match) {
      const nombre = match[1].trim();
      const prods = db.prepare("SELECT nombre, codigo, precio_venta, stock FROM productos WHERE nombre LIKE ? AND activo = 1 LIMIT 5").all(`%${nombre}%`);
      if (prods.length === 0) return { texto: `❌ No encontré productos con "${nombre}".`, accion: null };
      const lista = prods.map(p => `• **${p.nombre}** (${p.codigo}) - $${p.precio_venta.toLocaleString('es-CO')} - Stock: ${p.stock}`).join('\n');
      return { texto: `🔍 **Resultados para "${nombre}"**:\n${lista}`, accion: null };
    }
  }

  // Ayuda
  if (msg.includes('ayuda') || msg.includes('qué puedes') || msg.includes('comandos')) {
    return {
      texto: `🤖 **Puedo ayudarte con:**\n\n• **Precios**: "Cambiar precio de leche a 3800"\n• **Stock**: "¿Cuánto hay de papa?"\n• **Agregar stock**: "Agregar 50 unidades de arroz"\n• **Ventas**: "¿Cómo van las ventas de hoy?"\n• **Alertas**: "¿Qué productos tienen poco stock?"\n• **Buscar**: "Buscar yogur"\n\n💡 *Cuando conectes una API de OpenAI, podré hacer mucho más.*`,
      accion: null
    };
  }

  return {
    texto: `🤖 Entendí: "${mensaje}". Para comandos disponibles escribe "ayuda".\n\n💡 Con IA completa (OpenAI), podré procesar cualquier instrucción en lenguaje natural.`,
    accion: null
  };
}

// Historial de comandos IA
router.get('/historial', authMiddleware, (req, res) => {
  const db = getDB();
  const logs = db.prepare(`
    SELECT l.*, u.nombre as usuario_nombre
    FROM ia_logs l LEFT JOIN users u ON l.usuario_id = u.id
    ORDER BY l.creado_en DESC LIMIT 50
  `).all();
  res.json(logs);
});

// Estado del módulo IA
router.get('/estado', authMiddleware, (req, res) => {
  res.json({
    ia_activa: OPENAI_AVAILABLE,
    funciones: {
      chat_texto: true,
      chat_voz: OPENAI_AVAILABLE,
      leer_facturas: OPENAI_AVAILABLE,
      generacion_reportes: true
    },
    mensaje: OPENAI_AVAILABLE
      ? '✅ IA completa activa con OpenAI'
      : '⚡ IA básica activa. Para habilitar todas las funciones, agrega OPENAI_API_KEY en el archivo .env'
  });
});

module.exports = router;
