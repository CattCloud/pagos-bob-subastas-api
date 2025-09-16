const { prisma } = require('../config/database');
const { 
  BusinessErrors, 
  NotFoundError 
} = require('../middleware/errorHandler');
const { 
  businessCalculations,
  formatters,
  paginationHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class BalanceService {
  
  /**
   * Obtener saldo de un usuario
   */
  async getUserBalance(userId) {
    Logger.info(`Consultando saldo del usuario ${userId}`);
    
    // Obtener o crear saldo del usuario
    const balance = await prisma.userBalance.upsert({
      where: { user_id: userId },
      update: {}, // No actualizar nada, solo obtener
      create: {
        user_id: userId,
        saldo_total: 0,
        saldo_retenido: 0,
        saldo_aplicado: 0,
        saldo_en_reembolso: 0,
        saldo_penalizado: 0,
      },
    });
    
    // Calcular saldo disponible
    const saldo_disponible = businessCalculations.calculateAvailableBalance(balance);
    
    return {
      user_id: userId,
      saldo_total: balance.saldo_total,
      saldo_retenido: balance.saldo_retenido,
      saldo_aplicado: balance.saldo_aplicado,
      saldo_en_reembolso: balance.saldo_en_reembolso,
      saldo_penalizado: balance.saldo_penalizado,
      saldo_disponible,
      updated_at: balance.updated_at,
    };
  }
  
  /**
   * Obtener movimientos de un usuario
   */
  async getUserMovements(userId, filters = {}) {
    const { 
      tipo, 
      fecha_desde, 
      fecha_hasta, 
      page = 1, 
      limit = 20 
    } = filters;
    
    const offset = paginationHelpers.calculateOffset(page, limit);
    
    Logger.info(`Consultando movimientos del usuario ${userId}`, { filters });
    
    // Construir filtros
    const where = { user_id: userId };
    
    // Filtro por tipo de movimiento
    if (tipo) {
      const tipos = Array.isArray(tipo) ? tipo : tipo.split(',').map(t => t.trim());
      where.tipo_movimiento = { in: tipos };
    }
    
    // Filtro por fechas
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
    
    // Ejecutar consulta
    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.movement.count({ where }),
    ]);
    
    // Formatear movimientos con información adicional
    const formattedMovements = await Promise.all(movements.map(async (movement) => {
      let referenceInfo = null;
      
      // Obtener información adicional según el tipo de referencia
      if (movement.reference_type === 'pago' && movement.reference_id) {
        try {
          const payment = await prisma.guaranteePayment.findUnique({
            where: { id: movement.reference_id },
            include: {
              auction: {
                include: { asset: true },
              },
            },
          });
          
          if (payment) {
            referenceInfo = {
              type: 'pago',
              payment_id: payment.id,
              auction: {
                id: payment.auction.id,
                placa: payment.auction.asset.placa,
                marca: payment.auction.asset.marca,
                modelo: payment.auction.asset.modelo,
              },
              estado_pago: payment.estado,
            };
          }
        } catch (error) {
          Logger.warn(`Error obteniendo info de pago ${movement.reference_id}:`, error.message);
        }
      }
      
      if (movement.reference_type === 'subasta' && movement.reference_id) {
        try {
          const auction = await prisma.auction.findUnique({
            where: { id: movement.reference_id },
            include: { asset: true },
          });
          
          if (auction) {
            referenceInfo = {
              type: 'subasta',
              auction_id: auction.id,
              placa: auction.asset.placa,
              marca: auction.asset.marca,
              modelo: auction.asset.modelo,
              estado_subasta: auction.estado,
            };
          }
        } catch (error) {
          Logger.warn(`Error obteniendo info de subasta ${movement.reference_id}:`, error.message);
        }
      }
      
      return {
        id: movement.id,
        tipo_movimiento: movement.tipo_movimiento,
        monto: movement.monto,
        descripcion: movement.descripcion,
        reference_info: referenceInfo,
        created_at: movement.created_at,
      };
    }));
    
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    
    return { movements: formattedMovements, pagination };
  }
  
  /**
   * Obtener resumen de saldos para admin
   */
  async getBalancesSummary(filters = {}) {
    const { page = 1, limit = 20, search } = filters;
    const offset = paginationHelpers.calculateOffset(page, limit);
    
    Logger.info('Consultando resumen de saldos para admin', { filters });
    
    // Construir filtros de búsqueda
    const where = {};
    
    if (search) {
      where.user = {
        OR: [
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
          { document_number: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    
    // Obtener balances con información de usuarios
    const [balances, total] = await Promise.all([
      prisma.userBalance.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              document_type: true,
              document_number: true,
              email: true,
              phone_number: true,
            },
          },
        },
        orderBy: { saldo_total: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.userBalance.count({ where }),
    ]);
    
    // Formatear resultados
    const formattedBalances = balances.map(balance => {
      const saldo_disponible = businessCalculations.calculateAvailableBalance(balance);
      
      return {
        user: {
          id: balance.user.id,
          name: formatters.fullName(balance.user),
          document: formatters.document(balance.user.document_type, balance.user.document_number),
          email: balance.user.email,
          phone: balance.user.phone_number,
        },
        balance: {
          saldo_total: balance.saldo_total,
          saldo_retenido: balance.saldo_retenido,
          saldo_aplicado: balance.saldo_aplicado,
          saldo_en_reembolso: balance.saldo_en_reembolso,
          saldo_penalizado: balance.saldo_penalizado,
          saldo_disponible,
        },
        updated_at: balance.updated_at,
      };
    });
    
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    
    return { balances: formattedBalances, pagination };
  }
  
  /**
   * Obtener estadísticas generales de saldos
   */
  async getBalanceStats() {
    Logger.info('Calculando estadísticas de saldos');
    
    // Obtener estadísticas agregadas
    const stats = await prisma.userBalance.aggregate({
      _sum: {
        saldo_total: true,
        saldo_retenido: true,
        saldo_aplicado: true,
        saldo_en_reembolso: true,
        saldo_penalizado: true,
      },
      _count: {
        id: true,
      },
    });
    
    // Calcular saldo disponible total
    const saldo_disponible_total = (stats._sum.saldo_total || 0) - 
                                  (stats._sum.saldo_retenido || 0) - 
                                  (stats._sum.saldo_aplicado || 0) - 
                                  (stats._sum.saldo_en_reembolso || 0) - 
                                  (stats._sum.saldo_penalizado || 0);
    
    // Obtener usuarios con saldo positivo
    const usersWithBalance = await prisma.userBalance.count({
      where: {
        saldo_total: {
          gt: 0,
        },
      },
    });
    
    // Obtener movimientos del mes actual
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const movementsThisMonth = await prisma.movement.count({
      where: {
        created_at: {
          gte: currentMonth,
        },
      },
    });
    
    return {
      saldo_total_sistema: stats._sum.saldo_total || 0,
      saldo_retenido_total: stats._sum.saldo_retenido || 0,
      saldo_aplicado_total: stats._sum.saldo_aplicado || 0,
      saldo_en_reembolso_total: stats._sum.saldo_en_reembolso || 0,
      saldo_penalizado_total: stats._sum.saldo_penalizado || 0,
      saldo_disponible_total,
      total_usuarios_con_saldo: usersWithBalance,
      total_usuarios: stats._count.id,
      movimientos_mes_actual: movementsThisMonth,
    };
  }
  
  /**
   * Crear movimiento manual (para ajustes por admin)
   */
  async createManualMovement(userId, movementData, adminUserId) {
    const { tipo_movimiento, monto, descripcion, motivo } = movementData;
    
    Logger.info(`Admin ${adminUserId} creando movimiento manual para usuario ${userId}`, {
      tipo: tipo_movimiento,
      monto,
      motivo,
    });
    
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que el usuario existe
      const user = await tx.user.findUnique({
        where: { id: userId, user_type: 'client', deleted_at: null },
      });
      
      if (!user) {
        throw BusinessErrors.UserNotFound();
      }
      
      // Crear movimiento
      const movement = await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento,
          monto,
          descripcion: `${descripcion} - Ajuste manual realizado por admin`,
          reference_type: 'ajuste_manual',
          reference_id: adminUserId,
        },
      });
      
      // Actualizar saldo según el tipo de movimiento
      let balanceUpdate = {};
      
      switch (tipo_movimiento) {
        case 'ajuste_positivo':
          balanceUpdate = { saldo_total: { increment: Math.abs(monto) } };
          break;
        case 'ajuste_negativo':
          balanceUpdate = { saldo_total: { decrement: Math.abs(monto) } };
          break;
        case 'penalidad_manual':
          balanceUpdate = { saldo_penalizado: { increment: Math.abs(monto) } };
          break;
        default:
          throw new Error(`Tipo de movimiento manual no válido: ${tipo_movimiento}`);
      }
      
      // Actualizar balance
      const updatedBalance = await tx.userBalance.upsert({
        where: { user_id: userId },
        update: balanceUpdate,
        create: {
          user_id: userId,
          saldo_total: tipo_movimiento === 'ajuste_positivo' ? Math.abs(monto) : 0,
          saldo_retenido: 0,
          saldo_aplicado: 0,
          saldo_en_reembolso: 0,
          saldo_penalizado: tipo_movimiento === 'penalidad_manual' ? Math.abs(monto) : 0,
        },
      });
      
      return {
        movement,
        updated_balance: updatedBalance,
        user: {
          name: formatters.fullName(user),
          document: formatters.document(user.document_type, user.document_number),
        },
      };
    });
    
    Logger.info(`Movimiento manual creado: ${result.movement.id} para ${result.user.name}`);
    
    return result;
  }
}

module.exports = new BalanceService();