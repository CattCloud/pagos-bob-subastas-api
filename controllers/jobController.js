const auctionJobs = require('../jobs/auctionJobs');
const { 
  asyncHandler 
} = require('../middleware/errorHandler');
const { Logger } = require('../middleware/logger');

/**
 * Ejecutar job específico manualmente
 * POST /api/jobs/run/:jobName
 */
const runJob = asyncHandler(async (req, res) => {
  const { jobName } = req.params;
  
  Logger.info(`Admin ${req.user.email} ejecutando job manual: ${jobName}`);
  
  try {
    const result = await auctionJobs.runJob(jobName);
    
    res.status(200).json({
      success: true,
      data: {
        job_name: jobName,
        result,
        executed_by: req.user.email,
        executed_at: new Date().toISOString(),
      },
      message: `Job '${jobName}' ejecutado exitosamente`,
    });
  } catch (error) {
    Logger.error(`Error ejecutando job ${jobName}:`, error);
    
    res.status(400).json({
      success: false,
      error: {
        code: 'JOB_EXECUTION_ERROR',
        message: error.message,
        job_name: jobName,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * Obtener lista de jobs disponibles
 * GET /api/jobs/list
 */
const getJobsList = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando lista de jobs`);
  
  const jobs = [
    {
      name: 'process-expired',
      description: 'Procesar subastas vencidas automáticamente',
      frequency: 'Cada 30 minutos',
      manual: true,
    },
    {
      name: 'check-upcoming',
      description: 'Verificar subastas próximas a vencer',
      frequency: 'Cada hora',
      manual: true,
    },
    {
      name: 'daily-report',
      description: 'Generar reporte diario de actividades',
      frequency: '6:00 AM diario',
      manual: true,
    },
    {
      name: 'cleanup-sessions',
      description: 'Limpieza de sesiones expiradas',
      frequency: 'Cada 4 horas',
      manual: true,
    },
  ];
  
  res.status(200).json({
    success: true,
    data: {
      jobs,
      total: jobs.length,
      timezone: 'America/Lima',
    },
  });
});

/**
 * Procesar subastas vencidas manualmente
 * POST /api/jobs/process-expired
 */
const processExpiredAuctions = asyncHandler(async (req, res) => {
  Logger.warn(`Admin ${req.user.email} procesando subastas vencidas manualmente`);
  
  const result = await auctionJobs.processExpiredAuctions();
  
  res.status(200).json({
    success: true,
    data: {
      ...result,
      processed_by: req.user.email,
      processed_at: new Date().toISOString(),
    },
    message: `Procesamiento completado: ${result.processed} subastas procesadas, ${result.errors} errores`,
  });
});

/**
 * Verificar próximos vencimientos manualmente
 * GET /api/jobs/check-upcoming
 */
const checkUpcomingExpirations = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} verificando próximos vencimientos`);
  
  const result = await auctionJobs.checkUpcomingExpirations();
  
  res.status(200).json({
    success: true,
    data: {
      ...result,
      checked_by: req.user.email,
      checked_at: new Date().toISOString(),
    },
    message: result.notifications > 0 
      ? `Se encontraron ${result.notifications} subastas próximas a vencer`
      : 'No hay subastas próximas a vencer',
  });
});

/**
 * Generar reporte diario manualmente
 * GET /api/jobs/daily-report
 */
const generateDailyReport = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} generando reporte diario manual`);
  
  const result = await auctionJobs.generateDailyReport();
  
  res.status(200).json({
    success: true,
    data: {
      report: result,
      generated_by: req.user.email,
      generated_at: new Date().toISOString(),
    },
    message: 'Reporte diario generado exitosamente',
  });
});

/**
 * Obtener estado de jobs programados
 * GET /api/jobs/status
 */
const getJobsStatus = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando estado de jobs`);
  
  // Información sobre el estado de los cron jobs
  const jobsStatus = {
    cron_jobs_active: true,
    timezone: 'America/Lima',
    schedules: [
      {
        name: 'process-expired-auctions',
        schedule: '*/30 * * * *',
        description: 'Cada 30 minutos',
        active: true,
      },
      {
        name: 'check-upcoming-expirations',
        schedule: '0 * * * *',
        description: 'Cada hora en punto',
        active: true,
      },
      {
        name: 'daily-report',
        schedule: '0 6 * * *',
        description: 'Diario a las 6:00 AM',
        active: true,
      },
      {
        name: 'cleanup-sessions',
        schedule: '0 */4 * * *',
        description: 'Cada 4 horas en punto',
        active: true,
      },
    ],
    last_check: new Date().toISOString(),
  };
  
  res.status(200).json({
    success: true,
    data: jobsStatus,
  });
});

module.exports = {
  runJob,
  getJobsList,
  processExpiredAuctions,
  checkUpcomingExpirations,
  generateDailyReport,
  getJobsStatus,
};