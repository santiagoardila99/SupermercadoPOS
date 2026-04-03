import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scan, X, Plus, Minus, ShoppingCart, CreditCard, Banknote, Smartphone,
  LogOut, Settings, Bot, Printer, Scale, Search, Package, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api, { formatCOP } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';
import { getPOSConfig, keyLabel } from '../utils/posConfig';

// ── Helpers ────────────────────────────────────────────────────────────────
function formatearMonto(str) {
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CO');
}
function parseMonto(str) {
  return parseFloat((str || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

// ── Búsqueda fuzzy ─────────────────────────────────────────────────────────
function normalizar(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function bigramas(str) {
  const res = [];
  for (let i = 0; i < str.length - 1; i++) res.push(str.slice(i, i + 2));
  return res;
}
function puntaje(producto, busqueda) {
  const nb = normalizar(busqueda);
  if (!nb) return 100;
  const nombre = normalizar(producto.nombre);
  const codigo = normalizar(producto.codigo);
  const barras = normalizar(producto.codigo_barras || '');
  const cat    = normalizar(producto.categoria_nombre || '');
  if (codigo === nb || barras === nb) return 100;
  if (codigo.startsWith(nb) || barras.startsWith(nb)) return 95;
  if (nombre === nb) return 90;
  if (nombre.startsWith(nb)) return 85;
  if (nombre.includes(nb)) return 75;
  const palabras = nb.split(' ').filter(Boolean);
  if (palabras.length > 1 && palabras.every(p => nombre.includes(p))) return 65;
  if (palabras.some(p => p.length > 2 && nombre.includes(p))) return 45;
  if (cat.includes(nb)) return 35;
  const bn = bigramas(nombre), bb = bigramas(nb);
  if (!bn.length || !bb.length) return 0;
  const comunes = bb.filter(b => bn.includes(b)).length;
  return Math.round((2 * comunes) / (bn.length + bb.length) * 30);
}

// ── Botón tecla F ──────────────────────────────────────────────────────────
const FN_COLORS = {
  red:    'bg-red-700    hover:bg-red-600',
  blue:   'bg-blue-700   hover:bg-blue-600',
  green:  'bg-green-700  hover:bg-green-600',
  orange: 'bg-orange-600 hover:bg-orange-500',
  purple: 'bg-purple-700 hover:bg-purple-600',
  indigo: 'bg-indigo-700 hover:bg-indigo-600',
  teal:   'bg-teal-700   hover:bg-teal-600',
  gray:   'bg-gray-600   hover:bg-gray-500',
  amber:  'bg-amber-600  hover:bg-amber-500',
};
function FnKey({ fn, label, color = 'gray', onClick, disabled = false, large = false, badge }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={large ? {} : { paddingTop: '15px', paddingBottom: '15px' }}
      className={`relative flex items-center w-full text-left font-bold text-white transition-colors disabled:opacity-30
        ${large ? 'gap-3 px-4 py-3 rounded text-xl flex-1' : 'gap-2 px-3 rounded text-sm'}
        ${FN_COLORS[color] || FN_COLORS.gray}`}>
      <span className={`bg-white text-gray-900 font-mono rounded text-center shrink-0
        ${large ? 'px-2 py-1 text-sm min-w-[44px]' : 'px-1 text-xs min-w-[30px]'}`}>
        {fn}
      </span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-semibold bg-white/20 rounded px-1 py-0.5 shrink-0 leading-none">{badge}</span>
      )}
    </button>
  );
}

// ── Modal buscador ─────────────────────────────────────────────────────────
function BuscadorModal({ textoPrevio = '', onSeleccionar, onCerrar }) {
  const [busqueda, setBusqueda] = useState(textoPrevio);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando]   = useState(true);
  const [selecIdx, setSelecIdx]   = useState(0);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => {
    api.get('/productos?limite=300')
      .then(d => setProductos(d.productos || []))
      .catch(() => toast.error('Error cargando productos'))
      .finally(() => setCargando(false));
  }, []);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const resultados = (() => {
    if (cargando) return { coincidencias: [], sugerencias: [] };
    const scored = productos
      .map(p => ({ ...p, _score: puntaje(p, busqueda) }))
      .filter(p => p._score >= 10)
      .sort((a, b) => b._score - a._score);
    return {
      coincidencias: scored.filter(p => p._score >= 40),
      sugerencias:   scored.filter(p => p._score < 40),
    };
  })();
  const todas = [...resultados.coincidencias, ...resultados.sugerencias];

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelecIdx(i => Math.min(i + 1, todas.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelecIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && todas[selecIdx]) onSeleccionar(todas[selecIdx]);
    else if (e.key === 'Escape') onCerrar();
  };

  // Escape global — funciona sin importar dónde esté el foco
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar]);

  useEffect(() => { setSelecIdx(0); }, [busqueda]);
  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${selecIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selecIdx]);

  const tarjeta = (prod, idx, esSugerencia) => (
    <button key={prod.id} data-idx={idx} onClick={() => onSeleccionar(prod)}
      onMouseEnter={() => setSelecIdx(idx)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl mb-1 transition-colors
        ${idx === selecIdx ? 'bg-blue-700 ring-2 ring-blue-400' : 'bg-gray-800 hover:bg-gray-700'}
        ${esSugerencia ? 'opacity-75' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0
        ${prod.es_pesable ? 'bg-yellow-700' : 'bg-indigo-700'}`}>
        {prod.es_pesable ? <Scale className="w-4 h-4 text-white" /> : <Package className="w-4 h-4 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white truncate">{prod.nombre}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400 font-mono">{prod.codigo}</span>
          {prod.categoria_nombre && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 rounded">{prod.categoria_nombre}</span>}
          {prod.es_pesable && <span className="text-xs bg-yellow-800 text-yellow-300 px-1.5 rounded">kg</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-green-400 text-sm">{formatCOP(prod.precio_venta)}</p>
        <p className="text-xs text-gray-500">stock: {prod.stock}</p>
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/85 flex items-start justify-center z-50 pt-12 px-4 pb-4">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 6rem)' }}>
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-400 shrink-0" />
          <input ref={inputRef} type="text" value={busqueda}
            onChange={e => setBusqueda(e.target.value)} onKeyDown={handleKey}
            placeholder="Buscar por nombre, código o categoría..."
            className="flex-1 bg-transparent text-white text-lg placeholder-gray-500 focus:outline-none" />
          {busqueda && <button onClick={() => setBusqueda('')} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>}
          <button onClick={onCerrar} className="text-gray-500 hover:text-red-400 ml-1"><X className="w-6 h-6" /></button>
        </div>
        <div className="px-4 py-1.5 bg-gray-800/50 text-xs text-gray-400">
          {cargando ? 'Cargando...' : `${todas.length} producto(s) · ↑↓ navegar · Enter seleccionar · Esc cerrar`}
        </div>
        <div ref={listaRef} className="flex-1 overflow-y-auto p-3">
          {cargando && <div className="flex items-center justify-center py-12 text-gray-500"><div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />Cargando...</div>}
          {!cargando && todas.length === 0 && <div className="flex flex-col items-center py-12 text-gray-500"><Package className="w-12 h-12 mb-3 opacity-30" /><p>Sin resultados para "{busqueda}"</p></div>}
          {!cargando && todas.length > 0 && <>
            {resultados.coincidencias.length > 0 && <div className="mb-3">
              {busqueda && <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide px-1 mb-2">Coincidencias</p>}
              {resultados.coincidencias.map((p, i) => tarjeta(p, i, false))}
            </div>}
            {resultados.sugerencias.length > 0 && busqueda && <div>
              <p className="text-xs font-semibold text-yellow-500 uppercase tracking-wide px-1 mb-2">¿Quisiste decir...?</p>
              {resultados.sugerencias.map((p, i) => tarjeta(p, resultados.coincidencias.length + i, true))}
            </div>}
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Modal pesable ──────────────────────────────────────────────────────────
function PesableModal({ producto, onConfirmar, onCancelar, onPesoChange }) {
  const [peso, setPeso] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const pesoNum  = parseFloat(peso.replace(',', '.')) || 0;
  const subtotal = pesoNum * producto.precio_venta;

  const handleChange = (e) => { setPeso(e.target.value); onPesoChange?.(e.target.value); };
  const confirmar = () => {
    if (!pesoNum || pesoNum <= 0) return toast.error('Ingresa el peso correcto');
    onConfirmar(pesoNum);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-yellow-500 text-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-base leading-tight">{producto.nombre}</p>
            <p className="text-yellow-400 text-sm">Producto pesable</p>
          </div>
        </div>
        <div className="px-5 pt-4 pb-2 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Precio por kilogramo</p>
          <p className="text-3xl font-bold text-yellow-300">{formatCOP(producto.precio_venta)}<span className="text-base font-normal text-gray-400"> / kg</span></p>
        </div>
        <div className="px-5 pb-3">
          <p className="text-sm text-gray-300 mb-2 text-center">Ingresa el peso que muestra la gramera</p>
          <input ref={inputRef} type="number" step="0.001" min="0.001"
            value={peso} onChange={handleChange}
            onKeyDown={e => e.key === 'Enter' && confirmar()}
            placeholder="0.000"
            className="w-full bg-gray-800 text-white text-4xl font-bold border-2 border-yellow-500 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center" />
          <p className="text-xs text-gray-500 text-center mt-1">Ejemplo: 0.850 para 850 gramos</p>
        </div>
        <div className="mx-5 mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">PESO</p>
            <p className="text-lg font-bold">{pesoNum > 0 ? pesoNum.toFixed(3) : '—'}</p>
            <p className="text-xs text-gray-500">kg</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3 flex items-center justify-center">
            <p className="text-2xl text-gray-500">×</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">PRECIO/KG</p>
            <p className="text-lg font-bold">{formatCOP(producto.precio_venta)}</p>
          </div>
        </div>
        <div className={`mx-5 mb-5 rounded-xl p-4 text-center transition-colors ${pesoNum > 0 ? 'bg-green-900 border-2 border-green-500' : 'bg-gray-800'}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">TOTAL A COBRAR</p>
          <p className={`text-3xl font-bold ${pesoNum > 0 ? 'text-green-300' : 'text-gray-600'}`}>
            {pesoNum > 0 ? formatCOP(subtotal) : '$ —'}
          </p>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onCancelar} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors">Cancelar</button>
          <button onClick={confirmar} disabled={pesoNum <= 0}
            className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Impresión de recibo en impresora POS (80mm / 58mm) ─────────────────────
function imprimirReciboPOS(venta, nombreNegocio = 'SUPERMERCADO') {
  if (!venta) return;

  const fCOP = v => '$' + Math.round(v || 0).toLocaleString('es-CO');
  const W = 40; // ancho en caracteres
  const sep  = '─'.repeat(W);
  const sep2 = '═'.repeat(W);
  const center = (txt) => {
    const pad = Math.max(0, Math.floor((W - txt.length) / 2));
    return ' '.repeat(pad) + txt;
  };
  const line = (l, r) => {
    const space = W - l.length - r.length;
    return l + (space > 0 ? ' '.repeat(space) : ' ') + r;
  };
  const wrap = (txt, maxLen) => {
    if (txt.length <= maxLen) return [txt];
    const words = txt.split(' ');
    const lines2 = [];
    let cur = '';
    words.forEach(w => {
      if ((cur + ' ' + w).trim().length <= maxLen) { cur = (cur + ' ' + w).trim(); }
      else { if (cur) lines2.push(cur); cur = w; }
    });
    if (cur) lines2.push(cur);
    return lines2;
  };

  const METODO = { efectivo:'Efectivo', credito:'Credito/Cupo', nequi:'Nequi', daviplata:'Daviplata', transferencia:'Transferencia' };

  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  const horaStr  = ahora.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });

  const rows = [];
  const add = (t = '') => rows.push(t);

  add(sep2);
  add(center(nombreNegocio.toUpperCase()));
  add(center('FACTURA DE VENTA'));
  add(sep2);
  add(line('Factura:', venta.numero_factura || '—'));
  add(line('Fecha:', fechaStr + '  ' + horaStr));
  if (venta.cajero_nombre) add(line('Cajero:', venta.cajero_nombre.toUpperCase()));
  if (venta.cliente_nombre) add(line('Cliente:', venta.cliente_nombre.toUpperCase()));
  add(line('Metodo pago:', METODO[venta.metodo_pago] || venta.metodo_pago || '—'));
  add(sep);

  // Encabezado columnas
  add('PRODUCTO'.padEnd(22) + 'CANT'.padStart(5) + 'SUBTOTAL'.padStart(13));
  add(sep);

  // Items
  const items = venta.items || [];
  items.forEach(item => {
    const nombre = item.producto_nombre || item.nombre || 'Producto';
    const cant   = parseFloat(item.cantidad);
    const sub    = parseFloat(item.subtotal || 0);
    const cantStr = cant % 1 !== 0 ? cant.toFixed(3) : String(cant);
    const subStr  = fCOP(sub);

    // Nombre puede ser largo — partir en varias líneas si hace falta
    const nombreLineas = wrap(nombre, 22);
    nombreLineas.forEach((ln, i) => {
      if (i === 0) {
        const disponible = W - cantStr.length - subStr.length - 2;
        const nombrePad  = ln.padEnd(Math.max(disponible, 1));
        add(nombrePad + cantStr.padStart(Math.max(W - disponible - subStr.length, 1)) + subStr.padStart(subStr.length + 1));
      } else {
        add('  ' + ln);
      }
    });

    // Precio unitario y descuento
    const precioU = parseFloat(item.precio_unitario || 0);
    add('  ' + fCOP(precioU) + ' c/u' + (item.descuento_item > 0 ? '  Desc: ' + fCOP(item.descuento_item) : ''));
  });

  add(sep);

  // Totales
  const subtotalBruto = items.reduce((s, i) => s + (i.precio_unitario * i.cantidad), 0);
  const totalDescuentos = items.reduce((s, i) => s + (parseFloat(i.descuento_item) || 0), 0);
  const ivaTotal = parseFloat(venta.iva_total || 0);
  const total    = parseFloat(venta.total || 0);

  if (totalDescuentos > 0) {
    add(line('Subtotal:', fCOP(subtotalBruto)));
    add(line('Descuentos:', '- ' + fCOP(totalDescuentos)));
  }
  if (ivaTotal > 0) add(line('IVA:', fCOP(ivaTotal)));
  add(sep);
  add(line('TOTAL:', fCOP(total)));
  add(sep2);

  if (venta.metodo_pago === 'efectivo') {
    const recibido = parseFloat(venta.monto_recibido || 0);
    const cambio   = parseFloat(venta.cambio || 0);
    if (recibido > 0) add(line('Recibido:', fCOP(recibido)));
    if (cambio  > 0) add(line('CAMBIO:', fCOP(cambio)));
    add(sep);
  }

  if (venta.metodo_pago === 'credito') {
    add('');
    add(center('*** VENTA A CREDITO ***'));
    add(center('Pendiente de pago'));
    add(sep);
  }

  add('');
  add(center('¡Gracias por su compra!'));
  add(center('Vuelva pronto'));
  add('');
  add(sep2);

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Recibo ${venta.numero_factura}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.5;
    width: 72mm;
    padding: 4mm 3mm;
    color: #000;
    background: #fff;
  }
  pre { white-space: pre-wrap; word-break: break-all; font-family: inherit; font-size: inherit; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body  { width: 72mm; }
  }
</style>
</head><body>
<pre>${rows.join('\n')}</pre>
<script>window.onload = function(){ window.print(); setTimeout(() => window.close(), 800); }<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=340,height=700,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Modal recibo S/N con cuenta regresiva ──────────────────────────────────
function ReciboModal({ venta, onClose, countdownInicial = 10, autoImprimir = false, nombreNegocio = 'SUPERMERCADO' }) {
  const inputRef  = useRef(null);
  const closeRef  = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // progreso: de 1.0 (inicio) a 0.0 (fin) — se actualiza cada 50ms basado en tiempo real
  const [progreso, setProgreso] = useState(1);
  const segundos = Math.ceil(progreso * countdownInicial);
  useEffect(() => { inputRef.current?.focus(); }, []);
  // Auto-imprimir si está configurado
  useEffect(() => { if (autoImprimir) { imprimirReciboPOS(venta, nombreNegocio); closeRef.current(); } }, [autoImprimir]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fin = Date.now() + countdownInicial * 1000;
    const iv = setInterval(() => {
      const restante = fin - Date.now();
      if (restante <= 0) { clearInterval(iv); closeRef.current(); return; }
      setProgreso(restante / (countdownInicial * 1000));
    }, 50);
    return () => clearInterval(iv);
  // countdownInicial no cambia tras montarse, onClose está en ref — efecto corre solo una vez
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKey = (e) => {
    const t = e.key.toLowerCase();
    if (t === 's') { imprimirReciboPOS(venta, nombreNegocio); onClose(); }
    else if (t === 'n' || t === 'enter' || t === 'escape') onClose();
  };

  const radio = 20, circ = 2 * Math.PI * radio;
  const dashOffset = circ * (1 - progreso);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <input ref={inputRef} onKeyDown={handleKey} className="absolute opacity-0 w-0 h-0" readOnly />
      <div className="bg-gray-900 border-2 border-green-500 text-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6 text-center border-b border-gray-700">
          <p className="text-4xl mb-2">✅</p>
          <h2 className="text-2xl font-bold text-green-400">¡Venta completada!</h2>
          <p className="text-gray-400 text-sm mt-1">{venta.numero_factura}</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex justify-between items-center bg-gray-800 rounded-xl px-4 py-3">
            <span className="text-gray-300">Total cobrado</span>
            <span className="text-xl font-bold">{formatCOP(venta.total)}</span>
          </div>
          {venta.cambio > 0 && (
            <div className="flex justify-between items-center bg-green-900 border border-green-600 rounded-xl px-4 py-3">
              <span className="text-green-300 font-medium">Cambio a devolver</span>
              <span className="text-2xl font-bold text-green-300">{formatCOP(venta.cambio)}</span>
            </div>
          )}
        </div>
        <div className="mx-5 mb-5 p-4 bg-blue-900 border border-blue-500 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-300 mb-1">¿Imprimir recibo?</p>
              <p className="text-3xl font-bold tracking-widest text-white">
                <span className="text-green-400">S</span>
                <span className="text-gray-500 text-xl mx-2">/</span>
                <span className="text-red-400">N</span>
              </p>
              <p className="text-xs text-blue-400 mt-1">S = imprimir · N = continuar</p>
            </div>
            <div className="flex flex-col items-center">
              <svg width="52" height="52" className="-rotate-90">
                <circle cx="26" cy="26" r={radio} fill="none" stroke="#1e3a5f" strokeWidth="4" />
                <circle cx="26" cy="26" r={radio} fill="none"
                  stroke={segundos <= 3 ? '#ef4444' : '#60a5fa'} strokeWidth="4"
                  strokeDasharray={circ} strokeDashoffset={dashOffset} strokeLinecap="round" />
              </svg>
              <p className={`text-2xl font-bold -mt-12 text-center ${segundos <= 3 ? 'text-red-400' : 'text-blue-300'}`}
                style={{ position: 'relative', top: '-38px', width: '52px' }}>{segundos}</p>
              <p className="text-xs text-gray-500 -mt-5">seg</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={() => { imprimirReciboPOS(venta, nombreNegocio); onClose(); }}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl text-lg transition-colors flex items-center justify-center gap-2">
            <Printer className="w-5 h-5" /> S — Sí
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl text-lg transition-colors">
            N — No
          </button>
        </div>
      </div>
    </div>
  );
}

const METODOS_PAGO = [
  { id: 'efectivo',      label: 'Efectivo',       icon: <Banknote className="w-5 h-5" /> },
  { id: 'tarjeta',       label: 'Tarjeta',         icon: <CreditCard className="w-5 h-5" /> },
  { id: 'transferencia', label: 'Nequi/Daviplata', icon: <Smartphone className="w-5 h-5" /> },
  { id: 'credito',       label: 'Crédito/Fiado',  icon: <span className="text-lg font-bold">📋</span> },
];

// ── Modal Facturas Anteriores ───────────────────────────────────────────────
function toLocalDate(str) {
  // Convierte fecha UTC de SQLite a fecha local YYYY-MM-DD
  if (!str) return '';
  const d = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('en-CA'); // formato YYYY-MM-DD en locale
}

// ── Modal Descuento a Producto ───────────────────────────────────────────────
function DescuentoModal({ carrito, onAplicar, onCerrar }) {
  const [itemIdx, setItemIdx]   = useState(0);
  const [modo, setModo]         = useState(null); // null | 'porcentaje' | 'valor'
  const [input, setInput]       = useState('');
  const inputRef                = useRef(null);

  const item = carrito[itemIdx] || null;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (modo) { setModo(null); setInput(''); }
        else onCerrar();
        return;
      }
      if (!modo) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setItemIdx(i => Math.min(i + 1, carrito.length - 1)); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); setItemIdx(i => Math.max(i - 1, 0)); }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); setModo('porcentaje'); setTimeout(() => inputRef.current?.focus(), 50); }
        if (e.key === 'v' || e.key === 'V') { e.preventDefault(); setModo('valor'); setTimeout(() => inputRef.current?.focus(), 50); }
      } else {
        if (e.key === 'Enter') { e.preventDefault(); aplicar(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modo, carrito, itemIdx, input]);

  const aplicar = () => {
    if (!item || !modo) return;
    const num = parseFloat((input || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (num <= 0) { toast.error('Ingresa un valor'); return; }
    if (modo === 'porcentaje' && num > 100) { toast.error('El porcentaje no puede superar 100%'); return; }
    const descuento = modo === 'porcentaje'
      ? Math.round(item.precio_unitario * item.cantidad * (num / 100))
      : Math.min(num, item.precio_unitario * item.cantidad);
    onAplicar(item.producto_id, descuento, modo, num);
    onCerrar();
  };

  const precioOriginal = item ? item.precio_unitario * item.cantidad : 0;
  const descuentoPreview = (() => {
    const num = parseFloat((input || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (!modo || !num) return 0;
    return modo === 'porcentaje'
      ? Math.round(precioOriginal * (num / 100))
      : Math.min(num, precioOriginal);
  })();

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏷️</span>
            <div>
              <h2 className="font-bold text-white text-lg">Aplicar Descuento</h2>
              <p className="text-xs text-gray-400">Selecciona producto · P=% · V=Valor</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Lista productos */}
        <div className="p-4 space-y-2 max-h-56 overflow-y-auto">
          {carrito.map((it, i) => (
            <button key={it.producto_id} onClick={() => setItemIdx(i)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors ${
                i === itemIdx
                  ? 'bg-green-700/40 border-green-500 text-white'
                  : 'bg-gray-800 border-gray-700 hover:border-green-500 text-gray-300'
              }`}>
              <span className="font-medium text-sm truncate">{it.nombre}</span>
              <span className="font-mono text-sm shrink-0 ml-3">
                ${Math.round(it.precio_unitario * it.cantidad).toLocaleString('es-CO')}
                {it.descuento_item > 0 && <span className="text-green-400 ml-2">-${it.descuento_item.toLocaleString('es-CO')}</span>}
              </span>
            </button>
          ))}
        </div>

        {/* Selector de modo */}
        {!modo && item && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-3">
            <button onClick={() => { setModo('porcentaje'); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex flex-col items-center gap-1 py-4 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors">
              <span className="text-2xl">%</span>
              <span className="text-sm">Porcentaje <span className="opacity-60">[P]</span></span>
            </button>
            <button onClick={() => { setModo('valor'); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="flex flex-col items-center gap-1 py-4 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-xl transition-colors">
              <span className="text-2xl">$</span>
              <span className="text-sm">Valor fijo <span className="opacity-60">[V]</span></span>
            </button>
          </div>
        )}

        {/* Input de descuento */}
        {modo && item && (
          <div className="px-4 pb-4 space-y-3">
            <p className="text-xs text-gray-400 text-center">
              Producto: <span className="text-white font-semibold">{item.nombre}</span> — Total: ${Math.round(precioOriginal).toLocaleString('es-CO')}
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">
                {modo === 'porcentaje' ? '%' : '$'}
              </span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setInput(digits ? parseInt(digits).toLocaleString('es-CO') : '');
                }}
                placeholder="0"
                className="w-full bg-gray-800 border border-gray-600 focus:border-green-500 rounded-xl pl-10 pr-4 py-3 text-white text-2xl font-bold font-mono text-right focus:outline-none"
              />
            </div>
            {descuentoPreview > 0 && (
              <div className="bg-gray-800 rounded-xl px-4 py-2 flex justify-between text-sm">
                <span className="text-gray-400">Precio final:</span>
                <span className="text-green-400 font-bold">${Math.round(precioOriginal - descuentoPreview).toLocaleString('es-CO')}
                  <span className="text-gray-500 line-through ml-2 text-xs">${Math.round(precioOriginal).toLocaleString('es-CO')}</span>
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setModo(null); setInput(''); }}
                className="py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors">
                ← Volver
              </button>
              <button onClick={aplicar}
                className="py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors">
                ✓ Aplicar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Abono Cliente ──────────────────────────────────────────────────────
function AbonoClienteModal({ clienteInicial = null, onCerrar }) {
  const [busqueda, setBusqueda]         = useState('');
  const [clientes, setClientes]         = useState([]);
  const [clienteSel, setClienteSel]     = useState(clienteInicial);
  const [deuda, setDeuda]               = useState(null);  // { cliente, creditos, abonos_recientes }
  const [expandido, setExpandido]       = useState({});    // creditoId → bool
  const [valor, setValor]               = useState('');
  const [descripcion, setDescripcion]   = useState('');
  const [guardando, setGuardando]       = useState(false);
  const [listaIdx, setListaIdx]         = useState(-1);
  const guardandoRef                    = useRef(false);
  const busquedaRef                     = useRef(null);
  const valorRef                        = useRef(null);

  // Cargar clientes con deuda
  const buscarClientes = useCallback(async (q) => {
    try {
      const res = await api.get(`/clientes?busqueda=${encodeURIComponent(q)}`);
      setClientes((res || []).filter(c => c.deuda_total > 0));
    } catch { setClientes([]); }
  }, []);

  useEffect(() => { buscarClientes(''); }, [buscarClientes]);

  useEffect(() => {
    const t = setTimeout(() => buscarClientes(busqueda), 250);
    return () => clearTimeout(t);
  }, [busqueda, buscarClientes]);

  // Cargar deuda del cliente seleccionado
  useEffect(() => {
    if (!clienteSel) return;
    setDeuda(null);
    api.get(`/clientes/${clienteSel.id}/deuda`)
      .then(d => { setDeuda(d); setTimeout(() => valorRef.current?.focus(), 80); })
      .catch(err => toast.error(err?.error || err?.message || 'Error al cargar deuda'));
  }, [clienteSel]);

  // Si hay clienteInicial, seleccionarlo directo
  useEffect(() => { if (clienteInicial) setClienteSel(clienteInicial); }, [clienteInicial]);

  // Teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCerrar(); return; }
      // Navegación con flechas en la lista de clientes
      if (!clienteSel) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setListaIdx(i => Math.min(i + 1, clientes.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setListaIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && listaIdx >= 0 && clientes[listaIdx]) {
          e.preventDefault();
          setClienteSel(clientes[listaIdx]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, clienteSel, clientes, listaIdx]);

  const confirmarAbono = async () => {
    if (guardandoRef.current) return;
    const valorNum = parseFloat((valor || '0').replace(/\./g, '').replace(',', '.')) || 0;
    if (!valorNum || valorNum <= 0) { toast.error('Ingresa un valor válido'); return; }
    if (!clienteSel) { toast.error('Selecciona un cliente'); return; }
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const r = await api.post(`/clientes/${clienteSel.id}/abono`, { valor: valorNum, descripcion });
      toast.success(`✅ Abono de $${valorNum.toLocaleString('es-CO')} registrado`);
      // Actualizar vista
      setClienteSel(r.cliente);
      setValor('');
      setDescripcion('');
      api.get(`/clientes/${clienteSel.id}/deuda`).then(setDeuda);
    } catch (err) {
      toast.error(err?.error || 'Error al registrar abono');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const valorNum = parseFloat((valor || '0').replace(/\./g, '').replace(',', '.')) || 0;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-3">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h2 className="font-bold text-white text-lg">Abono a Cliente</h2>
              <p className="text-xs text-gray-400">Registra pagos de deuda y actualiza el cupo</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Panel izquierdo — lista de clientes */}
          {!clienteSel && (
            <div className="flex flex-col w-full p-4 gap-3">
              <input
                ref={busquedaRef}
                autoFocus
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o cédula..."
                className="w-full bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none"
              />
              <div className="overflow-y-auto flex-1 space-y-2">
                {clientes.length === 0 && (
                  <div className="text-center text-gray-500 py-8">No hay clientes con deuda pendiente</div>
                )}
                {clientes.map((c, i) => (
                  <button key={c.id} onClick={() => setClienteSel(c)}
                    className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-colors text-left ${
                      i === listaIdx
                        ? 'bg-amber-700/40 border-amber-500 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-amber-500'
                    }`}>
                    <div>
                      <p className="font-bold text-white">{c.nombre}</p>
                      {c.cedula && <p className="text-xs text-gray-400">CC {c.cedula}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Deuda</p>
                      <p className="text-amber-400 font-bold">${Math.round(c.deuda_total).toLocaleString('es-CO')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Panel derecho — detalle + abono */}
          {clienteSel && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Info cliente */}
              <div className="px-5 py-3 border-b border-gray-700 shrink-0 flex items-center justify-between">
                <div>
                  <button onClick={() => { setClienteSel(null); setDeuda(null); setValor(''); }}
                    className="text-xs text-blue-400 hover:text-blue-300 mb-1">← Cambiar cliente</button>
                  <p className="font-bold text-white text-base">{clienteSel.nombre}</p>
                  {clienteSel.cedula && <p className="text-xs text-gray-400">CC {clienteSel.cedula}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Deuda total</p>
                  <p className="text-2xl font-bold text-amber-400">${Math.round(clienteSel.deuda_total || 0).toLocaleString('es-CO')}</p>
                </div>
              </div>

              {/* Créditos / compras */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                {!deuda && <p className="text-gray-500 text-sm text-center py-4">Cargando...</p>}
                {deuda?.creditos?.length === 0 && (
                  <div className="text-center text-green-400 py-6">
                    <p className="text-2xl mb-1">✅</p>
                    <p className="font-bold">Sin deuda pendiente</p>
                  </div>
                )}
                {deuda?.creditos?.map(cr => (
                  <div key={cr.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <button onClick={() => setExpandido(p => ({ ...p, [cr.id]: !p[cr.id] }))}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-750 transition-colors">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-gray-400 text-xs">{expandido[cr.id] ? '▾' : '▸'}</span>
                        <div>
                          <p className="text-white text-sm font-semibold">Factura #{cr.numero_factura}</p>
                          <p className="text-xs text-gray-400">{new Date(cr.fecha_hora).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Saldo</p>
                        <p className="font-bold text-red-400">${Math.round(cr.saldo_pendiente).toLocaleString('es-CO')}</p>
                      </div>
                    </button>
                    {expandido[cr.id] && (
                      <div className="border-t border-gray-700 px-4 py-2 space-y-1">
                        {cr.items.map((it, i) => (
                          <div key={i} className="flex justify-between text-xs text-gray-400">
                            <span>{it.cantidad % 1 === 0 ? it.cantidad : it.cantidad.toFixed(3)} × {it.producto_nombre}</span>
                            <span className="text-gray-300">${Math.round(it.subtotal).toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-xs font-bold text-gray-300 pt-1 border-t border-gray-700">
                          <span>Total factura</span>
                          <span>${Math.round(cr.total_venta).toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Formulario abono */}
              {(deuda?.creditos?.length ?? 1) > 0 && (
                <div className="px-5 py-4 border-t border-gray-700 shrink-0 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 font-semibold uppercase block mb-1">Valor del abono *</label>
                      <input
                        ref={valorRef}
                        type="text"
                        value={valor}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '');
                          setValor(digits ? parseInt(digits).toLocaleString('es-CO') : '');
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarAbono(); } }}
                        placeholder="$0"
                        className="w-full bg-gray-800 border border-gray-600 focus:border-green-500 rounded-xl px-3 py-2.5 text-white text-xl font-bold font-mono text-right focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 font-semibold uppercase block mb-1">Descripción</label>
                      <input
                        type="text"
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                        placeholder="Opcional"
                        className="w-full bg-gray-800 border border-gray-600 focus:border-green-500 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  {valorNum > 0 && (
                    <p className="text-xs text-gray-400">
                      Deuda restante tras abono:&nbsp;
                      <span className={`font-bold ${(clienteSel.deuda_total - valorNum) <= 0 ? 'text-green-400' : 'text-amber-400'}`}>
                        ${Math.max(0, Math.round(clienteSel.deuda_total - valorNum)).toLocaleString('es-CO')}
                      </span>
                    </p>
                  )}
                  <button
                    onClick={confirmarAbono}
                    disabled={guardando || !valorNum}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-xl transition-colors">
                    {guardando ? 'Registrando...' : `✓ Registrar Abono${valorNum ? ` $${valorNum.toLocaleString('es-CO')}` : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal opciones cliente asignado ─────────────────────────────────────────
function OpcionesClienteModal({ cliente, onCambiar, onQuitar, onCerrar }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
      if (e.key === '1')      { e.preventDefault(); onCambiar(); }
      if (e.key === '2')      { e.preventDefault(); onQuitar(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, onCambiar, onQuitar]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Cabecera */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg">👤</div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Cliente asignado</p>
            <p className="font-bold text-white text-base truncate">{cliente.nombre}</p>
            {cliente.cedula && <p className="text-xs text-gray-400">CC {cliente.cedula}</p>}
          </div>
        </div>

        {/* Opciones */}
        <div className="p-4 space-y-3">
          <button
            onClick={onCambiar}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors text-sm">
            <span className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center text-xs font-bold shrink-0">1</span>
            🔄 Seleccionar otro cliente
          </button>
          <button
            onClick={onQuitar}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-800 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-sm">
            <span className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center text-xs font-bold shrink-0">2</span>
            ✖ Quitar cliente
          </button>
          <button
            onClick={onCerrar}
            className="w-full px-4 py-2 text-gray-400 hover:text-gray-200 text-sm transition-colors">
            Esc — Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Gastos / Recogida de caja ────────────────────────────────────────
const TIPOS_GASTO = [
  { id: 'proveedor', label: 'Pago a Proveedor', icon: '🏭' },
  { id: 'nomina',    label: 'Pago de Nómina',   icon: '👷' },
  { id: 'personal',  label: 'Pago Personal',    icon: '👤' },
  { id: 'recogida',  label: 'Recogida de Caja', icon: '💰' },
];

function GastosModal({ onCerrar }) {
  const hoy = new Date().toLocaleDateString('en-CA');
  const [gastos, setGastos]           = useState([]);
  const [totalDia, setTotalDia]       = useState(0);
  const [cargando, setCargando]       = useState(true);
  const [vistaForm, setVistaForm]     = useState(false);
  const [tipo, setTipo]               = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [valor, setValor]             = useState('');
  const [guardando, setGuardando]     = useState(false);
  const guardandoRef                  = useRef(false);
  const valorRef                      = useRef(null);

  const cargarGastos = () => {
    setCargando(true);
    api.get(`/gastos?fecha=${hoy}`)
      .then(d => { setGastos(d.gastos); setTotalDia(d.total); })
      .catch(() => toast.error('Error cargando gastos'))
      .finally(() => setCargando(false));
  };
  useEffect(() => { cargarGastos(); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (vistaForm) { setVistaForm(false); setTipo(''); setValor(''); setDescripcion(''); }
        else { onCerrar(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, vistaForm]);

  const guardarGasto = async () => {
    if (guardandoRef.current) return;
    if (!tipo) { toast.error('Selecciona el tipo de gasto'); return; }
    const valorNum = parseMonto(valor);
    if (!valorNum || valorNum <= 0) { toast.error('Ingresa un valor válido'); valorRef.current?.focus(); return; }
    guardandoRef.current = true;
    setGuardando(true);
    try {
      await api.post('/gastos', { tipo, descripcion, valor: valorNum });
      toast.success('✅ Gasto registrado');
      setVistaForm(false); setTipo(''); setValor(''); setDescripcion('');
      cargarGastos();
    } catch (err) {
      toast.error(err?.error || err?.message || 'Error al registrar gasto');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const tipoInfo = TIPOS_GASTO.find(t => t.id === tipo);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 pt-8 px-4 pb-4">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '84vh' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-3 shrink-0">
          <span className="text-xl">💸</span>
          <div className="flex-1">
            <h2 className="text-white font-bold text-base">{vistaForm ? 'Registrar Gasto' : 'Gastos del Día'}</h2>
            <p className="text-gray-400 text-xs">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <button onClick={onCerrar} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {vistaForm ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Tipo */}
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Tipo de gasto</p>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_GASTO.map(t => (
                  <button key={t.id} onClick={() => { setTipo(t.id); setTimeout(() => valorRef.current?.focus(), 50); }}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 font-bold text-sm transition-colors text-left ${
                      tipo === t.id
                        ? t.id === 'recogida' ? 'border-amber-500 bg-amber-900/40 text-amber-300'
                          : 'border-purple-500 bg-purple-900/40 text-purple-300'
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                    }`}>
                    <span className="text-xl">{t.icon}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Valor */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
                {tipo === 'recogida' ? 'Monto recogido ($)' : 'Valor ($)'}<span className="text-red-400 ml-1">*</span>
              </label>
              <input ref={valorRef} type="text" value={valor}
                onChange={e => setValor(formatearMonto(e.target.value))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardarGasto(); } }}
                placeholder="0"
                className="w-full bg-gray-800 text-white text-2xl font-mono text-right border-2 border-gray-600 focus:border-purple-500 rounded-xl px-4 py-3 focus:outline-none" />
            </div>
            {/* Descripción */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Descripción (opcional)</label>
              <input type="text" value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardarGasto(); } }}
                placeholder={tipo === 'recogida' ? 'Ej: Recogida 3pm' : 'Ej: Factura 456'}
                className="w-full bg-gray-800 text-white border border-gray-600 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
            </div>
            {/* Resumen */}
            {tipo && parseMonto(valor) > 0 && (
              <div className={`rounded-xl px-4 py-3 border ${tipo === 'recogida' ? 'bg-amber-900/20 border-amber-700' : 'bg-purple-900/20 border-purple-700'}`}>
                <p className="text-gray-400 text-xs mb-0.5">Se registrará:</p>
                <p className="text-white font-bold">{tipoInfo?.icon} {tipoInfo?.label} · ${parseMonto(valor).toLocaleString('es-CO')}</p>
              </div>
            )}
            {/* Botones */}
            <div className="flex gap-3">
              <button onClick={() => { setVistaForm(false); setTipo(''); setValor(''); setDescripcion(''); }}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors">← Cancelar</button>
              <button onClick={guardarGasto} disabled={guardando}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-colors">
                {guardando ? 'Guardando...' : '✓ Registrar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Resumen por tipo */}
            <div className="px-5 py-3 border-b border-gray-700 shrink-0 space-y-2">
              <div className="grid grid-cols-4 gap-2">
                {TIPOS_GASTO.map(t => {
                  const sub = gastos.filter(g => g.tipo === t.id).reduce((s, g) => s + g.valor, 0);
                  return (
                    <div key={t.id} className="bg-gray-800 rounded-lg px-2 py-2 text-center">
                      <p className="text-base">{t.icon}</p>
                      <p className="text-[10px] text-gray-400 leading-tight truncate">{t.label}</p>
                      <p className={`text-xs font-bold ${sub > 0 ? t.id === 'recogida' ? 'text-amber-400' : 'text-red-400' : 'text-gray-600'}`}>
                        {sub > 0 ? `$${sub.toLocaleString('es-CO')}` : '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{gastos.length} gasto(s) registrado(s) hoy</span>
                <span className="text-red-400 font-bold text-base">${totalDia.toLocaleString('es-CO')}</span>
              </div>
            </div>
            {/* Lista */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cargando && <p className="text-center text-gray-500 py-8">Cargando...</p>}
              {!cargando && gastos.length === 0 && <p className="text-center text-gray-500 py-8">Sin gastos hoy</p>}
              {!cargando && gastos.map(g => {
                const t = TIPOS_GASTO.find(t => t.id === g.tipo);
                return (
                  <div key={g.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${g.tipo === 'recogida' ? 'bg-amber-900/10 border-amber-800/60' : 'bg-gray-800 border-gray-700'}`}>
                    <span className="text-xl shrink-0">{t?.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{t?.label}</p>
                      {g.descripcion && <p className="text-gray-400 text-xs truncate">{g.descripcion}</p>}
                      <p className="text-gray-500 text-xs">{new Date(g.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {g.usuario_nombre}</p>
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${g.tipo === 'recogida' ? 'text-amber-400' : 'text-red-400'}`}>
                      −${g.valor.toLocaleString('es-CO')}
                    </p>
                  </div>
                );
              })}
            </div>
            {/* Botón agregar */}
            <div className="p-4 border-t border-gray-700 shrink-0">
              <button onClick={() => setVistaForm(true)}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors">
                + Registrar Gasto / Recogida de Caja
              </button>
              <p className="text-center text-gray-500 text-xs mt-1.5">Esc cerrar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal cantidad rápida (prefijo *) ──────────────────────────────────────
function CantidadRapidaModal({ producto, onConfirmar, onCerrar }) {
  const [cantidad, setCantidad] = useState('1');
  const inputRef = useRef(null);

  useEffect(() => {
    // Seleccionar todo el texto al abrir para sobreescribir rápido
    setTimeout(() => { inputRef.current?.select(); }, 40);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
      if (e.key === 'Enter')  { e.preventDefault(); confirmar(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidad]);

  const confirmar = () => {
    const cant = producto.es_pesable
      ? parseFloat((cantidad || '0').replace(',', '.')) || 0
      : parseInt(cantidad, 10) || 0;
    if (cant <= 0) { toast.error('La cantidad debe ser mayor a 0'); inputRef.current?.select(); return; }
    onConfirmar(cant);
  };

  const subtotal = producto.es_pesable
    ? (parseFloat((cantidad || '0').replace(',', '.')) || 0) * producto.precio_venta
    : (parseInt(cantidad, 10) || 0) * producto.precio_venta;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-blue-600 rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-700">
          <p className="text-xs text-blue-400 font-bold uppercase tracking-wide">Cantidad Rápida · *</p>
          <p className="text-white font-bold text-lg leading-tight mt-1">{producto.nombre.toUpperCase()}</p>
          <p className="text-gray-400 text-sm">${producto.precio_venta.toLocaleString('es-CO')} / {producto.unidad || 'ud'}</p>
        </div>
        {/* Input */}
        <div className="px-5 py-5 space-y-3">
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block">
            {producto.es_pesable ? 'Peso (kg)' : 'Cantidad'}
          </label>
          <input
            ref={inputRef}
            type={producto.es_pesable ? 'text' : 'number'}
            min={producto.es_pesable ? '0.001' : '1'}
            step={producto.es_pesable ? '0.001' : '1'}
            value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            className="w-full bg-gray-800 text-white text-3xl font-mono text-center border-2 border-blue-500 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {subtotal > 0 && (
            <p className="text-center text-blue-300 font-bold text-lg font-mono">
              = ${subtotal.toLocaleString('es-CO')}
            </p>
          )}
          <p className="text-center text-gray-500 text-xs">Enter para agregar · Esc cancelar</p>
        </div>
        {/* Botones */}
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onCerrar}
            className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors">
            Cancelar
          </button>
          <button onClick={confirmar}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
            ✓ Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function FacturasModal({ onCerrar, nombreNegocio = 'SUPERMERCADO' }) {
  const hoy = new Date().toLocaleDateString('en-CA');
  const [todas, setTodas]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [seleccionada, setSeleccionada] = useState(null);
  const [busqueda, setBusqueda]         = useState('');
  const [fecha, setFecha]               = useState(hoy);
  const [selecIdx, setSelecIdx]         = useState(0);
  const factListRef                     = useRef(null);

  useEffect(() => {
    // Carga todas las ventas recientes sin filtro de fecha (lo filtramos en el cliente)
    api.get('/ventas?limite=500')
      .then(d => setTodas(d.ventas || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // Reset selection when filter changes
  useEffect(() => { setSelecIdx(0); }, [busqueda, fecha]);

  // Auto-scroll selected row into view
  useEffect(() => {
    factListRef.current?.querySelector(`[data-idx="${selecIdx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selecIdx]);

  // Filtrar por fecha local + texto
  const filtradas = todas.filter(f => {
    const fechaVenta = toLocalDate(f.creado_en);
    const coincideFecha = fechaVenta === fecha;
    const coincideTexto = !busqueda ||
      f.numero_factura?.toLowerCase().includes(busqueda.toLowerCase()) ||
      f.cajero_nombre?.toLowerCase().includes(busqueda.toLowerCase());
    return coincideFecha && coincideTexto;
  });

  const totalDia = filtradas.reduce((s, f) => f.estado === 'completada' ? s + (f.total || 0) : s, 0);

  // Estado de devolución
  const [modoDevolucion, setModoDevolucion] = useState(null); // null | 'total' | 'parcial'
  const [cantDevolucion, setCantDevolucion] = useState({});   // { venta_item_id: cantidad }
  const [procesandoDev, setProcesandoDev]   = useState(false);

  const verDetalle = async (factura) => {
    try {
      const detalle = await api.get(`/ventas/${factura.id}`);
      setSeleccionada(detalle);
      setModoDevolucion(null);
      setCantDevolucion({});
    } catch { toast.error('No se pudo cargar el detalle'); }
  };

  const iniciarDevolucionParcial = () => {
    // Inicializa cantidades en 0
    const init = {};
    (seleccionada.items || []).forEach(it => { init[it.id] = 0; });
    setCantDevolucion(init);
    setModoDevolucion('parcial');
  };

  const procesarDevolucion = async (tipo) => {
    if (procesandoDev) return;
    setProcesandoDev(true);
    try {
      let body = { tipo };
      if (tipo === 'parcial') {
        const items = Object.entries(cantDevolucion)
          .filter(([, cant]) => cant > 0)
          .map(([venta_item_id, cantidad]) => ({ venta_item_id, cantidad: Number(cantidad) }));
        if (items.length === 0) { toast.error('Selecciona al menos un producto'); setProcesandoDev(false); return; }
        body.items = items;
      }
      const res = await api.post(`/ventas/${seleccionada.id}/devolucion`, body);
      const montoFmt = (res.monto_devuelto || 0).toLocaleString('es-CO');
      toast.success(`✅ ${res.mensaje || 'Devolución registrada'} · $${montoFmt} devueltos`);

      // Actualización optimista inmediata (para que la UI refleje el cambio aunque el refresh tarde)
      const estadoNuevo = tipo === 'total' ? 'devuelta' : seleccionada.estado;
      setSeleccionada(prev => prev ? { ...prev, estado: estadoNuevo } : prev);
      setModoDevolucion(null);
      setCantDevolucion({});

      // Luego refrescar desde el servidor para datos exactos
      try {
        const detalle = await api.get(`/ventas/${seleccionada.id}`);
        setSeleccionada(detalle);
        setTodas(prev => prev.map(v => v.id === detalle.id ? { ...v, estado: detalle.estado } : v));
      } catch {
        // Si el refresh falla, la UI igual refleja el cambio optimista — no mostrar error
      }
    } catch (err) {
      toast.error(err?.error || err?.message || 'Error al procesar devolución');
    } finally {
      setProcesandoDev(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (modoDevolucion) { setModoDevolucion(null); return; }
        if (seleccionada) { setSeleccionada(null); return; }
        onCerrar();
        return;
      }
      if (seleccionada || modoDevolucion) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelecIdx(i => Math.min(i + 1, filtradas.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelecIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { if (filtradas[selecIdx]) verDetalle(filtradas[selecIdx]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, seleccionada, modoDevolucion, filtradas, selecIdx]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-4xl border border-gray-600 shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-white">📋 Consulta de Facturas</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
        </div>

        {seleccionada ? (
          /* Detalle de factura */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Sub-header */}
            <div className="px-5 py-3 border-b border-gray-700 flex items-center gap-3 shrink-0">
              <button onClick={() => { if (modoDevolucion) { setModoDevolucion(null); } else { setSeleccionada(null); } }}
                className="text-blue-400 hover:text-blue-300 text-sm font-bold">← Volver</button>
              <span className="text-white font-bold">Factura #{seleccionada.numero_factura}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                seleccionada.estado === 'completada' ? 'bg-green-800 text-green-300' :
                seleccionada.estado === 'devuelta'   ? 'bg-orange-800 text-orange-300' :
                'bg-red-800 text-red-300'}`}>
                {seleccionada.estado?.toUpperCase()}
              </span>
              <span className="ml-auto text-gray-400 text-sm">{new Date(seleccionada.creado_en).toLocaleString('es-CO')}</span>
              <button
                onClick={() => imprimirReciboPOS(seleccionada, nombreNegocio)}
                className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                <Printer className="w-3.5 h-3.5"/> Imprimir
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-700 rounded p-3"><p className="text-gray-400 text-xs">Cajero</p><p className="text-white font-bold">{seleccionada.cajero_nombre?.toUpperCase()}</p></div>
                <div className="bg-gray-700 rounded p-3"><p className="text-gray-400 text-xs">Método de pago</p><p className="text-white font-bold capitalize">{seleccionada.metodo_pago}</p></div>
                <div className="bg-gray-700 rounded p-3"><p className="text-gray-400 text-xs">Total</p><p className="text-green-400 font-bold text-lg">${seleccionada.total?.toLocaleString('es-CO')}</p></div>
              </div>

              {/* Tabla de items */}
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                  <th className="text-left py-2">Producto</th>
                  <th className="text-right py-2">Cant</th>
                  <th className="text-right py-2">Precio/u</th>
                  <th className="text-right py-2">Subtotal</th>
                  {modoDevolucion === 'parcial' && <th className="text-right py-2 w-36"></th>}
                </tr></thead>
                <tbody>
                  {(seleccionada.items || []).map((it, i) => {
                    const cantDev    = parseFloat(it.cantidad_devuelta || 0);
                    const disponible = it.cantidad - cantDev;
                    const yaDevuelto = cantDev >= it.cantidad;
                    const seleccionado = (cantDevolucion[it.id] || 0) > 0;
                    return (
                    <tr key={i} className={`border-b border-gray-700/50 transition-colors ${
                      yaDevuelto ? 'opacity-50' : seleccionado ? 'bg-orange-900/20' : ''}`}>
                      <td className="py-2">
                        <span className="text-gray-100">{it.producto_nombre?.toUpperCase()}</span>
                        {cantDev > 0 && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-900/60 text-orange-300">
                            {yaDevuelto ? '✓ Dev. completa' : `${cantDev} dev.`}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-gray-300">
                        {it.cantidad}
                        {cantDev > 0 && <span className="text-orange-400 text-xs ml-1">(-{cantDev})</span>}
                      </td>
                      <td className="py-2 text-right text-gray-300">${it.precio_unitario?.toLocaleString('es-CO')}</td>
                      <td className="py-2 text-right font-bold text-white">${it.subtotal?.toLocaleString('es-CO')}</td>
                      {modoDevolucion === 'parcial' && (
                        <td className="py-2 text-right pl-3">
                          {yaDevuelto ? (
                            <span className="text-xs text-orange-400 font-bold px-3 py-1.5">✓ Devuelto</span>
                          ) : (
                            <button
                              onClick={() => setCantDevolucion(prev => ({
                                ...prev,
                                [it.id]: seleccionado ? 0 : disponible,
                              }))}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                                seleccionado
                                  ? 'bg-orange-500 hover:bg-orange-400 text-white'
                                  : 'bg-gray-700 hover:bg-orange-700 text-gray-300 hover:text-white'
                              }`}>
                              {seleccionado ? `✓ ${disponible} selecc.` : `↩ Devolver${disponible < it.cantidad ? ` (${disponible})` : ''}`}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Efectivo recibido/cambio */}
              {seleccionada.metodo_pago === 'efectivo' && (
                <div className="flex justify-end gap-6 text-sm text-gray-400">
                  <span>Recibido: <span className="text-white font-bold">${seleccionada.monto_recibido?.toLocaleString('es-CO')}</span></span>
                  <span>Cambio: <span className="text-green-400 font-bold">${seleccionada.cambio?.toLocaleString('es-CO')}</span></span>
                </div>
              )}

              {/* ── Sección devolución ── */}
              {seleccionada.estado === 'completada' && !modoDevolucion && (
                <div className="border-t border-gray-700 pt-4 flex gap-3">
                  <button onClick={iniciarDevolucionParcial}
                    className="flex-1 py-2.5 rounded-lg bg-orange-700 hover:bg-orange-600 text-white text-sm font-bold transition-colors">
                    ↩ Devolución Parcial
                  </button>
                  <button onClick={() => setModoDevolucion('total')}
                    className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors">
                    ↩ Devolución Total
                  </button>
                </div>
              )}

              {/* Confirmación devolución total */}
              {modoDevolucion === 'total' && (
                <div className="border border-red-600 bg-red-900/30 rounded-xl p-4 space-y-3">
                  <p className="text-red-300 font-bold text-sm">⚠️ Devolución Total — ${seleccionada.total?.toLocaleString('es-CO')}</p>
                  <p className="text-gray-400 text-xs">Se restaurará el stock de todos los productos y la factura quedará marcada como DEVUELTA.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setModoDevolucion(null)}
                      className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => procesarDevolucion('total')} disabled={procesandoDev}
                      className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                      {procesandoDev ? 'Procesando...' : '✓ Confirmar Devolución Total'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmación devolución parcial */}
              {modoDevolucion === 'parcial' && (
                <div className="border border-orange-600 bg-orange-900/20 rounded-xl p-4 space-y-3">
                  <p className="text-orange-300 font-bold text-sm">
                    Devolución Parcial · Total a devolver: $
                    {(seleccionada.items || []).reduce((s, it) => s + (cantDevolucion[it.id] || 0) * it.precio_unitario, 0).toLocaleString('es-CO')}
                  </p>
                  <p className="text-gray-400 text-xs">Selecciona los productos a devolver con el botón "↩ Devolver". El stock se restaurará automáticamente.</p>
                  <div className="flex gap-3">
                    <button onClick={() => setModoDevolucion(null)}
                      className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => procesarDevolucion('parcial')} disabled={procesandoDev}
                      className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                      {procesandoDev ? 'Procesando...' : '✓ Confirmar Devolución Parcial'}
                    </button>
                  </div>
                </div>
              )}

              {/* Venta ya devuelta */}
              {seleccionada.estado === 'devuelta' && (
                <div className="border border-orange-700 bg-orange-900/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-orange-300 font-bold text-sm">↩ Esta venta ya fue devuelta en su totalidad</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Lista de facturas */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filtros */}
            <div className="px-5 py-2 shrink-0 flex gap-2 items-center">
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por # factura o cajero..."
                className="flex-1 bg-gray-700 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus />
              <input type="date" value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {/* Resumen */}
            <div className="px-5 pb-1 shrink-0 flex gap-4 text-xs text-gray-400 border-b border-gray-700">
              <span>{filtradas.length} factura(s)</span>
              <span>Total del día: <span className="text-green-400 font-bold">${totalDia.toLocaleString('es-CO')}</span></span>
              <span className="ml-auto text-gray-600">↑↓ navegar · Enter ver detalle · Esc cerrar</span>
            </div>
            <div ref={factListRef} className="flex-1 overflow-y-auto">
              {cargando ? (
                <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
              ) : filtradas.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-500">No hay facturas</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                      <th className="text-left px-5 py-2"># Factura</th>
                      <th className="text-left px-3 py-2">Cajero</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-center px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((f, idx) => (
                      <tr key={f.id} data-idx={idx}
                        onClick={() => verDetalle(f)}
                        onMouseEnter={() => setSelecIdx(idx)}
                        className={`border-b border-gray-700/50 cursor-pointer transition-colors
                          ${idx === selecIdx ? 'bg-blue-800/50 ring-1 ring-inset ring-blue-500' : 'hover:bg-blue-900/30'}`}>
                        <td className="px-5 py-2.5 font-mono text-blue-400 font-bold">{f.numero_factura}</td>
                        <td className="px-3 py-2.5 text-gray-200">{f.cajero_nombre?.toUpperCase()}</td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{new Date(f.creado_en).toLocaleString('es-CO')}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-green-400">${f.total?.toLocaleString('es-CO')}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${f.estado === 'completada' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                            {f.estado?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal Consultar Precio ──────────────────────────────────────────────────
function ConsultaPrecioModal({ onAgregarAlCarrito, onCerrar }) {
  const [busqueda, setBusqueda]   = useState('');
  const [buscando, setBuscando]   = useState(false);
  const [producto, setProducto]   = useState(null);
  const [peso, setPeso]           = useState('');
  const [error, setError]         = useState('');
  const [agregado, setAgregado]   = useState(false);
  const inputRef = useRef(null);
  const pesoRef  = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pesoNum  = parseFloat((peso || '0').replace(',', '.')) || 0;
  const subtotal = producto
    ? (producto.es_pesable ? pesoNum * producto.precio_venta : producto.precio_venta)
    : 0;

  const buscarProducto = async () => {
    if (!busqueda.trim()) return;
    setBuscando(true); setError(''); setProducto(null); setPeso(''); setAgregado(false);
    try {
      const p = await api.get(`/productos/buscar?q=${encodeURIComponent(busqueda.trim())}`);
      setProducto(p);
      if (p.es_pesable) {
        setTimeout(() => pesoRef.current?.focus(), 60);
      } else {
        // Mover foco fuera del input para que S / N funcionen inmediatamente
        inputRef.current?.blur();
      }
    } catch {
      setError('Producto no encontrado. Intenta con otro código o nombre.');
    } finally { setBuscando(false); }
  };

  const handleAgregar = () => {
    if (!producto) return;
    if (producto.es_pesable && pesoNum <= 0) { toast.error('Ingresa el peso'); return; }
    onAgregarAlCarrito(producto, producto.es_pesable ? pesoNum : 1);
    setAgregado(true);
    // Cierra el modal tras una animación breve; el foco vuelve al lector de barras
    setTimeout(() => onCerrar(), 550);
  };

  // S = agregar, N/Esc = cerrar — solo activos cuando el producto está visible
  // y el foco NO está en el campo de código (para no interferir con la escritura)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (!producto) return;
      const enPeso = document.activeElement === pesoRef.current;
      const enCod  = document.activeElement === inputRef.current;
      if (!enCod) {
        if (e.key.toLowerCase() === 's') { e.preventDefault(); handleAgregar(); }
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); onCerrar(); }
      }
      // En el campo de peso: Enter = agregar
      if (enPeso && e.key === 'Enter') { e.preventDefault(); handleAgregar(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto, pesoNum, onCerrar]);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-indigo-500 text-white rounded-2xl w-full max-w-md shadow-2xl">

        {/* ── Encabezado ── */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight">Consultar Precio</p>
            <p className="text-indigo-400 text-xs">Escanea o escribe el código del producto</p>
          </div>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* ── Buscador ── */}
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setProducto(null); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && buscarProducto()}
              placeholder="Código de barras o nombre..."
              className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-500"
            />
            <button onClick={buscarProducto} disabled={buscando || !busqueda.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold px-4 rounded-xl transition-colors">
              {buscando
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Scan className="w-5 h-5" />}
            </button>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-900/40 border border-red-600 rounded-xl px-4 py-3 text-center text-red-300 text-sm">
              ❌ {error}
            </div>
          )}

          {/* ── Éxito al agregar ── */}
          {agregado && (
            <div className="bg-green-900/60 border border-green-500 rounded-xl px-4 py-3 text-center text-green-300 font-bold text-base animate-pulse">
              ✅ ¡Agregado a la factura!
            </div>
          )}

          {/* ── Ficha del producto ── */}
          {producto && !agregado && (
            <div className="space-y-3">

              {/* Card del producto */}
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-600">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-gray-400 uppercase">{producto.codigo}</p>
                    <p className="font-bold text-lg leading-tight mt-0.5">{producto.nombre.toUpperCase()}</p>
                    {producto.categoria_nombre && (
                      <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded mt-1 inline-block">{producto.categoria_nombre}</span>
                    )}
                  </div>
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${producto.es_pesable ? 'bg-yellow-700' : 'bg-indigo-700'}`}>
                    {producto.es_pesable ? <Scale className="w-5 h-5 text-white" /> : <Package className="w-5 h-5 text-white" />}
                  </div>
                </div>

                {/* Precio grande */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                      Precio {producto.es_pesable ? '/ kg' : 'unitario'}
                    </p>
                    <p className="text-2xl font-bold text-green-400 font-mono">{formatCOP(producto.precio_venta)}</p>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Stock disponible</p>
                    <p className={`text-2xl font-bold font-mono ${producto.stock > 5 ? 'text-blue-400' : producto.stock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {producto.es_pesable ? '∞' : producto.stock}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Input de peso (solo si es pesable) ── */}
              {producto.es_pesable && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm text-yellow-400 font-bold">Ingresa el peso de la gramera (kg):</p>
                  </div>
                  <input
                    ref={pesoRef}
                    type="number" step="0.001" min="0.001"
                    value={peso}
                    onChange={e => setPeso(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-gray-800 text-white text-3xl font-bold border-2 border-yellow-500 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center"
                  />
                  {pesoNum > 0 && (
                    <div className="bg-green-900/50 border border-green-600 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-green-400 uppercase tracking-wide mb-0.5">Total a cobrar</p>
                      <p className="text-2xl font-bold text-green-300 font-mono">{formatCOP(subtotal)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Botones S / N ── */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleAgregar}
                  disabled={producto.es_pesable && pesoNum <= 0}
                  className="flex items-center justify-center gap-3 bg-green-700 hover:bg-green-600 disabled:opacity-30 text-white font-bold py-4 rounded-xl transition-colors">
                  <span className="text-4xl font-mono leading-none font-black text-green-200">S</span>
                  <div className="text-left">
                    <p className="text-sm font-bold">Agregar</p>
                    <p className="text-xs text-green-300">a la factura</p>
                  </div>
                </button>
                <button
                  onClick={onCerrar}
                  className="flex items-center justify-center gap-3 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-colors">
                  <span className="text-4xl font-mono leading-none font-black text-gray-400">N</span>
                  <div className="text-left">
                    <p className="text-sm font-bold">Solo precio</p>
                    <p className="text-xs text-gray-400">no agregar</p>
                  </div>
                </button>
              </div>
              <p className="text-[10px] text-gray-600 text-center">
                S = agregar a factura · N / Esc = cerrar sin agregar
              </p>
            </div>
          )}

          {/* ── Estado vacío ── */}
          {!producto && !error && !buscando && (
            <div className="flex flex-col items-center py-6 text-gray-600 gap-2">
              <Tag className="w-10 h-10 opacity-20" />
              <p className="text-xs text-center">Escanea un código de barras o escribe el nombre del producto y presiona Enter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Borrar Producto de la Factura Actual ──────────────────────────────
function BorrarItemModal({ carrito, onEliminar, onCerrar }) {
  const [seleccionado, setSeleccionado] = useState(0);
  const listaRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onCerrar(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSeleccionado(i => Math.min(i + 1, carrito.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSeleccionado(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (carrito[seleccionado]) onEliminar(carrito[seleccionado].producto_id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, carrito, seleccionado, onEliminar]);

  useEffect(() => {
    listaRef.current?.querySelector(`[data-idx="${seleccionado}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [seleccionado]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg border border-gray-600 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">🗑 Selecciona el producto a borrar</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white text-xl font-bold">✕</button>
        </div>
        <div className="px-5 py-1 text-xs text-gray-500 bg-gray-800/50 border-b border-gray-700/50">
          ↑↓ navegar · Enter eliminar · Esc cerrar
        </div>
        <div ref={listaRef} className="p-3 space-y-2 max-h-96 overflow-y-auto">
          {carrito.map((item, idx) => (
            <button key={item.producto_id} data-idx={idx}
              onClick={() => onEliminar(item.producto_id)}
              onMouseEnter={() => setSeleccionado(idx)}
              className={`w-full flex items-center justify-between border rounded-lg px-4 py-3 transition-colors group
                ${idx === seleccionado
                  ? 'bg-red-900/60 border-red-500 ring-2 ring-red-400'
                  : 'bg-gray-700 border-gray-600 hover:bg-red-900/50 hover:border-red-600'}`}>
              <div className="text-left">
                <p className="text-white font-bold">{item.nombre.toUpperCase()}</p>
                <p className="text-gray-400 text-xs font-mono">{item.codigo.toUpperCase()} · {item.es_pesable ? `${item.cantidad.toFixed(3)} kg` : `x${item.cantidad}`}</p>
              </div>
              <div className="text-right">
                <p className="text-green-400 font-bold">${item.subtotal.toLocaleString('es-CO')}</p>
                <p className={`text-red-400 text-xs font-bold transition-opacity ${idx === seleccionado ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  Eliminar ↵
                </p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-700">
          <button onClick={onCerrar} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-lg text-sm">Cancelar (Esc)</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Selector de cliente para asignar a la venta ────────────────────────────
function ClienteSelectorModal({ onSeleccionar, onCerrar }) {
  const [busqueda, setBusqueda] = useState('');
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vistaAgregar, setVistaAgregar] = useState(false);

  // Campos formulario nuevo cliente
  const [fNombre,  setFNombre]  = useState('');
  const [fCedula,  setFCedula]  = useState('');
  const [fCelular, setFCelular] = useState('');
  const [fCupo,    setFCupo]    = useState('');
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false); // guard síncrono contra key-repeat

  const inputRef  = useRef(null);
  const nombreRef = useRef(null);

  // Focus inicial
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Al cambiar de vista, enfocar el campo correcto
  useEffect(() => {
    if (vistaAgregar) setTimeout(() => nombreRef.current?.focus(), 50);
    else              setTimeout(() => inputRef.current?.focus(), 50);
  }, [vistaAgregar]);

  // Teclado global
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (vistaAgregar) { setVistaAgregar(false); }
        else { onCerrar(); }
        return;
      }
      if (e.key === 'F2') { e.preventDefault(); setVistaAgregar(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar, vistaAgregar]);

  // Cargar clientes al buscar
  useEffect(() => {
    if (vistaAgregar) return;
    setCargando(true);
    api.get(`/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`)
      .then(data => setClientes(data))
      .catch(() => toast.error('Error cargando clientes'))
      .finally(() => setCargando(false));
  }, [busqueda, vistaAgregar]);

  const cupoRestante = (c) => c.cupo_disponible - c.deuda_total;

  const guardarCliente = async () => {
    if (guardandoRef.current) return; // bloquea key-repeat y doble-click
    if (!fNombre.trim()) {
      toast.error('El nombre es obligatorio');
      nombreRef.current?.focus();
      return;
    }
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const nuevo = await api.post('/clientes', {
        nombre:          fNombre.trim(),
        cedula:          fCedula.trim()  || null,
        celular:         fCelular.trim() || null,
        cupo_disponible: parseMonto(fCupo) || 0,
      });
      toast.success(`✅ Cliente "${nuevo.nombre}" creado`);
      onSeleccionar({ ...nuevo, deuda_total: 0 });
    } catch (err) {
      // El interceptor de axios ya transforma el error: err = error.response.data | error
      const msg = err?.error || err?.message || 'Error al crear cliente';
      toast.error(msg);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  // Enter en campo de formulario → guardar (stopPropagation evita que burbujee al POS)
  const handleFormKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); guardarCliente(); }
  };

  return (
    <div className="fixed inset-0 bg-black/85 flex items-start justify-center z-50 pt-10 px-4 pb-4">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '82vh' }}>

        {/* ── Cabecera ── */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <span className="text-xl">{vistaAgregar ? '➕' : '👤'}</span>
          {vistaAgregar ? (
            <p className="flex-1 text-white font-bold text-base">Nuevo Cliente</p>
          ) : (
            <input ref={inputRef} type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar cliente por nombre o cédula..."
              className="flex-1 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none" />
          )}
          <button onClick={onCerrar} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* ── Barra de hints ── */}
        <div className="text-xs text-gray-400 px-4 py-1.5 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
          {vistaAgregar ? (
            <span>Tab para avanzar · Enter para guardar · Esc volver</span>
          ) : (
            <span>Enter para seleccionar · Esc cerrar</span>
          )}
          {!vistaAgregar && (
            <button onClick={() => setVistaAgregar(true)}
              className="flex items-center gap-1 bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded transition-colors">
              <span className="bg-white/20 rounded px-1 font-mono">F2</span>
              <span>Agregar Cliente</span>
            </button>
          )}
        </div>

        {/* ── Contenido ── */}
        {vistaAgregar ? (
          /* Formulario rápido */
          <div className="p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input ref={nombreRef} type="text" value={fNombre} onChange={e => setFNombre(e.target.value)}
                onKeyDown={handleFormKey}
                placeholder="Nombre completo del cliente"
                className="w-full bg-gray-800 text-white border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
            </div>
            {/* Cédula */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Cédula</label>
              <input type="text" value={fCedula} onChange={e => setFCedula(e.target.value)}
                onKeyDown={handleFormKey}
                placeholder="Número de identificación"
                className="w-full bg-gray-800 text-white border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
            </div>
            {/* Celular */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Celular</label>
              <input type="text" value={fCelular} onChange={e => setFCelular(e.target.value)}
                onKeyDown={handleFormKey}
                placeholder="Número de celular"
                className="w-full bg-gray-800 text-white border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
            </div>
            {/* Cupo */}
            <div>
              <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1">Cupo disponible ($)</label>
              <input type="text" value={fCupo} onChange={e => setFCupo(formatearMonto(e.target.value))}
                onKeyDown={handleFormKey}
                placeholder="0"
                className="w-full bg-gray-800 text-white border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500" />
            </div>
            {/* Botones */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setVistaAgregar(false)}
                className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold transition-colors">
                ← Volver
              </button>
              <button onClick={guardarCliente} disabled={guardando}
                className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                {guardando ? 'Guardando...' : '✓ Guardar y Asignar'}
              </button>
            </div>
          </div>
        ) : (
          /* Lista de clientes */
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {cargando && <p className="text-center text-gray-500 py-8">Cargando...</p>}
            {!cargando && clientes.length === 0 && (
              <div className="text-center py-10">
                <p className="text-gray-500 mb-3">Sin resultados</p>
                <button onClick={() => setVistaAgregar(true)}
                  className="text-green-400 hover:text-green-300 text-sm font-bold underline">
                  + Crear cliente nuevo
                </button>
              </div>
            )}
            {!cargando && clientes.map(c => (
              <button key={c.id} onClick={() => onSeleccionar(c)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-blue-900/50 rounded-xl text-left transition-colors border border-gray-700 hover:border-blue-500">
                <div className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{c.nombre}</p>
                  <p className="text-xs text-gray-400">{c.cedula || 'Sin cédula'} {c.celular ? `· ${c.celular}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-400">Cupo disp.</p>
                  <p className={`text-sm font-bold ${cupoRestante(c) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${cupoRestante(c).toLocaleString('es-CO')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// POS PRINCIPAL — estilo SITRIC
// ═══════════════════════════════════════════════════════════════════════════
export default function POS() {
  const { user, isGerente, logout } = useAuth();
  const navigate = useNavigate();

  // ── Configuración del POS (leída una vez al montar) ─────────────────────
  const posConfig = useMemo(() => getPOSConfig(), []);
  const K = posConfig.atajos;   // atajos de teclado
  const A = posConfig.apariencia;
  const C = posConfig.carrito;
  const R = posConfig.recibo;

  const [carrito, setCarrito]               = useState([]);
  const [codigoInput, setCodigoInput]       = useState('');
  const [productoPesable, setProductoPesable] = useState(null);
  const [pesoDisplay, setPesoDisplay]       = useState('00.000');
  const [buscandoProducto, setBuscandoProducto] = useState(false);
  const [modalBuscador, setModalBuscador]   = useState(false);
  const [textoBuscador, setTextoBuscador]   = useState('');
  const [ultimoProducto, setUltimoProducto] = useState(null);

  const [modalCobro, setModalCobro]         = useState(false);
  const [metodoPago, setMetodoPago]         = useState('efectivo');
  const [montoRecibido, setMontoRecibido]   = useState('');
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [ultimaVenta, setUltimaVenta]       = useState(null);
  const [modalRecibo, setModalRecibo]       = useState(false);
  const [ultimaFactura, setUltimaFactura]   = useState('—');
  const [menuUsuario, setMenuUsuario]       = useState(false);
  const [modalFacturas, setModalFacturas]       = useState(false);
  const [modalBorrarItem, setModalBorrarItem]   = useState(false);
  const [modalConsultaPrecio, setModalConsulta] = useState(false);

  const [carritoIdx, setCarritoIdx] = useState(-1);
  const [carritoMemoria, setCarritoMemoria] = useState(null); // null = sin factura en espera
  const [clienteAsignado, setClienteAsignado] = useState(null); // { id, nombre, cupo_disponible, deuda_total }
  const [modalClienteSelector, setModalClienteSelector] = useState(false);
  const [modalOpcionesCliente, setModalOpcionesCliente] = useState(false);
  const [modalAbono, setModalAbono]                     = useState(false);
  const [modalDescuento, setModalDescuento]             = useState(false);
  const [cantidadRapida, setCantidadRapida] = useState(null); // { producto } — modal cantidad con prefijo *
  const [modalGastos, setModalGastos]       = useState(false);

  const [cajaId, setCajaId]   = useState(null);
  const [cajas, setCajas]     = useState([]);
  const [hora, setHora]       = useState('');

  const codigoRef = useRef(null);
  const socketRef = useRef(null);

  const subtotal     = carrito.reduce((s, i) => s + i.subtotal, 0);
  const ivaTotalCalc = carrito.reduce((s, i) => s + (i.subtotal * (i.iva_porcentaje / 100)), 0);
  const total        = subtotal;
  const montoNum     = parseMonto(montoRecibido);
  const cambio       = montoRecibido ? Math.max(0, montoNum - total) : 0;

  // Reloj
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('es-CO'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.get('/inventario/cajas').then(data => {
      setCajas(data);
      if (data.length > 0) setCajaId(data[0].id);
    }).catch(() => {});
    socketRef.current = io('/', { path: '/socket.io' });
    socketRef.current.on('producto:actualizado', (prod) => {
      setCarrito(prev => prev.map(i =>
        i.producto_id === prod.id ? { ...i, precio_unitario: prod.precio_venta } : i
      ));
    });
    return () => socketRef.current?.disconnect();
  }, []);

  // ── Mantener el foco en el input de código de barras ────────────────────
  // Al montar, enfocar inmediatamente
  useEffect(() => { codigoRef.current?.focus(); }, []);

  // Al hacer clic en cualquier área que NO sea un elemento interactivo,
  // devolver el foco al input de barras si no hay ningún modal abierto.
  // Usamos closest() para detectar correctamente clics en hijos de botones (iconos, spans).
  useEffect(() => {
    const handleDocClick = (e) => {
      if (modalCobro || modalRecibo || productoPesable || modalBuscador || modalFacturas || modalBorrarItem || modalConsultaPrecio) return;
      // Si el clic (o algún ancestro) es un elemento interactivo, no interferir
      if (e.target.closest('button, input, textarea, select, a, [tabindex]')) return;
      codigoRef.current?.focus();
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [modalCobro, modalRecibo, productoPesable, modalBuscador, modalFacturas, modalBorrarItem, modalConsultaPrecio, modalClienteSelector]);

  // Atajos de teclado F4–F12 + navegación de carrito
  useEffect(() => {
    const handler = (e) => {
      // ── Modal Cobro ──
      if (modalCobro) {
        if (e.key === 'Escape') { e.preventDefault(); setModalCobro(false); setMontoRecibido(''); return; }
        if (e.key === 'Enter')  { e.preventDefault(); procesarVenta(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const idx = METODOS_PAGO.findIndex(m => m.id === metodoPago);
          const newIdx = e.key === 'ArrowRight'
            ? (idx + 1) % METODOS_PAGO.length
            : (idx - 1 + METODOS_PAGO.length) % METODOS_PAGO.length;
          setMetodoPago(METODOS_PAGO[newIdx].id);
        }
        return;
      }
      // Otros modales tienen sus propios handlers
      if (modalRecibo || productoPesable || modalBuscador || modalFacturas || modalBorrarItem || modalConsultaPrecio || modalClienteSelector || modalOpcionesCliente || modalDescuento || modalAbono || modalGastos || cantidadRapida) return;

      // ── Navegación del carrito (solo si el input de código NO está activo) ──
      const barcodeActive = document.activeElement === codigoRef.current;
      if (!barcodeActive && carrito.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCarritoIdx(i => { const ni = Math.min(i + 1, carrito.length - 1); return ni < 0 ? 0 : ni; });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCarritoIdx(i => { const ni = Math.max(i - 1, 0); return ni; });
          return;
        }
        if ((e.key === '+' || e.key === '=') && carritoIdx >= 0 && carritoIdx < carrito.length) {
          const item = carrito[carritoIdx];
          cambiarCantidad(item.producto_id, item.es_pesable ? 0.1 : 1);
          return;
        }
        if (e.key === '-' && carritoIdx >= 0 && carritoIdx < carrito.length) {
          const item = carrito[carritoIdx];
          cambiarCantidad(item.producto_id, item.es_pesable ? -0.1 : -1);
          return;
        }
        if (e.key === 'Delete' && carritoIdx >= 0 && carritoIdx < carrito.length) {
          eliminarItem(carrito[carritoIdx].producto_id);
          setCarritoIdx(i => Math.min(i, carrito.length - 2));
          return;
        }
      }

      // ── Teclas de acción (configurables) ──
      if (e.key === K.salir)           { e.preventDefault(); navigate(isGerente ? '/gerente' : '/pos'); }
      if (e.key === K.consultarPrecio) { e.preventDefault(); setModalConsulta(true); }
      if (e.key === K.descuento)       { e.preventDefault(); if (carrito.length > 0) setModalDescuento(true); else toast.error('No hay productos en el carrito'); }
      if (e.key === K.borrarItem)      { e.preventDefault(); if (carrito.length > 0) setModalBorrarItem(true); }
      if (e.key === K.asignarCliente) {
        e.preventDefault();
        if (clienteAsignado) setModalOpcionesCliente(true);
        else setModalClienteSelector(true);
      }
      if (e.key === K.memoria)         { e.preventDefault(); cambiarFactura(); }
      if (e.key === K.facturas)        { e.preventDefault(); setModalFacturas(true); }
      if (e.key === K.gastos)          { e.preventDefault(); setModalGastos(true); }
      if (e.key === K.cobrar)          { e.preventDefault(); if (carrito.length > 0) setModalCobro(true); }
      if (e.key === K.abonoCliente)    { e.preventDefault(); setModalAbono(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalCobro, modalRecibo, productoPesable, modalBuscador, modalFacturas, modalBorrarItem, modalConsultaPrecio, modalClienteSelector, carrito, carritoIdx, isGerente, metodoPago, carritoMemoria, clienteAsignado, modalOpcionesCliente, modalDescuento, modalAbono, modalGastos, cantidadRapida]);

  const buscarProducto = useCallback(async (codigo) => {
    const raw = codigo.trim();
    if (!raw) { setTextoBuscador(''); setModalBuscador(true); return; }

    // ── Cantidad rápida: prefijo * ──────────────────────────────────────────
    if (raw.startsWith('*')) {
      const codigoProducto = raw.slice(1).trim();
      if (!codigoProducto) { toast('Escribe * seguido del código del producto'); return; }
      setBuscandoProducto(true);
      try {
        const producto = await api.get(`/productos/buscar?q=${encodeURIComponent(codigoProducto)}`);
        setCodigoInput('');
        setCantidadRapida({ producto });
      } catch {
        setTextoBuscador(codigoProducto);
        setModalBuscador(true);
      } finally {
        setBuscandoProducto(false);
      }
      return;
    }

    setBuscandoProducto(true);
    try {
      const producto = await api.get(`/productos/buscar?q=${encodeURIComponent(raw)}`);
      if (producto.es_pesable) { setProductoPesable(producto); setPesoDisplay('00.000'); return; }
      agregarAlCarrito(producto, 1);
      setCodigoInput('');
    } catch {
      setTextoBuscador(raw);
      setModalBuscador(true);
    } finally {
      setBuscandoProducto(false);
      codigoRef.current?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionarDesdeBuscador = (producto) => {
    setModalBuscador(false);
    setCodigoInput('');
    if (producto.es_pesable) { setProductoPesable(producto); setPesoDisplay('00.000'); }
    else { agregarAlCarrito(producto, 1); codigoRef.current?.focus(); }
  };

  const agregarAlCarrito = (producto, cantidad) => {
    setCarrito(prev => {
      const existente = prev.find(i => i.producto_id === producto.id);
      if (existente) {
        const updated = { ...existente, cantidad: existente.cantidad + cantidad, subtotal: (existente.cantidad + cantidad) * existente.precio_unitario };
        setUltimoProducto(updated);
        setCarritoIdx(prev.findIndex(i => i.producto_id === producto.id));
        return prev.map(i => i.producto_id === producto.id ? updated : i);
      }
      const item = {
        producto_id: producto.id, nombre: producto.nombre, codigo: producto.codigo,
        precio_unitario: producto.precio_venta, cantidad,
        iva_porcentaje: producto.iva_porcentaje || 0, unidad: producto.unidad,
        subtotal: cantidad * producto.precio_venta, es_pesable: producto.es_pesable,
      };
      setUltimoProducto(item);
      setPesoDisplay('00.000');
      setCarritoIdx(prev.length); // new item will be at this index
      return [...prev, item];
    });
    toast.success(`${producto.nombre}`, { duration: 800, position: 'bottom-right' });
  };

  const confirmarPesable = (peso) => {
    agregarAlCarrito(productoPesable, peso);
    setProductoPesable(null);
    setCodigoInput('');
    codigoRef.current?.focus();
  };

  const borrarUltimo = () => {
    if (carrito.length === 0) return;
    const ultimo = carrito[carrito.length - 1];
    setCarrito(prev => {
      const nuevo = prev.slice(0, -1);
      setUltimoProducto(nuevo.length > 0 ? nuevo[nuevo.length - 1] : null);
      return nuevo;
    });
    toast(`Eliminado: ${ultimo.nombre}`, { duration: 1000 });
  };

  const cambiarCantidad = (productoId, delta) => {
    setCarrito(prev => prev.map(i => {
      if (i.producto_id !== productoId) return i;
      const c = Math.max(0.001, i.cantidad + delta);
      return { ...i, cantidad: c, subtotal: c * i.precio_unitario };
    }).filter(i => i.cantidad > 0));
  };

  const eliminarItem = (productoId) => setCarrito(prev => prev.filter(i => i.producto_id !== productoId));

  const aplicarDescuento = (productoId, descuento) => {
    setCarrito(prev => prev.map(i => {
      if (i.producto_id !== productoId) return i;
      const subtotalBase = i.precio_unitario * i.cantidad;
      const desc = Math.max(0, Math.min(descuento, subtotalBase));
      return { ...i, descuento_item: desc, subtotal: subtotalBase - desc };
    }));
  };

  const limpiarCarrito = (recuperarMemoria = false) => {
    if (recuperarMemoria && carritoMemoria !== null) {
      // Recuperar factura guardada en memoria automáticamente tras finalizar venta
      setCarrito(carritoMemoria);
      setUltimoProducto(carritoMemoria[carritoMemoria.length - 1] || null);
      setCarritoMemoria(null);
      setCarritoIdx(-1);
      toast('↩ Factura en espera recuperada', { icon: '🔄', duration: 2500 });
    } else {
      setCarrito([]); setUltimoProducto(null);
      setCarritoIdx(-1);
    }
    setCodigoInput(''); codigoRef.current?.focus();
  };

  /** Lógica de F9 — Asignar a Memoria / Cambiar Factura */
  const cambiarFactura = () => {
    if (carritoMemoria === null) {
      // No hay factura en espera: guardar la actual y abrir una nueva en blanco
      if (carrito.length === 0) {
        toast.error('La factura actual está vacía, no se puede guardar en espera');
        return;
      }
      setCarritoMemoria(carrito);
      setCarrito([]);
      setUltimoProducto(null);
      setCarritoIdx(-1);
      toast('📥 Factura guardada en espera · Factura nueva lista', { duration: 2500 });
    } else {
      // Hay factura en espera: intercambiar con la actual
      const enEspera = carritoMemoria;
      setCarritoMemoria(carrito.length > 0 ? carrito : null);
      setCarrito(enEspera);
      setUltimoProducto(enEspera[enEspera.length - 1] || null);
      setCarritoIdx(-1);
      toast('🔄 Factura cambiada', { duration: 1500 });
    }
    codigoRef.current?.focus();
  };

  const procesarVenta = async () => {
    if (carrito.length === 0) return toast.error('El carrito está vacío');
    // Validaciones específicas de crédito
    if (metodoPago === 'credito') {
      if (!clienteAsignado) return toast.error('Asigna un cliente para ventas a crédito');
      const cupoRestante = clienteAsignado.cupo_disponible - clienteAsignado.deuda_total;
      if (total > cupoRestante) return toast.error(`Cupo insuficiente. Disponible: $${cupoRestante.toLocaleString('es-CO')}`);
    }
    setProcesandoVenta(true);
    try {
      const monto = parseMonto(montoRecibido);
      if (metodoPago === 'efectivo' && monto < total) return toast.error('Monto insuficiente');
      const venta = await api.post('/ventas', {
        caja_id: cajaId,
        items: carrito.map(i => ({
          producto_id: i.producto_id, cantidad: i.cantidad,
          precio_unitario_override: i.precio_unitario, iva_porcentaje: i.iva_porcentaje,
        })),
        metodo_pago: metodoPago, monto_recibido: monto || total, total,
        cliente_id: clienteAsignado?.id || null,
      });
      setUltimaFactura(venta.numero_factura || '—');
      setUltimaVenta({ ...venta, total, cambio }); // total local garantiza el valor correcto
      setModalCobro(false); setModalRecibo(true);
      limpiarCarrito(true); setMontoRecibido('');
      setClienteAsignado(null);
      if (metodoPago === 'efectivo') toast.success('💰 Cajón de efectivo abierto', { duration: 2000 });
    } catch (err) { toast.error(err?.error || 'Error procesando venta'); }
    finally { setProcesandoVenta(false); }
  };

  const cajaNombre = cajas.find(c => c.id === cajaId)?.nombre || 'POS1';

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100 overflow-hidden select-none">

      {/* ══ BARRA SUPERIOR ══════════════════════════════════════════════════ */}
      <div className="grid shrink-0 bg-gray-800 border-b border-gray-700 px-3 py-1.5 gap-2 items-center"
        style={{ gridTemplateColumns: '3fr auto auto' }}>

        {/* Col 1: Logo empresa + buscador */}
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow">
              <span className="text-white font-black text-sm leading-none">{A.letraLogo || 'S'}</span>
            </div>
            <div className="leading-none">
              <p className="text-white font-black text-sm tracking-tight">{A.nombreNegocio || 'SUPERMERCADO'}</p>
              <p className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">[ Venta ]</p>
            </div>
          </div>
          {/* Buscador */}
          <div className="relative flex-1">
            <Scan className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              ref={codigoRef}
              type="text"
              value={codigoInput}
              onChange={e => setCodigoInput(e.target.value)}
              onKeyDown={e => {
                const anyModal = modalCobro || modalRecibo || productoPesable || modalBuscador || modalFacturas || modalBorrarItem || modalConsultaPrecio || modalClienteSelector || modalOpcionesCliente || modalDescuento || modalAbono || modalGastos || cantidadRapida;
                // End → Cobrar (desde el input de barras, para garantizar que siempre funcione)
                if (e.key === K.cobrar) {
                  e.preventDefault();
                  if (!anyModal && carrito.length > 0) setModalCobro(true);
                  return;
                }
                if (e.key !== 'Enter') return;
                // Ignorar Enter si cualquier modal está abierto (evita que el Enter de otro modal dispare el buscador)
                if (anyModal) return;
                buscarProducto(codigoInput);
              }}
              placeholder="Código del producto..."
              className="w-full bg-gray-700 text-white border border-gray-600 rounded pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
              autoFocus
            />
          </div>
        </div>

        {/* Col 3: Báscula LED (centro) — condicional según config */}
        <div className={`flex items-center justify-center gap-1 bg-black border-2 border-blue-700 rounded px-3 py-1 ${A.mostrarGramera ? '' : 'invisible'}`}>
          <Scale className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-mono text-blue-400 text-xl font-bold tracking-widest"
            style={{ fontFamily: 'Courier New, monospace', textShadow: '0 0 8px #3b82f6', minWidth: '70px', display: 'inline-block', textAlign: 'right' }}>
            {productoPesable ? (pesoDisplay || '00.000') : '00.000'}
          </span>
          <span className="text-blue-600 text-xs font-mono">kg</span>
        </div>

        {/* Col 4: Info empleado */}
        <div className="relative flex justify-end">
          <button
            onClick={() => setMenuUsuario(v => !v)}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg px-3 py-1.5 transition-colors w-full">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">{user?.nombre?.[0]?.toUpperCase()}</span>
            </div>
            <div className="text-left overflow-hidden flex-1">
              <p className="text-white text-xs font-bold truncate leading-none">{user?.nombre?.toUpperCase()}</p>
              <p className="text-blue-400 text-[10px] capitalize leading-none mt-0.5">{user?.rol}</p>
            </div>
            <LogOut className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </button>
          {menuUsuario && (
            <div className="absolute top-full right-0 mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-600">
                <p className="text-xs text-gray-400">Sesión activa</p>
                <p className="text-white text-sm font-bold">{user?.nombre?.toUpperCase()}</p>
                <p className="text-blue-400 text-xs capitalize">{user?.rol}</p>
              </div>
              <button
                onClick={() => { setMenuUsuario(false); logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/50 text-red-400 text-sm font-bold transition-colors">
                <LogOut className="w-4 h-4" /> Cambiar usuario
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ CUERPO ══════════════════════════════════════════════════════════ */}
      <div className="grid flex-1 overflow-hidden" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>

        {/* ── TABLA DE CARRITO (cols 1-2) ──────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ gridColumn: '1 / 3' }}>
          {/* Cabecera fija */}
          <div className="shrink-0 bg-gray-800 border-b border-gray-700">
            {carritoMemoria !== null && (
              <div className="px-3 py-1 flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-400 border-b border-amber-500">
                <span>⏸</span>
                <span>Factura en espera ({carritoMemoria.length} producto{carritoMemoria.length !== 1 ? 's' : ''} · ${carritoMemoria.reduce((s,i)=>s+i.subtotal,0).toLocaleString('es-CO')})</span>
                <span className="ml-auto opacity-70">{keyLabel(K.memoria)} para cambiar</span>
              </div>
            )}
            {carritoIdx >= 0 && carrito.length > 0 && (
              <div className="px-3 py-0.5 text-xs text-blue-400/70 bg-blue-950/30 border-b border-blue-900/30">
                Fila {carritoIdx + 1}/{carrito.length} seleccionada · ↑↓ mover · Supr eliminar · * cantidad rápida
              </div>
            )}
            <table className="w-full text-sm font-bold text-gray-300 uppercase" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th className="px-3 py-3 text-left w-[10%]">Cod</th>
                  <th className="px-3 py-3 text-left">Nombre</th>
                  <th className="px-3 py-3 text-right w-[12%]">Cant</th>
                  <th className="px-3 py-3 text-right w-[13%]">Valor Kg/Ud</th>
                  {C.mostrarMedida    && <th className="px-3 py-3 text-center w-[9%]">Medida</th>}
                  <th className="px-3 py-3 text-right w-[13%]">Valor Prod</th>
                  {C.mostrarDescuento && <th className="px-3 py-3 text-right w-[5%]">%</th>}
                  {C.mostrarIVA       && <th className="px-3 py-3 text-right w-[5%]">IVA</th>}
                </tr>
              </thead>
            </table>
          </div>

          {/* Filas con scroll */}
          <div className="flex-1 overflow-y-auto">
            {carrito.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                <ShoppingCart className="w-10 h-10 opacity-20" />
                <p className="text-sm">Escanea un código · F5 buscar · F8/Fin cobrar</p>
              </div>
            ) : (
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <tbody>
                  {carrito.map((item, idx) => (
                    <tr key={item.producto_id}
                      onClick={() => setCarritoIdx(idx)}
                      className={`border-b border-gray-700 transition-colors cursor-pointer
                        ${idx === carritoIdx
                          ? 'bg-blue-900/50 ring-1 ring-inset ring-blue-500'
                          : item === ultimoProducto ? 'bg-yellow-900/20 hover:bg-blue-900/20'
                          : idx % 2 === 0 ? 'bg-gray-900 hover:bg-blue-900/20' : 'bg-gray-800 hover:bg-blue-900/20'}`}>
                      <td className="px-3 py-3 font-mono text-gray-400 truncate w-[10%]">{item.codigo.toUpperCase()}</td>
                      <td className="px-3 py-3 font-medium text-gray-100 truncate">{item.nombre.toUpperCase()}</td>
                      <td className="px-3 py-3 text-right font-mono text-gray-200">
                        {item.es_pesable ? item.cantidad.toFixed(3) : item.cantidad}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-300">$ {item.precio_unitario.toLocaleString('es-CO')}</td>
                      {C.mostrarMedida    && <td className="px-3 py-3 text-center text-gray-400 uppercase">{item.unidad}</td>}
                      <td className="px-3 py-3 text-right font-mono font-bold text-white">$ {item.subtotal.toLocaleString('es-CO')}</td>
                      {C.mostrarDescuento && <td className="px-3 py-3 text-right text-gray-500">0</td>}
                      {C.mostrarIVA       && <td className="px-3 py-3 text-right text-gray-500">{item.iva_porcentaje}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── COLUMNA 3: LIBRE ─────────────────────────────────────────────── */}
        <div />

        {/* ── PANEL DERECHO: TECLAS F (col 4) ──────────────────────────────── */}
        <div className="flex flex-col py-3 gap-4" style={{ paddingLeft: '80px', paddingRight: '80px', alignSelf: 'start' }}>
          <FnKey fn={keyLabel(K.salir)}           label="X Salir"             color="red"    onClick={() => navigate(isGerente ? '/gerente' : '/pos')} />
          <FnKey fn={keyLabel(K.consultarPrecio)} label="Consultar"           color="teal"   onClick={() => setModalConsulta(true)} />
          <FnKey fn={keyLabel(K.descuento)}       label="Seleccionar"         color="teal"   onClick={() => carrito.length > 0 ? setModalDescuento(true) : toast.error('No hay productos')} disabled={carrito.length === 0} />
          <FnKey fn={keyLabel(K.borrarItem)}      label="Borrar"              color="amber"  onClick={() => carrito.length > 0 ? setModalBorrarItem(true) : toast.error('No hay productos')} disabled={carrito.length === 0} />
          <FnKey
            fn={keyLabel(K.asignarCliente)}
            label={clienteAsignado ? clienteAsignado.nombre : 'Asignar Cliente'}
            color="blue"
            onClick={() => clienteAsignado ? setModalOpcionesCliente(true) : setModalClienteSelector(true)}
            badge={clienteAsignado ? '👤' : undefined}
          />
          <FnKey
            fn={keyLabel(K.memoria)}
            label={carritoMemoria !== null ? 'Cambiar Factura' : 'Enviar a Memoria'}
            color="indigo"
            onClick={cambiarFactura}
            badge={carritoMemoria !== null ? '⏸ En espera' : undefined}
          />
          <FnKey fn={keyLabel(K.facturas)}    label="Consulta Facturas"  color="blue"   onClick={() => setModalFacturas(true)} />
          <FnKey fn={keyLabel(K.gastos)}      label="Gastos"             color="purple" onClick={() => setModalGastos(true)} />
          <FnKey fn={keyLabel(K.abonoCliente)} label="Abono Cliente"     color="green"  onClick={() => setModalAbono(true)} />
          <span className="hidden"><FnKey fn={keyLabel(K.cobrar)} label="Cobrar / Finalizar" color="green" onClick={() => carrito.length > 0 ? setModalCobro(true) : toast.error('No hay productos en el carrito')} disabled={carrito.length === 0} /></span>
        </div>
      </div>

      {/* ══ BARRA INFERIOR: ÚLTIMO PRODUCTO + TOTAL DIGITAL ════════════════ */}
      <div className="flex items-center bg-gray-900 border-t border-gray-700 shrink-0 px-4 py-3 gap-6">
        {/* Último producto */}
        <div className="overflow-hidden">
          <p className="text-sm text-yellow-500 font-bold uppercase tracking-wide leading-none">Ultimo Producto:</p>
          <p className="font-bold text-yellow-400 truncate leading-tight mt-1"
            style={{ fontSize: `${A.tamanoUltProd}px`, fontFamily: 'Courier New, monospace', textShadow: '0 0 14px #fbbf24', lineHeight: 1 }}>
            {ultimoProducto?.nombre?.toUpperCase() || '—'}
          </p>
          <p className="text-sm text-yellow-500 font-bold uppercase tracking-wide leading-none mt-1">Valor Total Producto:</p>
          <p className="text-yellow-300 font-mono leading-tight mt-1"
            style={{ fontSize: `${A.tamanoUltSubtotal}px`, fontFamily: 'Courier New, monospace', lineHeight: 1 }}>
            $: {ultimoProducto ? ultimoProducto.subtotal.toLocaleString('es-CO') : '0'}
          </p>
        </div>

        {/* Total digital */}
        <div className="ml-auto flex flex-col items-end">
          <p className="text-base text-gray-400 font-mono"># Productos = {carrito.length}</p>
          <p className="font-bold font-mono text-blue-400"
            style={{ fontSize: `${A.tamanoTotal}px`, letterSpacing: '6px', textShadow: '0 0 28px #3b82f6', fontFamily: 'Courier New, monospace', lineHeight: 1 }}>
            $: {total.toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {/* ══ BARRA DE ESTADO ════════════════════════════════════════════════ */}
      <div className="bg-black text-gray-500 text-xs px-3 py-0.5 flex items-center gap-3 shrink-0 whitespace-nowrap overflow-hidden">
        <span>Punto: <span className="text-gray-200">{cajaNombre}</span></span>
        <span>Cajero: <span className="text-gray-200">{user?.nombre?.toUpperCase()}</span></span>
        <span>Cod Venta: <span className="text-gray-200">{ultimaFactura}</span></span>
        <span>CC Cliente: <span className="text-gray-200">{clienteAsignado?.cedula || '—'}</span></span>
        <span>Cliente: <span className={clienteAsignado ? 'text-blue-300 font-bold' : 'text-gray-200'}>{clienteAsignado?.nombre?.toUpperCase() || 'CONSUMIDOR FINAL'}</span></span>
        {clienteAsignado && <span>Deuda: <span className="text-amber-400 font-bold">${clienteAsignado.deuda_total.toLocaleString('es-CO')}</span></span>}
        <span className="ml-auto font-mono">{hora}</span>
      </div>

      {/* ══ MODALES ════════════════════════════════════════════════════════ */}
      {modalBuscador && (
        <BuscadorModal textoPrevio={textoBuscador}
          onSeleccionar={seleccionarDesdeBuscador}
          onCerrar={() => { setModalBuscador(false); codigoRef.current?.focus(); }} />
      )}
      {productoPesable && (
        <PesableModal producto={productoPesable}
          onConfirmar={confirmarPesable}
          onPesoChange={v => setPesoDisplay(v || '00.000')}
          onCancelar={() => { setProductoPesable(null); setPesoDisplay('00.000'); setCodigoInput(''); codigoRef.current?.focus(); }} />
      )}
      {modalCobro && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-600 shadow-2xl text-white">
            <div className="p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold">Cobrar venta</h2>
              <p className="text-3xl font-bold text-green-400 mt-1">{formatCOP(total)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{carrito.length} producto(s) · IVA: {formatCOP(ivaTotalCalc)}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Método de pago <span className="text-xs text-gray-500 font-normal">← → cambiar · Enter confirmar · Esc cancelar</span></p>
                <div className="grid grid-cols-4 gap-2">
                  {METODOS_PAGO.map(m => (
                    <button key={m.id} onClick={() => setMetodoPago(m.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-colors text-xs font-medium
                        ${metodoPago === m.id
                          ? m.id === 'credito' ? 'border-amber-500 bg-amber-900/60' : 'border-blue-500 bg-blue-900'
                          : 'border-gray-600 bg-gray-700 hover:bg-gray-600'}`}>
                      {m.icon}<span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {metodoPago === 'credito' && (
                <div className="space-y-3">
                  {clienteAsignado ? (
                    <div className="bg-amber-900/40 border border-amber-600 rounded-xl px-4 py-3">
                      <p className="text-xs text-amber-400 font-semibold mb-1">CLIENTE ASIGNADO</p>
                      <p className="font-bold text-white text-lg">{clienteAsignado.nombre}</p>
                      {clienteAsignado.cedula && <p className="text-xs text-gray-400">CC: {clienteAsignado.cedula}</p>}
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-gray-400">Cupo disponible: <span className="text-green-400 font-bold">${((clienteAsignado.cupo_disponible - clienteAsignado.deuda_total)).toLocaleString('es-CO')}</span></span>
                      </div>
                      {total > (clienteAsignado.cupo_disponible - clienteAsignado.deuda_total) && (
                        <p className="text-red-400 text-xs mt-2 font-bold">⚠️ Cupo insuficiente para esta venta</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-4 text-center">
                      <p className="text-red-400 font-bold mb-2">⚠️ No hay cliente asignado</p>
                      <p className="text-gray-400 text-sm mb-3">Debes asignar un cliente para ventas a crédito</p>
                      <button onClick={() => { setModalCobro(false); setModalClienteSelector(true); }}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                        👤 Asignar cliente ahora
                      </button>
                    </div>
                  )}
                </div>
              )}
              {metodoPago === 'efectivo' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-300">¿Cuánto entrega el cliente?</p>
                  <input type="text" inputMode="numeric" value={montoRecibido}
                    onChange={e => setMontoRecibido(formatearMonto(e.target.value))}
                    onKeyDown={e => e.key === 'Enter' && montoRecibido && montoNum >= total && procesarVenta()}
                    placeholder="0"
                    className="w-full bg-gray-700 text-white text-3xl font-bold border-2 border-yellow-500 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center tracking-wider"
                    autoFocus />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-700 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-1">TOTAL A COBRAR</p>
                      <p className="text-xl font-bold">{formatCOP(total)}</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center transition-colors ${montoRecibido && montoNum >= total ? 'bg-green-800 border-2 border-green-500' : 'bg-gray-700'}`}>
                      <p className="text-xs text-gray-400 mb-1">CAMBIO A DEVOLVER</p>
                      <p className={`text-xl font-bold ${montoRecibido && montoNum >= total ? 'text-green-300' : 'text-gray-500'}`}>
                        {montoRecibido && montoNum >= total ? formatCOP(cambio) : '—'}
                      </p>
                    </div>
                  </div>
                  {montoRecibido && montoNum < total && (
                    <p className="text-red-400 text-sm text-center">⚠️ Falta {formatCOP(total - montoNum)}</p>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setModalCobro(false); setMontoRecibido(''); }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                <button onClick={procesarVenta} disabled={procesandoVenta}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
                  {procesandoVenta ? 'Procesando...' : '✓ Confirmar cobro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {modalRecibo && ultimaVenta && (
        <ReciboModal venta={ultimaVenta}
          countdownInicial={R.countdownSegundos}
          autoImprimir={R.autoImprimir}
          nombreNegocio={A.nombreNegocio || 'SUPERMERCADO'}
          onClose={() => { setModalRecibo(false); codigoRef.current?.focus(); }} />
      )}
      {modalFacturas && (
        <FacturasModal nombreNegocio={A.nombreNegocio || 'SUPERMERCADO'} onCerrar={() => { setModalFacturas(false); codigoRef.current?.focus(); }} />
      )}
      {modalBorrarItem && (
        <BorrarItemModal
          carrito={carrito}
          onEliminar={(id) => { eliminarItem(id); setModalBorrarItem(false); codigoRef.current?.focus(); }}
          onCerrar={() => { setModalBorrarItem(false); codigoRef.current?.focus(); }} />
      )}
      {modalConsultaPrecio && (
        <ConsultaPrecioModal
          onAgregarAlCarrito={(producto, cantidad) => {
            agregarAlCarrito(producto, cantidad);
          }}
          onCerrar={() => { setModalConsulta(false); codigoRef.current?.focus(); }} />
      )}
      {modalOpcionesCliente && clienteAsignado && (
        <OpcionesClienteModal
          cliente={clienteAsignado}
          onCambiar={() => { setModalOpcionesCliente(false); setModalClienteSelector(true); }}
          onQuitar={() => { setClienteAsignado(null); setModalOpcionesCliente(false); codigoRef.current?.focus(); }}
          onCerrar={() => { setModalOpcionesCliente(false); codigoRef.current?.focus(); }} />
      )}
      {modalClienteSelector && (
        <ClienteSelectorModal
          onSeleccionar={(c) => { setClienteAsignado(c); setModalClienteSelector(false); codigoRef.current?.focus(); }}
          onCerrar={() => { setModalClienteSelector(false); codigoRef.current?.focus(); }} />
      )}
      {cantidadRapida && (
        <CantidadRapidaModal
          producto={cantidadRapida.producto}
          onConfirmar={(cant) => {
            agregarAlCarrito(cantidadRapida.producto, cant);
            setCantidadRapida(null);
            codigoRef.current?.focus();
          }}
          onCerrar={() => { setCantidadRapida(null); codigoRef.current?.focus(); }}
        />
      )}
      {modalGastos && (
        <GastosModal onCerrar={() => { setModalGastos(false); codigoRef.current?.focus(); }} />
      )}
      {modalDescuento && carrito.length > 0 && (
        <DescuentoModal
          carrito={carrito}
          onAplicar={(productoId, descuento) => aplicarDescuento(productoId, descuento)}
          onCerrar={() => { setModalDescuento(false); codigoRef.current?.focus(); }} />
      )}
      {modalAbono && (
        <AbonoClienteModal
          clienteInicial={clienteAsignado}
          onCerrar={() => { setModalAbono(false); codigoRef.current?.focus(); }} />
      )}
    </div>
  );
}
