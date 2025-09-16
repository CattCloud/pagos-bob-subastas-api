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

class OfferService {
  
  /**
   * Registrar ganador de subasta
   */
  async createWinner(auctionId, winnerData) {
    const { user_id, monto_oferta, fecha_oferta, fecha_limite_pago } = winnerData;
    
    Logger.info(`Registrando ganador para subasta ${auctionId}`, {
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
      
      // Validar que la fecha de oferta esté dentro del rango de la subasta
      if (!businessValidations.isOfferDateValid(fecha_oferta, auction.fecha_inicio, auction.fecha_fin)) {
        throw new ConflictError(
          'La fecha de la oferta debe estar entre las fechas de inicio y fin de la subasta',
          'INVALID_OFFER_DATE'
        );
      }
      
      // Calcular monto de garantía
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(monto_oferta);
      
      // Crear oferta como ganadora
      const offer = await tx.offer.create({
        data: {
          auction_id: auctionId,
          user_id: user_id,
          monto_oferta: monto_oferta,
          fecha_oferta: new Date(fecha_oferta),
          posicion_ranking: 1,
          fecha_asignacion_ganador: new Date(),
          estado: 'activa',
        },
      });
      
      // Actualizar subasta con el ganador y cambiar estado
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          estado: 'pendiente',
          id_offerWin: offer.id,
          fecha_limite_pago: fecha_limite_pago ? new Date(fecha_limite_pago) : null,
        },
        include: { asset: true },
      });
      
      return {
        offer: {
          ...offer,
          monto_garantia,
        },
        auction: updatedAuction,
        user: {
          id: user.id,
          name: formatters.fullName(user),
          document: formatters.document(user.document_type, user.document_number),
        },
      };
    });
    
    Logger.info(`Ganador registrado exitosamente: ${result.user.name} - Subasta ${auctionId}`);
    
    return result;
  }
  
  /**
   * Reasignar ganador cuando el actual no paga
   */
  async reassignWinner(auctionId, newWinnerData) {
    const { user_id, monto_oferta, fecha_oferta, motivo_reasignacion } = newWinnerData;
    
    Logger.info(`Reasignando ganador para subasta ${auctionId}`, {
      new_user_id: user_id,
      motivo: motivo_reasignacion,
    });
    
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que la subasta existe
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          asset: true,
          offers: {
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
      
      // Obtener oferta ganadora actual
      const currentWinningOffer = auction.offers.find(offer => offer.id === auction.id_offerWin);
      
      if (!currentWinningOffer) {
        throw new ConflictError('No se encontró oferta ganadora actual para reasignar', 'NO_CURRENT_WINNER');
      }
      
      // Verificar que el nuevo usuario existe y es diferente al actual
      const newUser = await tx.user.findUnique({
        where: { id: user_id, user_type: 'client', deleted_at: null },
      });
      
      if (!newUser) {
        throw BusinessErrors.UserNotFound();
      }
      
      if (currentWinningOffer.user_id === user_id) {
        throw new ConflictError('El nuevo ganador no puede ser el mismo que el actual', 'SAME_USER');
      }
      
      // Aplicar penalidad al ganador anterior si corresponde
      let penaltyApplied = null;
      if (auction.estado !== 'vencida') { // Si ya está vencida, la penalidad se aplicó automáticamente
        const currentUser = currentWinningOffer.user;
        
        // Obtener saldo actual del usuario
        const userBalance = await tx.userBalance.findUnique({
          where: { user_id: currentUser.id },
        });
        
        if (userBalance) {
          const availableBalance = businessCalculations.calculateAvailableBalance(userBalance);
          const penaltyAmount = businessCalculations.calculatePenalty(availableBalance);
          
          if (penaltyAmount > 0) {
            // Aplicar penalidad
            await tx.userBalance.update({
              where: { user_id: currentUser.id },
              data: {
                saldo_penalizado: { increment: penaltyAmount },
              },
            });
            
            // Registrar movimiento de penalidad
            await tx.movement.create({
              data: {
                user_id: currentUser.id,
                tipo_movimiento: 'penalidad',
                monto: -penaltyAmount,
                descripcion: `Penalidad del 30% aplicada por no pagar garantía a tiempo - Subasta ${auction.asset.placa}`,
                reference_type: 'subasta',
                reference_id: auctionId,
              },
            });
            
            penaltyApplied = {
              user: formatters.fullName(currentUser),
              amount: penaltyAmount,
            };
            
            Logger.warn(`Penalidad aplicada: ${penaltyAmount} a ${currentUser.email}`);
          }
        }
      }
      
      // Marcar oferta anterior como perdedora
      await tx.offer.update({
        where: { id: currentWinningOffer.id },
        data: { estado: 'perdedora' },
      });
      
      // Crear nueva oferta ganadora
      const newOffer = await tx.offer.create({
        data: {
          auction_id: auctionId,
          user_id: user_id,
          monto_oferta: monto_oferta,
          fecha_oferta: new Date(fecha_oferta),
          posicion_ranking: 1,
          fecha_asignacion_ganador: new Date(),
          estado: 'activa',
        },
      });
      
      // Actualizar subasta
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          estado: 'pendiente',
          id_offerWin: newOffer.id,
          fecha_limite_pago: null, // Resetear fecha límite para nuevo ganador
        },
        include: { asset: true },
      });
      
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(monto_oferta);
      
      return {
        new_offer: {
          ...newOffer,
          monto_garantia,
        },
        auction: updatedAuction,
        previous_winner: {
          name: formatters.fullName(currentWinningOffer.user),
          penalty_applied: penaltyApplied,
        },
        new_winner: {
          id: newUser.id,
          name: formatters.fullName(newUser),
          document: formatters.document(newUser.document_type, newUser.document_number),
        },
      };
    });
    
    Logger.info(`Ganador reasignado exitosamente: ${result.new_winner.name} - Subasta ${auctionId}`);
    
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
    
    // Filtrar por estado de oferta
    if (estado) {
      where.estado = { in: Array.isArray(estado) ? estado : [estado] };
    }
    
    // Obtener ofertas ganadoras del usuario
    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        include: {
          auction: {
            include: {
              asset: true,
            },
          },
          guarantee_payment: {
            select: {
              id: true,
              estado: true,
              monto_garantia: true,
              fecha_pago: true,
              created_at: true,
            },
          },
        },
        orderBy: { fecha_asignacion_ganador: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.offer.count({ where }),
    ]);
    
    // Formatear resultados
    const wonAuctions = offers.map(offer => {
      const monto_garantia = businessCalculations.calculateGuaranteeAmount(offer.monto_oferta);
      
      return {
        offer_id: offer.id,
        auction: {
          id: offer.auction.id,
          estado: offer.auction.estado,
          fecha_inicio: offer.auction.fecha_inicio,
          fecha_fin: offer.auction.fecha_fin,
          fecha_limite_pago: offer.auction.fecha_limite_pago,
          asset: offer.auction.asset,
        },
        offer_details: {
          monto_oferta: offer.monto_oferta,
          monto_garantia: monto_garantia,
          fecha_oferta: offer.fecha_oferta,
          fecha_asignacion: offer.fecha_asignacion_ganador,
          estado: offer.estado,
        },
        payment_status: offer.guarantee_payment ? {
          has_payment: true,
          payment_id: offer.guarantee_payment.id,
          estado: offer.guarantee_payment.estado,
          monto_pagado: offer.guarantee_payment.monto_garantia,
          fecha_pago: offer.guarantee_payment.fecha_pago,
        } : {
          has_payment: false,
          monto_requerido: monto_garantia,
        },
      };
    });
    
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
    const pendingPayments = await prisma.offer.count({
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

module.exports = new OfferService();