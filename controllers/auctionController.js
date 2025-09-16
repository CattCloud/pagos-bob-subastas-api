const auctionService = require('../services/auctionService');
const { 
  asyncHandler 
} = require('../middleware/errorHandler');
const { 
  validations: { auctionSchemas, querySchemas, validate } 
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Crear nueva subasta
 * POST /api/auctions
 */
const createAuction = asyncHandler(async (req, res) => {
  // Validar datos de entrada
  const auctionData = validate(auctionSchemas.createAuction, req.body);
  
  Logger.info(`Admin ${req.user.email} creando nueva subasta`, {
    placa: auctionData.asset.placa,
    marca: auctionData.asset.marca,
    modelo: auctionData.asset.modelo,
  });
  
  // Crear subasta usando el servicio
  const auction = await auctionService.createAuction(auctionData);
  
  res.status(201).json({
    success: true,
    data: {
      auction,
    },
    message: 'Subasta creada exitosamente',
  });
});

/**
 * Listar subastas con filtros
 * GET /api/auctions
 */
const getAuctions = asyncHandler(async (req, res) => {
  // Validar parámetros de consulta
  const filters = validate(querySchemas.auctionFilters, req.query);
  
  Logger.info(`Consulta de subastas por ${req.user.user_type}`, { filters });
  
  // Obtener subastas usando el servicio
  const result = await auctionService.getAuctions(filters);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Obtener detalle de subasta específica
 * GET /api/auctions/:id
 */
const getAuctionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  Logger.info(`Consultando detalle de subasta ${id} por ${req.user.user_type}`);
  
  // Obtener subasta usando el servicio
  const auction = await auctionService.getAuctionById(id);
  
  res.status(200).json({
    success: true,
    data: {
      auction,
    },
  });
});

/**
 * Cambiar estado de subasta
 * PATCH /api/auctions/:id/status
 */
const updateAuctionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validar datos de entrada
  const { estado, motivo } = validate(auctionSchemas.updateStatus, req.body);
  
  Logger.info(`Admin ${req.user.email} cambiando estado de subasta ${id} a ${estado}`, {
    motivo,
  });
  
  // Actualizar estado usando el servicio
  const updatedAuction = await auctionService.updateAuctionStatus(id, estado, motivo);
  
  res.status(200).json({
    success: true,
    data: {
      auction: updatedAuction,
    },
    message: `Estado de subasta actualizado a '${estado}'`,
  });
});

/**
 * Extender plazo de pago
 * PATCH /api/auctions/:id/extend-deadline
 */
const extendPaymentDeadline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validar datos de entrada
  const { fecha_limite_pago, motivo } = validate(auctionSchemas.extendDeadline, req.body);
  
  Logger.info(`Admin ${req.user.email} extendiendo plazo de subasta ${id}`, {
    nuevaFecha: fecha_limite_pago,
    motivo,
  });
  
  // Extender plazo usando el servicio
  const updatedAuction = await auctionService.extendPaymentDeadline(
    id, 
    fecha_limite_pago, 
    motivo
  );
  
  res.status(200).json({
    success: true,
    data: {
      auction: updatedAuction,
    },
    message: 'Plazo de pago extendido exitosamente',
  });
});

/**
 * Eliminar subasta
 * DELETE /api/auctions/:id
 */
const deleteAuction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  Logger.warn(`Admin ${req.user.email} eliminando subasta ${id}`);
  
  // Eliminar subasta usando el servicio
  await auctionService.deleteAuction(id);
  
  res.status(204).json({
    success: true,
    message: 'Subasta eliminada exitosamente',
  });
});

/**
 * Obtener estadísticas generales de subastas (para dashboard admin)
 * GET /api/auctions/stats
 */
const getAuctionStats = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando estadísticas de subastas`);
  
  // Obtener estadísticas de diferentes estados
  const stats = await Promise.all([
    // Subastas activas
    auctionService.getAuctions({ estado: 'activa', limit: 1 }),
    // Subastas pendientes de pago
    auctionService.getAuctions({ estado: 'pendiente', limit: 1 }),
    // Subastas en validación
    auctionService.getAuctions({ estado: 'en_validacion', limit: 1 }),
    // Subastas finalizadas este mes
    auctionService.getAuctions({ 
      estado: 'finalizada',
      fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      limit: 1 
    }),
    // Subastas vencidas
    auctionService.getAuctions({ estado: 'vencida', limit: 1 }),
  ]);
  
  const statistics = {
    activas: stats[0].pagination.total,
    pendientes: stats[1].pagination.total,
    en_validacion: stats[2].pagination.total,
    finalizadas_mes: stats[3].pagination.total,
    vencidas: stats[4].pagination.total,
    total: stats[0].pagination.total + 
           stats[1].pagination.total + 
           stats[2].pagination.total + 
           stats[4].pagination.total,
  };
  
  res.status(200).json({
    success: true,
    data: {
      statistics,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Obtener subastas vencidas para procesamiento automático
 * GET /api/auctions/expired
 */
const getExpiredAuctions = asyncHandler(async (req, res) => {
  Logger.info(`Consultando subastas vencidas para procesamiento automático`);
  
  // Obtener subastas vencidas
  const expiredAuctions = await auctionService.getExpiredAuctions();
  
  res.status(200).json({
    success: true,
    data: {
      expired_auctions: expiredAuctions,
      count: expiredAuctions.length,
    },
  });
});

module.exports = {
  createAuction,
  getAuctions,
  getAuctionById,
  updateAuctionStatus,
  extendPaymentDeadline,
  deleteAuction,
  getAuctionStats,
  getExpiredAuctions,
};