require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Inicializar DB antes de las rutas
const { getDB } = require('./database');
getDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Guardar io en app para usarlo en rutas
app.set('io', io);

// CORS — en producción solo permite el dominio propio
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting básico
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use(limiter);

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/inventario', require('./routes/inventario'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/ia', require('./routes/ia'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/gastos',   require('./routes/gastos'));

// ── Servir frontend en producción ────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  // Todas las rutas no-API devuelven el index.html (SPA)
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    sistema: 'SupermercadoPOS Colombia',
    timestamp: new Date().toISOString()
  });
});

// Socket.io para tiempo real
io.on('connection', (socket) => {
  console.log(`📱 Dispositivo conectado: ${socket.id}`);

  socket.on('join:caja', (cajaId) => {
    socket.join(`caja:${cajaId}`);
    console.log(`🏪 Socket ${socket.id} unido a caja ${cajaId}`);
  });

  socket.on('disconnect', () => {
    console.log(`📴 Dispositivo desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 =========================================`);
  console.log(`   SupermercadoPOS - Backend corriendo`);
  console.log(`   Puerto: http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Salud:  http://localhost:${PORT}/api/health`);
  console.log(`=========================================\n`);
  console.log(`👤 Gerente:  gerente@supermercado.com / admin123`);
  console.log(`👤 Cajero:   caja1@supermercado.com / caja123`);
});

module.exports = { app, server, io };
