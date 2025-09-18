const express = require('express');
const router = express.Router();

const { createBilling } = require('../controllers/billingController');
const { requireAuth, requireClient } = require('../middleware/auth');

/**
 * Billing routes
 * - HU-BILL-01: Completar Datos de Facturación (Cliente)
 */

// Autenticación para todas las rutas de billing
router.use(requireAuth);

/**
 * @route POST /api/billing
 * @desc Crear Billing para subasta ganada (cliente)
 * @access Private (Client only)
 * @body {string} auction_id - CUID de subasta en estado 'ganada'
 * @body {string} billing_document_type - 'RUC' | 'DNI'
 * @body {string} billing_document_number
 * @body {string} billing_name
 */
router.post('/', requireClient, createBilling);

module.exports = router;