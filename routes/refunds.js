const express = require('express');
const router = express.Router();

const {
  createRefund,
  manageRefund,
  processRefund,
} = require('../controllers/refundController');

const { requireAuth, requireClient, requireAdmin } = require('../middleware/auth');

/**
 * Refunds routes
 * - HU-REEM-01: Solicitar Reembolso (Cliente)
 * - HU-REEM-02: Gestionar Solicitudes Reembolso (Admin)
 * - HU-REEM-03: Procesar Reembolso (Admin)
 */

// Autenticación para todas las rutas de refunds
router.use(requireAuth);

/**
 * @route POST /api/refunds
 * @desc Crear solicitud de reembolso
 * @access Private (Client only)
 * @body {number} monto_solicitado
 * @body {string} tipo_reembolso - 'mantener_saldo' | 'devolver_dinero'
 * @body {string} motivo - opcional
 */
router.post('/', requireClient, createRefund);

/**
 * @route PATCH /api/refunds/:id/manage
 * @desc Confirmar o rechazar solicitud de reembolso
 * @access Private (Admin only)
 * @params {string} id - ID de la solicitud
 * @body {string} estado - 'confirmado' | 'rechazado'
 * @body {string} motivo - opcional
 */
router.patch('/:id/manage', requireAdmin, manageRefund);

/**
 * @route PATCH /api/refunds/:id/process
 * @desc Procesar reembolso confirmado
 * @access Private (Admin only)
 * @params {string} id - ID de la solicitud
 * @body {string} tipo_transferencia? - 'transferencia' | 'deposito'
 * @body {string} banco_destino?
 * @body {string} numero_cuenta_destino?
 * @body {string} numero_operacion? (obligatorio si devolver_dinero)
 * @body {file} voucher? - comprobante del reembolso (PDF/JPG/PNG)
 */
router.patch('/:id/process', requireAdmin, processRefund);

module.exports = router;