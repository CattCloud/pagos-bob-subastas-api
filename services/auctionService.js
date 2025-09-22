const { prisma } = require('../config/database');
const { 
  BusinessErrors, 
  NotFoundError, 
  ConflictError 
} = require('../middleware/errorHandler');
const { 
  businessValidations,
  stateHelpers,
  formatters,
  paginationHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class AuctionService {
  
  /**
   * Crear nueva subasta con activo asociado
   */
  async createAuction(auctionData) {
    const { asset } = auctionData;
    
    Logger.info(`Creando nueva subasta para vehículo: ${asset.placa}`);
    
    // Verificar que no exista otra subasta activa con la misma placa
    const existingActiveAuction = await prisma.auction.findFirst({
      where: {
        asset: {
          placa: asset.placa.toUpperCase(),
        },
        estado: {
          in: ['activa', 'pendiente', 'en_validacion'],
        },
      },
    });
    
    if (existingActiveAuction) {
      throw new ConflictError(
        `Ya existe una subasta activa para el vehículo con placa ${asset.placa}`,
        'DUPLICATE_PLATE'
      );
    }
    
    // Transacción para crear activo y subasta
    const result = await prisma.$transaction(async (tx) => {
      // Crear o actualizar el activo
      const createdAsset = await tx.asset.upsert({
        where: { placa: asset.placa.toUpperCase() },
        update: {
          empresa_propietaria: asset.empresa_propietaria,
          marca: asset.marca,
          modelo: asset.modelo,
          año: asset.año,
          descripcion: asset.descripcion || null,
          estado: 'disponible',
        },
        create: {
          placa: asset.placa.toUpperCase(),
          empresa_propietaria: asset.empresa_propietaria,
          marca: asset.marca,
          modelo: asset.modelo,
          año: asset.año,
          descripcion: asset.descripcion || null,
          estado: 'disponible',
        },
      });
      
      // Crear subasta
      const auction = await tx.auction.create({
        data: {
          asset_id: createdAsset.id,
          estado: 'activa',
        },
        include: {
          asset: true,
        },
      });
      
      return auction;
    });
    
    Logger.info(`Subasta creada exitosamente: ID ${result.id} - ${asset.placa}`);
    
    return result;
  }
  
  /**
   * Listar subastas con filtros y paginación
   */
  async getAuctions(filters = {}) {
    const { 
      estado, 
      search, 
      fecha_desde, 
      fecha_hasta, 
      page = 1, 
      limit = 20 
    } = filters;
    
    const offset = paginationHelpers.calculateOffset(page, limit);
    
    // Construir filtros de búsqueda
    const where = {};
    
    // Filtro por estados
    if (estado) {
      const estados = Array.isArray(estado) ? estado : estado.split(',').map(s => s.trim());
      where.estado = { in: estados };
    }
    
    // Filtro por fechas (usar created_at ya que no existe fecha_inicio/fin)
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
    
    // Filtro de búsqueda en activo
    if (search) {
      where.asset = {
        OR: [
          { placa: { contains: search, mode: 'insensitive' } },
          { marca: { contains: search, mode: 'insensitive' } },
          { modelo: { contains: search, mode: 'insensitive' } },
          { empresa_propietaria: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    
    // Ejecutar consulta con paginación
    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          asset: {
            select: {
              placa: true,
              marca: true,
              modelo: true,
              año: true,
              empresa_propietaria: true,
            },
          },
          guarantees: {
            where: { estado: 'activa' },
            include: {
              user: {
                select: {
                  first_name: true,
                  last_name: true,
                  document_type: true,
                  document_number: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.auction.count({ where }),
    ]);
    
    // Formatear resultados
    const formattedAuctions = auctions.map(auction => {
      const activeWinner = auction.guarantees[0] || null;
      return {
        id: auction.id,
        asset: auction.asset,
        estado: auction.estado,
        // Compatibilidad: exponer fecha límite a nivel auction desde Guarantee ganadora
        fecha_limite_pago: activeWinner?.fecha_limite_pago || null,
        winner: activeWinner ? {
          name: formatters.fullName(activeWinner.user),
          document: formatters.document(
            activeWinner.user.document_type,
            activeWinner.user.document_number
          ),
          monto_oferta: activeWinner.monto_oferta,
        } : null,
        created_at: auction.created_at,
      };
    });
    
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    
    return { auctions: formattedAuctions, pagination };
  }
  
  /**
   * Obtener detalle de subasta específica
   */
  async getAuctionById(auctionId) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        asset: true,
        guarantees: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                document_type: true,
                document_number: true,
                phone_number: true,
              },
            },
          },
          orderBy: { posicion_ranking: 'asc' },
        },
      },
    });
    
    if (!auction) {
      throw BusinessErrors.AuctionNotFound();
    }

    // Compatibilidad: inyectar fecha_limite_pago desde Guarantee ganadora
    const winner = auction.guarantees.find(g => g.id === auction.id_offerWin) || auction.guarantees[0] || null;
    return {
      ...auction,
      fecha_limite_pago: winner?.fecha_limite_pago || null,
    };
  }
  
  /**
   * Cambiar estado de subasta
   */
  async updateAuctionStatus(auctionId, newStatus, motivo = null) {
    const auction = await this.getAuctionById(auctionId);
    
    // Validar transición de estado
    if (!stateHelpers.isValidStateTransition(auction.estado, newStatus)) {
      const validStates = stateHelpers.getValidAuctionTransitions(auction.estado);
      throw new ConflictError(
        `No se puede cambiar de '${auction.estado}' a '${newStatus}'. Estados válidos: ${validStates.join(', ')}`,
        'INVALID_STATE_TRANSITION'
      );
    }
    
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        estado: newStatus,
        finished_at: newStatus === 'finalizada' ? new Date() : null,
      },
      include: {
        asset: true,
      },
    });
    
    Logger.info(`Estado de subasta actualizado: ${auctionId} -> ${newStatus}`, {
      motivo,
      previousState: auction.estado,
    });
    
    return updatedAuction;
  }
  
  /**
   * Extender fecha límite de pago
   */
  async extendPaymentDeadline(auctionId, newDeadline, motivo = null) {
    // Cargar subasta base (sin campo fecha_limite_pago en DB)
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        estado: true,
        id_offerWin: true,
      },
    });
    if (!auction) throw BusinessErrors.AuctionNotFound();
    
    // Validar que la subasta pueda tener extensión
    if (!['pendiente', 'en_validacion'].includes(auction.estado)) {
      throw BusinessErrors.InvalidAuctionState('pendiente o en_validacion', auction.estado);
    }
    
    // Validar que la nueva fecha sea futura
    if (!businessValidations.isPaymentDeadlineValid(newDeadline)) {
      throw new ConflictError(
        'La fecha límite debe ser futura',
        'INVALID_DEADLINE'
      );
    }

    if (!auction.id_offerWin) {
      throw new ConflictError('No existe garantía ganadora para extender plazo', 'NO_WINNING_GUARANTEE');
    }

    // Actualizar fecha en Guarantee ganadora
    await prisma.guarantee.update({
      where: { id: auction.id_offerWin },
      data: { fecha_limite_pago: new Date(newDeadline) },
    });
    
    Logger.info(`Fecha límite extendida para subasta ${auctionId}`, {
      nuevaFecha: newDeadline,
      motivo,
    });
    
    // Compatibilidad: devolver objeto "auction" con fecha_limite_pago calculado
    const updated = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        asset: true,
        guarantees: {
          include: { user: true },
          orderBy: { posicion_ranking: 'asc' },
        },
      },
    });
    const winner = updated.guarantees.find(g => g.id === updated.id_offerWin) || updated.guarantees[0] || null;
    return {
      ...updated,
      fecha_limite_pago: winner?.fecha_limite_pago || null,
    };
  }
  
  /**
   * Eliminar subasta (solo si no tiene ofertas)
   */
  async deleteAuction(auctionId) {
    const auction = await this.getAuctionById(auctionId);
    
    // Verificar que no tenga ofertas asociadas
    if (auction.guarantees.length > 0) {
      throw new ConflictError(
        'No se puede eliminar una subasta que tiene ofertas asociadas',
        'HAS_OFFERS'
      );
    }
    
    // Verificar que no tenga movements de pago_garantia asociados
    const movementsCount = await prisma.movement.count({
      where: {
        auction_id_ref: auctionId,
        tipo_movimiento_especifico: 'pago_garantia',
      },
    });
    if (movementsCount > 0) {
      throw new ConflictError(
        'No se puede eliminar una subasta que tiene transacciones de garantía asociadas',
        'HAS_PAYMENTS'
      );
    }
    
    await prisma.auction.delete({
      where: { id: auctionId },
    });
    
    Logger.info(`Subasta eliminada: ${auctionId} - ${auction.asset.placa}`);
    
    return { success: true };
  }
  
  /**
   * Obtener subastas vencidas que requieren procesamiento automático
   */
  async getExpiredAuctions() {
    const now = new Date();
    
    // Buscar subastas con garantía ganadora activa cuyo deadline (en Guarantee) expiró
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        estado: 'pendiente',
        guarantees: {
          some: {
            estado: 'activa',
            fecha_limite_pago: { lte: now },
          },
        },
      },
      include: {
        asset: true,
        guarantees: {
          where: { estado: 'activa' },
          include: {
            user: true,
          },
        },
      },
    });
    
    return expiredAuctions;
  }

  /**
   * Registrar resultado de competencia externa (ganada | perdida | penalizada)
   * - ganada: estado=ganada, mantener retenido hasta facturación (facturada), notificar
   * - perdida: estado=perdida, mantener retenido hasta que el reembolso sea procesado, notificar
   * - penalizada: estado=penalizada, aplicar penalidad (salida 30%) y mantener retenido hasta que el reembolso sea procesado, notificar
   */
  async registerCompetitionResult(auctionId, resultado, observaciones = null) {
    if (!['ganada', 'perdida', 'penalizada'].includes(resultado)) {
      throw new ConflictError('Resultado de competencia no válido', 'INVALID_COMPETITION_RESULT');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Obtener subasta + offer ganador (id_offerWin) + asset
      const auction = await tx.auction.findUnique({
        where: { id: auctionId },
        include: {
          asset: true,
          guarantees: true,
        },
      });
      if (!auction) throw BusinessErrors.AuctionNotFound();

      // Validar transición: solo desde 'finalizada' se resuelve competencia
      if (!['finalizada', 'ganada', 'perdida', 'penalizada'].includes(auction.estado) && auction.estado !== 'finalizada') {
        throw new ConflictError(
          `Estado actual no permite registrar resultado de competencia: ${auction.estado}`,
          'INVALID_AUCTION_STATE'
        );
      }

      // Offer ganador y usuario
      const winningOfferId = auction.id_offerWin;
      const winningOffer = auction.guarantees.find(o => o.id === winningOfferId);
      if (!winningOffer) {
        throw new ConflictError('No se encontró la oferta ganadora para esta subasta', 'NO_WINNING_OFFER');
      }
      const userId = winningOffer.user_id;

      // Cambiar estado base + fecha_resultado_general
      const updatedAuction = await tx.auction.update({
        where: { id: auctionId },
        data: {
          estado: resultado,
          fecha_resultado_general: new Date(),
        },
        include: { asset: true },
      });

      // Helpers internos
      const recalcSaldoTotalTx = async (uid) => {
        // Excluir entradas de tipo 'reembolso' para no inflar saldo_total cuando se libera retenido
        const entradas = await tx.movement.aggregate({
          _sum: { monto: true },
          where: {
            user_id: uid,
            estado: 'validado',
            tipo_movimiento_general: 'entrada',
            NOT: { tipo_movimiento_especifico: 'reembolso' },
          },
        });
        const salidas = await tx.movement.aggregate({
          _sum: { monto: true },
          where: {
            user_id: uid,
            estado: 'validado',
            tipo_movimiento_general: 'salida',
          },
        });
        const totalEntradas = Number(entradas._sum.monto || 0);
        const totalSalidas = Number(salidas._sum.monto || 0);
        const saldoTotal = Number((totalEntradas - totalSalidas).toFixed(2));
        await tx.user.update({ where: { id: uid }, data: { saldo_total: saldoTotal } });
        return saldoTotal;
      };

      const recalcSaldoRetenidoTx = async (uid) => {
        // RN07: Estados que retienen: finalizada, ganada, perdida, penalizada
        const guarantees = await tx.guarantee.findMany({
          where: { user_id: uid },
          select: { auction: { select: { id: true, estado: true } } },
        });
        const retainStates = new Set(['finalizada', 'ganada', 'perdida']);
        const auctionIdsToRetain = guarantees
          .filter((o) => o.auction && retainStates.has(o.auction.estado))
          .map((o) => o.auction.id);

        // Sumar garantías validadas asociadas a subastas retenedoras
        let sumGarantias = 0;
        if (auctionIdsToRetain.length > 0) {
          const validatedGuaranteeMovs = await tx.movement.findMany({
            where: {
              user_id: uid,
              estado: 'validado',
              tipo_movimiento_general: 'entrada',
              tipo_movimiento_especifico: 'pago_garantia',
              auction_id_ref: { in: auctionIdsToRetain },
            },
            select: { monto: true },
          });
          sumGarantias = validatedGuaranteeMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
        }

        // Restar reembolsos de salida ya procesados (validados) SOLO de estas subastas retenedoras
        let sumReembolsos = 0;
        if (auctionIdsToRetain.length > 0) {
          const refundMovs = await tx.movement.findMany({
            where: {
              user_id: uid,
              estado: 'validado',
              // Considerar cualquier 'reembolso' (entrada: liberación, salida: devolución de dinero)
              tipo_movimiento_especifico: 'reembolso',
              auction_id_ref: { in: auctionIdsToRetain },
            },
            select: { monto: true },
          });
          sumReembolsos = refundMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
        }

        const saldoRetenido = Number(Math.max(0, sumGarantias - sumReembolsos).toFixed(2));
        await tx.user.update({ where: { id: uid }, data: { saldo_retenido: saldoRetenido } });
        return saldoRetenido;
      };

      // Crear notificación dentro de la TX, pero enviar email fuera de la TX para evitar expiración (P2028)
      const notifySafe = async (tipo, { uid, titulo, mensaje, reference_type, reference_id }) => {
        try {
          const notif = await tx.notification.create({
            data: {
              user_id: uid,
              tipo,
              titulo,
              mensaje,
              estado: 'pendiente',
              email_status: 'pendiente',
              reference_type: reference_type ?? null,
              reference_id: reference_id ?? null,
            },
          });

          // Envío de correo fuera de la transacción (no bloqueante)
          setTimeout(async () => {
            try {
              const emailService = require('../services/emailService');
              await emailService.send({
                toUserId: uid,
                subject: titulo,
                body: mensaje,
              });
              await prisma.notification.update({
                where: { id: notif.id },
                data: { email_status: 'enviado', email_sent_at: new Date() },
              });
            } catch (e) {
              try {
                await prisma.notification.update({
                  where: { id: notif.id },
                  data: { email_status: 'fallido', email_error: e?.message?.slice(0, 300) ?? 'unknown_error' },
                });
              } catch (updErr) {
                Logger.warn(`No se pudo actualizar estado de email para notificación (${tipo}): ${updErr.message}`);
              }
            }
          }, 0);
        } catch (e) {
          Logger.warn(`No se pudo crear notificación (${tipo}): ${e.message}`);
        }
      };

      switch (resultado) {
        case 'ganada': {
          // RN07: Mantener retenido sin cambios hasta facturación, solo notificar
          await notifySafe('competencia_ganada', {
            uid: userId,
            titulo: '¡BOB ganó la competencia!',
            mensaje: `BOB ganó la competencia externa para la subasta ${updatedAuction.asset?.placa ?? ''}. Completa tus datos de facturación.`,
            reference_type: 'auction',
            reference_id: auctionId,
          });
          // NO recalcular retenido: debe mantenerse igual hasta la facturación
          break;
        }
        case 'perdida': {
          // Crear reembolso automático (entrada/reembolso) por el 100% de la garantía validada
          const agg = await tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'entrada',
              tipo_movimiento_especifico: 'pago_garantia',
              auction_id_ref: auctionId,
            },
          });
          const garantiaTotal = Number(agg._sum.monto || 0);

          if (garantiaTotal > 0) {
            await tx.movement.create({
              data: {
                user_id: userId,
                tipo_movimiento_general: 'entrada',
                tipo_movimiento_especifico: 'reembolso',
                monto: garantiaTotal,
                moneda: 'USD',
                tipo_pago: null,
                numero_cuenta_origen: null,
                voucher_url: null,
                concepto: `Reembolso automático por BOB perdió - Subasta ${updatedAuction.asset?.placa ?? ''}`,
                estado: 'validado',
                fecha_pago: new Date(),
                fecha_resolucion: new Date(),
                motivo_rechazo: null,
                numero_operacion: null,
                auction_id_ref: auctionId,
              },
            });
          }

          await recalcSaldoTotalTx(userId);
          await recalcSaldoRetenidoTx(userId);

          await notifySafe('competencia_perdida', {
            uid: userId,
            titulo: 'Competencia externa perdida',
            mensaje: `BOB no ganó la competencia externa para la subasta ${updatedAuction.asset?.placa ?? ''}. Tu dinero ya fue liberado y está disponible para próximas subastas.`,
            reference_type: 'auction',
            reference_id: auctionId,
          });
          break;
        }
        case 'penalizada': {
          // Penalidad 30% de garantía validada asociada a esta subasta + reembolso automático 70%
          const agg = await tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'entrada',
              tipo_movimiento_especifico: 'pago_garantia',
              auction_id_ref: auctionId,
            },
          });
          const garantiaTotal = Number(agg._sum.monto || 0);
          const penalidad = Number((garantiaTotal * 0.30).toFixed(2));

          if (penalidad > 0) {
            const penalMovement = await tx.movement.create({
              data: {
                user_id: userId,
                tipo_movimiento_general: 'salida',
                tipo_movimiento_especifico: 'penalidad',
                monto: penalidad,
                moneda: 'USD',
                tipo_pago: null,
                numero_cuenta_origen: null,
                voucher_url: null,
                concepto: `Penalidad 30% por no completar pago de vehículo - Subasta ${updatedAuction.asset?.placa ?? ''}`,
                estado: 'validado',
                fecha_pago: new Date(),
                fecha_resolucion: new Date(),
                motivo_rechazo: null,
                numero_operacion: null,
                auction_id_ref: auctionId,
              },
            });

            await notifySafe('penalidad_aplicada', {
              uid: userId,
              titulo: 'Penalidad aplicada',
              mensaje: `Se aplicó penalidad del 30% de la garantía para la subasta ${updatedAuction.asset?.placa ?? ''}.`,
              reference_type: 'movement',
              reference_id: penalMovement.id,
            });
          }

          // Reembolso automático del 70% restante como entrada/reembolso (libera retenido)
          const reembolso70 = Number((garantiaTotal - penalidad).toFixed(2));
          if (reembolso70 > 0) {
            await tx.movement.create({
              data: {
                user_id: userId,
                tipo_movimiento_general: 'entrada',
                tipo_movimiento_especifico: 'reembolso',
                monto: reembolso70,
                moneda: 'USD',
                tipo_pago: null,
                numero_cuenta_origen: null,
                voucher_url: null,
                concepto: `Reembolso automático 70% por penalidad - Subasta ${updatedAuction.asset?.placa ?? ''}`,
                estado: 'validado',
                fecha_pago: new Date(),
                fecha_resolucion: new Date(),
                motivo_rechazo: null,
                numero_operacion: null,
                auction_id_ref: auctionId,
              },
            });
          }

          // Recalcular caches tras penalidad + reembolso automático
          await recalcSaldoTotalTx(userId);
          await recalcSaldoRetenidoTx(userId);
          break;
        }
      }

      return {
        auction: updatedAuction,
        resultado,
        observaciones: observaciones || undefined,
      };
    });

    return result;
  }
}
 
module.exports = new AuctionService();