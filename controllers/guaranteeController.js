const guaranteeService = require('../services/guaranteeService');
const { 
  asyncHandler 
} = require('../middleware/errorHandler');
const { 
  validations: { guaranteeSchemas, querySchemas, validate } 
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Registrar ganador de subasta (Guarantee)
 * POST /api/auctions/:id/winner
 */
const createWinner = asyncHandler(async (req, res) => {
  const { id: auctionId } = req.params;
  
  // Validar datos de entrada
  const winnerData = validate(guaranteeSchemas.createWinner, req.body);
  
  Logger.info(`Admin ${req.user.email} registrando ganador (guarantee) para subasta ${auctionId}`, {
    winner_user_id: winnerData.user_id,
    monto_oferta: winnerData.monto_oferta,
  });
  
  // Registrar ganador usando el servicio
  const result = await guaranteeService.createWinner(auctionId, winnerData);
  
  res.status(201).json({
    success: true,
    data: result,
    message: 'Ganador asignado exitosamente',
  });
});

/**
 * Reasignar ganador de subasta (Guarantee)
 * POST /api/auctions/:id/reassign-winner
 */
const reassignWinner = asyncHandler(async (req, res) => {
  const { id: auctionId } = req.params;
  
  // Validar datos de entrada
  const reassignData = validate(guaranteeSchemas.reassignWinner, req.body);
  
  Logger.warn(`Admin ${req.user.email} reasignando ganador (guarantee) para subasta ${auctionId}`, {
    new_winner_user_id: reassignData.user_id,
    motivo: reassignData.motivo_reasignacion,
  });
  
  // Reasignar ganador usando el servicio
  const result = await guaranteeService.reassignWinner(auctionId, reassignData);
  
  res.status(200).json({
    success: true,
    data: result,
    message: 'Ganador reasignado exitosamente',
  });
});

/**
 * Obtener subastas ganadas por cliente (según Guarantees)
 * GET /api/users/:userId/won-auctions
 */
const getWonAuctionsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Los clientes solo pueden ver sus propias subastas ganadas
  if (req.user.user_type === 'client' && req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Solo puede acceder a sus propias subastas ganadas',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Validar parámetros de consulta
  const filters = validate(querySchemas.pagination, req.query);
  
  // Agregar filtro de estado si se proporciona
  if (req.query.estado) {
    filters.estado = req.query.estado.split(',').map(s => s.trim());
  }
  
  Logger.info(`Consultando subastas ganadas por usuario ${userId} (guarantees)`, {
    requested_by: req.user.email,
    filters,
  });
  
  // Obtener subastas ganadas usando el servicio
  const result = await guaranteeService.getWonAuctionsByUser(userId, filters);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Verificar si un cliente puede participar en nueva subasta
 * GET /api/users/:userId/can-participate
 */
const canUserParticipate = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Los clientes solo pueden consultar su propio estado
  if (req.user.user_type === 'client' && req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Solo puede consultar su propio estado de participación',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  Logger.info(`Verificando elegibilidad de participación (guarantees) para usuario ${userId}`, {
    requested_by: req.user.email,
  });
  
  // Verificar elegibilidad usando el servicio
  const result = await guaranteeService.canUserParticipate(userId);
  
  res.status(200).json({
    success: true,
    data: {
      user_id: userId,
      eligibility: result,
    },
  });
});

/**
 * Obtener estadísticas de garantías para dashboard admin
 * GET /api/guarantees/stats
 */
const getGuaranteeStats = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando estadísticas de garantías`);
  
  // Placeholder: se puede implementar una agregación específica
  const statistics = {
    garantias_activas: 0,
    garantias_procesadas_mes: 0,
    reasignaciones_mes: 0,
    penalidades_aplicadas_mes: 0,
  };
  
  res.status(200).json({
    success: true,
    data: {
      statistics,
      timestamp: new Date().toISOString(),
    },
    message: 'Estadísticas básicas - funcionalidad completa en desarrollo',
  });
});

module.exports = {
  createWinner,
  reassignWinner,
  getWonAuctionsByUser,
  canUserParticipate,
  getGuaranteeStats,
};