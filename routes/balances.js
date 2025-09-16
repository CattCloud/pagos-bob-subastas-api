const express = require('express');
const router = express.Router();
const {
  getBalancesSummary,
  getBalanceStats,
  getDashboardSummary,
} = require('../controllers/balanceController');
const { 
  requireAuth, 
  requireAdmin
} = require('../middleware/auth');

// Aplicar autenticación y requerir admin para todas las rutas
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @route GET /api/balances/dashboard
 * @desc Obtener resumen financiero para dashboard admin
 * @access Private (Admin only)
 */
router.get('/dashboard', getDashboardSummary);

/**
 * @route GET /api/balances/stats
 * @desc Obtener estadísticas detalladas de saldos
 * @access Private (Admin only)
 */
router.get('/stats', getBalanceStats);

/**
 * @route GET /api/balances/summary
 * @desc Obtener resumen de saldos de todos los usuarios
 * @access Private (Admin only)
 * @query {string} search - Buscar por nombre, documento, email
 * @query {number} page - Número de página
 * @query {number} limit - Registros por página
 */
router.get('/summary', getBalancesSummary);

module.exports = router;