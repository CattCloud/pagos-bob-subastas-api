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

module.exports = {
  createBilling,
};