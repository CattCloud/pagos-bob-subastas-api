const express = require('express');
const router = express.Router();

const {
  createPayment,
  listMovements,
  getMovementById,
  approvePayment,
  rejectPayment,
  downloadVoucher,
} = require('../controllers/movementController');

const {
  requireAuth,
  requireAdmin,
  requireClient,
} = require('../middleware/auth');

// Autenticación para todas las rutas de movements
router.use(requireAuth);

/**
 * @route GET /api/movements
 * @desc Listar movements (admin: todos, client: propios)
 * @access Private
 * @query {string} tipo_especifico - Filtrar por tipos específicos (pago_garantia,reembolso,penalidad,ajuste_manual)
 * @query {string} estado - Filtrar por estados (pendiente,validado,rechazado)
 * @query {string} fecha_desde - ISO
 * @query {string} fecha_hasta - ISO
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/', listMovements);

/**
 * @route POST /api/movements
 * @desc Registrar pago de garantía como Movement (cliente)
 * @access Private (Client only)
 * @body {string} auction_id
 * @body {number} monto
 * @body {string} tipo_pago - 'deposito' | 'transferencia'
 * @body {string} numero_cuenta_origen
 * @body {string} numero_operacion
 * @body {string} fecha_pago - ISO
 * @body {string} moneda - default 'USD'
 * @body {string} concepto - default 'Pago de garantía'
 * @body {file} voucher - PDF/JPG/PNG
 */
router.post('/', requireClient, createPayment);

/**
 * @route GET /api/movements/:id
 * @desc Detalle movement
 * @access Private (Admin: cualquiera, Client: propio)
 */
router.get('/:id', getMovementById);

/**
 * @route PATCH /api/movements/:id/approve
 * @desc Aprobar pago de garantía (admin)
 * @access Private (Admin only)
 * @body {string} comentarios (opcional)
 */
router.patch('/:id/approve', requireAdmin, approvePayment);

/**
 * @route PATCH /api/movements/:id/reject
 * @desc Rechazar pago de garantía (admin)
 * @access Private (Admin only)
 * @body {array} motivos - Motivos del rechazo (obligatorio)
 * @body {string} otros_motivos - Opcional
 * @body {string} comentarios - Opcional
 */
router.patch('/:id/reject', requireAdmin, rejectPayment);

/**
 * @route GET /api/movements/:id/voucher
 * @desc Descargar comprobante (voucher)
 * @access Private (Admin: cualquiera, Client: propio)
 */
router.get('/:id/voucher', downloadVoucher);

module.exports = router;