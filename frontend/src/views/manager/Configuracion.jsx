import React, { useState, useEffect } from 'react';
import { Save, Plus, Users, Building2, Tag } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function Configuracion() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('negocio');
  const [distribuidores, setDistribuidores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [nuevoDistrib, setNuevoDistrib] = useState({ nombre: '', contacto: '', telefono: '', nit: '' });
  const [nuevaCat, setNuevaCat] = useState({ nombre: '', color: '#2563eb' });
  const [nuevoUser, setNuevoUser] = useState({ nombre: '', email: '', password: '', rol: 'cajero' });

  useEffect(() => {
    Promise.all([
      api.get('/inventario/configuracion').then(setConfig),
      api.get('/inventario/distribuidores').then(setDistribuidores),
      api.get('/inventario/usuarios').then(setUsuarios),
      api.get('/inventario/categorias').then(setCategorias),
    ]).finally(() => setLoading(false));
  }, []);

  const guardarConfig = async () => {
    setSaving(true);
    try {
      await api.put('/inventario/configuracion', config);
      toast.success('Configuración guardada');
    } catch { toast.error('Error guardando'); } finally { setSaving(false); }
  };

  const crearDistrib = async () => {
    if (!nuevoDistrib.nombre) return toast.error('Nombre requerido');
    try {
      await api.post('/inventario/distribuidores', nuevoDistrib);
      const data = await api.get('/inventario/distribuidores');
      setDistribuidores(data);
      setNuevoDistrib({ nombre: '', contacto: '', telefono: '', nit: '' });
      toast.success('Distribuidor creado');
    } catch (err) { toast.error(err?.error || 'Error'); }
  };

  const crearCategoria = async () => {
    if (!nuevaCat.nombre) return toast.error('Nombre requerido');
    try {
      await api.post('/inventario/categorias', nuevaCat);
      const data = await api.get('/inventario/categorias');
      setCategorias(data);
      setNuevaCat({ nombre: '', color: '#2563eb' });
      toast.success('Categoría creada');
    } catch (err) { toast.error(err?.error || 'Error'); }
  };

  const crearUsuario = async () => {
    if (!nuevoUser.nombre || !nuevoUser.email || !nuevoUser.password) return toast.error('Todos los campos son requeridos');
    try {
      await api.post('/inventario/usuarios', nuevoUser);
      const data = await api.get('/inventario/usuarios');
      setUsuarios(data);
      setNuevoUser({ nombre: '', email: '', password: '', rol: 'cajero' });
      toast.success('Usuario creado');
    } catch (err) { toast.error(err?.error || 'Error'); }
  };

  const TabBtn = ({ id, label, icon }) => (
    <button onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab===id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {icon}{label}
    </button>
  );

  if (loading) return <p className="text-center text-gray-400 py-8">Cargando...</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>

      <div className="flex flex-wrap gap-2">
        <TabBtn id="negocio" label="Negocio" icon={<Building2 className="w-4 h-4"/>} />
        <TabBtn id="distribuidores" label="Distribuidores" icon={<Building2 className="w-4 h-4"/>} />
        <TabBtn id="categorias" label="Categorías" icon={<Tag className="w-4 h-4"/>} />
        <TabBtn id="usuarios" label="Usuarios" icon={<Users className="w-4 h-4"/>} />
      </div>

      {/* NEGOCIO */}
      {tab === 'negocio' && (
        <div className="card space-y-4">
          <h2 className="font-bold text-gray-800">Datos del negocio</h2>
          {[
            { k: 'nombre_negocio', l: 'Nombre del supermercado' },
            { k: 'nit', l: 'NIT' },
            { k: 'direccion', l: 'Dirección' },
            { k: 'telefono', l: 'Teléfono' },
          ].map(f => (
            <div key={f.k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.l}</label>
              <input value={config[f.k] || ''} onChange={e => setConfig(c => ({...c, [f.k]: e.target.value}))} className="input" />
            </div>
          ))}
          <button onClick={guardarConfig} disabled={saving} className="btn-primary gap-2">
            <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      )}

      {/* DISTRIBUIDORES */}
      {tab === 'distribuidores' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Agregar distribuidor</h2>
            <div className="grid grid-cols-2 gap-3">
              {[['nombre','Nombre *','text'],['contacto','Persona de contacto','text'],['telefono','Teléfono','tel'],['nit','NIT','text']].map(([k,l,t]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                  <input type={t} value={nuevoDistrib[k]||''} onChange={e => setNuevoDistrib(n=>({...n,[k]:e.target.value}))} className="input text-sm" />
                </div>
              ))}
            </div>
            <button onClick={crearDistrib} className="btn-primary gap-2 mt-3 text-sm">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Contacto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">NIT</th>
              </tr></thead>
              <tbody className="divide-y">
                {distribuidores.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{d.contacto||'—'}</td>
                    <td className="px-4 py-3 text-gray-500">{d.telefono||'—'}</td>
                    <td className="px-4 py-3 text-gray-500">{d.nit||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORÍAS */}
      {tab === 'categorias' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Nueva categoría</h2>
            <div className="flex gap-3">
              <input value={nuevaCat.nombre} onChange={e => setNuevaCat(n=>({...n,nombre:e.target.value}))} placeholder="Nombre de la categoría" className="input flex-1" />
              <input type="color" value={nuevaCat.color} onChange={e => setNuevaCat(n=>({...n,color:e.target.value}))} className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" />
              <button onClick={crearCategoria} className="btn-primary gap-1 text-sm"><Plus className="w-4 h-4"/>Agregar</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categorias.map(c => (
              <div key={c.id} className="card flex items-center gap-3">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="text-sm font-medium text-gray-800">{c.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* USUARIOS */}
      {tab === 'usuarios' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-gray-800 mb-4">Nuevo usuario</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label><input value={nuevoUser.nombre} onChange={e=>setNuevoUser(n=>({...n,nombre:e.target.value}))} className="input text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label><input type="email" value={nuevoUser.email} onChange={e=>setNuevoUser(n=>({...n,email:e.target.value}))} className="input text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Contraseña *</label><input type="password" value={nuevoUser.password} onChange={e=>setNuevoUser(n=>({...n,password:e.target.value}))} className="input text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
                <select value={nuevoUser.rol} onChange={e=>setNuevoUser(n=>({...n,rol:e.target.value}))} className="input text-sm">
                  <option value="cajero">Cajero</option>
                  <option value="gerente">Gerente</option>
                </select>
              </div>
            </div>
            <button onClick={crearUsuario} className="btn-primary gap-2 mt-3 text-sm"><Plus className="w-4 h-4"/>Crear usuario</button>
          </div>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              </tr></thead>
              <tbody className="divide-y">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3"><span className={u.rol==='gerente'?'badge-info':'badge-success'}>{u.rol}</span></td>
                    <td className="px-4 py-3"><span className={u.activo?'badge-success':'badge-danger'}>{u.activo?'Activo':'Inactivo'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
