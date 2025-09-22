const refundService = require('../services/refundService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validations: { refundSchemas, querySchemas, validate },
} = require('../utils');
const { uploadVoucher } = require('../config/cloudinary');
const { Logger } = require('../middleware/logger');

/**
 * HU-REEM-01 — Solicitar Reembolso (Cliente)
 * POST /api/refunds
 */
const createRefund = asyncHandler(async (req, res) => {
  const payload = validate(refundSchemas.createRefund, req.body);

  Logger.info(`Cliente ${req.user.email} creando solicitud de reembolso`, payload);

  const refund = await refundService.createRefund(req.user.id, payload);

  res.status(201).json({
    success: true,
    data: { refund },
    message: 'Solicitud de reembolso creada exitosamente',
  });
});

/**
 * HU-REEM-02 — Gestionar Solicitudes Reembolso (Admin)
 * PATCH /api/refunds/:id/manage
 */
const manageRefund = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = validate(refundSchemas.manageRefund, req.body);

  Logger.info(`Admin ${req.user.email} gestionando refund ${id}`, payload);

  const result = await refundService.manageRefund(id, req.user.id, payload);

  res.status(200).json({
    success: true,
    data: { refund: result },
    message: `Solicitud de reembolso ${payload.estado}`,
  });
});

/**
 * HU-REEM-03 — Procesar Reembolso (Admin)
 * PATCH /api/refunds/:id/process
 */
const processRefund = [
  uploadVoucher.single('voucher'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Datos opcionales; validación la ejecuta el service según tipo/estado
    const data = validate(refundSchemas.processRefund, req.body);

    Logger.info(`Admin ${req.user.email} procesando refund ${id}`);

    const result = await refundService.processRefund(id, req.user.id, data, req.file);

    res.status(200).json({
      success: true,
      data: {
        refund: result.refund,
        movement: {
          id: result.movement.id,
          tipo_movimiento_general: result.movement.tipo_movimiento_general,
          tipo_movimiento_especifico: result.movement.tipo_movimiento_especifico,
          monto: result.movement.monto,
          estado: result.movement.estado,
          created_at: result.movement.created_at,
        },
      },
      message: 'Reembolso procesado correctamente',
    });
  }),
];

// GET /refunds — Listar solicitudes de reembolso (Admin ve todas; Cliente solo las propias)
const listRefunds = asyncHandler(async (req, res) => {
  const filters = validate(querySchemas.refundFilters, req.query);
  
  Logger.info(`Listando refunds`, {
    requested_by: req.user.email,
    role: req.user.user_type,
    filters,
  });
  
  const result = await refundService.listRefunds(req.user, filters);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * GET /refunds/:id — Detalle de refund
 * Query: include (CSV: user,auction)
 * Auth: Admin cualquiera; Client solo propio
 */
const getRefundById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include = '' } = req.query;

  Logger.info(`Detalle refund ${id} - ${req.user.user_type}: ${req.user.email}`, { include });

  const refund = await refundService.getRefundById(
    id,
    req.user.user_type,
    req.user.id,
    include
  );

  res.status(200).json({
    success: true,
    data: { refund },
  });
});

/**
 * GET /users/:userId/refunds — Listar refunds por usuario
 * Query: estado, auction_id, fecha_desde, fecha_hasta, page, limit, include (CSV: user,auction)
 * Auth: Admin cualquiera; Client solo propio
 */
const getRefundsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const filters = validate(querySchemas.refundFilters, req.query);

  Logger.info(
    `Listando refunds de usuario ${userId} - ${req.user.user_type}: ${req.user.email}`,
    { filters }
  );

  const result = await refundService.getRefundsByUser(
    userId,
    filters,
    req.user.user_type,
    req.user.id
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  createRefund,
  manageRefund,
  processRefund,
  listRefunds,
  getRefundById,
  getRefundsByUser,
};