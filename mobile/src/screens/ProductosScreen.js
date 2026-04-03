import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import api, { formatCOP } from '../utils/api';

// ── Colores de stock ──────────────────────────────────────────────────────────
function stockColor(stock, minimo) {
  if (stock <= 0) return '#ef4444';
  if (stock <= minimo) return '#f59e0b';
  return '#10b981';
}

// ── Modal de edición ─────────────────────────────────────────────────────────
function EditModal({ producto, visible, onClose, onSaved }) {
  const [precio,    setPrecio]    = useState('');
  const [stock,     setStock]     = useState('');
  const [stockMin,  setStockMin]  = useState('');
  const [saving,    setSaving]    = useState(false);

  React.useEffect(() => {
    if (producto) {
      setPrecio(String(producto.precio_venta || ''));
      setStock(String(producto.stock || ''));
      setStockMin(String(producto.stock_minimo || ''));
    }
  }, [producto]);

  const guardar = async () => {
    const p = parseFloat(precio);
    const s = parseFloat(stock);
    if (isNaN(p) || p < 0) { Alert.alert('Error', 'Precio inválido'); return; }
    if (isNaN(s) || s < 0) { Alert.alert('Error', 'Stock inválido'); return; }
    setSaving(true);
    try {
      await api.put(`/productos/${producto.id}`, {
        ...producto,
        precio_venta:  p,
        stock:         s,
        stock_minimo:  parseFloat(stockMin) || producto.stock_minimo,
      });
      Alert.alert('✓ Guardado', `${producto.nombre} actualizado correctamente`);
      onSaved({ ...producto, precio_venta: p, stock: s, stock_minimo: parseFloat(stockMin) || producto.stock_minimo });
    } catch (err) {
      Alert.alert('Error', err?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={em.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={em.sheet}>
          <View style={em.handle} />
          <Text style={em.title} numberOfLines={1}>{producto?.nombre}</Text>
          <Text style={em.code}>{producto?.codigo} · {producto?.categoria_nombre || '—'}</Text>

          <View style={em.row}>
            <View style={em.field}>
              <Text style={em.label}>Precio venta ($)</Text>
              <TextInput style={em.input} value={precio} onChangeText={setPrecio}
                keyboardType="numeric" placeholder="0" placeholderTextColor="#6b7280" />
            </View>
            <View style={em.field}>
              <Text style={em.label}>Stock actual</Text>
              <TextInput style={em.input} value={stock} onChangeText={setStock}
                keyboardType="numeric" placeholder="0" placeholderTextColor="#6b7280" />
            </View>
          </View>

          <View style={em.fieldFull}>
            <Text style={em.label}>Stock mínimo (alerta)</Text>
            <TextInput style={em.input} value={stockMin} onChangeText={setStockMin}
              keyboardType="numeric" placeholder="0" placeholderTextColor="#6b7280" />
          </View>

          <View style={em.actions}>
            <TouchableOpacity style={em.btnCancel} onPress={onClose}>
              <Text style={em.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={em.btnSave} onPress={guardar} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={em.btnSaveText}>Guardar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ProductosScreen() {
  const [todos,     setTodos]     = useState([]);
  const [busqueda,  setBusqueda]  = useState('');
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [editando,  setEditando]  = useState(null);
  const [filtro,    setFiltro]    = useState('todos'); // 'todos' | 'bajo' | 'agotado'

  const cargar = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await api.get('/productos?limite=500');
      setTodos(res.productos || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => { setRefreshing(true); cargar(true); };

  const filtrados = todos.filter(p => {
    const q = busqueda.toLowerCase();
    const coincide = !q ||
      p.nombre?.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      p.codigo_barras?.toLowerCase().includes(q);
    if (!coincide) return false;
    if (filtro === 'bajo')    return p.stock <= p.stock_minimo && p.stock > 0;
    if (filtro === 'agotado') return p.stock <= 0;
    return true;
  });

  const bajoStock   = todos.filter(p => p.stock <= p.stock_minimo && p.stock > 0).length;
  const agotados    = todos.filter(p => p.stock <= 0).length;

  const onSaved = (updated) => {
    setTodos(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditando(null);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={s.loadingText}>Cargando productos...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Productos</Text>
        <Text style={s.headerSub}>{todos.length} productos activos</Text>
      </View>

      {/* Buscador */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6b7280" style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar por nombre o código..."
          placeholderTextColor="#6b7280"
          value={busqueda}
          onChangeText={setBusqueda}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filtros */}
      <View style={s.filtros}>
        {[
          { id: 'todos',   label: `Todos (${todos.length})` },
          { id: 'bajo',    label: `Stock bajo (${bajoStock})`,  color: '#f59e0b' },
          { id: 'agotado', label: `Agotados (${agotados})`,     color: '#ef4444' },
        ].map(f => (
          <TouchableOpacity key={f.id} style={[s.filtroBtn, filtro === f.id && s.filtroBtnActive]}
            onPress={() => setFiltro(f.id)}>
            <Text style={[s.filtroText, filtro === f.id && { color: f.color || '#2563eb' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}>
        {filtrados.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={40} color="#374151" />
            <Text style={s.emptyText}>Sin resultados</Text>
          </View>
        ) : (
          filtrados.map((p, i) => (
            <TouchableOpacity key={p.id} style={s.item} onPress={() => setEditando(p)} activeOpacity={0.7}>
              {/* Indicador color stock */}
              <View style={[s.stockBar, { backgroundColor: stockColor(p.stock, p.stock_minimo) }]} />
              <View style={s.itemBody}>
                <View style={s.itemTop}>
                  <Text style={s.itemNombre} numberOfLines={1}>{p.nombre}</Text>
                  <Text style={s.itemPrecio}>{formatCOP(p.precio_venta)}</Text>
                </View>
                <View style={s.itemBottom}>
                  <Text style={s.itemCodigo}>{p.codigo}</Text>
                  <View style={s.stockInfo}>
                    <Ionicons name="cube-outline" size={12} color={stockColor(p.stock, p.stock_minimo)} />
                    <Text style={[s.stockText, { color: stockColor(p.stock, p.stock_minimo) }]}>
                      {p.stock} {p.unidad || 'un'}
                    </Text>
                    {p.stock <= p.stock_minimo && (
                      <Text style={s.stockAlert}> · Mín: {p.stock_minimo}</Text>
                    )}
                  </View>
                </View>
                {p.categoria_nombre ? <Text style={s.itemCat}>{p.categoria_nombre}</Text> : null}
              </View>
              <Ionicons name="create-outline" size={18} color="#4b5563" />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal edición */}
      <EditModal
        producto={editando}
        visible={!!editando}
        onClose={() => setEditando(null)}
        onSaved={onSaved}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#111827' },
  center:       { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { color: '#6b7280', fontSize: 14 },
  header:       { padding: 20, paddingTop: 56 },
  headerTitle:  { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSub:    { color: '#6b7280', fontSize: 13, marginTop: 2 },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, marginBottom: 8 },
  searchIcon:   { marginRight: 8 },
  searchInput:  { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  filtros:      { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  filtroBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1f2937' },
  filtroBtnActive:{ backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151' },
  filtroText:   { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  empty:        { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText:    { color: '#4b5563', fontSize: 14 },
  item:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', marginHorizontal: 16, marginBottom: 6, borderRadius: 12, overflow: 'hidden' },
  stockBar:     { width: 4, alignSelf: 'stretch' },
  itemBody:     { flex: 1, padding: 12 },
  itemTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemNombre:   { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  itemPrecio:   { color: '#10b981', fontSize: 15, fontWeight: '700' },
  itemBottom:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  itemCodigo:   { color: '#6b7280', fontSize: 11 },
  stockInfo:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stockText:    { fontSize: 12, fontWeight: '600' },
  stockAlert:   { color: '#6b7280', fontSize: 11 },
  itemCat:      { color: '#4b5563', fontSize: 11, marginTop: 2 },
});

const em = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#1f2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  handle:     { width: 40, height: 4, backgroundColor: '#374151', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:      { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  code:       { color: '#6b7280', fontSize: 12, marginBottom: 20 },
  row:        { flexDirection: 'row', gap: 12, marginBottom: 12 },
  field:      { flex: 1 },
  fieldFull:  { marginBottom: 20 },
  label:      { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input:      { backgroundColor: '#374151', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, fontWeight: '600' },
  actions:    { flexDirection: 'row', gap: 12 },
  btnCancel:  { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#374151', alignItems: 'center' },
  btnCancelText:{ color: '#9ca3af', fontSize: 15, fontWeight: '600' },
  btnSave:    { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2563eb', alignItems: 'center' },
  btnSaveText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
});
