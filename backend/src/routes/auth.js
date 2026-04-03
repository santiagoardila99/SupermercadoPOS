const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../database');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol }
  });
});

// Perfil del usuario actual
router.get('/me', authMiddleware, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, nombre, email, rol, creado_en FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// Cambiar contraseña
router.put('/cambiar-password', authMiddleware, (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(password_actual, user.password_hash)) {
    return res.status(400).json({ error: 'Contraseña actual incorrecta' });
  }
  const newHash = bcrypt.hashSync(password_nuevo, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ mensaje: 'Contraseña actualizada' });
});

module.exports = router;
