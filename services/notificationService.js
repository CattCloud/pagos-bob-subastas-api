const { prisma } = require('../config/database');
const { Logger } = require('../middleware/logger');
const { NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

/**
 * Servicio de Notificaciones
 * - Persistencia en tabla notifications
 * - Envío de email (best-effort) vía services/emailService.js
 */
class NotificationService {
  /**
   * Crear notificación y (best-effort) enviar email.
   * Si se provee tx, usa la transacción; de lo contrario usa prisma directo.
   */
  async createAndSend({ tx = null, user_id, tipo, titulo, mensaje, reference_type = null, reference_id = null }) {
    const db = tx || prisma;

    // 1) Crear notificación
    const notif = await db.notification.create({
      data: {
        user_id,
        tipo,
        titulo,
        mensaje,
        estado: 'pendiente',
        email_status: 'pendiente',
        reference_type,
        reference_id,
      },
    });

    // 2) Intento de envío de correo fuera de transacción (no bloqueante)
    setTimeout(async () => {
      try {
        const emailService = require('./emailService');
        await emailService.send({
          toUserId: user_id,
          subject: titulo,
          body: mensaje,
        });

        await prisma.notification.update({
          where: { id: notif.id },
          data: {
            email_status: 'enviado',
            email_sent_at: new Date(),
          },
        });
      } catch (e) {
        Logger.warn(`Email de notificación falló (${tipo}): ${e.message || 'undefined'}`);
        try {
          await prisma.notification.update({
            where: { id: notif.id },
            data: {
              email_status: 'fallido',
              email_error: e?.message?.slice(0, 300) ?? 'unknown_error',
            },
          });
        } catch (updErr) {
          Logger.warn(`No se pudo actualizar estado de email para notificación (${tipo}): ${updErr.message}`);
        }
      }
    }, 0);

    return notif;
  }

  /**
   * Listar notificaciones del usuario autenticado (cliente)
   */
  async listUserNotifications(userId, { page = 1, limit = 20, estado, tipo, fecha_desde, fecha_hasta } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const where = { user_id: userId };

    if (estado) {
      const estados = Array.isArray(estado) ? estado : String(estado).split(',').map(s => s.trim());
      where.estado = { in: estados };
    }

    if (tipo) {
      const tipos = Array.isArray(tipo) ? tipo : String(tipo).split(',').map(s => s.trim());
      where.tipo = { in: tipos };
    }

    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }

    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(limit))),
        has_next: skip + Number(limit) < total,
        has_prev: Number(page) > 1,
      },
    };
  }

  /**
   * Listado para admin (todas o con filtros)
   */
  async listAdminNotifications({ page = 1, limit = 20, user_id, estado, tipo, fecha_desde, fecha_hasta, search } = {}) {
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};

    if (user_id) where.user_id = user_id;

    if (estado) {
      const estados = Array.isArray(estado) ? estado : String(estado).split(',').map(s => s.trim());
      where.estado = { in: estados };
    }

    if (tipo) {
      const tipos = Array.isArray(tipo) ? tipo : String(tipo).split(',').map(s => s.trim());
      where.tipo = { in: tipos };
    }

    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }

    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { mensaje: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          // Priorizar pendientes primero
          { estado: 'asc' },
          { created_at: 'desc' },
        ],
        skip,
        take: Number(limit),
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(limit))),
        has_next: skip + Number(limit) < total,
        has_prev: Number(page) > 1,
      },
    };
  }

  /**
   * Marcar todas como leídas (vista) para el usuario
   */
  async markAllAsRead(userId) {
    const res = await prisma.notification.updateMany({
      where: {
        user_id: userId,
        estado: 'pendiente',
      },
      data: {
        estado: 'vista',
        fecha_vista: new Date(),
      },
    });
    return { updated: res.count };
  }

  /**
   * Marcar una notificación específica como leída
   */
  async markAsRead(notificationId, userId) {
    const notif = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) {
      throw new NotFoundError('Notificación');
    }
    if (notif.user_id !== userId) {
      throw new ForbiddenError('No tiene permisos para modificar esta notificación');
    }
    if (notif.estado === 'vista') return notif;
  
    return prisma.notification.update({
      where: { id: notificationId },
      data: { estado: 'vista', fecha_vista: new Date() },
    });
  }
}

module.exports = new NotificationService();