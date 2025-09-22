const express = require('express');
const router = express.Router();
const {
  getWonAuctionsByUser,
  canUserParticipate,
  getGuaranteeStats,
} = require('../controllers/guaranteeController');
const {
  getBalance,
  getUserMovements,
  createManualMovement,
} = require('../controllers/balanceController');
const { listUsers } = require('../controllers/userController');
const { getBillingsByUser } = require('../controllers/billingController');
const { getRefundsByUser } = require('../controllers/refundController');
const {
  requireAuth,
  requireAdmin,
  requireClient
} = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

/**
 * @route GET /users
 * @desc Listar usuarios (solo Admin)
 * @access Private (Admin only)
 * @query {string} search - nombre/apellido/email/documento/teléfono
 * @query {string} document_type - DNI | CE | RUC | Pasaporte
 * @query {string} user_type - admin | client
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/', requireAdmin, listUsers);

/**
 * @route GET /api/users/:userId/won-auctions
 * @desc Obtener subastas ganadas por cliente
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 * @query {string} estado - Filtrar por estado de oferta
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/:userId/won-auctions', getWonAuctionsByUser);

/**
 * @route GET /api/users/:userId/can-participate
 * @desc Verificar si cliente puede participar en nuevas subastas
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 */
router.get('/:userId/can-participate', canUserParticipate);

/**
 * @route GET /api/users/:userId/balance
 * @desc Obtener saldo de usuario
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 */
router.get('/:userId/balance', getBalance);

/**
 * @route GET /api/users/:userId/movements
 * @desc Obtener movimientos de usuario
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 * @query {string} tipo - Filtrar por tipo de movimiento
 * @query {string} fecha_desde - Fecha inicio del rango
 * @query {string} fecha_hasta - Fecha fin del rango
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/:userId/movements', getUserMovements);

/**
 * @route GET /api/users/:userId/billings
 * @desc Listar facturaciones por usuario
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 * @query {string} fecha_desde - ISO
 * @query {string} fecha_hasta - ISO
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 * @query {string} include - CSV: user,auction
 */
router.get('/:userId/billings', getBillingsByUser);

/**
 * @route GET /api/users/:userId/refunds
 * @desc Listar reembolsos por usuario
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 * @query {string} estado - Filtrar por estado
 * @query {string} auction_id - Filtrar por subasta
 * @query {string} fecha_desde - ISO
 * @query {string} fecha_hasta - ISO
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 * @query {string} include - CSV: user,auction
 */
router.get('/:userId/refunds', getRefundsByUser);

/**
 * @route GET /api/users/:userId/billings
 * @desc Listar facturaciones por usuario
 * @access Private (Client own data or Admin)
 * @params {string} userId - ID del usuario
 * @query {string} fecha_desde - ISO
 * @query {string} fecha_hasta - ISO
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 * @query {string} include - CSV: user,auction
 */
router.get('/:userId/billings', getBillingsByUser);

/**
 * @route POST /api/users/:userId/movements/manual
 * @desc Crear movimiento manual (ajustes admin)
 * @access Private (Admin only)
 * @params {string} userId - ID del usuario
 * @body {string} tipo_movimiento - Tipo de movimiento manual
 * @body {number} monto - Monto del ajuste
 * @body {string} descripcion - Descripción del movimiento
 * @body {string} motivo - Motivo del ajuste (opcional)
 */
router.post('/:userId/movements/manual', requireAdmin, createManualMovement);

/**
 * @route GET /api/users/guarantees/stats
 * @desc Obtener estadísticas de garantías (para dashboard admin)
 * @access Private (Admin only)
 */
router.get('/guarantees/stats', requireAdmin, getGuaranteeStats);

module.exports = router;