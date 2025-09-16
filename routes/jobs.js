const express = require('express');
const router = express.Router();
const {
  runJob,
  getJobsList,
  processExpiredAuctions,
  checkUpcomingExpirations,
  generateDailyReport,
  getJobsStatus,
} = require('../controllers/jobController');
const { 
  requireAuth, 
  requireAdmin
} = require('../middleware/auth');

// Aplicar autenticación y requerir admin para todas las rutas
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @route GET /api/jobs/status
 * @desc Obtener estado de jobs programados
 * @access Private (Admin only)
 */
router.get('/status', getJobsStatus);

/**
 * @route GET /api/jobs/list
 * @desc Obtener lista de jobs disponibles
 * @access Private (Admin only)
 */
router.get('/list', getJobsList);

/**
 * @route POST /api/jobs/run/:jobName
 * @desc Ejecutar job específico manualmente
 * @access Private (Admin only)
 * @params {string} jobName - Nombre del job a ejecutar
 */
router.post('/run/:jobName', runJob);

/**
 * @route POST /api/jobs/process-expired
 * @desc Procesar subastas vencidas manualmente
 * @access Private (Admin only)
 */
router.post('/process-expired', processExpiredAuctions);

/**
 * @route GET /api/jobs/check-upcoming
 * @desc Verificar próximos vencimientos
 * @access Private (Admin only)
 */
router.get('/check-upcoming', checkUpcomingExpirations);

/**
 * @route GET /api/jobs/daily-report
 * @desc Generar reporte diario manualmente
 * @access Private (Admin only)
 */
router.get('/daily-report', generateDailyReport);

module.exports = router;