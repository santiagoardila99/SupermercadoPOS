import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api, { setServerIP, getServerIP } from '../utils/api';

export default function LoginScreen({ navigation }) {
  const [ip,       setIp]       = useState('');
  const [usuario,  setUsuario]  = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  // Cargar IP guardada
  useEffect(() => {
    SecureStore.getItemAsync('server_ip').then(v => { if (v) { setIp(v); setServerIP(v); } });
    SecureStore.getItemAsync('last_user').then(v => { if (v) setUsuario(v); });
  }, []);

  const login = async () => {
    if (!ip.trim()) { Alert.alert('Error', 'Ingresa la IP del servidor'); return; }
    if (!usuario.trim() || !password.trim()) { Alert.alert('Error', 'Ingresa usuario y contraseña'); return; }
    setLoading(true);
    try {
      setServerIP(ip.trim());
      await SecureStore.setItemAsync('server_ip', ip.trim());
      await SecureStore.setItemAsync('last_user', usuario.trim());

      const res = await api.post('/auth/login', { nombre: usuario.trim(), password: password.trim() });
      if (!res.token) throw new Error('Sin token');
      await SecureStore.setItemAsync('pos_token', res.token);
      await SecureStore.setItemAsync('pos_user', JSON.stringify(res.usuario));
      navigation.replace('Main');
    } catch (err) {
      const msg = err?.error || err?.message || 'Error de conexión. Verifica la IP del servidor.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoLetter}>S</Text>
          </View>
          <Text style={s.logoTitle}>SupermercadoPOS</Text>
          <Text style={s.logoSub}>Panel de gestión móvil</Text>
        </View>

        {/* Formulario */}
        <View style={s.card}>
          <Text style={s.label}>IP del servidor</Text>
          <TextInput
            style={s.input}
            placeholder="ej: 192.168.1.5"
            placeholderTextColor="#6b7280"
            value={ip}
            onChangeText={setIp}
            keyboardType="numeric"
            autoCapitalize="none"
          />
          <Text style={s.hint}>
            IP local del PC donde corre el POS (mismo Wi-Fi)
          </Text>

          <Text style={[s.label, { marginTop: 16 }]}>Usuario</Text>
          <TextInput
            style={s.input}
            placeholder="Nombre de usuario"
            placeholderTextColor="#6b7280"
            value={usuario}
            onChangeText={setUsuario}
            autoCapitalize="none"
          />

          <Text style={[s.label, { marginTop: 16 }]}>Contraseña</Text>
          <TextInput
            style={s.input}
            placeholder="Contraseña"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={s.btn} onPress={login} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Ingresar</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          El celular debe estar en la misma red Wi-Fi que el PC
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#111827' },
  scroll:      { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap:    { alignItems: 'center', marginBottom: 32 },
  logoCircle:  { width: 72, height: 72, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoLetter:  { color: '#fff', fontSize: 36, fontWeight: '900' },
  logoTitle:   { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  logoSub:     { color: '#6b7280', fontSize: 13, marginTop: 4 },
  card:        { backgroundColor: '#1f2937', borderRadius: 16, padding: 20 },
  label:       { color: '#d1d5db', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input:       { backgroundColor: '#374151', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15 },
  hint:        { color: '#6b7280', fontSize: 11, marginTop: 4 },
  btn:         { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer:      { color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 20 },
});
