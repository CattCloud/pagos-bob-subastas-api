const movementService = require('../services/movementService');
const { uploadVoucher } = require('../config/cloudinary');
const {
  asyncHandler
} = require('../middleware/errorHandler');
const {
  validations: { movementSchemas, validate }
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Registrar pago de garantía como Movement
 * POST /api/movements
 */
const createPayment = [
  // Middleware de subida de archivo (voucher)
  uploadVoucher.single('voucher'),

  asyncHandler(async (req, res) => {
    // Validar request
    const payload = validate(movementSchemas.createPayment, req.body);

    Logger.info(`Cliente ${req.user.email} registrando Movement pago_garantia`, {
      auction_id: payload.auction_id,
      monto: payload.monto,
      tipo_pago: payload.tipo_pago,
    });

    const result = await movementService.createPaymentMovement(
      req.user.id,
      payload,
      req.file
    );

    res.status(201).json({
      success: true,
      data: {
        movement: {
          id: result.movement.id,
          tipo_movimiento_general: result.movement.tipo_movimiento_general,
          tipo_movimiento_especifico: result.movement.tipo_movimiento_especifico,
          monto: result.movement.monto,
          estado: result.movement.estado,
          voucher_url: result.movement.voucher_url,
          created_at: result.movement.created_at,
        },
        auction_updated: {
          id: result.auction.id,
          estado: result.auction.estado,
        },
      },
      message: 'Transacción registrada exitosamente',
    });
  })
];

/**
 * Listar movements (admin: todos, client: propios)
 * GET /api/movements
 */
const listMovements = asyncHandler(async (req, res) => {
  const filters = validate(movementSchemas.listFilters, req.query);

  Logger.info(`Listando movements - ${req.user.user_type}: ${req.user.email}`, {
    filters,
  });

  const result = await movementService.listMovements(
    filters,
    req.user.user_type,
    req.user.id
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Obtener detalle de movement
 * GET /api/movements/:id
 */
const getMovementById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include = '' } = req.query;

  Logger.info(`Detalle movement ${id} - ${req.user.user_type}: ${req.user.email}`, { include });

  const movement = await movementService.getMovementById(
    id,
    req.user.user_type,
    req.user.id,
    include
  );

  res.status(200).json({
    success: true,
    data: {
      movement,
    },
  });
});

/**
 * Aprobar pago de garantía (movement)
 * PATCH /api/movements/:id/approve
 */
const approvePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comentarios } = validate(movementSchemas.approve, req.body);

  Logger.info(`Admin ${req.user.email} aprobando movement ${id}`, { comentarios });

  const result = await movementService.approvePaymentMovement(
    id,
    req.user.id,
    comentarios
  );

  res.status(200).json({
    success: true,
    data: {
      movement: {
        id: result.movement.id,
        estado: result.movement.estado,
        fecha_resolucion: result.movement.fecha_resolucion,
      },
      auction_updated: {
        id: result.auction.id,
        estado: result.auction.estado,
        finished_at: result.auction.finished_at,
      },
      user: result.user,
    },
    message: 'Transacción aprobada exitosamente',
  });
});

/**
 * Rechazar pago de garantía (movement)
 * PATCH /api/movements/:id/reject
 */
const rejectPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rejectionData = validate(movementSchemas.reject, req.body);

  Logger.warn(`Admin ${req.user.email} rechazando movement ${id}`, {
    motivos: rejectionData.motivos,
    otros_motivos: rejectionData.otros_motivos,
  });

  const result = await movementService.rejectPaymentMovement(
    id,
    req.user.id,
    rejectionData
  );

  res.status(200).json({
    success: true,
    data: {
      movement: {
        id: result.movement.id,
        estado: result.movement.estado,
        motivo_rechazo: result.movement.motivo_rechazo,
        fecha_resolucion: result.movement.fecha_resolucion,
      },
      auction_updated: {
        id: result.auction.id,
        estado: result.auction.estado,
      },
      user: result.user,
    },
    message: 'Transacción rechazada',
  });
});

/**
 * Descargar voucher del movement
 * GET /api/movements/:id/voucher
 */
const downloadVoucher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  Logger.info(`Descargando voucher movement ${id} - ${req.user.user_type}: ${req.user.email}`);

  const movement = await movementService.getMovementById(
    id,
    req.user.user_type,
    req.user.id
  );

  if (!movement.voucher_url) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VOUCHER_NOT_FOUND',
        message: 'No se encontró el comprobante para esta transacción',
        timestamp: new Date().toISOString(),
      },
    });
  }

  res.redirect(movement.voucher_url);
});

module.exports = {
  createPayment,
  listMovements,
  getMovementById,
  approvePayment,
  rejectPayment,
  downloadVoucher,
};