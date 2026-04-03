import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const TIPOS_GASTO = [
  { id: 'proveedor', label: 'Pago a Proveedor', icon: '🏭', color: 'bg-blue-50 border-blue-300 text-blue-700', activeColor: 'bg-blue-100 border-blue-500 text-blue-800' },
  { id: 'nomina',    label: 'Pago de Nómina',   icon: '👷', color: 'bg-teal-50 border-teal-300 text-teal-700', activeColor: 'bg-teal-100 border-teal-500 text-teal-800' },
  { id: 'personal',  label: 'Pago Personal',    icon: '👤', color: 'bg-indigo-50 border-indigo-300 text-indigo-700', activeColor: 'bg-indigo-100 border-indigo-500 text-indigo-800' },
  { id: 'recogida',  label: 'Recogida de Caja', icon: '💰', color: 'bg-amber-50 border-amber-300 text-amber-700', activeColor: 'bg-amber-100 border-amber-500 text-amber-800' },
];

function formatearMonto(str) {
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('es-CO');
}
function parseMonto(str) {
  return parseFloat((str || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

export default function Gastos() {
  const hoy = new Date().toLocaleDateString('en-CA');
  const [fecha, setFecha]         = useState(hoy);
  const [gastos, setGastos]       = useState([]);
  const [totales, setTotales]     = useState({});
  const [totalDia, setTotalDia]   = useState(0);
  const [cargando, setCargando]   = useState(true);
  const [showForm, setShowForm]   = useState(false);

  const [tipo, setTipo]               = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [valor, setValor]             = useState('');
  const [guardando, setGuardando]     = useState(false);

  const cargar = () => {
    setCargando(true);
    api.get(`/gastos?fecha=${fecha}`)
      .then(d => { setGastos(d.gastos); setTotales(d.totales || {}); setTotalDia(d.total); })
      .catch(() => toast.error('Error al cargar gastos'))
      .finally(() => setCargando(false));
  };

  useEffect(() => { cargar(); }, [fecha]);

  const guardar = async () => {
    if (!tipo) { toast.error('Selecciona el tipo de gasto'); return; }
    const valorNum = parseMonto(valor);
    if (!valorNum || valorNum <= 0) { toast.error('Ingresa un valor válido'); return; }
    setGuardando(true);
    try {
      await api.post('/gastos', { tipo, descripcion, valor: valorNum });
      toast.success('✅ Gasto registrado');
      setShowForm(false); setTipo(''); setValor(''); setDescripcion('');
      cargar();
    } catch (err) {
      toast.error(err?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingDown className="w-7 h-7 text-red-500" /> Gastos
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Registro de egresos, pagos y recogidas de caja</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Registrar Gasto
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="text-gray-800 font-bold text-lg">Nuevo Gasto / Recogida</h3>

          {/* Tipo */}
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Tipo</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIPOS_GASTO.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipo(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 font-semibold text-sm transition-colors ${
                    tipo === t.id ? t.activeColor : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Valor ($) *</label>
              <input
                type="text"
                value={valor}
                onChange={e => setValor(formatearMonto(e.target.value))}
                placeholder="0"
                className="input w-full text-xl font-mono text-right"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Descripción</label>
              <input
                type="text"
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                placeholder="Opcional"
                className="input w-full"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowForm(false); setTipo(''); setValor(''); setDescripcion(''); }}
              className="btn-ghost px-5 py-2.5 rounded-xl font-bold"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="btn-primary flex-1 py-2.5 rounded-xl font-bold disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : '✓ Registrar Gasto'}
            </button>
          </div>
        </div>
      )}

      {/* Filtro fecha + resumen */}
      <div className="card p-5">
        <div className="flex items-center gap-4 mb-4">
          <label className="text-gray-600 text-sm font-semibold">Fecha:</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="input text-sm py-1.5"
          />
          <button onClick={cargar} className="text-purple-600 hover:text-purple-700 text-sm font-bold">
            ↻ Actualizar
          </button>
        </div>

        {/* Tarjetas por tipo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {TIPOS_GASTO.map(t => (
            <div key={t.id} className={`rounded-xl border-2 px-4 py-3 ${t.color}`}>
              <p className="text-xl">{t.icon}</p>
              <p className="text-xs font-semibold mt-1">{t.label}</p>
              <p className="text-lg font-bold mt-0.5">
                {totales[t.id] ? `$${totales[t.id].toLocaleString('es-CO')}` : '—'}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-gray-500 text-sm">{gastos.length} movimiento(s)</span>
          <div className="text-right">
            <p className="text-xs text-gray-400">Total egresos del día</p>
            <p className="text-2xl font-bold text-red-500">${totalDia.toLocaleString('es-CO')}</p>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden p-0">
        {cargando ? (
          <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
        ) : gastos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
            <DollarSign className="w-8 h-8 opacity-30" />
            <p>No hay gastos para esta fecha</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-500 text-xs uppercase">
                <th className="px-5 py-3 text-left">Hora</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Registrado por</th>
                <th className="px-4 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => {
                const t = TIPOS_GASTO.find(t => t.id === g.tipo);
                return (
                  <tr
                    key={g.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      g.tipo === 'recogida' ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                      {new Date(g.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span>{t?.icon}</span>
                        <span className="text-gray-700 font-medium">{t?.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{g.descripcion || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{g.usuario_nombre?.toUpperCase()}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">${g.valor.toLocaleString('es-CO')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
