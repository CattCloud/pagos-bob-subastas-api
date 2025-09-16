const express = require('express');
const router = express.Router();
const {
  createGuaranteePayment,
  getGuaranteePayments,
  getGuaranteePaymentById,
  approveGuaranteePayment,
  rejectGuaranteePayment,
  downloadVoucher,
  getPaymentStats,
} = require('../controllers/guaranteePaymentController');
const { 
  requireAuth, 
  requireAdmin,
  requireClient
} = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

/**
 * @route GET /api/guarantee-payments/stats
 * @desc Obtener estadísticas de pagos de garantía
 * @access Private (Admin only)
 */
router.get('/stats', requireAdmin, getPaymentStats);

/**
 * @route GET /api/guarantee-payments
 * @desc Listar pagos de garantía con filtros
 * @access Private (Admin: todos, Client: propios)
 * @query {string} estado - Filtrar por estados (separados por coma)
 * @query {string} fecha_desde - Fecha inicio del rango
 * @query {string} fecha_hasta - Fecha fin del rango
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/', getGuaranteePayments);

/**
 * @route POST /api/guarantee-payments
 * @desc Registrar pago de garantía
 * @access Private (Client only)
 * @body {string} auction_id - ID de la subasta
 * @body {number} monto_garantia - Monto de la garantía (8% de la oferta)
 * @body {string} tipo_pago - Tipo de pago (Deposito/Transferencia)
 * @body {string} numero_cuenta_origen - Número de cuenta origen
 * @body {string} fecha_pago - Fecha del pago
 * @body {string} billing_document_type - Tipo documento facturación (RUC/DNI)
 * @body {string} billing_name - Nombre/Razón social para facturación
 * @body {string} comentarios - Comentarios adicionales (opcional)
 * @body {file} voucher - Archivo del comprobante (PDF/JPG/PNG)
 */
router.post('/', requireClient, createGuaranteePayment);

/**
 * @route GET /api/guarantee-payments/:id
 * @desc Obtener detalle de pago específico
 * @access Private (Admin: cualquiera, Client: propios)
 * @params {string} id - ID del pago
 */
router.get('/:id', getGuaranteePaymentById);

/**
 * @route PATCH /api/guarantee-payments/:id/approve
 * @desc Aprobar pago de garantía
 * @access Private (Admin only)
 * @params {string} id - ID del pago
 * @body {string} comentarios - Comentarios adicionales (opcional)
 */
router.patch('/:id/approve', requireAdmin, approveGuaranteePayment);

/**
 * @route PATCH /api/guarantee-payments/:id/reject
 * @desc Rechazar pago de garantía
 * @access Private (Admin only)
 * @params {string} id - ID del pago
 * @body {array} motivos - Motivos del rechazo (obligatorio)
 * @body {string} otros_motivos - Otros motivos específicos (opcional)
 * @body {string} comentarios - Comentarios adicionales (opcional)
 */
router.patch('/:id/reject', requireAdmin, rejectGuaranteePayment);

/**
 * @route GET /api/guarantee-payments/:id/voucher
 * @desc Descargar comprobante de pago
 * @access Private (Admin: cualquiera, Client: propios)
 * @params {string} id - ID del pago
 */
router.get('/:id/voucher', downloadVoucher);

module.exports = router;