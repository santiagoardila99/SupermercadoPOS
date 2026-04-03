// ── Configuración persistente del POS (localStorage) ──────────────────────
const CONFIG_KEY = 'pos_config_v1';

// Lista de acciones configurables
export const ACCIONES_POS = [
  {
    id: 'salir',
    label: 'Salir del POS',
    descripcion: 'Regresa al panel principal sin cerrar sesión',
    icono: '🚪',
    color: 'red',
  },
  {
    id: 'facturas',
    label: 'Consultar Facturas',
    descripcion: 'Abre el historial de ventas del día con buscador y totales',
    icono: '📋',
    color: 'blue',
  },
  {
    id: 'borrarItem',
    label: 'Borrar Producto Específico',
    descripcion: 'Muestra lista del carrito para seleccionar y eliminar un ítem',
    icono: '🗑',
    color: 'teal',
  },
  {
    id: 'consultarPrecio',
    label: 'Consultar Precio',
    descripcion: 'Escanea un producto para ver su precio sin agregarlo a la factura',
    icono: '🏷️',
    color: 'indigo',
  },
  {
    id: 'cobrar',
    label: 'Cobrar / Finalizar Venta',
    descripcion: 'Abre el modal de cobro para finalizar la venta',
    icono: '💰',
    color: 'green',
  },
  {
    id: 'asignarCliente',
    label: 'Asignar Cliente / Fiado',
    descripcion: 'Busca y asigna un cliente a la factura actual',
    icono: '👤',
    color: 'blue',
  },
  {
    id: 'memoria',
    label: 'Asignar a Memoria / Cambiar Factura',
    descripcion: 'Guarda la factura actual en espera y abre una nueva (máx. 2 facturas)',
    icono: '🔄',
    color: 'amber',
  },
  {
    id: 'gastos',
    label: 'Gastos / Recogida de Caja',
    descripcion: 'Registra gastos del día y recogidas de caja',
    icono: '💸',
    color: 'purple',
  },
  {
    id: 'descuento',
    label: 'Descuento a Producto',
    descripcion: 'Aplica descuento por % o valor fijo a un producto del carrito',
    icono: '🏷️',
    color: 'green',
  },
  {
    id: 'abonoCliente',
    label: 'Abono Cliente',
    descripcion: 'Registra un abono a la deuda del cliente asignado',
    icono: '💵',
    color: 'green',
  },
];

// Valores por defecto
export const DEFAULT_CONFIG = {
  atajos: {
    salir:           'F4',
    consultarPrecio: 'F5',
    descuento:       'F6',
    borrarItem:      'F7',
    asignarCliente:  'F8',
    memoria:         'F9',
    facturas:        'F11',
    gastos:          'F12',
    cobrar:          'End',
    abonoCliente:    'F3',
  },
  apariencia: {
    nombreNegocio:     'SUPERMERCADO',
    letraLogo:         'S',
    tamanoTotal:       150,
    tamanoUltProd:     68,
    tamanoUltSubtotal: 58,
    mostrarGramera:    true,
  },
  carrito: {
    mostrarIVA:       true,
    mostrarMedida:    true,
    mostrarDescuento: true,
  },
  recibo: {
    countdownSegundos: 10,
    autoImprimir:      false,
  },
};

/** Lee la configuración (mezcla con defaults para garantizar todas las keys) */
export function getPOSConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return structuredClone(DEFAULT_CONFIG);
    const saved = JSON.parse(raw);
    return {
      atajos:     { ...DEFAULT_CONFIG.atajos,     ...(saved.atajos     || {}) },
      apariencia: { ...DEFAULT_CONFIG.apariencia, ...(saved.apariencia || {}) },
      carrito:    { ...DEFAULT_CONFIG.carrito,    ...(saved.carrito    || {}) },
      recibo:     { ...DEFAULT_CONFIG.recibo,     ...(saved.recibo     || {}) },
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

/** Guarda la configuración */
export function setPOSConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/** Restablece a los valores por defecto */
export function resetPOSConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

/** Muestra un nombre legible para una tecla */
export function keyLabel(key) {
  const map = {
    ' ': 'Espacio', Enter: '↵ Enter', Escape: 'Esc', Backspace: '⌫',
    Delete: 'Supr', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓',
    ArrowLeft: '←', ArrowRight: '→', End: 'Fin', Home: 'Inicio',
    PageUp: 'Re Pág', PageDown: 'Av Pág', Insert: 'Ins',
    NumpadEnter: '↵ Num', NumpadAdd: '+ Num', NumpadSubtract: '− Num',
    NumpadMultiply: '× Num', NumpadDecimal: '. Num',
  };
  return map[key] || key;
}
