import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save, RotateCcw, Keyboard, Palette, ShoppingCart, Receipt,
  Eye, EyeOff, ChevronRight, AlertTriangle, Check, Monitor,
  Scale, Info, X,
} from 'lucide-react';
import {
  getPOSConfig, setPOSConfig, resetPOSConfig,
  DEFAULT_CONFIG, ACCIONES_POS, keyLabel,
} from '../../utils/posConfig';
import toast from 'react-hot-toast';

// ── Colores por acción ──────────────────────────────────────────────────────
const ACTION_COLORS = {
  red:    { bg: 'bg-red-100',    text: 'text-red-700',    badge: 'bg-red-700 text-white',    ring: 'ring-red-400' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-700',   badge: 'bg-blue-700 text-white',   ring: 'ring-blue-400' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-700',   badge: 'bg-teal-700 text-white',   ring: 'ring-teal-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700', badge: 'bg-orange-600 text-white', ring: 'ring-orange-400' },
  green:  { bg: 'bg-green-100',  text: 'text-green-700',  badge: 'bg-green-700 text-white',  ring: 'ring-green-400' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700', badge: 'bg-purple-700 text-white', ring: 'ring-purple-400' },
  gray:   { bg: 'bg-gray-100',   text: 'text-gray-700',   badge: 'bg-gray-600 text-white',   ring: 'ring-gray-400' },
};

// ── Toggle switch ───────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, descripcion }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {descripcion && <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4 ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

// ── Slider ──────────────────────────────────────────────────────────────────
function Slider({ value, min, max, step = 1, onChange, label, unit = 'px', preview }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
      {preview && (
        <div className="mt-2 bg-gray-900 rounded-xl p-3 flex items-center justify-center overflow-hidden">
          <p style={{ fontSize: `${Math.min(value, 60)}px`, fontFamily: 'Courier New, monospace', color: '#60a5fa', lineHeight: 1, textShadow: '0 0 10px #3b82f6' }}>
            {preview}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Tab button ──────────────────────────────────────────────────────────────
function TabBtn({ id, icon, label, active, onClick }) {
  return (
    <button onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
        ${active ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
      {icon}<span>{label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ConfiguracionPOS() {
  const navigate = useNavigate();
  const [config, setConfig]             = useState(() => getPOSConfig());
  const [tab, setTab]                   = useState('atajos');
  const [capturandoAtajo, setCap]       = useState(null); // id de la acción capturando
  const [guardado, setGuardado]         = useState(false);
  const [cambiosPendientes, setCambios] = useState(false);

  // Detectar cambios
  useEffect(() => {
    const saved = getPOSConfig();
    const changed = JSON.stringify(config) !== JSON.stringify(saved);
    setCambios(changed);
  }, [config]);

  // ── Captura de tecla para atajos ─────────────────────────────────────────
  useEffect(() => {
    if (!capturandoAtajo) return;
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Teclas ignoradas
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (e.key === 'Escape') { setCap(null); return; }
      setConfig(c => ({ ...c, atajos: { ...c.atajos, [capturandoAtajo]: e.key } }));
      setCap(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturandoAtajo]);

  // ── Detectar conflictos de teclas ─────────────────────────────────────────
  const conflictos = (() => {
    const counts = {};
    Object.entries(config.atajos).forEach(([id, key]) => {
      counts[key] = counts[key] ? [...counts[key], id] : [id];
    });
    return Object.entries(counts)
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => ({ key, ids }));
  })();

  // ── Guardar ───────────────────────────────────────────────────────────────
  const guardar = () => {
    if (conflictos.length > 0) {
      toast.error('Hay conflictos de teclas. Resuélvelos antes de guardar.');
      return;
    }
    setPOSConfig(config);
    setGuardado(true);
    setCambios(false);
    setTimeout(() => setGuardado(false), 2000);
    toast.success('Configuración guardada. Reinicia el POS para aplicar cambios.');
  };

  // ── Restablecer ───────────────────────────────────────────────────────────
  const restablecer = () => {
    if (!window.confirm('¿Restablecer toda la configuración a los valores por defecto?')) return;
    resetPOSConfig();
    setConfig(getPOSConfig());
    setCambios(false);
    toast.success('Configuración restablecida');
  };

  const set = useCallback((section, key, value) => {
    setConfig(c => ({ ...c, [section]: { ...c[section], [key]: value } }));
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Encabezado ────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración del POS</h1>
          </div>
          <p className="text-sm text-gray-500">Personaliza atajos de teclado, apariencia y comportamiento de la caja registradora.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={restablecer}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
            <RotateCcw className="w-4 h-4" /> Restablecer
          </button>
          <button onClick={guardar}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl transition-all shadow
              ${guardado ? 'bg-green-600 text-white' : cambiosPendientes ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-200 text-gray-400 cursor-default'}`}>
            {guardado ? <><Check className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
          </button>
        </div>
      </div>

      {/* ── Alerta de cambios pendientes ──────────────────────────────────── */}
      {cambiosPendientes && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
          Hay cambios sin guardar. Presiona "Guardar cambios" para aplicarlos.
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        <TabBtn id="atajos"    icon={<Keyboard className="w-4 h-4" />}     label="Atajos de Teclado" active={tab==='atajos'}    onClick={setTab} />
        <TabBtn id="apariencia" icon={<Palette className="w-4 h-4" />}     label="Apariencia"        active={tab==='apariencia'} onClick={setTab} />
        <TabBtn id="carrito"   icon={<ShoppingCart className="w-4 h-4" />} label="Tabla de Carrito"  active={tab==='carrito'}   onClick={setTab} />
        <TabBtn id="recibo"    icon={<Receipt className="w-4 h-4" />}      label="Recibo"            active={tab==='recibo'}    onClick={setTab} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: ATAJOS DE TECLADO                                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'atajos' && (
        <div className="space-y-4">
          {/* Info box */}
          <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              Haz clic en el botón de cada acción y luego presiona la tecla que quieres asignarle.
              Puedes usar teclas de función (F1–F12), letras, números o teclas especiales.
              La tecla <strong>Fin/End</strong> siempre abre el cobro como alternativa fija.
            </div>
          </div>

          {/* Conflictos */}
          {conflictos.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
              <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Conflictos detectados
              </p>
              {conflictos.map(({ key, ids }) => (
                <p key={key} className="text-xs text-red-600">
                  La tecla <strong>{keyLabel(key)}</strong> está asignada a:{' '}
                  {ids.map(id => ACCIONES_POS.find(a => a.id === id)?.label).join(' y ')}
                </p>
              ))}
            </div>
          )}

          {/* Tabla de atajos */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {ACCIONES_POS.map((accion, idx) => {
              const col = ACTION_COLORS[accion.color] || ACTION_COLORS.gray;
              const currentKey = config.atajos[accion.id];
              const defaultKey = DEFAULT_CONFIG.atajos[accion.id];
              const isCapturing = capturandoAtajo === accion.id;
              const isConflict = conflictos.some(c => c.ids.includes(accion.id));
              const isChanged = currentKey !== defaultKey;

              return (
                <div key={accion.id}
                  className={`flex items-center gap-4 px-5 py-4 ${idx < ACCIONES_POS.length - 1 ? 'border-b border-gray-100' : ''} ${isCapturing ? 'bg-yellow-50' : ''} transition-colors`}>

                  {/* Icono + info */}
                  <div className={`w-10 h-10 ${col.bg} rounded-xl flex items-center justify-center text-xl shrink-0`}>
                    {accion.icono}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{accion.label}</p>
                      {isChanged && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">MODIFICADO</span>
                      )}
                      {isConflict && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded">CONFLICTO</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{accion.descripcion}</p>
                  </div>

                  {/* Default key (pequeño) */}
                  <div className="hidden sm:flex flex-col items-center shrink-0">
                    <span className="text-[10px] text-gray-400 mb-1">Default</span>
                    <kbd className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-mono border border-gray-200">
                      {keyLabel(defaultKey)}
                    </kbd>
                  </div>

                  {/* Tecla actual + botón capturar */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isCapturing ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-yellow-100 border-2 border-yellow-400 rounded-xl px-4 py-2 animate-pulse">
                          <Keyboard className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-bold text-yellow-700">Presiona una tecla...</span>
                        </div>
                        <button onClick={() => setCap(null)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <kbd className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold border-2 min-w-[52px] text-center
                          ${isConflict ? 'bg-red-100 border-red-400 text-red-700' : `${col.badge} border-transparent`}`}>
                          {keyLabel(currentKey)}
                        </kbd>
                        <button onClick={() => setCap(accion.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200">
                          <Keyboard className="w-3.5 h-3.5" />
                          Cambiar
                        </button>
                        {isChanged && (
                          <button
                            onClick={() => setConfig(c => ({ ...c, atajos: { ...c.atajos, [accion.id]: defaultKey } }))}
                            title="Restablecer esta tecla"
                            className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Teclas fijas (no configurables) */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Teclas fijas (no configurables)</p>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'Fin / End', desc: 'Siempre abre el cobro' },
                { key: 'Esc',       desc: 'Cierra cualquier modal' },
                { key: '↑ ↓',      desc: 'Navega el carrito o listas' },
                { key: '+ / −',     desc: 'Ajusta cantidad del ítem seleccionado' },
                { key: 'Supr',      desc: 'Elimina ítem seleccionado del carrito' },
                { key: '← →',      desc: 'Cambia método de pago al cobrar' },
                { key: 'Enter',     desc: 'Confirma la selección en modales' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <kbd className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{key}</kbd>
                  <span className="text-xs text-gray-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: APARIENCIA                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'apariencia' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Columna izquierda: controles */}
          <div className="space-y-5">

            {/* Logo del negocio */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Identidad del negocio
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del negocio</label>
                <input
                  value={config.apariencia.nombreNegocio}
                  onChange={e => set('apariencia', 'nombreNegocio', e.target.value.toUpperCase())}
                  maxLength={20}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold uppercase tracking-wider"
                />
                <p className="text-xs text-gray-400 mt-1">Se muestra en la barra superior del POS</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Letra del logo</label>
                <input
                  value={config.apariencia.letraLogo}
                  onChange={e => set('apariencia', 'letraLogo', e.target.value.slice(-1).toUpperCase())}
                  maxLength={1}
                  className="w-16 border border-gray-300 rounded-xl px-3 py-2 text-center text-lg font-black focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
                <p className="text-xs text-gray-400 mt-1">Un solo carácter que aparece en el ícono azul</p>
              </div>
            </div>

            {/* Gramera */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Báscula / Gramera
              </h3>
              <Toggle
                checked={config.apariencia.mostrarGramera}
                onChange={v => set('apariencia', 'mostrarGramera', v)}
                label="Mostrar indicador de báscula"
                descripcion="Muestra el display LED de la gramera en la barra superior"
              />
            </div>

            {/* Tamaños tipografía */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-6 shadow-sm">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span> Tamaños de texto en pantalla
              </h3>
              <Slider
                label="Total de la venta"
                value={config.apariencia.tamanoTotal}
                min={60} max={200} step={5}
                onChange={v => set('apariencia', 'tamanoTotal', v)}
                preview={`$: 85.000`}
              />
              <Slider
                label="Nombre del último producto"
                value={config.apariencia.tamanoUltProd}
                min={24} max={100} step={2}
                onChange={v => set('apariencia', 'tamanoUltProd', v)}
                preview="ARROZ DIANA"
              />
              <Slider
                label="Subtotal del último producto"
                value={config.apariencia.tamanoUltSubtotal}
                min={20} max={80} step={2}
                onChange={v => set('apariencia', 'tamanoUltSubtotal', v)}
                preview="$: 4.500"
              />
            </div>
          </div>

          {/* Columna derecha: preview del POS */}
          <div className="lg:sticky lg:top-4 self-start">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Vista previa</p>
              {/* Mini POS mockup */}
              <div className="bg-gray-900 rounded-xl overflow-hidden text-white">
                {/* Top bar */}
                <div className="bg-gray-800 px-3 py-2 flex items-center gap-2 border-b border-gray-700">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-black">
                    {config.apariencia.letraLogo || 'S'}
                  </div>
                  <div className="leading-none">
                    <p className="text-white font-black text-xs">{config.apariencia.nombreNegocio || 'SUPERMERCADO'}</p>
                    <p className="text-blue-400 text-[8px] font-bold tracking-widest">[ Venta ]</p>
                  </div>
                  <div className="flex-1 h-5 bg-gray-700 rounded mx-2 text-[9px] text-gray-500 flex items-center px-2">
                    Código del producto...
                  </div>
                  {config.apariencia.mostrarGramera && (
                    <div className="flex items-center gap-1 bg-black border border-blue-700 rounded px-2 py-1">
                      <Scale className="w-2.5 h-2.5 text-blue-400" />
                      <span className="text-blue-400 font-mono text-xs font-bold" style={{ fontFamily: 'Courier New' }}>00.000</span>
                      <span className="text-blue-600 text-[9px]">kg</span>
                    </div>
                  )}
                </div>
                {/* Cart area (simplificado) */}
                <div className="h-16 flex items-center justify-center text-gray-600 text-xs border-b border-gray-700">
                  [tabla de productos]
                </div>
                {/* Bottom bar */}
                <div className="px-3 py-2 border-t border-gray-700 bg-gray-900">
                  <p className="text-yellow-400 font-bold truncate"
                    style={{ fontSize: `${Math.min(config.apariencia.tamanoUltProd, 20)}px`, fontFamily: 'Courier New', lineHeight: 1 }}>
                    ARROZ DIANA
                  </p>
                  <div className="flex justify-between items-end mt-1">
                    <p className="text-yellow-300 font-mono"
                      style={{ fontSize: `${Math.min(config.apariencia.tamanoUltSubtotal, 16)}px`, fontFamily: 'Courier New', lineHeight: 1 }}>
                      $: 4.500
                    </p>
                    <p className="text-blue-400 font-mono font-bold"
                      style={{ fontSize: `${Math.min(config.apariencia.tamanoTotal, 28)}px`, fontFamily: 'Courier New', lineHeight: 1, textShadow: '0 0 8px #3b82f6' }}>
                      $: 85.000
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                * La vista previa es aproximada. Los tamaños están escalados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: TABLA DE CARRITO                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'carrito' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Columnas visibles en la tabla</h3>
            <p className="text-sm text-gray-500 mb-4">Elige qué columnas mostrar en la tabla de productos del POS.</p>
            <div className="divide-y divide-gray-100">
              <Toggle
                checked={config.carrito.mostrarMedida}
                onChange={v => set('carrito', 'mostrarMedida', v)}
                label="Columna Medida"
                descripcion="Muestra la unidad de medida (Und, Kg, Lt…)"
              />
              <Toggle
                checked={config.carrito.mostrarDescuento}
                onChange={v => set('carrito', 'mostrarDescuento', v)}
                label="Columna Descuento %"
                descripcion="Muestra el porcentaje de descuento aplicado al producto"
              />
              <Toggle
                checked={config.carrito.mostrarIVA}
                onChange={v => set('carrito', 'mostrarIVA', v)}
                label="Columna IVA %"
                descripcion="Muestra el porcentaje de IVA de cada producto"
              />
            </div>
          </div>

          {/* Preview de la tabla */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Vista previa de la tabla</p>
            <div className="bg-gray-900 rounded-xl overflow-hidden text-white text-xs">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr className="text-gray-300 text-[10px] font-bold uppercase">
                    <th className="px-3 py-2 text-left">Cod</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-right">Cant</th>
                    <th className="px-3 py-2 text-right">Precio/Ud</th>
                    {config.carrito.mostrarMedida    && <th className="px-3 py-2 text-center">Medida</th>}
                    <th className="px-3 py-2 text-right">Total</th>
                    {config.carrito.mostrarDescuento && <th className="px-3 py-2 text-right">%Dto</th>}
                    {config.carrito.mostrarIVA       && <th className="px-3 py-2 text-right">IVA</th>}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cod: 'ARR01', nom: 'ARROZ DIANA 1KG', cant: 2, precio: '4.500', med: 'Und', total: '9.000', dto: 0, iva: 0 },
                    { cod: 'LEC02', nom: 'LECHE ALPINA 1L',  cant: 1, precio: '3.200', med: 'Lt',  total: '3.200', dto: 0, iva: 0 },
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-gray-700 ${i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}`}>
                      <td className="px-3 py-2 font-mono text-gray-400">{row.cod}</td>
                      <td className="px-3 py-2 text-gray-100">{row.nom}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className="flex items-center justify-end gap-0.5">
                          <span className="w-4 h-4 bg-gray-700 rounded text-center text-[9px] flex items-center justify-center">−</span>
                          <span className="w-6 text-center">{row.cant}</span>
                          <span className="w-4 h-4 bg-gray-700 rounded text-center text-[9px] flex items-center justify-center">+</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300 font-mono">$ {row.precio}</td>
                      {config.carrito.mostrarMedida    && <td className="px-3 py-2 text-center text-gray-400">{row.med}</td>}
                      <td className="px-3 py-2 text-right font-bold">$ {row.total}</td>
                      {config.carrito.mostrarDescuento && <td className="px-3 py-2 text-right text-gray-500">{row.dto}</td>}
                      {config.carrito.mostrarIVA       && <td className="px-3 py-2 text-right text-gray-500">{row.iva}</td>}
                      <td className="px-3 py-2 text-center text-red-500">✕</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB: RECIBO                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'recibo' && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-1">Comportamiento del recibo</h3>
            <p className="text-sm text-gray-500 mb-4">Configura qué ocurre después de completar una venta.</p>
            <div className="divide-y divide-gray-100">
              <Toggle
                checked={config.recibo.autoImprimir}
                onChange={v => set('recibo', 'autoImprimir', v)}
                label="Imprimir recibo automáticamente"
                descripcion="Envía el recibo a la impresora sin preguntar (sin mostrar el modal S/N)"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800">Tiempo de espera del modal</h3>
            <p className="text-sm text-gray-500">Cuántos segundos espera el modal de recibo antes de cerrarse automáticamente.</p>
            <Slider
              label="Segundos antes de cierre automático"
              value={config.recibo.countdownSegundos}
              min={3} max={30} step={1}
              unit="s"
              onChange={v => set('recibo', 'countdownSegundos', v)}
            />
            {/* Preview del countdown */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">¿Imprimir recibo?</p>
                <p className="text-3xl font-bold tracking-widest">
                  <span className="text-green-500">S</span>
                  <span className="text-gray-400 text-xl mx-2">/</span>
                  <span className="text-red-500">N</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">S = imprimir · N = continuar</p>
              </div>
              <div className="relative w-16 h-16">
                <svg width="64" height="64" className="-rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#3b82f6" strokeWidth="4"
                    strokeDasharray={2 * Math.PI * 26}
                    strokeDashoffset={2 * Math.PI * 26 * 0.5}
                    strokeLinecap="round" />
                </svg>
                <p className="absolute inset-0 flex items-center justify-center text-xl font-bold text-blue-500">
                  {Math.round(config.recibo.countdownSegundos / 2)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400">El número en el preview representa la mitad del tiempo configurado, como ejemplo visual.</p>
          </div>
        </div>
      )}

      {/* ── Botón guardar flotante (si hay cambios) ───────────────────────── */}
      {cambiosPendientes && (
        <div className="sticky bottom-4 flex justify-end">
          <button onClick={guardar}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-2xl shadow-2xl hover:bg-gray-800 transition-all">
            <Save className="w-5 h-5" /> Guardar cambios
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
          </button>
        </div>
      )}
    </div>
  );
}
