import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowRight,
  RefreshCw, DollarSign, TrendingDown, RotateCcw, Tag, Wallet,
  CreditCard, Smartphone, Banknote, Users
} from 'lucide-react';
import api, { formatCOP } from '../../utils/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const METODO_LABEL = { efectivo: 'Efectivo', credito: 'Crédito', nequi: 'Nequi', daviplata: 'Daviplata', transferencia: 'Transferencia' };
const METODO_COLOR = { efectivo: 'bg-green-100 text-green-800', credito: 'bg-amber-100 text-amber-800', nequi: 'bg-pink-100 text-pink-800', daviplata: 'bg-red-100 text-red-800', transferencia: 'bg-blue-100 text-blue-800' };
const METODO_ICON  = { efectivo: <Banknote className="w-4 h-4" />, credito: <CreditCard className="w-4 h-4" />, nequi: <Smartphone className="w-4 h-4" />, daviplata: <Smartphone className="w-4 h-4" />, transferencia: <Wallet className="w-4 h-4" /> };

function StatCard({ label, value, sub, icon, color = 'blue', small = false }) {
  const colors = {
    green:  'bg-green-50  border-green-100  text-green-700',
    blue:   'bg-blue-50   border-blue-100   text-blue-700',
    red:    'bg-red-50    border-red-100    text-red-700',
    amber:  'bg-amber-50  border-amber-100  text-amber-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
    gray:   'bg-gray-50   border-gray-100   text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between mb-2">{icon}<span className="text-xs opacity-60 font-medium">{sub}</span></div>
      <p className={`font-bold ${small ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="text-sm font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [diario, setDiario] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const cargar = async () => {
    setLoading(true);
    try {
      const [dash, dia] = await Promise.all([
        api.get('/reportes/dashboard'),
        api.get('/reportes/diario'),
      ]);
      setData(dash);
      setDiario(dia);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return null;

  const hoy = data.hoy;
  const chartData = (diario?.ventasPorHora || []).map(h => ({
    hora: `${h.hora}:00`, ventas: parseFloat(h.ingresos) || 0,
  }));

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={cargar} className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button onClick={() => navigate('/gerente/reportes')} className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-3 py-2 text-sm font-medium hover:bg-blue-700">
            Ver informes <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Fila 1: métricas principales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ventas hoy" value={formatCOP(hoy.total)}
          sub={`${hoy.transacciones} transacciones`} color="green"
          icon={<TrendingUp className="w-5 h-5 text-green-600" />} />
        <StatCard label="Ventas del mes" value={formatCOP(data.mes.total)}
          sub="Mes actual" color="blue"
          icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Efectivo esperado" value={formatCOP(hoy.efectivo_esperado)}
          sub="En caja ahora" color={hoy.efectivo_esperado >= 0 ? 'green' : 'red'}
          icon={<Wallet className="w-5 h-5 text-green-600" />} />
        <StatCard label="Gastos hoy" value={formatCOP(hoy.gastos)}
          sub={hoy.recogida > 0 ? `Recogida: ${formatCOP(hoy.recogida)}` : 'Sin recogida'}
          color="amber" icon={<TrendingDown className="w-5 h-5 text-amber-600" />} />
      </div>

      {/* ── Fila 2: detalles operativos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Devoluciones" value={hoy.devoluciones?.cantidad || 0}
          sub={formatCOP(hoy.devoluciones?.total || 0)} color="red" small
          icon={<RotateCcw className="w-5 h-5 text-red-500" />} />
        <StatCard label="Descuentos aplicados" value={formatCOP(hoy.descuentos)}
          sub="En ítems de venta" color="purple" small
          icon={<Tag className="w-5 h-5 text-purple-600" />} />
        <StatCard label="Abonos recibidos" value={formatCOP(hoy.abonos)}
          sub="Pagos de deudas" color="blue" small
          icon={<Users className="w-5 h-5 text-blue-600" />} />
        <StatCard label="Stock bajo" value={data.inventario.stock_bajo}
          sub={`de ${data.inventario.total_productos} productos`}
          color={data.inventario.stock_bajo > 0 ? 'red' : 'gray'} small
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />} />
      </div>

      {/* ── Fila 3: métodos de pago + gráfico ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Métodos de pago */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4">Ventas por método de pago (hoy)</h2>
          {(diario?.porMetodoPago || []).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Sin ventas registradas</p>
          ) : (
            <div className="space-y-3">
              {(diario?.porMetodoPago || []).map(m => {
                const pct = hoy.total > 0 ? ((m.total / hoy.total) * 100).toFixed(0) : 0;
                return (
                  <div key={m.metodo_pago}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${METODO_COLOR[m.metodo_pago] || 'bg-gray-100 text-gray-700'}`}>
                          {METODO_ICON[m.metodo_pago]}
                          {METODO_LABEL[m.metodo_pago] || m.metodo_pago}
                        </span>
                        <span className="text-xs text-gray-400">{m.cantidad} venta{m.cantidad !== 1 ? 's' : ''}</span>
                      </div>
                      <span className="font-bold text-gray-800 text-sm">{formatCOP(m.total)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gráfico por hora */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4">Ventas por hora (hoy)</h2>
          {chartData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Sin ventas registradas</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [formatCOP(v), 'Ventas']} />
                <Bar dataKey="ventas" fill="#2563eb" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Fila 4: resumen de caja + últimas ventas ── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Resumen de caja */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-bold text-gray-800 mb-4">Resumen de caja hoy</h2>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Ventas en efectivo',  value: formatCOP((diario?.porMetodoPago || []).find(m => m.metodo_pago === 'efectivo')?.total || 0), color: 'text-green-600' },
              { label: '+ Abonos recibidos',  value: formatCOP(hoy.abonos),   color: 'text-green-600' },
              { label: '− Gastos y pagos',    value: formatCOP(hoy.gastos - hoy.recogida), color: 'text-red-500' },
              { label: '− Recogida de caja',  value: formatCOP(hoy.recogida), color: 'text-red-500' },
            ].map(r => (
              <div key={r.label} className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">{r.label}</span>
                <span className={`font-semibold ${r.color}`}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <span className="font-bold text-gray-800">= Efectivo en caja</span>
              <span className={`font-bold text-lg ${hoy.efectivo_esperado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCOP(hoy.efectivo_esperado)}
              </span>
            </div>
          </div>
          <button onClick={() => navigate('/gerente/reportes')}
            className="mt-4 w-full text-center text-blue-600 text-xs font-medium hover:underline flex items-center justify-center gap-1">
            Ver informe completo <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Últimas ventas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Últimas ventas</h2>
            <button onClick={() => navigate('/gerente/reportes')} className="text-blue-600 text-xs flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {data.ultimas_ventas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Sin ventas aún</p>
          ) : (
            <div className="space-y-1">
              {data.ultimas_ventas.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.numero_factura}</p>
                    <p className="text-xs text-gray-400">{v.cajero} · <span className={`font-medium ${METODO_COLOR[v.metodo_pago] || ''}`}>{METODO_LABEL[v.metodo_pago] || v.metodo_pago}</span></p>
                  </div>
                  <p className="font-bold text-green-600 text-sm">{formatCOP(v.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerta stock bajo */}
      {data.inventario.stock_bajo > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">{data.inventario.stock_bajo} productos con stock bajo</p>
            <p className="text-sm text-amber-600">Necesitan reabastecerse pronto</p>
          </div>
          <button onClick={() => navigate('/gerente/inventario')}
            className="text-amber-700 font-medium text-sm flex items-center gap-1 hover:underline shrink-0">
            Ver <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
