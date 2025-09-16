const express = require('express');
const router = express.Router();
const {
  getWonAuctionsByUser,
  canUserParticipate,
  getOfferStats,
} = require('../controllers/offerController');
const {
  getUserBalance,
  getUserMovements,
  createManualMovement,
} = require('../controllers/balanceController');
const {
  requireAuth,
  requireAdmin,
  requireClient
} = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

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
router.get('/:userId/balance', getUserBalance);

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
 * @route GET /api/users/offers/stats
 * @desc Obtener estadísticas de ofertas (para dashboard admin)
 * @access Private (Admin only)
 */
router.get('/offers/stats', requireAdmin, getOfferStats);

module.exports = router;