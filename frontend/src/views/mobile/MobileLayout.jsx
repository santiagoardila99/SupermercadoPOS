import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Package, FileText, Users, Bot, LogOut, X, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const tabs = [
  { to: '/gerente',           icon: LayoutDashboard, label: 'Inicio',    end: true },
  { to: '/gerente/reportes',  icon: BarChart3,        label: 'Informes'  },
  { to: '/gerente/productos', icon: Package,          label: 'Productos' },
  { to: '/gerente/facturas',  icon: FileText,         label: 'Facturas'  },
  { to: '/gerente/clientes',  icon: Users,            label: 'Clientes'  },
];

export default function MobileLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="mobile-root">
      {/* ── Header ── */}
      <header className="mobile-header">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-bold text-gray-800 text-sm">SupermercadoPOS</span>
        </div>
        <button
          onClick={() => setShowMenu(true)}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <span className="text-xs font-bold text-gray-600">
            {user?.nombre?.charAt(0)?.toUpperCase() || 'G'}
          </span>
        </button>
      </header>

      {/* ── Contenido principal ── */}
      <main className="mobile-main">
        <Outlet />
      </main>

      {/* ── Botón flotante IA ── */}
      <button
        onClick={() => navigate('/gerente/ia')}
        className="mobile-fab"
        title="Chat con IA"
      >
        <Sparkles className="w-6 h-6" />
      </button>

      {/* ── Tab bar inferior ── */}
      <nav className="mobile-tabbar">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `mobile-tab ${isActive ? 'mobile-tab-active' : 'mobile-tab-inactive'}`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Menú de perfil ── */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-2xl p-5 space-y-3"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-gray-900">{user?.nombre}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button onClick={() => setShowMenu(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <button
              onClick={() => { setShowMenu(false); navigate('/gerente/ia'); }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl font-medium"
            >
              <Bot className="w-5 h-5" />
              Chat con IA
            </button>
            <button
              onClick={() => { setShowMenu(false); logout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-medium"
            >
              <LogOut className="w-5 h-5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
