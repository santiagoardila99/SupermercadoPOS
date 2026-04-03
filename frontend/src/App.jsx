import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useMobile } from './hooks/useMobile';
import Login from './views/Login';
import POSView from './views/POS';
import ManagerLayout from './views/manager/Layout';
import MobileLayout from './views/mobile/MobileLayout';
import Dashboard from './views/manager/Dashboard';
import Productos from './views/manager/Productos';
import Inventario from './views/manager/Inventario';
import Reportes from './views/manager/Reportes';
import Facturas from './views/manager/Facturas';
import Configuracion from './views/manager/Configuracion';
import ConfiguracionPOS from './views/manager/ConfiguracionPOS';
import Clientes from './views/manager/Clientes';
import Gastos from './views/manager/Gastos';
import IAChat from './views/IAChat';

function ProtectedRoute({ children, requireGerente = false }) {
  const { user, isGerente } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (requireGerente && !isGerente) return <Navigate to="/pos" replace />;
  return children;
}

function AppRoutes() {
  const { user, isGerente } = useAuth();
  const isMobile = useMobile();

  // En móvil, el gerente ve el layout móvil; en desktop, el layout normal
  const GerenteLayout = isMobile ? MobileLayout : ManagerLayout;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={isGerente ? '/gerente' : '/pos'} replace /> : <Login />} />
      <Route path="/pos" element={<ProtectedRoute><POSView /></ProtectedRoute>} />
      <Route path="/ia" element={<ProtectedRoute><IAChat /></ProtectedRoute>} />
      <Route path="/gerente" element={<ProtectedRoute requireGerente><GerenteLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Productos />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="facturas" element={<Facturas />} />
        <Route path="configuracion" element={<Configuracion />} />
        <Route path="pos-config" element={<ConfiguracionPOS />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="gastos" element={<Gastos />} />
        <Route path="ia" element={<IAChat />} />
      </Route>
      <Route path="/" element={<Navigate to={user ? (isGerente ? '/gerente' : '/pos') : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
