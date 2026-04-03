import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import api, { formatCOP, formatHora } from '../utils/api';

// ── Tarjeta de stat ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = '#2563eb' }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color }]}>
      <View style={[s.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
        {sub ? <Text style={s.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Fila de método de pago ────────────────────────────────────────────────────
const METODO_COLOR = { efectivo: '#10b981', credito: '#f59e0b', nequi: '#ec4899', daviplata: '#ef4444', transferencia: '#3b82f6' };
const METODO_LABEL = { efectivo: 'Efectivo', credito: 'Crédito', nequi: 'Nequi', daviplata: 'Daviplata', transferencia: 'Transferencia' };

export default function DashboardScreen({ navigation }) {
  const [data,      setData]      = useState(null);
  const [caja,      setCaja]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const cargar = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const [dashboard, cajaData] = await Promise.all([
        api.get('/reportes/dashboard'),
        api.get(`/reportes/caja?fecha=${hoy}`).catch(() => null),
      ]);
      setData(dashboard);
      setCaja(cajaData);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el dashboard. Verifica la conexión.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => { setRefreshing(true); cargar(true); };

  const logout = async () => {
    await SecureStore.deleteItemAsync('pos_token');
    await SecureStore.deleteItemAsync('pos_user');
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={s.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  const hoy = data?.hoy || {};
  const metodos = caja?.ventas?.porMetodo || [];
  const ultimasVentas = data?.ultimas_ventas || [];
  const efectivoEsperado = hoy.efectivo_esperado ?? 0;

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}>

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Dashboard</Text>
          <Text style={s.headerSub}>{new Date().toLocaleDateString('es-CO', { weekday:'long', day:'2-digit', month:'long' })}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Stats principales */}
      <Text style={s.sectionTitle}>Resumen del día</Text>
      <StatCard icon="cash-outline"         label="Ventas hoy"       value={formatCOP(hoy.total)}             sub={`${hoy.transacciones || 0} transacciones`} color="#10b981" />
      <StatCard icon="wallet-outline"       label="Efectivo en caja" value={formatCOP(efectivoEsperado)}      color="#2563eb" />
      <StatCard icon="trending-down-outline"label="Gastos"           value={formatCOP(hoy.gastos)}            color="#ef4444" />
      <StatCard icon="return-down-back-outline" label="Devoluciones" value={formatCOP(hoy.devoluciones?.total || 0)} sub={`${hoy.devoluciones?.cantidad || 0} devoluciones`} color="#f59e0b" />
      <StatCard icon="pricetag-outline"     label="Descuentos"       value={formatCOP(hoy.descuentos)}        color="#8b5cf6" />
      <StatCard icon="people-outline"       label="Abonos recibidos" value={formatCOP(hoy.abonos)}            color="#06b6d4" />

      {/* Métodos de pago */}
      {metodos.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Por método de pago</Text>
          <View style={s.metodosCard}>
            {metodos.map((m, i) => (
              <View key={i} style={[s.metodoRow, i > 0 && s.metodoRowBorder]}>
                <View style={[s.metodoDot, { backgroundColor: METODO_COLOR[m.metodo_pago] || '#6b7280' }]} />
                <Text style={s.metodoLabel}>{METODO_LABEL[m.metodo_pago] || m.metodo_pago}</Text>
                <Text style={s.metodoCant}>{m.cantidad} vta{m.cantidad !== 1 ? 's' : ''}</Text>
                <Text style={[s.metodoTotal, { color: METODO_COLOR[m.metodo_pago] || '#fff' }]}>{formatCOP(m.total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Caja resumen */}
      {caja?.caja && (
        <>
          <Text style={s.sectionTitle}>Resumen de caja</Text>
          <View style={s.cajaCard}>
            <CajaRow label="Ventas efectivo"   value={formatCOP(caja.caja.efectivo_ventas)}   color="#10b981" />
            <CajaRow label="+ Abonos"          value={formatCOP(caja.caja.abonos_recibidos)}  color="#06b6d4" />
            <CajaRow label="− Gastos"          value={formatCOP(caja.caja.gastos_pagados)}    color="#ef4444" minus />
            <CajaRow label="− Recogida"        value={formatCOP(caja.caja.recogidas)}         color="#f59e0b" minus />
            <View style={s.cajaSep} />
            <CajaRow label="EFECTIVO EN CAJA"  value={formatCOP(caja.caja.efectivo_esperado)} color="#2563eb" bold />
          </View>
        </>
      )}

      {/* Últimas ventas */}
      {ultimasVentas.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Últimas ventas</Text>
          <View style={s.ventasCard}>
            {ultimasVentas.map((v, i) => (
              <View key={i} style={[s.ventaRow, i > 0 && s.ventaRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ventaFac}>{v.numero_factura}</Text>
                  <Text style={s.ventaCajero}>{v.cajero || '—'} · {formatHora(v.creado_en)}</Text>
                </View>
                <View style={[s.metodoBadge, { backgroundColor: (METODO_COLOR[v.metodo_pago] || '#6b7280') + '22' }]}>
                  <Text style={[s.metodoBadgeText, { color: METODO_COLOR[v.metodo_pago] || '#9ca3af' }]}>
                    {METODO_LABEL[v.metodo_pago] || v.metodo_pago}
                  </Text>
                </View>
                <Text style={s.ventaTotal}>{formatCOP(v.total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function CajaRow({ label, value, color, minus, bold }) {
  return (
    <View style={s.cajaRow}>
      <Text style={[s.cajaLabel, bold && { color: '#fff', fontWeight: '700' }]}>{label}</Text>
      <Text style={[s.cajaValue, { color }, bold && { fontSize: 17 }]}>{minus ? '−' : ''}{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#111827' },
  center:       { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { color: '#6b7280', fontSize: 14 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 56 },
  headerTitle:  { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSub:    { color: '#6b7280', fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  logoutBtn:    { padding: 8 },
  sectionTitle: { color: '#9ca3af', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 20, marginBottom: 8 },
  statCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderLeftWidth: 3, gap: 12 },
  statIcon:     { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue:    { color: '#fff', fontSize: 17, fontWeight: '700' },
  statLabel:    { color: '#9ca3af', fontSize: 12, marginTop: 1 },
  statSub:      { color: '#6b7280', fontSize: 11, marginTop: 1 },
  metodosCard:  { backgroundColor: '#1f2937', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  metodoRow:    { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  metodoRowBorder: { borderTopWidth: 1, borderTopColor: '#374151' },
  metodoDot:    { width: 8, height: 8, borderRadius: 4 },
  metodoLabel:  { flex: 1, color: '#d1d5db', fontSize: 14 },
  metodoCant:   { color: '#6b7280', fontSize: 12, marginRight: 8 },
  metodoTotal:  { fontSize: 14, fontWeight: '700' },
  cajaCard:     { backgroundColor: '#1f2937', marginHorizontal: 16, borderRadius: 12, padding: 14 },
  cajaRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  cajaLabel:    { color: '#9ca3af', fontSize: 13 },
  cajaValue:    { fontSize: 14, fontWeight: '600' },
  cajaSep:      { height: 1, backgroundColor: '#374151', marginVertical: 8 },
  ventasCard:   { backgroundColor: '#1f2937', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  ventaRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  ventaRowBorder:{ borderTopWidth: 1, borderTopColor: '#374151' },
  ventaFac:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  ventaCajero:  { color: '#6b7280', fontSize: 11, marginTop: 2 },
  ventaTotal:   { color: '#10b981', fontSize: 14, fontWeight: '700' },
  metodoBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metodoBadgeText: { fontSize: 10, fontWeight: '700' },
});
