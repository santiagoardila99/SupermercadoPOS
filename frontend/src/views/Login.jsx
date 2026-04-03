import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Eye, EyeOff, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isGerente } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      toast.success(`Bienvenido, ${data.user.nombre}!`);
      navigate(data.user.rol === 'gerente' || data.user.rol === 'admin' ? '/gerente' : '/pos');
    } catch (err) {
      toast.error(err?.error || 'Error de conexión. Verifica que el servidor esté corriendo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Store className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">SupermercadoPOS</h1>
          <p className="text-blue-200 mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Iniciar Sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="usuario@supermercado.com"
                className="input" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  className="input pr-10" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? 'Iniciando...' : 'Entrar al sistema'}
            </button>
          </form>

          {/* Credenciales de prueba */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2">Credenciales de prueba:</p>
            <div className="space-y-1">
              <button onClick={() => { setEmail('gerente@supermercado.com'); setPassword('admin123'); }}
                className="w-full text-left text-xs p-2 hover:bg-blue-100 rounded transition-colors">
                👔 <strong>Gerente:</strong> gerente@supermercado.com / admin123
              </button>
              <button onClick={() => { setEmail('caja1@supermercado.com'); setPassword('caja123'); }}
                className="w-full text-left text-xs p-2 hover:bg-blue-100 rounded transition-colors">
                🛒 <strong>Cajero:</strong> caja1@supermercado.com / caja123
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
