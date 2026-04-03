import React, { useState, useEffect } from 'react';
import { Plus, Camera, FileText, X, Search, Save, Upload } from 'lucide-react';
import api, { formatCOP } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [distribuidores, setDistribuidores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ distribuidor_id: '', numero_factura: '', notas: '', items: [] });
  const [buscarProd, setBuscarProd] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [imagenUrl, setImagenUrl] = useState(null);
  const [subiendoImg, setSubiendoImg] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const [f, d] = await Promise.all([
        api.get('/inventario/facturas-compra'),
        api.get('/inventario/distribuidores')
      ]);
      setFacturas(f.facturas);
      setDistribuidores(d);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const buscarProducto = async (q) => {
    setBuscarProd(q);
    if (q.length < 2) { setResultadosBusqueda([]); return; }
    try {
      const data = await api.get(`/productos?buscar=${encodeURIComponent(q)}&limite=8`);
      setResultadosBusqueda(data.productos);
    } catch { setResultadosBusqueda([]); }
  };

  const agregarItem = (producto) => {
    setForm(f => ({
      ...f,
      items: [...f.items, {
        producto_id: producto.id, nombre_producto: producto.nombre,
        codigo: producto.codigo, cantidad: 1, precio_unitario: producto.precio_compra || 0
      }]
    }));
    setBuscarProd(''); setResultadosBusqueda([]);
  };

  const agregarItemManual = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { producto_id: null, nombre_producto: '', codigo: '', cantidad: 1, precio_unitario: 0 }]
    }));
  };

  const actualizarItem = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, [campo]: valor } : item)
    }));
  };

  const eliminarItem = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const totalFactura = form.items.reduce((s, i) => s + (parseFloat(i.cantidad)||0) * (parseFloat(i.precio_unitario)||0), 0);

  const subirImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendoImg(true);
    const formData = new FormData();
    formData.append('imagen', file);
    try {
      const res = await api.post('/inventario/facturas-compra/upload-imagen', formData);
      setImagenUrl(res.imagen_url);
      toast.success('Imagen subida. La extracción IA estará disponible pronto.');
    } catch { toast.error('Error subiendo imagen'); } finally { setSubiendoImg(false); }
  };

  const guardar = async () => {
    if (form.items.length === 0) return toast.error('Agrega al menos un producto');
    setGuardando(true);
    try {
      await api.post('/inventario/facturas-compra', {
        ...form,
        items: form.items.map(i => ({
          ...i,
          cantidad: parseFloat(i.cantidad),
          precio_unitario: parseFloat(i.precio_unitario)
        }))
      });
      toast.success('Factura procesada y stock actualizado');
      setModal(false);
      setForm({ distribuidor_id: '', numero_factura: '', notas: '', items: [] });
      setImagenUrl(null);
      cargar();
    } catch (err) { toast.error(err?.error || 'Error guardando factura'); } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Facturas de Compra</h1>
        <button onClick={() => { setModal(true); setForm({ distribuidor_id: '', numero_factura: '', notas: '', items: [] }); setImagenUrl(null); }}
          className="btn-primary gap-2">
          <Plus className="w-4 h-4" /> Nueva factura
        </button>
      </div>

      {/* Nota sobre IA */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3">
        <Camera className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-purple-800">📸 Próximamente: Lectura automática de facturas con IA</p>
          <p className="text-sm text-purple-600">Podrás fotografiar cualquier factura — escrita a mano o impresa — y la IA extraerá los productos y precios automáticamente.</p>
        </div>
      </div>

      {/* Lista de facturas */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Factura</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Distribuidor</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Fecha</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : facturas.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin facturas registradas</td></tr>
            ) : facturas.map(f => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium">{f.numero_factura || 'Sin número'}</p>
                  <p className="text-xs text-gray-400">Por: {f.usuario_nombre}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{f.distribuidor_nombre || 'Sin distribuidor'}</td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{new Date(f.creado_en).toLocaleString('es-CO')}</td>
                <td className="px-4 py-3 text-right font-bold">{formatCOP(f.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={f.estado === 'procesada' ? 'badge-success' : 'badge-warning'}>{f.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nueva factura */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Nueva factura de compra</h2>
              <button onClick={() => setModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-5">
              {/* Datos de la factura */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distribuidor</label>
                  <select value={form.distribuidor_id} onChange={e => setForm(f=>({...f,distribuidor_id:e.target.value}))} className="input">
                    <option value="">Sin distribuidor</option>
                    {distribuidores.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de factura</label>
                  <input value={form.numero_factura} onChange={e => setForm(f=>({...f,numero_factura:e.target.value}))} placeholder="Ej: FV-0023" className="input" />
                </div>
              </div>

              {/* Subir imagen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fotografía de la factura (opcional)</label>
                <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{subiendoImg ? 'Subiendo...' : imagenUrl ? '✅ Imagen guardada' : 'Clic para subir foto de factura'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={subirImagen} />
                </label>
              </div>

              {/* Buscar y agregar productos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Agregar productos</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={buscarProd} onChange={e => buscarProducto(e.target.value)}
                    placeholder="Buscar producto por nombre o código..."
                    className="input pl-9" />
                  {resultadosBusqueda.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-lg z-10 mt-1 max-h-48 overflow-y-auto">
                      {resultadosBusqueda.map(p => (
                        <button key={p.id} onClick={() => agregarItem(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b last:border-0 flex items-center justify-between">
                          <span className="text-sm font-medium">{p.nombre}</span>
                          <span className="text-xs text-gray-400">{p.codigo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={agregarItemManual} className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Agregar producto sin buscar (nuevo o de factura)
                </button>
              </div>

              {/* Tabla de items */}
              {form.items.length > 0 && (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-gray-50">
                        <th className="text-left px-2 py-2 font-medium text-gray-600">Producto</th>
                        <th className="text-right px-2 py-2 font-medium text-gray-600 w-24">Cantidad</th>
                        <th className="text-right px-2 py-2 font-medium text-gray-600 w-32">Precio unitario</th>
                        <th className="text-right px-2 py-2 font-medium text-gray-600 w-28">Subtotal</th>
                        <th className="w-8"></th>
                      </tr></thead>
                      <tbody className="divide-y">
                        {form.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-2">
                              {item.producto_id ? (
                                <p className="font-medium text-gray-800">{item.nombre_producto}</p>
                              ) : (
                                <input value={item.nombre_producto} onChange={e => actualizarItem(idx, 'nombre_producto', e.target.value)}
                                  placeholder="Nombre del producto" className="input text-xs py-1" />
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" value={item.cantidad} onChange={e => actualizarItem(idx, 'cantidad', e.target.value)} min="0.001" step="0.001" className="input text-right text-xs py-1" />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" value={item.precio_unitario} onChange={e => actualizarItem(idx, 'precio_unitario', e.target.value)} min="0" className="input text-right text-xs py-1" />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">{formatCOP((parseFloat(item.cantidad)||0)*(parseFloat(item.precio_unitario)||0))}</td>
                            <td className="px-2 py-2"><button onClick={() => eliminarItem(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t bg-gray-50">
                        <td colSpan={3} className="px-2 py-2 font-bold text-right">Total factura:</td>
                        <td className="px-2 py-2 text-right font-bold text-green-600">{formatCOP(totalFactura)}</td>
                        <td></td>
                      </tr></tfoot>
                    </table>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f=>({...f,notas:e.target.value}))} rows={2} placeholder="Observaciones..." className="input resize-none" />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModal(false)} className="flex-1 btn-ghost border border-gray-200">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="flex-1 btn-success gap-2">
                <Save className="w-4 h-4" />{guardando ? 'Procesando...' : 'Procesar factura y actualizar stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
