import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Package, AlertTriangle, X, Save } from 'lucide-react';
import api, { formatCOP } from '../../utils/api';
import toast from 'react-hot-toast';

const UNIDADES = ['unidad', 'kg', 'gr', 'lt', 'ml', 'docena', 'paquete'];

const FORM_INICIAL = {
  codigo: '', nombre: '', descripcion: '', categoria_id: '', distribuidor_id: '',
  precio_compra: '', precio_venta: '', iva_porcentaje: '0', stock: '', stock_minimo: '5',
  unidad: 'unidad', es_pesable: false
};

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [distribuidores, setDistribuidores] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [categoria, setCategoria] = useState('');
  const [stockBajo, setStockBajo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pagina, limite: 20 });
      if (buscar) params.set('buscar', buscar);
      if (categoria) params.set('categoria', categoria);
      if (stockBajo) params.set('stock_bajo', 'true');
      const data = await api.get(`/productos?${params}`);
      setProductos(data.productos);
      setTotal(data.total);
    } catch { toast.error('Error cargando productos'); } finally { setLoading(false); }
  }, [pagina, buscar, categoria, stockBajo]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    api.get('/inventario/categorias').then(setCategorias).catch(() => {});
    api.get('/inventario/distribuidores').then(setDistribuidores).catch(() => {});
  }, []);

  const abrirCrear = () => { setEditando(null); setForm(FORM_INICIAL); setModal(true); };
  const abrirEditar = (p) => {
    setEditando(p.id);
    // Usar el código de barras si existe, si no el código personalizado
    const codigoMostrar = p.codigo_barras || p.codigo;
    setForm({
      codigo: codigoMostrar, nombre: p.nombre, descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || '', distribuidor_id: p.distribuidor_id || '',
      precio_compra: p.precio_compra, precio_venta: p.precio_venta, iva_porcentaje: p.iva_porcentaje,
      stock: p.stock, stock_minimo: p.stock_minimo, unidad: p.unidad, es_pesable: !!p.es_pesable
    });
    setModal(true);
  };

  const guardar = async () => {
    if (!form.codigo || !form.nombre || !form.precio_venta) return toast.error('Código, nombre y precio son obligatorios');
    setGuardando(true);
    try {
      // El mismo código sirve como código personalizado y código de barras
      const payload = {
        ...form,
        codigo_barras: form.codigo,
        precio_compra: parseFloat(form.precio_compra)||0,
        precio_venta: parseFloat(form.precio_venta),
        iva_porcentaje: parseFloat(form.iva_porcentaje)||0,
        stock: parseInt(form.stock)||0,
        stock_minimo: parseInt(form.stock_minimo)||5
      };
      if (editando) { await api.put(`/productos/${editando}`, payload); toast.success('Producto actualizado'); }
      else { await api.post('/productos', payload); toast.success('Producto creado'); }
      setModal(false); cargar();
    } catch (err) { toast.error(err?.error || 'Error guardando producto'); } finally { setGuardando(false); }
  };

  const toggleActivo = async (p) => {
    try {
      await api.put(`/productos/${p.id}`, { activo: !p.activo });
      cargar();
    } catch { toast.error('Error actualizando producto'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <button onClick={abrirCrear} className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={buscar} onChange={e => { setBuscar(e.target.value); setPagina(1); }} placeholder="Buscar por nombre, código..."
              className="input pl-9" />
          </div>
          <select value={categoria} onChange={e => { setCategoria(e.target.value); setPagina(1); }} className="input w-48">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={stockBajo} onChange={e => setStockBajo(e.target.checked)} className="rounded" />
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Stock bajo
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Categoría</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin productos</td></tr>
              ) : productos.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    {p.es_pesable && <span className="badge-info text-xs">Pesable</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.categoria_nombre || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold text-gray-900">{formatCOP(p.precio_venta)}</p>
                    {p.iva_porcentaje > 0 && <p className="text-xs text-gray-400">IVA {p.iva_porcentaje}%</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${p.stock <= p.stock_minimo ? 'text-red-600' : 'text-gray-900'}`}>
                      {p.stock} {p.unidad}
                    </span>
                    {p.stock <= p.stock_minimo && <AlertTriangle className="w-3 h-3 text-amber-500 inline ml-1" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActivo(p)}>
                      {p.activo ? <ToggleRight className="w-6 h-6 text-green-500 mx-auto" /> : <ToggleLeft className="w-6 h-6 text-gray-400 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => abrirEditar(p)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{total} productos total</p>
            <div className="flex gap-2">
              <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="btn-ghost border border-gray-200 py-1 px-3 text-sm disabled:opacity-40">Anterior</button>
              <span className="flex items-center px-3 text-sm text-gray-600">Pág {pagina}</span>
              <button disabled={pagina * 20 >= total} onClick={() => setPagina(p => p + 1)} className="btn-ghost border border-gray-200 py-1 px-3 text-sm disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                  placeholder="Escanea el código de barras o escribe uno personalizado (ej: VER001)"
                  className="input"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Este código se usará tanto para buscar el producto manualmente como con el lector de barras.
                </p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del producto *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} placeholder="Ej: Leche Entera 1L Alquería" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={form.categoria_id} onChange={e => setForm(f => ({...f, categoria_id: e.target.value}))} className="input">
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Distribuidor</label>
                <select value={form.distribuidor_id} onChange={e => setForm(f => ({...f, distribuidor_id: e.target.value}))} className="input">
                  <option value="">Sin distribuidor</option>
                  {distribuidores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de compra (COP)</label>
                <input type="number" value={form.precio_compra} onChange={e => setForm(f => ({...f, precio_compra: e.target.value}))} placeholder="0" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio de venta (COP) *</label>
                <input type="number" value={form.precio_venta} onChange={e => setForm(f => ({...f, precio_venta: e.target.value}))} placeholder="0" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IVA (%)</label>
                <select value={form.iva_porcentaje} onChange={e => setForm(f => ({...f, iva_porcentaje: e.target.value}))} className="input">
                  <option value="0">0% (Exento)</option>
                  <option value="5">5%</option>
                  <option value="19">19%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
                <select value={form.unidad} onChange={e => setForm(f => ({...f, unidad: e.target.value}))} className="input">
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock actual</label>
                <input type="number" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} placeholder="0" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo</label>
                <input type="number" value={form.stock_minimo} onChange={e => setForm(f => ({...f, stock_minimo: e.target.value}))} placeholder="5" className="input" />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.es_pesable} onChange={e => setForm(f => ({...f, es_pesable: e.target.checked, unidad: e.target.checked ? 'kg' : f.unidad}))} className="w-4 h-4 rounded" />
                  <div>
                    <p className="font-medium text-gray-800">Producto pesable</p>
                    <p className="text-xs text-gray-500">Para verduras, frutas y carnes que se pesan en báscula</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(false)} className="flex-1 btn-ghost border border-gray-200">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 btn-primary gap-2">
                <Save className="w-4 h-4" />{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
