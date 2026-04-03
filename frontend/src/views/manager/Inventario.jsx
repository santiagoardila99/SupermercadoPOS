import React, { useState, useEffect } from 'react';
import { AlertTriangle, Plus, Minus, RotateCcw, TrendingUp, Package } from 'lucide-react';
import api, { formatCOP } from '../../utils/api';
import toast from 'react-hot-toast';

export default function Inventario() {
  const [stockBajo, setStockBajo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAjuste, setModalAjuste] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [tipo, setTipo] = useState('entrada');
  const [notas, setNotas] = useState('');

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await api.get('/reportes/stock-bajo');
      setStockBajo(data.productos);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const ajustarStock = async () => {
    if (!cantidad || parseFloat(cantidad) <= 0) return toast.error('Ingresa una cantidad válida');
    try {
      await api.post(`/productos/${modalAjuste.id}/ajustar-stock`, {
        cantidad: parseFloat(cantidad), tipo, notas
      });
      toast.success('Stock actualizado');
      setModalAjuste(null); setCantidad(''); setNotas('');
      cargar();
    } catch (err) { toast.error(err?.error || 'Error ajustando stock'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 text-sm">Productos con stock bajo o agotado</p>
        </div>
        <button onClick={cargar} className="btn-ghost border border-gray-200 text-sm">Actualizar</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Cargando...</p>
      ) : stockBajo.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">¡Todo el inventario está bien!</p>
          <p className="text-gray-400 text-sm mt-1">Todos los productos tienen stock suficiente</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-amber-800 font-medium">{stockBajo.length} productos necesitan reabastecerse</p>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Categoría</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Mínimo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockBajo.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.categoria_nombre || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>{p.stock}</span>
                      <span className="text-gray-400 text-xs ml-1">{p.unidad}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.stock_minimo}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => { setModalAjuste(p); setCantidad(''); setTipo('entrada'); setNotas(''); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 mx-auto">
                        <Plus className="w-3 h-3" /> Agregar stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal ajuste de stock */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b">
              <h2 className="font-bold text-lg">Ajustar stock</h2>
              <p className="text-gray-500 text-sm">{modalAjuste.nombre}</p>
              <p className="text-gray-400 text-xs mt-0.5">Stock actual: <strong>{modalAjuste.stock} {modalAjuste.unidad}</strong></p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de movimiento</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{v:'entrada', l:'Entrada', i:<TrendingUp className="w-4 h-4"/>}, {v:'salida', l:'Salida', i:<Minus className="w-4 h-4"/>}, {v:'ajuste', l:'Ajuste', i:<RotateCcw className="w-4 h-4"/>}].map(t => (
                    <button key={t.v} onClick={() => setTipo(t.v)}
                      className={`flex items-center justify-center gap-1 p-2 rounded-xl border-2 text-sm font-medium transition-colors ${tipo === t.v ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                      {t.i}{t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tipo === 'ajuste' ? 'Nuevo stock total' : 'Cantidad'}
                </label>
                <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0" step="0.001"
                  placeholder={tipo === 'ajuste' ? 'Stock nuevo total' : 'Cantidad a agregar/quitar'}
                  className="input" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: Llegó factura distribuidor X"
                  className="input" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setModalAjuste(null)} className="flex-1 btn-ghost border border-gray-200">Cancelar</button>
              <button onClick={ajustarStock} className="flex-1 btn-primary">Confirmar ajuste</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
