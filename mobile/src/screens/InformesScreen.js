import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api, { formatCOP } from '../utils/api';

const METODO_COLOR = { efectivo:'#10b981', credito:'#f59e0b', nequi:'#ec4899', daviplata:'#ef4444', transferencia:'#3b82f6' };
const METODO_LABEL = { efectivo:'Efectivo', credito:'Crédito', nequi:'Nequi', daviplata:'Daviplata', transferencia:'Transferencia' };

function Section({ title, children }) {
  return (
    <>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </>
  );
}

function Row({ label, value, color, bold, sep }) {
  return (
    <>
      {sep && <View style={s.sep} />}
      <View style={s.row}>
        <Text style={[s.rowLabel, bold && s.boldText]}>{label}</Text>
        <Text style={[s.rowValue, { color: color || '#fff' }, bold && { fontSize: 16 }]}>{value}</Text>
      </View>
    </>
  );
}

export default function InformesScreen() {
  const hoyISO = new Date().toISOString().split('T')[0];
  const [fecha,     setFecha]     = useState(hoyISO);
  const [caja,      setCaja]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await api.get(`/reportes/caja?fecha=${fecha}`);
      setCaja(data);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el informe del día');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fecha]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));
  const onRefresh = () => { setRefreshing(true); cargar(true); };

  const irAyer = () => {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setFecha(d.toISOString().split('T')[0]);
  };
  const irManana = () => {
    const d = new Date(fecha + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    if (d > new Date()) return;
    setFecha(d.toISOString().split('T')[0]);
  };

  const esHoy = fecha === hoyISO;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={s.loadingText}>Cargando informe...</Text>
      </View>
    );
  }

  const ventas    = caja?.ventas     || {};
  const gastos    = caja?.gastos     || {};
  const dev       = caja?.devoluciones || {};
  const desc      = caja?.descuentos || {};
  const abonos    = caja?.abonos     || {};
  const creditos  = caja?.creditos   || {};
  const cajaRes   = caja?.caja       || {};
  const metodos   = ventas.porMetodo || [];

  const [d, m, a] = fecha.split('-');
  const fechaDisplay = `${d}/${m}/${a}`;

  return (
    <ScrollView style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}>

      {/* Header con selector de fecha */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Informe del día</Text>
        <View style={s.fechaNav}>
          <TouchableOpacity style={s.navBtn} onPress={irAyer}>
            <Ionicons name="chevron-back" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <Text style={s.fechaText}>{esHoy ? 'Hoy' : fechaDisplay}</Text>
          <TouchableOpacity style={[s.navBtn, esHoy && s.navBtnDisabled]} onPress={irManana} disabled={esHoy}>
            <Ionicons name="chevron-forward" size={20} color={esHoy ? '#374151' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ventas */}
      <Section title="Ventas">
        <Row label="Total ventas"    value={formatCOP(ventas.resumen?.ingreso_bruto)}  color="#10b981" bold />
        <Row label="Transacciones"   value={String(ventas.resumen?.total_ventas || 0)} color="#d1d5db" />
        <Row label="IVA recaudado"   value={formatCOP(ventas.resumen?.iva_total)}       color="#d1d5db" />
      </Section>

      {/* Por método */}
      {metodos.length > 0 && (
        <Section title="Por método de pago">
          {metodos.map((m2, i) => (
            <Row key={i} label={METODO_LABEL[m2.metodo_pago] || m2.metodo_pago}
              value={`${formatCOP(m2.total)} (${m2.cantidad})`}
              color={METODO_COLOR[m2.metodo_pago] || '#fff'} />
          ))}
        </Section>
      )}

      {/* Gastos */}
      <Section title="Gastos">
        <Row label="Total gastos"    value={formatCOP(gastos.totalGastos)}       color="#ef4444" bold />
        <Row label="Sin recogidas"   value={formatCOP(gastos.gastosSinRecog)}    color="#d1d5db" />
        <Row label="Recogidas"       value={formatCOP(gastos.totalRecogidas)}    color="#f59e0b" />
        {(gastos.detalle || []).map((g, i) => (
          <Row key={i} label={`  · ${g.descripcion || g.tipo}`}
            value={formatCOP(g.valor)} color="#9ca3af" />
        ))}
      </Section>

      {/* Devoluciones */}
      <Section title="Devoluciones">
        <Row label="Monto devuelto"  value={formatCOP(dev.resumen?.total_devuelto)} color="#f59e0b" bold />
        <Row label="Cantidad"        value={String(dev.resumen?.cantidad || 0)}     color="#d1d5db" />
        <Row label="Totales"         value={String(dev.resumen?.totales  || 0)}     color="#d1d5db" />
        <Row label="Parciales"       value={String(dev.resumen?.parciales || 0)}    color="#d1d5db" />
      </Section>

      {/* Descuentos */}
      <Section title="Descuentos">
        <Row label="Total descuentos" value={formatCOP(desc.resumen?.total_descuentos_item)} color="#8b5cf6" bold />
        <Row label="Items con desc."  value={String(desc.resumen?.items_con_descuento || 0)} color="#d1d5db" />
      </Section>

      {/* Abonos y créditos */}
      <Section title="Abonos & Créditos">
        <Row label="Abonos recibidos" value={formatCOP(abonos.resumen?.total)}           color="#06b6d4" bold />
        <Row label="Cantidad abonos"  value={String(abonos.resumen?.cantidad || 0)}      color="#d1d5db" />
        <Row label="Ventas a crédito" value={formatCOP(creditos.resumen?.total)}         color="#f59e0b" />
        <Row label="Cantidad créditos"value={String(creditos.resumen?.cantidad || 0)}    color="#d1d5db" />
      </Section>

      {/* Caja */}
      <Section title="Resumen de caja">
        <Row label="Ventas efectivo"  value={formatCOP(cajaRes.efectivo_ventas)}   color="#10b981" />
        <Row label="+ Abonos"         value={formatCOP(cajaRes.abonos_recibidos)}  color="#06b6d4" />
        <Row label="− Gastos"         value={formatCOP(cajaRes.gastos_pagados)}    color="#ef4444" />
        <Row label="− Recogidas"      value={formatCOP(cajaRes.recogidas)}         color="#f59e0b" />
        <Row label="EFECTIVO EN CAJA" value={formatCOP(cajaRes.efectivo_esperado)} color="#2563eb" bold sep />
      </Section>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#111827' },
  center:       { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { color: '#6b7280', fontSize: 14 },
  header:       { padding: 20, paddingTop: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:  { color: '#fff', fontSize: 24, fontWeight: '800' },
  fechaNav:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn:       { padding: 6, backgroundColor: '#1f2937', borderRadius: 8 },
  navBtnDisabled:{ opacity: 0.3 },
  fechaText:    { color: '#d1d5db', fontSize: 14, fontWeight: '600', minWidth: 50, textAlign: 'center' },
  sectionTitle: { color: '#9ca3af', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 16, marginBottom: 6 },
  card:         { backgroundColor: '#1f2937', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel:     { color: '#9ca3af', fontSize: 13 },
  rowValue:     { fontSize: 14, fontWeight: '600' },
  boldText:     { color: '#fff', fontWeight: '700' },
  sep:          { height: 1, backgroundColor: '#374151', marginVertical: 4 },
});
