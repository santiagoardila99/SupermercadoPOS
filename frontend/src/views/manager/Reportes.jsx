import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import {
  Calendar, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, RotateCcw, Tag, Wallet, CreditCard, Smartphone,
  Banknote, Users, ChevronDown, ChevronUp, Package, AlertCircle, Printer,
} from 'lucide-react';
import api, { formatCOP } from '../../utils/api';

// ── helpers ──────────────────────────────────────────────────────────────────
const fh = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};
const fd = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const METODO_LABEL = { efectivo:'Efectivo', credito:'Crédito', nequi:'Nequi', daviplata:'Daviplata', transferencia:'Transferencia' };
const METODO_COLOR = { efectivo:'bg-green-100 text-green-800', credito:'bg-amber-100 text-amber-800', nequi:'bg-pink-100 text-pink-800', daviplata:'bg-red-100 text-red-800', transferencia:'bg-blue-100 text-blue-800' };
const METODO_ICON  = { efectivo:<Banknote className="w-3.5 h-3.5"/>, credito:<CreditCard className="w-3.5 h-3.5"/>, nequi:<Smartphone className="w-3.5 h-3.5"/>, daviplata:<Smartphone className="w-3.5 h-3.5"/>, transferencia:<Wallet className="w-3.5 h-3.5"/> };

const GASTO_LABEL = { proveedor:'Proveedor', nomina:'Nómina', personal:'Personal', recogida:'Recogida de caja' };
const GASTO_COLOR = { proveedor:'bg-blue-100 text-blue-800', nomina:'bg-purple-100 text-purple-800', personal:'bg-gray-100 text-gray-700', recogida:'bg-red-100 text-red-800' };

// ── sub-componentes simples ───────────────────────────────────────────────────
function SectionCard({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2 font-bold text-gray-800">{icon}{title}</div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function Badge({ label, color = '' }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color || 'bg-gray-100 text-gray-700'}`}>{label}</span>;
}

function EmptyMsg({ msg = 'Sin registros para esta fecha' }) {
  return <p className="text-gray-400 text-sm text-center py-6">{msg}</p>;
}

function KpiRow({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {items.map(({ label, value, sub, color = 'gray' }) => {
        const bg = { green:'bg-green-50 text-green-700 border-green-100', red:'bg-red-50 text-red-700 border-red-100', blue:'bg-blue-50 text-blue-700 border-blue-100', amber:'bg-amber-50 text-amber-700 border-amber-100', purple:'bg-purple-50 text-purple-700 border-purple-100', gray:'bg-gray-50 text-gray-700 border-gray-100' };
        return (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg[color]}`}>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs font-semibold mt-0.5">{label}</p>
            {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Caja del día ─────────────────────────────────────────────────────────
function TabCaja({ data }) {
  if (!data) return <EmptyMsg msg="Cargando..." />;
  const { ventas, gastos, abonos, caja, descuentos, devoluciones, creditos } = data;

  return (
    <div className="space-y-4">

      {/* Resumen de caja */}
      <SectionCard title="Resumen de caja" icon={<Wallet className="w-4 h-4 text-green-600"/>}>
        <div className="max-w-sm space-y-1 text-sm">
          {[
            { label: 'Ventas en efectivo',    value: caja.efectivo_ventas,  sign: '+', color: 'text-green-600' },
            { label: 'Abonos de clientes',    value: caja.abonos_recibidos, sign: '+', color: 'text-green-600' },
            { label: 'Gastos y pagos',        value: caja.gastos_pagados,   sign: '−', color: 'text-red-500' },
            { label: 'Recogida de caja',      value: caja.recogidas,        sign: '−', color: 'text-red-500' },
          ].map(r => (
            <div key={r.label} className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">{r.sign} {r.label}</span>
              <span className={`font-semibold ${r.color}`}>{formatCOP(r.value || 0)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-3">
            <span className="font-bold text-gray-800 text-base">= Efectivo en caja</span>
            <span className={`font-bold text-xl ${caja.efectivo_esperado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCOP(caja.efectivo_esperado)}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Ventas por método */}
      <SectionCard title="Ventas por método de pago" icon={<DollarSign className="w-4 h-4 text-blue-600"/>}>
        <KpiRow items={[
          { label: 'Total ventas',   value: ventas.resumen?.total_ventas || 0,          sub: 'transacciones',     color: 'blue'   },
          { label: 'Ingreso bruto',  value: formatCOP(ventas.resumen?.ingreso_bruto||0), sub: 'todas las ventas',  color: 'green'  },
          { label: 'Con cliente',    value: ventas.resumen?.ventas_con_cliente || 0,     sub: 'ventas asignadas',  color: 'purple' },
          { label: 'IVA total',      value: formatCOP(ventas.resumen?.iva_total||0),     sub: 'recaudado',         color: 'gray'   },
        ]} />
        {ventas.porMetodo.length === 0 ? <EmptyMsg /> : (
          <div className="space-y-3">
            {ventas.porMetodo.map(m => {
              const total = ventas.resumen?.ingreso_bruto || 1;
              const pct = Math.round((m.total / total) * 100);
              return (
                <div key={m.metodo_pago}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge label={METODO_LABEL[m.metodo_pago] || m.metodo_pago} color={METODO_COLOR[m.metodo_pago]} />
                      <span className="text-xs text-gray-400">{m.cantidad} venta{m.cantidad !== 1 ? 's' : ''} · {pct}%</span>
                    </div>
                    <span className="font-bold text-gray-800">{formatCOP(m.total)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Ventas en crédito */}
      {creditos.detalle.length > 0 && (
        <SectionCard title={`Ventas en crédito (${creditos.detalle.length})`} icon={<CreditCard className="w-4 h-4 text-amber-600"/>} defaultOpen={false}>
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
            Total fiado: <strong>{formatCOP(creditos.resumen?.total || 0)}</strong> en {creditos.resumen?.cantidad || 0} venta(s)
          </p>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase border-b">
              <th className="text-left py-2">Factura</th><th className="text-left">Cliente</th>
              <th className="text-left">Cédula</th><th className="text-right">Total</th><th className="text-right">Hora</th>
            </tr></thead>
            <tbody>{creditos.detalle.map((v,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-600">{v.numero_factura}</td>
                <td className="py-2 text-gray-800 font-medium">{v.cliente}</td>
                <td className="py-2 text-gray-500">{v.cedula || '—'}</td>
                <td className="py-2 text-right font-bold text-amber-700">{formatCOP(v.total)}</td>
                <td className="py-2 text-right text-gray-400 text-xs">{fh(v.creado_en)}</td>
              </tr>
            ))}</tbody>
          </table>
        </SectionCard>
      )}

      {/* Mini-tabla de ventas del día */}
      <SectionCard title={`Todas las ventas del día (${ventas.lista.length})`} icon={<ShoppingCart className="w-4 h-4 text-gray-500"/>} defaultOpen={false}>
        {ventas.lista.length === 0 ? <EmptyMsg /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 uppercase border-b">
                <th className="text-left py-2">Factura</th><th className="text-left">Cajero</th>
                <th className="text-left">Método</th><th className="text-left">Cliente</th>
                <th className="text-right">Total</th><th className="text-right">Hora</th>
              </tr></thead>
              <tbody>{ventas.lista.map((v,i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-1.5 font-mono text-xs text-gray-500">{v.numero_factura}</td>
                  <td className="py-1.5 text-gray-700">{v.cajero || '—'}</td>
                  <td className="py-1.5"><Badge label={METODO_LABEL[v.metodo_pago]||v.metodo_pago} color={METODO_COLOR[v.metodo_pago]}/></td>
                  <td className="py-1.5 text-gray-500 text-xs">{v.cliente || 'Consumidor final'}</td>
                  <td className="py-1.5 text-right font-bold text-gray-800">{formatCOP(v.total)}</td>
                  <td className="py-1.5 text-right text-gray-400 text-xs">{fh(v.creado_en)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Tab: Gastos & Recogidas ───────────────────────────────────────────────────
function TabGastos({ data }) {
  if (!data) return <EmptyMsg msg="Cargando..." />;
  const { gastos } = data;

  const porTipo = gastos.resumen.reduce((acc, g) => { acc[g.tipo] = g; return acc; }, {});

  return (
    <div className="space-y-4">
      <SectionCard title="Resumen de gastos" icon={<TrendingDown className="w-4 h-4 text-red-500"/>}>
        <KpiRow items={[
          { label: 'Total gastos',      value: formatCOP(gastos.totalGastos),    sub: 'todo incluido',      color: 'red'    },
          { label: 'Recogida de caja',  value: formatCOP(gastos.totalRecogidas), sub: 'extraído de caja',   color: 'amber'  },
          { label: 'Pagos y gastos',    value: formatCOP(gastos.gastosSinRecog), sub: 'proveedor/nómina',   color: 'blue'   },
          { label: 'Movimientos',       value: gastos.detalle.length,            sub: 'registros',          color: 'gray'   },
        ]} />

        {/* Por categoría */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {['proveedor','nomina','personal','recogida'].map(tipo => {
            const g = porTipo[tipo];
            return (
              <div key={tipo} className={`rounded-lg border p-3 text-center ${g ? (GASTO_COLOR[tipo] || 'bg-gray-50') : 'bg-gray-50 text-gray-300'}`}>
                <p className="text-lg font-bold">{formatCOP(g?.total || 0)}</p>
                <p className="text-xs font-semibold mt-0.5">{GASTO_LABEL[tipo]}</p>
                <p className="text-xs opacity-60">{g?.cantidad || 0} registro{g?.cantidad !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Detalle de gastos" icon={<Package className="w-4 h-4 text-gray-500"/>}>
        {gastos.detalle.length === 0 ? <EmptyMsg /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase border-b">
              <th className="text-left py-2">Tipo</th><th className="text-left">Descripción</th>
              <th className="text-left">Usuario</th><th className="text-right">Valor</th><th className="text-right">Hora</th>
            </tr></thead>
            <tbody>{gastos.detalle.map((g,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2"><Badge label={GASTO_LABEL[g.tipo]||g.tipo} color={GASTO_COLOR[g.tipo]}/></td>
                <td className="py-2 text-gray-700">{g.descripcion || '—'}</td>
                <td className="py-2 text-gray-500 text-xs">{g.usuario || '—'}</td>
                <td className="py-2 text-right font-bold text-red-600">{formatCOP(g.valor)}</td>
                <td className="py-2 text-right text-gray-400 text-xs">{fh(g.creado_en)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

// ── Tab: Devoluciones & Descuentos ───────────────────────────────────────────
function TabDevDesc({ data }) {
  if (!data) return <EmptyMsg msg="Cargando..." />;
  const { devoluciones, descuentos } = data;

  return (
    <div className="space-y-4">
      {/* Devoluciones */}
      <SectionCard title="Devoluciones" icon={<RotateCcw className="w-4 h-4 text-red-500"/>}>
        <KpiRow items={[
          { label: 'Total devoluciones',  value: devoluciones.resumen?.cantidad || 0,                    sub: 'registradas',   color: devoluciones.resumen?.cantidad > 0 ? 'red' : 'gray' },
          { label: 'Monto devuelto',      value: formatCOP(devoluciones.resumen?.total_devuelto || 0),   sub: 'total',         color: 'red'   },
          { label: 'Totales',             value: devoluciones.resumen?.totales || 0,                     sub: 'venta completa', color: 'amber' },
          { label: 'Parciales',           value: devoluciones.resumen?.parciales || 0,                   sub: 'ítem(s)',        color: 'blue'  },
        ]} />
        {devoluciones.detalle.length === 0 ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm">
            <span>✓</span> Sin devoluciones registradas
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase border-b">
              <th className="text-left py-2">Factura</th><th className="text-left">Tipo</th>
              <th className="text-left">Motivo</th><th className="text-left">Cajero</th>
              <th className="text-right">Monto</th><th className="text-right">Hora</th>
            </tr></thead>
            <tbody>{devoluciones.detalle.map((d,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-500">{d.numero_factura}</td>
                <td className="py-2"><Badge label={d.tipo} color={d.tipo==='total'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}/></td>
                <td className="py-2 text-gray-600 text-xs">{d.motivo || '—'}</td>
                <td className="py-2 text-gray-500 text-xs">{d.cajero || '—'}</td>
                <td className="py-2 text-right font-bold text-red-600">{formatCOP(d.monto_devuelto)}</td>
                <td className="py-2 text-right text-gray-400 text-xs">{fh(d.creado_en)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>

      {/* Descuentos */}
      <SectionCard title="Descuentos aplicados" icon={<Tag className="w-4 h-4 text-purple-600"/>}>
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-4 py-3 mb-4 text-sm text-purple-800">
          Se aplicaron descuentos en <strong>{descuentos.resumen?.ventas_con_descuento || 0}</strong> venta(s),
          con <strong>{descuentos.resumen?.items_con_descuento || 0}</strong> ítem(s) afectado(s).
          Total descontado: <strong>{formatCOP(descuentos.resumen?.total_descuentos_item || 0)}</strong>
        </div>
        <div className="mb-2 text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-amber-500"/>
          Los productos eliminados con F7 antes de finalizar la venta no quedan registrados en el sistema (son ajustes previos al cobro).
        </div>
        {descuentos.detalle.length === 0 ? (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm">
            <span>✓</span> Sin descuentos en ítems
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase border-b">
              <th className="text-left py-2">Factura</th><th className="text-left">Producto</th>
              <th className="text-right">Precio</th><th className="text-right">Descuento</th>
              <th className="text-right">Final</th><th className="text-right">Hora</th>
            </tr></thead>
            <tbody>{descuentos.detalle.map((d,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-mono text-xs text-gray-500">{d.numero_factura}</td>
                <td className="py-2 text-gray-700">{d.producto} <span className="text-gray-400 text-xs">×{d.cantidad}</span></td>
                <td className="py-2 text-right text-gray-400">{formatCOP(d.precio_unitario)}</td>
                <td className="py-2 text-right font-semibold text-purple-600">−{formatCOP(d.descuento_item)}</td>
                <td className="py-2 text-right font-bold text-gray-800">{formatCOP(d.subtotal)}</td>
                <td className="py-2 text-right text-gray-400 text-xs">{fh(d.creado_en)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

// ── Tab: Abonos & Créditos ────────────────────────────────────────────────────
function TabAbonos({ data }) {
  if (!data) return <EmptyMsg msg="Cargando..." />;
  const { abonos, creditos } = data;

  return (
    <div className="space-y-4">
      <SectionCard title="Abonos recibidos" icon={<Users className="w-4 h-4 text-blue-600"/>}>
        <KpiRow items={[
          { label: 'Abonos recibidos', value: abonos.resumen?.cantidad || 0,            sub: 'pagos de deuda',  color: 'blue'  },
          { label: 'Total cobrado',    value: formatCOP(abonos.resumen?.total || 0),    sub: 'ingresó a caja',  color: 'green' },
          { label: 'Créditos nuevos',  value: creditos.resumen?.cantidad || 0,          sub: 'fiados hoy',      color: 'amber' },
          { label: 'Total fiado hoy',  value: formatCOP(creditos.resumen?.total || 0),  sub: 'por cobrar',      color: 'red'   },
        ]} />
        {abonos.detalle.length === 0 ? <EmptyMsg /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-400 uppercase border-b">
              <th className="text-left py-2">Cliente</th><th className="text-left">Cédula</th>
              <th className="text-left">Descripción</th><th className="text-right">Valor</th><th className="text-right">Hora</th>
            </tr></thead>
            <tbody>{abonos.detalle.map((a,i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 font-medium text-gray-800">{a.cliente}</td>
                <td className="py-2 text-gray-500 text-xs">{a.cedula || '—'}</td>
                <td className="py-2 text-gray-600 text-xs">{a.descripcion || '—'}</td>
                <td className="py-2 text-right font-bold text-green-600">{formatCOP(a.valor)}</td>
                <td className="py-2 text-right text-gray-400 text-xs">{fh(a.creado_en)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

// ── Tab: Mensual ──────────────────────────────────────────────────────────────
function TabMensual() {
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [añoSel, setAñoSel] = useState(new Date().getFullYear());
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get(`/reportes/mensual?año=${añoSel}&mes=${mesSel}`)); }
    catch { } finally { setLoading(false); }
  }, [mesSel, añoSel]);

  useEffect(() => { cargar(); }, [cargar]);

  const chartData = (data?.ventasPorDia || []).map(d => {
    const gastosDia = data?.gastosPorDia?.find(g => g.fecha === d.fecha)?.total_gastos || 0;
    return { fecha: fd(d.fecha), ventas: d.ingresos || 0, gastos: gastosDia };
  });

  return (
    <div className="space-y-4">
      {/* Selector */}
      <div className="flex gap-2 items-center">
        <select value={mesSel} onChange={e => setMesSel(+e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={añoSel} onChange={e => setAñoSel(+e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={cargar} className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5"/> Actualizar
        </button>
      </div>

      {loading && <div className="text-center text-gray-400 py-8">Cargando...</div>}

      {!loading && data && (
        <>
          <KpiRow items={[
            { label: 'Ventas del mes',  value: data.resumenMes?.ventas_completadas || 0,            sub: 'transacciones', color: 'blue'  },
            { label: 'Ingreso total',   value: formatCOP(data.resumenMes?.ingresos_totales || 0),   sub: 'bruto',         color: 'green' },
            { label: 'Ticket promedio', value: formatCOP(data.resumenMes?.ticket_promedio || 0),    sub: 'por venta',     color: 'purple'},
            { label: 'IVA total',       value: formatCOP(data.resumenMes?.iva_total || 0),          sub: 'recaudado',     color: 'gray'  },
          ]} />

          {/* Métodos de pago del mes */}
          {data.porMetodo?.length > 0 && (
            <SectionCard title="Métodos de pago del mes" icon={<DollarSign className="w-4 h-4 text-blue-600"/>}>
              <div className="space-y-3">
                {data.porMetodo.map(m => {
                  const total = data.resumenMes?.ingresos_totales || 1;
                  const pct = Math.round((m.total / total) * 100);
                  return (
                    <div key={m.metodo_pago}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge label={METODO_LABEL[m.metodo_pago]||m.metodo_pago} color={METODO_COLOR[m.metodo_pago]}/>
                          <span className="text-xs text-gray-400">{m.cantidad} ventas · {pct}%</span>
                        </div>
                        <span className="font-bold text-gray-800">{formatCOP(m.total)}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Gráfico ventas vs gastos */}
          {chartData.length > 0 && (
            <SectionCard title="Ventas vs Gastos por día" icon={<TrendingUp className="w-4 h-4 text-green-600"/>}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }}/>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={(v, n) => [formatCOP(v), n === 'ventas' ? 'Ventas' : 'Gastos']}/>
                  <Legend formatter={v => v === 'ventas' ? 'Ventas' : 'Gastos'}/>
                  <Bar dataKey="ventas" fill="#2563eb" radius={[3,3,0,0]}/>
                  <Bar dataKey="gastos" fill="#ef4444" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Gastos del mes */}
          {data.resumenGastos?.length > 0 && (
            <SectionCard title="Gastos del mes por tipo" icon={<TrendingDown className="w-4 h-4 text-red-500"/>}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {['proveedor','nomina','personal','recogida'].map(tipo => {
                  const g = data.resumenGastos.find(x => x.tipo === tipo);
                  return (
                    <div key={tipo} className={`rounded-lg border p-3 text-center ${g ? (GASTO_COLOR[tipo]||'bg-gray-50') : 'bg-gray-50 text-gray-300'}`}>
                      <p className="text-lg font-bold">{formatCOP(g?.total || 0)}</p>
                      <p className="text-xs font-semibold mt-0.5">{GASTO_LABEL[tipo]}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Top productos */}
          {data.topProductos?.length > 0 && (
            <SectionCard title="Top productos del mes" icon={<Package className="w-4 h-4 text-gray-500"/>} defaultOpen={false}>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-400 uppercase border-b">
                  <th className="text-left py-2">#</th><th className="text-left">Producto</th>
                  <th className="text-right">Cantidad</th><th className="text-right">Total</th>
                </tr></thead>
                <tbody>{data.topProductos.map((p,i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 w-8 font-bold text-gray-400">{i+1}</td>
                    <td className="py-2 text-gray-800">{p.nombre} <span className="text-gray-400 text-xs font-mono">{p.codigo}</span></td>
                    <td className="py-2 text-right text-gray-600">{Number(p.cantidad_vendida).toFixed(p.cantidad_vendida % 1 ? 3 : 0)}</td>
                    <td className="py-2 text-right font-bold text-gray-800">{formatCOP(p.total_vendido)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
const TABS = [
  { id: 'caja',    label: '🏦 Caja del día'         },
  { id: 'gastos',  label: '💸 Gastos & Recogidas'   },
  { id: 'devdesc', label: '↩ Devoluciones & Desc.'  },
  { id: 'abonos',  label: '👤 Abonos & Créditos'    },
  { id: 'mensual', label: '📆 Mensual'               },
];

// ── Impresión POS (80mm / 58mm) ───────────────────────────────────────────────
function imprimirInforme(data, fecha) {
  if (!data) return;
  const { ventas, gastos, devoluciones, descuentos, abonos, creditos, caja } = data;

  const col = (txt, n) => String(txt).padEnd(n, ' ');
  const colR = (txt, n) => String(txt).padStart(n, ' ');
  const sep  = '─'.repeat(40);
  const sep2 = '═'.repeat(40);
  const line = (l, r, w = 40) => {
    const space = w - l.length - r.length;
    return l + (space > 0 ? ' '.repeat(space) : ' ') + r;
  };

  const fCOP = (v) => '$' + Math.round(v || 0).toLocaleString('es-CO');
  const fechaFmt = new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
  });

  const metodoLabel = { efectivo:'Efectivo', credito:'Credito', nequi:'Nequi', daviplata:'Daviplata', transferencia:'Transfer.' };

  let lines = [];
  const add = (txt = '') => lines.push(txt);

  add(sep2);
  add('         INFORME DEL DIA');
  add(sep2);
  add(fechaFmt.toUpperCase());
  add('');

  // ── VENTAS ──
  add('VENTAS');
  add(sep);
  add(line('Total transacciones:', String(ventas.resumen?.total_ventas || 0)));
  add(line('Ingreso bruto:', fCOP(ventas.resumen?.ingreso_bruto)));
  add(line('IVA recaudado:', fCOP(ventas.resumen?.iva_total)));
  add('');
  add('Por metodo de pago:');
  (ventas.porMetodo || []).forEach(m => {
    add(line('  ' + (metodoLabel[m.metodo_pago] || m.metodo_pago) + ' (' + m.cantidad + ')', fCOP(m.total)));
  });
  add('');

  // ── GASTOS detallados ──
  add('GASTOS');
  add(sep);
  const tiposGasto = { proveedor:'Proveedor', nomina:'Nomina', personal:'Personal', recogida:'Recogida caja' };

  if (!gastos.detalle || gastos.detalle.length === 0) {
    add('  Sin gastos registrados');
  } else {
    // Agrupar por tipo para mostrarlos organizados
    Object.entries(tiposGasto).forEach(([tipo, lbl]) => {
      const items = (gastos.detalle || []).filter(g => g.tipo === tipo);
      if (items.length === 0) return;
      add('');
      add('  ' + lbl.toUpperCase() + ':');
      items.forEach((g, i) => {
        const hora = g.creado_en ? new Date(g.creado_en).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }) : '';
        const desc = g.descripcion ? g.descripcion : 'Sin descripcion';
        // Descripcion en linea propia si es larga
        if (desc.length > 18) {
          add('  ' + String(i+1) + '. ' + hora);
          add('     ' + desc);
          add('     ' + colR(fCOP(g.valor), 35 - 5));
        } else {
          add(line('  ' + String(i+1) + '. ' + hora + ' ' + desc, fCOP(g.valor)));
        }
        if (g.usuario) add('     Por: ' + g.usuario);
      });
      const subtotal = items.reduce((s, g) => s + (g.valor || 0), 0);
      add('  ' + '-'.repeat(36));
      add(line('  Subtotal ' + lbl + ':', fCOP(subtotal)));
    });
  }

  add('');
  add(sep);
  add(line('TOTAL GASTOS:', fCOP(gastos.totalGastos)));
  add(line('  Pagos/gastos:', fCOP(gastos.gastosSinRecog)));
  add(line('  Recogida de caja:', fCOP(gastos.totalRecogidas)));
  add('');

  // ── DEVOLUCIONES ──
  add('DEVOLUCIONES');
  add(sep);
  const dr = devoluciones.resumen;
  if (!dr || dr.cantidad === 0) {
    add('  Sin devoluciones');
  } else {
    add(line('  Cantidad:', String(dr.cantidad)));
    add(line('  Total devuelto:', fCOP(dr.total_devuelto)));
    add(line('  Totales:', String(dr.totales || 0)));
    add(line('  Parciales:', String(dr.parciales || 0)));
  }
  add('');

  // ── DESCUENTOS ──
  add('DESCUENTOS');
  add(sep);
  const dc = descuentos.resumen;
  if (!dc || !dc.total_descuentos_item) {
    add('  Sin descuentos aplicados');
  } else {
    add(line('  Items con descuento:', String(dc.items_con_descuento || 0)));
    add(line('  Ventas afectadas:', String(dc.ventas_con_descuento || 0)));
    add(line('  Total descontado:', fCOP(dc.total_descuentos_item)));
  }
  add('');

  // ── ABONOS ──
  add('ABONOS DE CLIENTES');
  add(sep);
  const ar = abonos.resumen;
  add(line('  Abonos recibidos:', String(ar?.cantidad || 0)));
  add(line('  Total cobrado:', fCOP(ar?.total)));
  add('');

  // ── CREDITOS ──
  add('CREDITOS NUEVOS');
  add(sep);
  const cr = creditos.resumen;
  add(line('  Ventas fiadas:', String(cr?.cantidad || 0)));
  add(line('  Total fiado:', fCOP(cr?.total)));
  add('');

  // ── RESUMEN CAJA ──
  add(sep2);
  add('       RESUMEN DE CAJA');
  add(sep2);
  add(line('+ Ventas efectivo:', fCOP(caja.efectivo_ventas)));
  add(line('+ Abonos recibidos:', fCOP(caja.abonos_recibidos)));
  add(line('- Gastos / pagos:', fCOP(caja.gastos_pagados)));
  add(line('- Recogida de caja:', fCOP(caja.recogidas)));
  add(sep);
  add(line('= EFECTIVO EN CAJA:', fCOP(caja.efectivo_esperado)));
  add(sep2);
  add('');
  add('Impreso: ' + new Date().toLocaleTimeString('es-CO'));
  add('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Informe del dia - ${fecha}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.45;
    width: 72mm;
    padding: 4mm;
    color: #000;
    background: #fff;
  }
  pre { white-space: pre-wrap; word-break: break-all; font-family: inherit; font-size: inherit; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    body { width: 72mm; }
  }
</style>
</head><body>
<pre>${lines.join('\n')}</pre>
<script>window.onload = function(){ window.print(); setTimeout(()=>window.close(), 800); }<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=340,height=600,scrollbars=yes');
  if (w) { w.document.write(html); w.document.close(); }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Informes() {
  const [tab, setTab]     = useState('caja');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [caja, setCaja]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargarCaja = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setCaja(await api.get(`/reportes/caja?fecha=${fecha}`)); }
    catch (e) {
      setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
      setCaja(null);
    } finally { setLoading(false); }
  }, [fecha]);

  useEffect(() => {
    if (['caja','gastos','devdesc','abonos'].includes(tab)) cargarCaja();
  }, [tab, cargarCaja]);

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Informes</h1>
          <p className="text-gray-500 text-sm">Historial completo de operaciones</p>
        </div>

        {/* Controles de fecha + imprimir */}
        <div className="flex flex-wrap items-center gap-2">
          {['caja','gastos','devdesc','abonos'].includes(tab) && (
            <>
              <Calendar className="w-4 h-4 text-gray-400"/>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <button onClick={cargarCaja} disabled={loading}
                className="flex items-center gap-1 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}/> Actualizar
              </button>
            </>
          )}
          {['caja','gastos','devdesc','abonos'].includes(tab) && (
            <button onClick={() => imprimirInforme(caja, fecha)} disabled={!caja || loading}
              className="flex items-center gap-1 bg-gray-800 text-white rounded-xl px-3 py-2 text-sm hover:bg-gray-700 disabled:opacity-40">
              <Printer className="w-3.5 h-3.5"/> Imprimir
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
              ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {loading && ['caja','gastos','devdesc','abonos'].includes(tab) ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"/>
          <p className="text-gray-400 text-sm">Cargando datos...</p>
        </div>
      ) : error && ['caja','gastos','devdesc','abonos'].includes(tab) ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <AlertCircle className="w-10 h-10 text-red-400"/>
          <p className="text-red-600 font-medium text-sm text-center">{error}</p>
          <button onClick={cargarCaja} className="mt-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700">
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {tab === 'caja'    && <TabCaja    data={caja} />}
          {tab === 'gastos'  && <TabGastos  data={caja} />}
          {tab === 'devdesc' && <TabDevDesc data={caja} />}
          {tab === 'abonos'  && <TabAbonos  data={caja} />}
          {tab === 'mensual' && <TabMensual />}
        </>
      )}
    </div>
  );
}
