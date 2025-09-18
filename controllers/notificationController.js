const notificationService = require('../services/notificationService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validations: { querySchemas, validate },
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Listar notificaciones
 * - Cliente: sus propias notificaciones
 * - Admin: listado global con filtros (opcionalmente por user_id)
 * GET /api/notifications
 */
const listNotifications = asyncHandler(async (req, res) => {
  const filters = validate(querySchemas.notificationFilters, req.query);

  if (req.user.user_type === 'admin') {
    // Para admin, permitir filtros globales. user_id opcional.
    const adminFilters = { ...filters };
    if (req.query.user_id) adminFilters.user_id = req.query.user_id;

    Logger.info(`Admin ${req.user.email} listando notificaciones`, { adminFilters });

    const result = await notificationService.listAdminNotifications(adminFilters);
    return res.status(200).json({
      success: true,
      data: result,
    });
  }

  // Cliente: solo propias
  Logger.info(`Cliente ${req.user.email} listando sus notificaciones`, { filters });

  const result = await notificationService.listUserNotifications(req.user.id, filters);
  return res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Marcar todas las notificaciones del usuario autenticado como leídas
 * PATCH /api/notifications/mark-all-read
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  Logger.info(`Usuario ${req.user.email} marcando todas las notificaciones como leídas`);

  const result = await notificationService.markAllAsRead(req.user.id);
  return res.status(200).json({
    success: true,
    data: result,
    message: 'Notificaciones marcadas como leídas',
  });
});

/**
 * Marcar una notificación específica como leída
 * PATCH /api/notifications/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  Logger.info(`Usuario ${req.user.email} marcando notificación ${id} como leída`);

  const notif = await notificationService.markAsRead(id, req.user.id);
  return res.status(200).json({
    success: true,
    data: { notification: notif },
    message: 'Notificación marcada como leída',
  });
});

module.exports = {
  listNotifications,
  markAllAsRead,
  markAsRead,
};