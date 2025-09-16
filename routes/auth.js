const express = require('express');
const router = express.Router();
const {
  clientLogin,
  adminAccess,
  logout,
  validateSession,
  getSessionStats,
} = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

/**
 * @route POST /api/auth/client-login
 * @desc Identificar cliente por documento
 * @access Public
 */
router.post('/client-login', clientLogin);

/**
 * @route POST /api/auth/admin-access
 * @desc Acceso automático del administrador
 * @access Public
 */
router.post('/admin-access', adminAccess);

/**
 * @route POST /api/auth/logout
 * @desc Cerrar sesión
 * @access Private
 */
router.post('/logout', logout);

/**
 * @route GET /api/auth/session
 * @desc Validar sesión activa
 * @access Private
 */
router.get('/session', validateSession);

/**
 * @route GET /api/auth/sessions/stats
 * @desc Obtener estadísticas de sesiones activas
 * @access Private (Admin only)
 */
router.get('/sessions/stats', requireAdmin, getSessionStats);

module.exports = router;