const { prisma } = require('../config/database');
const { 
  BusinessErrors, 
  NotFoundError, 
  ConflictError 
} = require('../middleware/errorHandler');
const { 
  businessCalculations,
  businessValidations,
  formatters,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class GuaranteeService {
  
  /**
   * Registrar ganador de subasta (crea Guarantee)
   */
  async createWinner(auctionId, winnerData) {
    const { user_id, monto_oferta, fecha_limite_pago } = winnerData;
    
    Logger.info(`Registrando ganador (guarantee) para subasta ${auctionId}`, {
      user_id,
      monto_oferta,
    });
    
    // Transacción para registrar ganador
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que la subasta existe y está en estado 'activa'
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: { asset: true },
      });
      
      if (!auction) {
        throw BusinessErrors.AuctionNotFound();
      }
      
      if (auction.estado !== 'activa') {
        throw BusinessErrors.InvalidAuctionState('activa', auction.estado);
      }
      
      // Verificar que el usuario existe y es tipo cliente
      const user = await tx.user.findUnique({
        where: { id: user_id, user_type: 'client', deleted_at: null },
      });
      
      if (!user) {
        throw BusinessErrors.UserNotFound();
      }
      
      // Validación de rango de fechas eliminada: la subasta ya no tiene fecha_inicio/fecha_fin
      
      // Calcular monto de garantía
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(monto_oferta);
      
      // Crear garantía (ganador)
      const guarantee = await tx.guarantee.create({
        data: {
          auction_id: auctionId,
          user_id: user_id,
          monto_oferta: monto_oferta,
          posicion_ranking: 1,
          estado: 'activa',
          fecha_limite_pago: fecha_limite_pago ? new Date(fecha_limite_pago) : null,
        },
      });
      
      // Actualizar subasta con el ganador y cambiar estado
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          estado: 'pendiente',
          id_offerWin: guarantee.id, // mantenemos nombre de campo
        },
        include: { asset: true },
      });
      
      return {
        guarantee: {
          ...guarantee,
          monto_garantia,
        },
        // Compatibilidad: exponer fecha_limite_pago a nivel de auction como campo calculado
        auction: {
          ...updatedAuction,
          fecha_limite_pago: guarantee.fecha_limite_pago || null,
        },
        user: {
          id: user.id,
          name: formatters.fullName(user),
          document: formatters.document(user.document_type, user.document_number),
        },
      };
    });
    
    Logger.info(`Ganador (guarantee) registrado: ${result.user.name} - Subasta ${auctionId}`);
    
    return result;
  }
  
  /**
   * Reasignar ganador cuando el actual no paga
   */
  async reassignWinner(auctionId, newWinnerData) {
    const { user_id, monto_oferta, motivo_reasignacion } = newWinnerData;
    
    Logger.info(`Reasignando ganador (guarantee) para subasta ${auctionId}`, {
      new_user_id: user_id,
      motivo: motivo_reasignacion,
    });
    
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que la subasta existe
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          asset: true,
          guarantees: {
            where: { estado: 'activa' },
            include: { user: true },
          },
        },
      });
      
      if (!auction) {
        throw BusinessErrors.AuctionNotFound();
      }
      
      // Verificar que la subasta puede ser reasignada
      if (!['pendiente', 'en_validacion', 'vencida'].includes(auction.estado)) {
        throw BusinessErrors.InvalidAuctionState('pendiente, en_validacion o vencida', auction.estado);
      }
      
      // Obtener garantía ganadora actual
      const currentWinningGuarantee = auction.guarantees.find(g => g.id === auction.id_offerWin);
      
      if (!currentWinningGuarantee) {
        throw new ConflictError('No se encontró garantía ganadora actual para reasignar', 'NO_CURRENT_WINNER');
      }
      
      // Verificar que el nuevo usuario existe y es diferente al actual
      const newUser = await tx.user.findUnique({
        where: { id: user_id, user_type: 'client', deleted_at: null },
      });
      
      if (!newUser) {
        throw BusinessErrors.UserNotFound();
      }
      
      if (currentWinningGuarantee.user_id === user_id) {
        throw new ConflictError('El nuevo ganador no puede ser el mismo que el actual', 'SAME_USER');
      }
      
      // Penalidad solo aplica en otra etapa (según reglas actuales)
      const penaltyApplied = null;
      
      // Marcar garantía anterior como perdedora
      await tx.guarantee.update({
        where: { id: currentWinningGuarantee.id },
        data: { estado: 'perdedora' },
      });
      
      // Crear nueva garantía ganadora
      const newGuarantee = await tx.guarantee.create({
        data: {
          auction_id: auctionId,
          user_id: user_id,
          monto_oferta: monto_oferta,
          posicion_ranking: 1,
          estado: 'activa',
          fecha_limite_pago: null,
        },
      });
      
      // Actualizar subasta
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          estado: 'pendiente',
          id_offerWin: newGuarantee.id,
        },
        include: { asset: true },
      });
      
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(monto_oferta);
      
      return {
        new_guarantee: {
          ...newGuarantee,
          monto_garantia,
        },
        // Compatibilidad: exponer fecha_limite_pago calculado desde la nueva garantía
        auction: {
          ...updatedAuction,
          fecha_limite_pago: newGuarantee.fecha_limite_pago || null,
        },
        previous_winner: {
          name: formatters.fullName(currentWinningGuarantee.user),
          penalty_applied: penaltyApplied,
        },
        new_winner: {
          id: newUser.id,
          name: formatters.fullName(newUser),
          document: formatters.document(newUser.document_type, newUser.document_number),
        },
      };
    });
    
    Logger.info(`Ganador (guarantee) reasignado: ${result.new_winner.name} - Subasta ${auctionId}`);
    
    return result;
  }
  
  /**
   * Obtener subastas ganadas por un cliente
   */
  async getWonAuctionsByUser(userId, filters = {}) {
    const { page = 1, limit = 20, estado } = filters;
    const offset = (page - 1) * limit;
    
    // Construir filtros
    const where = {
      user_id: userId,
      posicion_ranking: 1,
    };
    
    // Filtrar por estado de guarantee
    if (estado) {
      where.estado = { in: Array.isArray(estado) ? estado : [estado] };
    }
    
    // Obtener garantías ganadoras del usuario
    const [guarantees, total] = await Promise.all([
      prisma.guarantee.findMany({
        where,
        include: {
          auction: {
            include: {
              asset: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.guarantee.count({ where }),
    ]);
    
    // Formatear resultados
    const wonAuctions = await Promise.all(guarantees.map(async (guarantee) => {
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(guarantee.monto_oferta);

      // Buscar movement de pago_garantia para esta subasta y usuario
      const paymentMovement = await prisma.movement.findFirst({
        where: {
          user_id: userId,
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          references: {
            some: {
              reference_type: 'auction',
              reference_id: guarantee.auction.id,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      return {
        guarantee_id: guarantee.id,
        auction: {
          id: guarantee.auction.id,
          estado: guarantee.auction.estado,
          // Compatibilidad: la fecha límite ahora vive en Guarantee
          fecha_limite_pago: guarantee.fecha_limite_pago || null,
          asset: guarantee.auction.asset,
        },
        guarantee_details: {
          monto_oferta: guarantee.monto_oferta,
          monto_garantia,
          estado: guarantee.estado,
        },
        payment_status: paymentMovement ? {
          has_payment: true,
          movement_id: paymentMovement.id,
          estado: paymentMovement.estado,
          monto_pagado: paymentMovement.monto,
          fecha_pago: paymentMovement.fecha_pago,
        } : {
          has_payment: false,
          monto_requerido: monto_garantia,
        },
      };
    }));
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      total_pages: Math.ceil(total / limit),
    };
    
    return { won_auctions: wonAuctions, pagination };
  }
  
  /**
   * Verificar si un usuario puede participar en una nueva subasta
   */
  async canUserParticipate(userId) {
    // Verificar que no tenga pagos pendientes
    const pendingPayments = await prisma.guarantee.count({
      where: {
        user_id: userId,
        estado: 'activa',
        auction: {
          estado: { in: ['pendiente', 'en_validacion'] },
        },
      },
    });
    
    return {
      can_participate: pendingPayments === 0,
      pending_payments: pendingPayments,
      reason: pendingPayments > 0 ? 'Tiene pagos de garantía pendientes' : null,
    };
  }
}

module.exports = new GuaranteeService();