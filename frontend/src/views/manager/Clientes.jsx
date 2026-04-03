import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, ChevronLeft, Edit2, CreditCard,
  Phone, MapPin, DollarSign, AlertCircle, CheckCircle, Clock
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO');

// ── Modal para crear / editar cliente ──────────────────────────────────────
function ClienteModal({ cliente, onGuardar, onCerrar }) {
  const esNuevo = !cliente;
  const [form, setForm] = useState({
    nombre: cliente?.nombre || '',
    cedula: cliente?.cedula || '',
    celular: cliente?.celular || '',
    direccion: cliente?.direccion || '',
    cupo_disponible: cliente?.cupo_disponible ?? 0,
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    setGuardando(true);
    try {
      const payload = { ...form, cupo_disponible: parseFloat(form.cupo_disponible) || 0 };
      if (esNuevo) {
        await api.post('/clientes', payload);
        toast.success('Cliente creado');
      } else {
        await api.put(`/clientes/${cliente.id}`, payload);
        toast.success('Cliente actualizado');
      }
      onGuardar();
    } catch (err) {
      toast.error(err?.error || 'Error guardando cliente');
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-600 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">{esNuevo ? '➕ Nuevo Cliente' : '✏️ Editar Cliente'}</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Nombre completo *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Juan García" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Cédula</label>
              <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1234567890" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Celular</label>
              <input value={form.celular} onChange={e => set('celular', e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="310 000 0000" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Dirección</label>
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Calle 10 # 5-20" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase">Cupo de crédito (fiado)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
              <input type="number" min="0" step="1000" value={form.cupo_disponible}
                onChange={e => set('cupo_disponible', e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Monto máximo que puede fiar este cliente</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={guardando}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
              {guardando ? 'Guardando...' : (esNuevo ? 'Crear cliente' : 'Guardar cambios')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal de detalle de cliente (créditos/deudas) ──────────────────────────
function ClienteDetalleModal({ clienteId, onCerrar, onActualizado }) {
  const [cliente, setCliente] = useState(null);
  const [pagando, setPagando] = useState(null); // credito_id en pago
  const [montoPago, setMontoPago] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const data = await api.get(`/clientes/${clienteId}`);
      setCliente(data);
    } catch { toast.error('Error cargando cliente'); }
    finally { setCargando(false); }
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCerrar]);

  const registrarPago = async (creditoId) => {
    const monto = parseFloat(montoPago.replace(/\./g, '').replace(',', '.'));
    if (!monto || monto <= 0) return toast.error('Ingresa un monto válido');
    try {
      await api.post(`/clientes/${clienteId}/pagar`, { credito_id: creditoId, monto });
      toast.success('Pago registrado');
      setPagando(null); setMontoPago('');
      cargar(); onActualizado();
    } catch (err) { toast.error(err?.error || 'Error'); }
  };

  const estadoBadge = (estado) => {
    if (estado === 'pagado') return <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" />Pagado</span>;
    if (estado === 'pagado_parcial') return <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><Clock className="w-3 h-3" />Parcial</span>;
    return <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" />Pendiente</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <h2 className="text-lg font-bold text-white">📋 Cuenta del cliente</h2>
          <button onClick={onCerrar} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Cargando...</div>
        ) : cliente ? (
          <>
            {/* Info del cliente */}
            <div className="p-5 border-b border-gray-700 shrink-0">
              <h3 className="text-xl font-bold text-white">{cliente.nombre}</h3>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
                {cliente.cedula && <span className="flex items-center gap-1"><CreditCard className="w-4 h-4" />{cliente.cedula}</span>}
                {cliente.celular && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{cliente.celular}</span>}
                {cliente.direccion && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{cliente.direccion}</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Cupo total</p>
                  <p className="text-green-400 font-bold">${fmt(cliente.cupo_disponible)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Deuda actual</p>
                  <p className={`font-bold ${cliente.deuda_total > 0 ? 'text-red-400' : 'text-gray-300'}`}>${fmt(cliente.deuda_total)}</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Cupo disponible</p>
                  <p className={`font-bold ${cliente.cupo_restante > 0 ? 'text-blue-400' : 'text-red-400'}`}>${fmt(cliente.cupo_restante)}</p>
                </div>
              </div>
            </div>

            {/* Historial de créditos */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wide">Historial de créditos</h4>
              {cliente.creditos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Sin créditos registrados</p>
                </div>
              ) : cliente.creditos.map(cr => (
                <div key={cr.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white text-sm">Factura #{cr.numero_factura}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{cr.fecha_venta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {estadoBadge(cr.estado)}
                      <p className="text-sm font-bold text-white mt-1">${fmt(cr.monto)}</p>
                    </div>
                  </div>
                  {cr.estado !== 'pagado' && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-400 mb-2">Saldo pendiente: <span className="text-red-400 font-bold">${fmt(cr.saldo_pendiente)}</span></p>
                      {pagando === cr.id ? (
                        <div className="flex gap-2">
                          <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)}
                            placeholder="Monto a abonar" autoFocus
                            className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          <button onClick={() => registrarPago(cr.id)}
                            className="bg-green-700 hover:bg-green-600 text-white font-bold px-3 py-1.5 rounded-lg text-sm transition-colors">
                            Abonar
                          </button>
                          <button onClick={() => { setPagando(null); setMontoPago(''); }}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setPagando(cr.id); setMontoPago(''); }}
                          className="w-full bg-green-900 hover:bg-green-800 text-green-300 font-semibold py-1.5 rounded-lg text-sm transition-colors">
                          💰 Registrar pago
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Página principal de Clientes ───────────────────────────────────────────
export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await api.get(`/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`);
      setClientes(data);
    } catch { toast.error('Error cargando clientes'); }
    finally { setCargando(false); }
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const deudaTotal = clientes.reduce((s, c) => s + (c.deuda_total || 0), 0);
  const conDeuda = clientes.filter(c => c.deuda_total > 0).length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/gerente')} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Users className="w-6 h-6 text-blue-400" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Clientes / Fiados</h1>
          <p className="text-xs text-gray-400">Gestión de clientes y créditos del negocio</p>
        </div>
        <button onClick={() => setModalNuevo(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {/* Resumen */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4 border-b border-gray-700">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Total clientes</p>
          <p className="text-3xl font-bold text-white">{clientes.length}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Con deuda activa</p>
          <p className="text-3xl font-bold text-red-400">{conDeuda}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Cartera total</p>
          <p className="text-3xl font-bold text-yellow-400">${fmt(deudaTotal)}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cédula o celular..."
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="px-6 pb-6">
        {cargando ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{busqueda ? 'Sin resultados para la búsqueda' : 'No hay clientes registrados'}</p>
            {!busqueda && (
              <button onClick={() => setModalNuevo(true)}
                className="mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-colors">
                Crear primer cliente
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase font-semibold">
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Cédula</th>
                  <th className="px-4 py-3 text-left">Celular</th>
                  <th className="px-4 py-3 text-right">Cupo total</th>
                  <th className="px-4 py-3 text-right">Deuda</th>
                  <th className="px-4 py-3 text-right">Disponible</th>
                  <th className="px-4 py-3 text-center">Créditos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, i) => (
                  <tr key={c.id}
                    onClick={() => setDetalle(c.id)}
                    className={`border-b border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors
                      ${i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {c.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-white">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.cedula || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{c.celular || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">${fmt(c.cupo_disponible)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={c.deuda_total > 0 ? 'text-red-400' : 'text-gray-500'}>
                        ${fmt(c.deuda_total)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={c.cupo_restante > 0 ? 'text-blue-400' : 'text-red-400'}>
                        ${fmt(c.cupo_restante)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.num_creditos > 0 ? (
                        <span className="bg-red-900 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full">{c.num_creditos}</span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); setEditando(c); }}
                        className="text-gray-500 hover:text-blue-400 transition-colors p-1 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {modalNuevo && (
        <ClienteModal onGuardar={() => { setModalNuevo(false); cargar(); }} onCerrar={() => setModalNuevo(false)} />
      )}
      {editando && (
        <ClienteModal cliente={editando} onGuardar={() => { setEditando(null); cargar(); }} onCerrar={() => setEditando(null)} />
      )}
      {detalle && (
        <ClienteDetalleModal clienteId={detalle} onCerrar={() => setDetalle(null)} onActualizado={cargar} />
      )}
    </div>
  );
}
