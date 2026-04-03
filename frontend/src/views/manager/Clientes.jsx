import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, X, Edit2, CreditCard,
  Phone, MapPin, AlertCircle, CheckCircle, Clock
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-CO');

// ── Modal crear / editar cliente ────────────────────────────────────────────
function ClienteModal({ cliente, onGuardar, onCerrar }) {
  const esNuevo = !cliente;
  const [form, setForm] = useState({
    nombre:          cliente?.nombre          || '',
    cedula:          cliente?.cedula          || '',
    celular:         cliente?.celular         || '',
    direccion:       cliente?.direccion       || '',
    cupo_disponible: cliente?.cupo_disponible ?? 0,
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCerrar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    setGuardando(true);
    try {
      const payload = { ...form, cupo_disponible: parseFloat(form.cupo_disponible) || 0 };
      if (esNuevo) { await api.post('/clientes', payload);                   toast.success('Cliente creado'); }
      else         { await api.put(`/clientes/${cliente.id}`, payload);      toast.success('Cliente actualizado'); }
      onGuardar();
    } catch (err) { toast.error(err?.error || 'Error guardando cliente'); }
    finally       { setGuardando(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{esNuevo ? 'Nuevo cliente' : 'Editar cliente'}</h2>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Nombre completo *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus
              className="input" placeholder="Ej: Juan García" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Cédula</label>
              <input value={form.cedula} onChange={e => set('cedula', e.target.value)} className="input" placeholder="1234567890" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Celular</label>
              <input value={form.celular} onChange={e => set('celular', e.target.value)} className="input" placeholder="310 000 0000" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Dirección</label>
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)} className="input" placeholder="Calle 10 # 5-20" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Cupo de crédito (fiado)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
              <input type="number" min="0" step="1000" value={form.cupo_disponible}
                onChange={e => set('cupo_disponible', e.target.value)}
                className="input pl-7" placeholder="0" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Monto máximo que puede fiar este cliente</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCerrar} className="flex-1 btn-ghost border border-gray-200">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 btn-primary">
              {guardando ? 'Guardando...' : (esNuevo ? 'Crear cliente' : 'Guardar cambios')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal detalle / créditos ────────────────────────────────────────────────
function ClienteDetalleModal({ clienteId, onCerrar, onActualizado }) {
  const [cliente, setCliente] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try { const d = await api.get(`/clientes/${clienteId}`); setCliente(d); }
    catch { toast.error('Error cargando cliente'); }
    finally { setCargando(false); }
  }, [clienteId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
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
    if (estado === 'pagado')         return <span className="badge-success flex items-center gap-1"><CheckCircle className="w-3 h-3" />Pagado</span>;
    if (estado === 'pagado_parcial') return <span className="badge-warning flex items-center gap-1"><Clock className="w-3 h-3" />Parcial</span>;
    return <span className="badge-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />Pendiente</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-gray-200 flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Cuenta del cliente</h2>
          <button onClick={onCerrar} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Cargando...</div>
        ) : cliente ? (
          <>
            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-xl font-bold text-gray-900">{cliente.nombre}</h3>
              <div className="flex flex-wrap gap-4 mt-1 text-sm text-gray-500">
                {cliente.cedula   && <span className="flex items-center gap-1"><CreditCard className="w-4 h-4" />{cliente.cedula}</span>}
                {cliente.celular  && <span className="flex items-center gap-1"><Phone className="w-4 h-4" />{cliente.celular}</span>}
                {cliente.direccion && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{cliente.direccion}</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-green-600 mb-1 font-medium">Cupo total</p>
                  <p className="text-green-700 font-bold">${fmt(cliente.cupo_disponible)}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-600 mb-1 font-medium">Deuda actual</p>
                  <p className={`font-bold ${cliente.deuda_total > 0 ? 'text-red-700' : 'text-gray-400'}`}>${fmt(cliente.deuda_total)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-600 mb-1 font-medium">Cupo disponible</p>
                  <p className={`font-bold ${cliente.cupo_restante > 0 ? 'text-blue-700' : 'text-red-700'}`}>${fmt(cliente.cupo_restante)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Historial de créditos</h4>
              {cliente.creditos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Sin créditos registrados</p>
                </div>
              ) : cliente.creditos.map(cr => (
                <div key={cr.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Factura #{cr.numero_factura}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{cr.fecha_venta}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {estadoBadge(cr.estado)}
                      <p className="text-sm font-bold text-gray-900 mt-1">${fmt(cr.monto)}</p>
                    </div>
                  </div>
                  {cr.estado !== 'pagado' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Saldo pendiente: <span className="text-red-600 font-bold">${fmt(cr.saldo_pendiente)}</span></p>
                      {pagando === cr.id ? (
                        <div className="flex gap-2">
                          <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)}
                            placeholder="Monto a abonar" autoFocus className="input flex-1 text-sm py-1.5" />
                          <button onClick={() => registrarPago(cr.id)} className="btn-success text-sm py-1.5 px-3">Abonar</button>
                          <button onClick={() => { setPagando(null); setMontoPago(''); }}
                            className="btn-ghost text-sm py-1.5 px-3 border border-gray-200"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setPagando(cr.id); setMontoPago(''); }}
                          className="w-full bg-green-50 hover:bg-green-100 text-green-700 font-semibold py-1.5 rounded-lg text-sm transition-colors border border-green-200">
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

// ── Página principal ────────────────────────────────────────────────────────
export default function Clientes() {
  const [clientes,    setClientes]    = useState([]);
  const [busqueda,    setBusqueda]    = useState('');
  const [cargando,    setCargando]    = useState(true);
  const [modalNuevo,  setModalNuevo]  = useState(false);
  const [editando,    setEditando]    = useState(null);
  const [detalle,     setDetalle]     = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const d = await api.get(`/clientes${busqueda ? `?busqueda=${encodeURIComponent(busqueda)}` : ''}`); setClientes(d); }
    catch { toast.error('Error cargando clientes'); }
    finally { setCargando(false); }
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const deudaTotal = clientes.reduce((s, c) => s + (c.deuda_total || 0), 0);
  const conDeuda   = clientes.filter(c => c.deuda_total > 0).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes / Fiados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de clientes y créditos del negocio</p>
        </div>
        <button onClick={() => setModalNuevo(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Total clientes</p>
          <p className="text-3xl font-bold text-gray-900">{clientes.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Con deuda activa</p>
          <p className="text-3xl font-bold text-red-600">{conDeuda}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Cartera total</p>
          <p className="text-3xl font-bold text-amber-600">${fmt(deudaTotal)}</p>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, cédula o celular..."
          className="input pl-10 pr-10" />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">{busqueda ? 'Sin resultados para la búsqueda' : 'No hay clientes registrados'}</p>
          {!busqueda && (
            <button onClick={() => setModalNuevo(true)} className="btn-primary mt-4 mx-auto w-fit">
              Crear primer cliente
            </button>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 uppercase font-semibold">
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
              <tbody className="divide-y divide-gray-50">
                {clientes.map(c => (
                  <tr key={c.id} onClick={() => setDetalle(c.id)}
                    className="cursor-pointer hover:bg-blue-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                          {c.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-900">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.cedula || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.celular || '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-green-700">${fmt(c.cupo_disponible)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      <span className={c.deuda_total > 0 ? 'text-red-600' : 'text-gray-400'}>${fmt(c.deuda_total)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={c.cupo_restante > 0 ? 'text-blue-600' : 'text-red-600'}>${fmt(c.cupo_restante)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.num_creditos > 0
                        ? <span className="badge-danger">{c.num_creditos}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={e => { e.stopPropagation(); setEditando(c); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalNuevo && <ClienteModal onGuardar={() => { setModalNuevo(false); cargar(); }} onCerrar={() => setModalNuevo(false)} />}
      {editando   && <ClienteModal cliente={editando} onGuardar={() => { setEditando(null); cargar(); }} onCerrar={() => setEditando(null)} />}
      {detalle    && <ClienteDetalleModal clienteId={detalle} onCerrar={() => setDetalle(null)} onActualizado={cargar} />}
    </div>
  );
}
