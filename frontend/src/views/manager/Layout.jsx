import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Warehouse, BarChart3, FileText, Settings, LogOut, ShoppingCart, Bot, Menu, X, Store, Monitor, Users, TrendingDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/gerente', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard', end: true },
  { to: '/gerente/productos', icon: <Package className="w-5 h-5" />, label: 'Productos' },
  { to: '/gerente/inventario', icon: <Warehouse className="w-5 h-5" />, label: 'Inventario' },
  { to: '/gerente/facturas', icon: <FileText className="w-5 h-5" />, label: 'Facturas' },
  { to: '/gerente/reportes', icon: <BarChart3 className="w-5 h-5" />, label: 'Informes' },
  { to: '/gerente/ia', icon: <Bot className="w-5 h-5" />, label: 'Chat IA' },
  { to: '/gerente/clientes', icon: <Users className="w-5 h-5" />, label: 'Clientes / Fiados' },
  { to: '/gerente/gastos', icon: <TrendingDown className="w-5 h-5" />, label: 'Gastos' },
  { to: '/gerente/pos-config', icon: <Monitor className="w-5 h-5" />, label: 'Config. POS' },
  { to: '/gerente/configuracion', icon: <Settings className="w-5 h-5" />, label: 'Configuración' },
];

export default function ManagerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:relative lg:flex
      `}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">SupermercadoPOS</p>
            <p className="text-xs text-gray-400 truncate">{user?.nombre}</p>
          </div>
          <button className="lg:hidden ml-auto p-1" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }>
              {item.icon}<span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-700 space-y-2">
          <button onClick={() => navigate('/pos')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
            <ShoppingCart className="w-5 h-5" /><span>Ir a Caja</span>
          </button>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-red-900 hover:text-red-300 transition-colors">
            <LogOut className="w-5 h-5" /><span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Overlay móvil */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar móvil */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-gray-800">Panel Gerente</span>
          <div className="w-9" />
        </div>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
