const balanceService = require('../services/balanceService');
const { 
  asyncHandler 
} = require('../middleware/errorHandler');
const {
  validations: { movementSchemas, querySchemas, validate }
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Obtener saldo de usuario
 * GET /api/users/:userId/balance
 */
const getBalance = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Los clientes solo pueden ver su propio saldo
  if (req.user.user_type === 'client' && req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Solo puede consultar su propio saldo',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  Logger.info(`Consultando saldo de usuario ${userId}`, {
    requested_by: req.user.email,
  });
  
  // Obtener saldo usando el servicio
  const balance = await balanceService.getBalance(userId);
  
  res.status(200).json({
    success: true,
    data: {
      balance,
    },
  });
});

/**
 * Obtener movimientos de usuario
 * GET /api/users/:userId/movements
 */
const getUserMovements = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // Los clientes solo pueden ver sus propios movimientos
  if (req.user.user_type === 'client' && req.user.id !== userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Solo puede consultar sus propios movimientos',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Validar parámetros de consulta (usa Movement listFilters)
  const filters = validate(movementSchemas.listFilters, req.query);
  
  Logger.info(`Consultando movimientos de usuario ${userId}`, {
    requested_by: req.user.email,
    filters,
  });
  
  // Obtener movimientos usando el servicio
  const result = await balanceService.getUserMovements(userId, filters);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Obtener resumen de saldos (solo admin)
 * GET /api/balances/summary
 */
const getBalancesSummary = asyncHandler(async (req, res) => {
  // Validar parámetros de consulta
  const filters = validate(querySchemas.pagination, req.query);
  
  // Agregar filtro de búsqueda si existe
  if (req.query.search) {
    filters.search = req.query.search.trim();
  }
  
  Logger.info(`Admin ${req.user.email} consultando resumen de saldos`, { filters });
  
  // Obtener resumen usando el servicio
  const result = await balanceService.getBalancesSummary(filters);
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Obtener estadísticas de saldos (solo admin)
 * GET /api/balances/stats
 */
const getBalanceStats = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando estadísticas de saldos`);
  
  // Obtener estadísticas usando el servicio
  const stats = await balanceService.getBalanceStats();
  
  res.status(200).json({
    success: true,
    data: {
      statistics: stats,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Crear movimiento manual (solo admin)
 * POST /api/users/:userId/movements/manual
 */
const createManualMovement = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { tipo_movimiento, monto, descripcion, motivo } = req.body;
  
  // Validaciones básicas
  if (!tipo_movimiento || !monto || !descripcion) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'Se requieren tipo_movimiento, monto y descripcion',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  const validTypes = ['ajuste_positivo', 'ajuste_negativo', 'penalidad_manual'];
  if (!validTypes.includes(tipo_movimiento)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_MOVEMENT_TYPE',
        message: `Tipo de movimiento debe ser uno de: ${validTypes.join(', ')}`,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  if (typeof monto !== 'number' || monto <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_AMOUNT',
        message: 'El monto debe ser un número positivo',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  Logger.warn(`Admin ${req.user.email} creando movimiento manual para usuario ${userId}`, {
    tipo: tipo_movimiento,
    monto,
    motivo,
  });
  
  // Crear movimiento usando el servicio
  const result = await balanceService.createManualMovement(
    userId,
    { tipo_movimiento, monto, descripcion, motivo },
    req.user.id
  );
  
  res.status(201).json({
    success: true,
    data: {
      movement: {
        id: result.movement.id,
        tipo_movimiento: result.movement.tipo_movimiento,
        monto: result.movement.monto,
        descripcion: result.movement.descripcion,
        created_at: result.movement.created_at,
      },
      updated_balance: {
        saldo_total: result.updated_balance.saldo_total,
        saldo_penalizado: result.updated_balance.saldo_penalizado,
      },
      user: result.user,
    },
    message: 'Movimiento manual creado exitosamente',
  });
});

/**
 * Obtener resumen financiero para dashboard
 * GET /api/balances/dashboard
 */
const getDashboardSummary = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando resumen financiero del dashboard`);
  
  // Obtener estadísticas generales
  const balanceStats = await balanceService.getBalanceStats();
  
  // Obtener algunos balances destacados (top 5 por saldo total)
  const topBalances = await balanceService.getBalancesSummary({ 
    page: 1, 
    limit: 5 
  });
  
  res.status(200).json({
    success: true,
    data: {
      financial_overview: {
        total_dinero_en_sistema: balanceStats.saldo_total_sistema,
        dinero_retenido: balanceStats.saldo_retenido_total,
        dinero_aplicado: balanceStats.saldo_aplicado_total,
        dinero_disponible: balanceStats.saldo_disponible_total,
        usuarios_con_saldo: balanceStats.total_usuarios_con_saldo,
        movimientos_mes: balanceStats.movimientos_mes_actual,
      },
      top_balances: topBalances.balances,
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  getBalance,
  getUserMovements,
  getBalancesSummary,
  getBalanceStats,
  createManualMovement,
  getDashboardSummary,
};