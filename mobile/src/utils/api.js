import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── Configuración de servidor ─────────────────────────────────────────────────
// El usuario configura la IP del PC donde corre el backend desde la pantalla de login
let BASE_URL = 'http://192.168.1.100:3001/api';

export const setServerIP = (ip) => {
  const clean = ip.trim().replace(/\/$/, '');
  // Si ya incluye protocolo y puerto úsalo directo, si no lo construimos
  if (clean.startsWith('http')) {
    BASE_URL = clean.endsWith('/api') ? clean : `${clean}/api`;
  } else {
    BASE_URL = `http://${clean}:3001/api`;
  }
  instance.defaults.baseURL = BASE_URL;
};

export const getServerIP = () => BASE_URL.replace('/api', '').replace('http://', '');

const instance = axios.create({ baseURL: BASE_URL, timeout: 12000 });

instance.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('pos_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}
  return config;
});

instance.interceptors.response.use(
  (r) => r.data,
  (err) => Promise.reject(err.response?.data || err)
);

export default instance;

// ── Helpers de formato ────────────────────────────────────────────────────────
export const formatCOP = (v) => {
  if (!v && v !== 0) return '$0';
  return '$' + Math.round(v).toLocaleString('es-CO');
};

export const formatHora = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export const formatFecha = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
