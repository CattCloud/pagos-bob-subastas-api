const express = require('express');
const router = express.Router();

const {
  createRefund,
  manageRefund,
  processRefund,
  listRefunds,
  getRefundById,
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
 * @route GET /refunds
 * @desc Listar solicitudes de reembolso
 * @access Private (Admin: todas | Client: solo propias)
 * @query {string} estado - (opcional) 'solicitado,confirmado,procesado,rechazado,cancelado'
 * @query {string} user_id - (admin opcional) filtrar por usuario
 * @query {string} auction_id - (opcional) filtrar por subasta
 * @query {string} fecha_desde - (opcional) ISO date
 * @query {string} fecha_hasta - (opcional) ISO date
 * @query {number} page - (opcional) default 1
 * @query {number} limit - (opcional) default 20
 */
router.get('/', listRefunds);

/**
 * @route GET /api/refunds/:id
 * @desc Detalle de refund
 * @access Private (Admin: cualquiera, Client: propio)
 * @query {string} include - CSV: user,auction
 */
router.get('/:id', getRefundById);

/**
 * @route POST /api/refunds
 * @desc Crear solicitud de reembolso
 * @access Private (Client only)
 * @body {number} monto_solicitado
 * @body {string} motivo - opcional
 * @body {string} auction_id? - opcional (solo trazabilidad)
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
 * @desc Procesar reembolso confirmado (únicamente devolución de dinero)
 * @access Private (Admin only)
 * @params {string} id - ID de la solicitud
 * @body {string} tipo_transferencia? - 'transferencia' | 'deposito'
 * @body {string} banco_destino?
 * @body {string} numero_cuenta_destino?
 * @body {string} numero_operacion - obligatorio
 * @body {file} voucher? - comprobante del reembolso (PDF/JPG/PNG)
 */
router.patch('/:id/process', requireAdmin, processRefund);

module.exports = router;