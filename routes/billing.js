const express = require('express');
const router = express.Router();

const { createBilling, listBillings, getBillingById } = require('../controllers/billingController');
const { requireAuth, requireClient, requireAdmin } = require('../middleware/auth');

/**
 * Billing routes
 * - HU-BILL-01: Completar Datos de Facturación (Cliente)
 */

// Autenticación para todas las rutas de billing
router.use(requireAuth);

/**
 * @route GET /api/billing
 * @desc Listar facturaciones (solo Admin)
 * @access Private (Admin only)
 * @query {string} fecha_desde - ISO
 * @query {string} fecha_hasta - ISO
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 * @query {string} include - CSV: user,auction
 */
router.get('/', requireAdmin, listBillings);

/**
 * @route GET /api/billing/:id
 * @desc Detalle de una facturación
 * @access Private (Admin: cualquiera, Client: propio)
 * @query {string} include - CSV: user,auction
 */
router.get('/:id', getBillingById);

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