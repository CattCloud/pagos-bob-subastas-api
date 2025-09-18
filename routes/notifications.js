const express = require('express');
const router = express.Router();

const {
  listNotifications,
  markAllAsRead,
  markAsRead,
} = require('../controllers/notificationController');

const { requireAuth } = require('../middleware/auth');

// Autenticación para todas las rutas de notificaciones
router.use(requireAuth);

/**
 * @route GET /api/notifications
 * @desc Listar notificaciones
 * @access Private (Admin: global, Client: propias)
 * @query estado, tipo, fecha_desde, fecha_hasta, page, limit, search, user_id?(admin)
 */
router.get('/', listNotifications);

/**
 * @route PATCH /api/notifications/mark-all-read
 * @desc Marcar todas las notificaciones del usuario autenticado como leídas
 * @access Private
 */
router.patch('/mark-all-read', markAllAsRead);

/**
 * @route PATCH /api/notifications/:id/read
 * @desc Marcar una notificación específica como leída
 * @access Private
 * @params {string} id - ID de la notificación
 */
router.patch('/:id/read', markAsRead);

module.exports = router;