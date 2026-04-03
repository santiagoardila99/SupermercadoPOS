/**
 * Agrega 3 productos de prueba para testear la interfaz del POS
 * sin necesidad de lector de barras ni báscula física.
 *
 * Ejecutar: node agregar_productos_prueba.js
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'supermercado.db');

try {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');

  // Buscar IDs de categorías existentes
  const catLacteos   = db.prepare("SELECT id FROM categorias WHERE nombre LIKE '%Lácteo%' OR nombre LIKE '%Lacteo%'").get();
  const catVerduras  = db.prepare("SELECT id FROM categorias WHERE nombre LIKE '%Verdura%' OR nombre LIKE '%Fruta%'").get();
  const catAseo      = db.prepare("SELECT id FROM categorias WHERE nombre LIKE '%Aseo%' OR nombre LIKE '%Limpieza%'").get();
  const catGranos    = db.prepare("SELECT id FROM categorias WHERE nombre LIKE '%Grano%' OR nombre LIKE '%Cereal%'").get();
  const catBebidas   = db.prepare("SELECT id FROM categorias WHERE nombre LIKE '%Bebida%'").get();

  // Usar primera categoría disponible como fallback
  const fallback = db.prepare("SELECT id FROM categorias LIMIT 1").get();
  const cat1 = catBebidas?.id  || fallback?.id;
  const cat2 = catVerduras?.id || fallback?.id;
  const cat3 = catAseo?.id     || fallback?.id;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO productos
      (id, codigo, codigo_barras, nombre, categoria_id,
       precio_compra, precio_venta, iva_porcentaje,
       stock, stock_minimo, unidad, es_pesable, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const productos = [
    // ── PRODUCTO 1: código de barras escrito a mano ──────────────────────────
    {
      id:         uuidv4(),
      codigo:     'P020',
      barras:     '7702005002316',   // <-- este código se digita en el POS
      nombre:     'Café Juan Valdez Molido 250g',
      cat:        cat1,
      p_compra:   7500,
      p_venta:    9900,
      iva:        0,
      stock:      25,
      stock_min:  5,
      unidad:     'unidad',
      pesable:    0,
    },
    // ── PRODUCTO 2: pesable (fruta/verdura) ──────────────────────────────────
    {
      id:         uuidv4(),
      codigo:     'FRU010',
      barras:     null,              // sin código de barras → se busca por código
      nombre:     'Banano x kg',
      cat:        cat2,
      p_compra:   1000,
      p_venta:    1800,
      iva:        0,
      stock:      40,
      stock_min:  5,
      unidad:     'kg',
      pesable:    1,                 // <-- activa el modal de peso en el POS
    },
    // ── PRODUCTO 3: código personalizado (sin barras) ────────────────────────
    {
      id:         uuidv4(),
      codigo:     'ASE001',          // <-- se digita este código en el POS
      barras:     null,
      nombre:     'Jabón Rey x 3 unidades',
      cat:        cat3,
      p_compra:   3200,
      p_venta:    4500,
      iva:        19,
      stock:      18,
      stock_min:  3,
      unidad:     'unidad',
      pesable:    0,
    },
  ];

  let insertados = 0;
  for (const p of productos) {
    const resultado = insert.run(
      p.id, p.codigo, p.barras, p.nombre, p.cat,
      p.p_compra, p.p_venta, p.iva,
      p.stock, p.stock_min, p.unidad, p.pesable
    );
    if (resultado.changes > 0) {
      console.log(`  ✅ Insertado: ${p.nombre} (código: ${p.codigo})`);
      insertados++;
    } else {
      console.log(`  ⚠️  Ya existe:  ${p.nombre} (código: ${p.codigo})`);
    }
  }

  db.close();

  console.log('\n─────────────────────────────────────────────────────');
  console.log(`  ${insertados} de ${productos.length} productos agregados.`);
  console.log('\n  CÓMO PROBARLOS EN EL POS:');
  console.log('  ┌──────────────────────────────────────────────────┐');
  console.log('  │ 1. Café Juan Valdez  → digita: 7702005002316     │');
  console.log('  │    (simula lector de barras escribiendo el código)│');
  console.log('  │                                                    │');
  console.log('  │ 2. Banano x kg       → digita: FRU010             │');
  console.log('  │    (abre modal de peso → escribe ej. 0.750 kg)    │');
  console.log('  │                                                    │');
  console.log('  │ 3. Jabón Rey         → digita: ASE001             │');
  console.log('  │    (código personalizado, sin barras)              │');
  console.log('  └──────────────────────────────────────────────────┘');
  console.log('\n  Recarga el navegador (F5) y pruébalos en el POS.');
  console.log('─────────────────────────────────────────────────────\n');

} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error('   Asegúrate de que el backend haya arrancado al menos');
  console.error('   una vez para que exista la base de datos.\n');
  process.exit(1);
}
