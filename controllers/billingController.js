const billingService = require('../services/billingService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validations: { billingSchemas, validate },
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Crear Billing (cliente ganador)
 * POST /api/billing
 */
const createBilling = asyncHandler(async (req, res) => {
  const payload = validate(billingSchemas.createBilling, req.body);

  Logger.info(`Cliente ${req.user.email} creando Billing`, {
    auction_id: payload.auction_id,
    billing_document_type: payload.billing_document_type,
  });

  const result = await billingService.createBilling(req.user.id, payload);

  res.status(201).json({
    success: true,
    data: {
      billing: {
        id: result.billing.id,
        monto: result.billing.monto,
        moneda: result.billing.moneda,
        concepto: result.billing.concepto,
        created_at: result.billing.created_at,
      },
      auction_updated: {
        id: result.auction.id,
        estado: result.auction.estado,
      },
    },
    message: 'Facturación completada exitosamente',
  });
});

/**
 * Listar facturaciones (Admin)
 * GET /api/billing
 * Query: page, limit, fecha_desde, fecha_hasta, include (CSV: user,auction)
 */
const listBillings = asyncHandler(async (req, res) => {
  const filters = {
    page: req.query.page,
    limit: req.query.limit,
    fecha_desde: req.query.fecha_desde,
    fecha_hasta: req.query.fecha_hasta,
    include: req.query.include || '',
  };

  Logger.info(`Listando billings - ${req.user.user_type}: ${req.user.email}`, { filters });

  const result = await billingService.listBillings(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Detalle de facturación
 * GET /api/billing/:id
 * Query: include (CSV: user,auction)
 */
const getBillingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include = '' } = req.query;

  Logger.info(`Detalle billing ${id} - ${req.user.user_type}: ${req.user.email}`, { include });

  const billing = await billingService.getBillingById(
    id,
    req.user.user_type,
    req.user.id,
    include
  );

  res.status(200).json({
    success: true,
    data: { billing },
  });
});

/**
 * Completar datos de facturación (HU-BILL-01)
 * PATCH /api/billing/:id/complete
 */
const completeBilling = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = validate(billingSchemas.completeBilling, req.body);

  Logger.info(`Completar datos de facturación billing ${id} - ${req.user.user_type}: ${req.user.email}`, {
    payload: {
      billing_document_type: payload.billing_document_type,
      billing_document_number: payload.billing_document_number?.slice(0, 3) + '***',
      billing_name_len: payload.billing_name?.length,
    },
  });

  const result = await billingService.completeBilling(
    id,
    req.user.user_type,
    req.user.id,
    payload
  );

  res.status(200).json({
    success: true,
    data: {
      billing: {
        id: result.billing.id,
        billing_document_type: result.billing.billing_document_type,
        billing_document_number: result.billing.billing_document_number,
        billing_name: result.billing.billing_name,
        updated_at: result.billing.updated_at,
      },
    },
    message: 'Datos de facturación completados exitosamente',
  });
});

/**
 * Listar facturaciones por usuario
 * GET /api/users/:userId/billings
 * Query: page, limit, fecha_desde, fecha_hasta, include (CSV: user,auction)
 */
const getBillingsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const filters = {
    page: req.query.page,
    limit: req.query.limit,
    fecha_desde: req.query.fecha_desde,
    fecha_hasta: req.query.fecha_hasta,
    include: req.query.include || '',
  };

  Logger.info(
    `Listando billings de usuario ${userId} - ${req.user.user_type}: ${req.user.email}`,
    { filters }
  );

  const result = await billingService.getBillingsByUser(
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
  createBilling,
  listBillings,
  getBillingById,
  getBillingsByUser,
  completeBilling,
};