const express = require('express');
const router = express.Router();
const {
  createAuction,
  getAuctions,
  getAuctionById,
  updateAuctionStatus,
  extendPaymentDeadline,
  deleteAuction,
  getAuctionStats,
  getExpiredAuctions,
  registerCompetitionResult,
} = require('../controllers/auctionController');
const {
  createWinner,
  reassignWinner,
} = require('../controllers/guaranteeController');
const {
  requireAuth,
  requireAdmin
} = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(requireAuth);

/**
 * @route GET /api/auctions/stats
 * @desc Obtener estadísticas de subastas
 * @access Private (Admin only)
 */
router.get('/stats', requireAdmin, getAuctionStats);

/**
 * @route GET /api/auctions/expired
 * @desc Obtener subastas vencidas para procesamiento
 * @access Private (Admin only)
 */
router.get('/expired', requireAdmin, getExpiredAuctions);

/**
 * @route GET /api/auctions
 * @desc Listar subastas con filtros
 * @access Private (Admin and Client)
 * @query {string} estado - Filtrar por estados (separados por coma)
 * @query {string} search - Buscar por placa, marca, modelo, empresa
 * @query {string} fecha_desde - Fecha inicio del rango
 * @query {string} fecha_hasta - Fecha fin del rango
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/', getAuctions);

/**
 * @route POST /api/auctions
 * @desc Crear nueva subasta
 * @access Private (Admin only)
 * @body {object} auction - Datos de la subasta y activo
 */
router.post('/', requireAdmin, createAuction);

/**
 * @route GET /api/auctions/:id
 * @desc Obtener detalle de subasta específica
 * @access Private (Admin and Client)
 * @params {string} id - ID de la subasta
 */
router.get('/:id', getAuctionById);

/**
 * @route PATCH /api/auctions/:id/status
 * @desc Cambiar estado de subasta
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 * @body {string} estado - Nuevo estado
 * @body {string} motivo - Motivo del cambio (opcional)
 */
router.patch('/:id/status', requireAdmin, updateAuctionStatus);

/**
 * @route PATCH /api/auctions/:id/extend-deadline
 * @desc Extender plazo de pago de subasta
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 * @body {string} fecha_limite_pago - Nueva fecha límite
 * @body {string} motivo - Motivo de la extensión (opcional)
 */
router.patch('/:id/extend-deadline', requireAdmin, extendPaymentDeadline);

/**
 * @route PATCH /api/auctions/:id/competition-result
 * @desc Registrar resultado de competencia externa (ganada | perdida | penalizada)
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 * @body {string} resultado - 'ganada' | 'perdida' | 'penalizada'
 * @body {string} observaciones - Observaciones opcionales
 */
router.patch('/:id/competition-result', requireAdmin, registerCompetitionResult);

/**
 * @route POST /api/auctions/:id/winner
 * @desc Registrar ganador de subasta
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 * @body {string} user_id - ID del usuario ganador
 * @body {number} monto_oferta - Monto de la oferta ganadora
 * @body {string} fecha_limite_pago - Fecha límite para el pago (opcional)
 */
router.post('/:id/winner', requireAdmin, createWinner);

/**
 * @route POST /api/auctions/:id/reassign-winner
 * @desc Reasignar ganador de subasta
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 * @body {string} user_id - ID del nuevo usuario ganador
 * @body {number} monto_oferta - Monto de la nueva oferta
 * @body {string} motivo_reasignacion - Motivo de la reasignación (opcional)
 */
router.post('/:id/reassign-winner', requireAdmin, reassignWinner);

/**
 * @route DELETE /api/auctions/:id
 * @desc Eliminar subasta (solo sin ofertas)
 * @access Private (Admin only)
 * @params {string} id - ID de la subasta
 */
router.delete('/:id', requireAdmin, deleteAuction);

module.exports = router;