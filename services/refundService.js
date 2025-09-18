const { prisma } = require('../config/database');
const { Logger } = require('../middleware/logger');
const {
  BusinessErrors,
  ConflictError,
  NotFoundError,
} = require('../middleware/errorHandler');
const balanceService = require('./balanceService');
const notificationService = require('./notificationService');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * Servicio de Reembolsos
 * Cubre HU-REEM-01 (solicitar), HU-REEM-02 (confirmar/rechazar),
 * y HU-REEM-03 (procesar) con creación de Movement.
 */
class RefundService {
  /**
   * HU-REEM-01 — Solicitar Reembolso (Cliente)
   * Reglas:
   * - monto_solicitado > 0 y <= saldo_disponible
   * - No debe haber solicitudes pendientes (solicitado|confirmado)
   * - Crea refund estado 'solicitado' + notificaciones
   */
  async createRefund(userId, payload) {
    const { monto_solicitado, tipo_reembolso, motivo, auction_id } = payload;

    Logger.info(`Cliente ${userId} solicitando reembolso`, {
      monto_solicitado,
      tipo_reembolso,
      auction_id,
    });

    return prisma.$transaction(async (tx) => {
      // Regla base: monto > 0
      if (Number(monto_solicitado) <= 0) {
        throw new ConflictError('Monto inválido: debe ser > 0', 'INVALID_REFUND_AMOUNT');
      }

      // Verificar solicitudes pendientes
      const pending = await tx.refund.findFirst({
        where: {
          user_id: userId,
          estado: { in: ['solicitado', 'confirmado'] },
        },
      });
      if (pending) {
        throw new ConflictError(
          'Existe una solicitud de reembolso pendiente',
          'REFUND_PENDING_EXISTS'
        );
      }

      // CRÍTICO: Validar contra saldo_disponible global antes de validaciones específicas
      const balance = await balanceService.getBalance(userId, tx);
      if (Number(monto_solicitado) > balance.saldo_disponible) {
        throw new ConflictError(
          `Monto solicitado ($${monto_solicitado}) excede saldo disponible ($${balance.saldo_disponible})`,
          'INSUFFICIENT_AVAILABLE_BALANCE'
        );
      }

      // VN-06 (opcional por ahora): si se provee auction_id, validar pertenencia y retenido disponible
      if (auction_id) {
        const auction = await tx.auction.findUnique({
          where: { id: auction_id },
          select: {
            id: true,
            estado: true,
            offers: { where: { user_id: userId }, select: { id: true } },
          },
        });
        if (!auction || !auction.offers?.length) {
          throw new ConflictError(
            'auction_id no corresponde a una subasta del cliente',
            'INVALID_AUCTION_FOR_REFUND'
          );
        }
        if (!['perdida', 'penalizada'].includes(auction.estado)) {
          throw new ConflictError(
            `La subasta no está en estado válido para reembolso (actual: ${auction.estado})`,
            'AUCTION_STATE_NOT_REFUNDABLE'
          );
        }

        const [aggGarantias, aggReembolsos] = await Promise.all([
          tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'entrada',
              tipo_movimiento_especifico: 'pago_garantia',
              references: { some: { reference_type: 'auction', reference_id: auction_id } },
            },
          }),
          tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'salida',
              tipo_movimiento_especifico: 'reembolso',
              references: { some: { reference_type: 'auction', reference_id: auction_id } },
            },
          }),
        ]);

        const garantias = Number(aggGarantias._sum.monto || 0);
        const reembolsos = Number(aggReembolsos._sum.monto || 0);
        const pendiente = Number((garantias - reembolsos).toFixed(2));
        if (pendiente <= 0 || Number(monto_solicitado) > pendiente) {
          throw new ConflictError(
            `Monto solicitado excede saldo retenido pendiente ($${pendiente}) en la subasta`,
            'REFUND_AMOUNT_EXCEEDS_RETAINED'
          );
        }
      }

      const refund = await tx.refund.create({
        data: {
          user_id: userId,
          monto_solicitado: Number(monto_solicitado),
          tipo_reembolso, // mantener_saldo | devolver_dinero
          estado: 'solicitado',
          motivo: motivo || null,
          ...(auction_id ? { auction_id } : {}),
        },
      });

      // Notificación para admin: reembolso_solicitado
      const admin = await tx.user.findFirst({
        where: { user_type: 'admin' },
        select: { id: true },
      });
      if (admin) {
        await notificationService.createAndSend({
          tx,
          user_id: admin.id,
          tipo: 'reembolso_solicitado',
          titulo: 'Nueva solicitud de reembolso',
          mensaje: `Cliente solicitó reembolso de $${monto_solicitado} - Tipo: ${tipo_reembolso}`,
          reference_type: 'refund',
          reference_id: refund.id,
        });
      }

      // Notificación para cliente (usamos reembolso_solicitado como confirmación)
      await notificationService.createAndSend({
        tx,
        user_id: userId,
        tipo: 'reembolso_solicitado',
        titulo: 'Solicitud de reembolso registrada',
        mensaje: `Su solicitud de reembolso #${refund.id} ha sido registrada. Pronto será contactado para confirmar detalles.`,
        reference_type: 'refund',
        reference_id: refund.id,
      });

      return refund;
    });
  }

  /**
   * HU-REEM-02 — Gestionar Solicitudes (Admin)
   * Confirmar o rechazar solicitud:
   * - confirmado: requiere llamada previa; marca fecha_respuesta_empresa
   * - rechazado: requiere motivo
   */
  async manageRefund(refundId, adminUserId, { estado, motivo }) {
    Logger.info(`Admin ${adminUserId} gestionando refund ${refundId}`, { estado, motivo });

    if (!['confirmado', 'rechazado'].includes(estado)) {
      throw new ConflictError('Estado no válido para gestión', 'INVALID_MANAGE_STATE');
    }

    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({ where: { id: refundId } });
      if (!refund) throw new NotFoundError('Refund');

      if (refund.estado !== 'solicitado') {
        throw new ConflictError(
          `Solo se puede gestionar solicitudes en estado 'solicitado' (actual: ${refund.estado})`,
          'INVALID_REFUND_STATE'
        );
      }

      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          estado,
          fecha_respuesta_empresa: new Date(),
          motivo: estado === 'rechazado' ? (motivo || 'Rechazado por políticas') : refund.motivo,
        },
      });

      // Notificación al cliente según resultado (opcional, usamos reembolso_solicitado para no crear nuevo tipo)
      await notificationService.createAndSend({
        tx,
        user_id: refund.user_id,
        tipo: 'reembolso_solicitado',
        titulo: estado === 'confirmado' ? 'Solicitud de reembolso confirmada' : 'Solicitud de reembolso rechazada',
        mensaje:
          estado === 'confirmado'
            ? `Su solicitud de reembolso #${refundId} fue confirmada. Será procesada pronto.`
            : `Su solicitud de reembolso #${refundId} fue rechazada.${motivo ? ' Motivo: ' + motivo : ''}`,
        reference_type: 'refund',
        reference_id: refundId,
      });

      return updated;
    });
  }

  /**
   * HU-REEM-03 — Procesar Reembolso (Admin)
   * - Solo para solicitudes 'confirmado'
   * - Crea Movement validado:
   *   * mantener_saldo => entrada/reembolso
   *   * devolver_dinero => salida/reembolso (con voucher/operación)
   * - Recalcula saldos y notifica reembolso_procesado
   */
  async processRefund(refundId, adminUserId, data = {}, voucherFile) {
    const {
      tipo_transferencia, // 'transferencia' | 'deposito' | etc (opcional)
      banco_destino,
      numero_cuenta_destino,
      numero_operacion, // obligatorio si devolver_dinero
    } = data;

    Logger.info(`Admin ${adminUserId} procesando refund ${refundId}`);

    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
      });
      if (!refund) throw new NotFoundError('Refund');

      if (refund.estado !== 'confirmado') {
        throw new ConflictError(
          `Solo se puede procesar refund en estado 'confirmado' (actual: ${refund.estado})`,
          'INVALID_REFUND_STATE'
        );
      }

      const userId = refund.user_id;

      // Nota: No verificamos saldo_disponible aquí.
      // La validación se realiza contra el saldo retenido pendiente por subasta (RN07).

      let movementGeneral = 'entrada';
      let movementConcept = `Reembolso mantenido como saldo - ${refund.motivo || ''}`.trim();
      let movementNumeroOperacion = null;
      let voucherUrl = null;

      if (refund.tipo_reembolso === 'devolver_dinero') {
        // Validaciones básicas
        if (!numero_operacion || typeof numero_operacion !== 'string' || numero_operacion.length < 3) {
          throw new ConflictError('numero_operacion es obligatorio y debe ser válido', 'INVALID_OPERATION_NUMBER');
        }
        movementGeneral = 'salida';
        movementConcept = `Reembolso transferido - ${refund.motivo || ''}`.trim();

        // Subir voucher si hay
        if (voucherFile?.buffer) {
          try {
            const uploadResult = await uploadToCloudinary(
              voucherFile.buffer,
              voucherFile.originalname || 'refund_voucher',
              userId
            );
            voucherUrl = uploadResult.secure_url;
          } catch (err) {
            throw new ConflictError('Error al procesar el comprobante del reembolso', 'UPLOAD_ERROR');
          }
        }

        movementNumeroOperacion = numero_operacion;
      }

      // Determinar subasta a asociar (preferir refund.auction_id, luego data.auction_id; si falta, inferir)
      let auctionIdForRefund = refund.auction_id || data?.auction_id || null;
      if (!auctionIdForRefund) {
        // Candidatas: subastas del usuario en estados que requieren reembolso
        const candidates = await tx.auction.findMany({
          where: {
            estado: { in: ['perdida', 'penalizada'] },
            offers: { some: { user_id: userId } },
          },
          orderBy: { updated_at: 'desc' },
          select: { id: true },
        });

        // Buscar la primera subasta con retenido_sin_devolver >= monto_solicitado
        const requested = Number(refund.monto_solicitado);
        for (const a of candidates) {
          const [aggGarantias, aggReembolsos] = await Promise.all([
            tx.movement.aggregate({
              _sum: { monto: true },
              where: {
                user_id: userId,
                estado: 'validado',
                tipo_movimiento_general: 'entrada',
                tipo_movimiento_especifico: 'pago_garantia',
                references: { some: { reference_type: 'auction', reference_id: a.id } },
              },
            }),
            tx.movement.aggregate({
              _sum: { monto: true },
              where: {
                user_id: userId,
                estado: 'validado',
                tipo_movimiento_general: 'salida',
                tipo_movimiento_especifico: 'reembolso',
                references: { some: { reference_type: 'auction', reference_id: a.id } },
              },
            }),
          ]);

          const garantias = Number(aggGarantias._sum.monto || 0);
          const reembolsos = Number(aggReembolsos._sum.monto || 0);
          const pendiente = Number((garantias - reembolsos).toFixed(2));

          if (pendiente >= requested && pendiente > 0) {
            auctionIdForRefund = a.id;
            break;
          }
        }

        // Fallback: si no encuentra por monto, tomar la primera candidata (para no perder trazabilidad)
        if (!auctionIdForRefund && candidates.length > 0) {
          auctionIdForRefund = candidates[0].id;
        }
      }

      // Validación específica para 'devolver_dinero': debe existir retenido pendiente suficiente en la subasta
      if (refund.tipo_reembolso === 'devolver_dinero') {
        if (!auctionIdForRefund) {
          throw new ConflictError(
            'No se pudo determinar la subasta asociada al reembolso',
            'MISSING_AUCTION_REFERENCE_FOR_REFUND'
          );
        }

        const [aggGarantiasSel, aggReembolsosSel] = await Promise.all([
          tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'entrada',
              tipo_movimiento_especifico: 'pago_garantia',
              references: { some: { reference_type: 'auction', reference_id: auctionIdForRefund } },
            },
          }),
          tx.movement.aggregate({
            _sum: { monto: true },
            where: {
              user_id: userId,
              estado: 'validado',
              tipo_movimiento_general: 'salida',
              tipo_movimiento_especifico: 'reembolso',
              references: { some: { reference_type: 'auction', reference_id: auctionIdForRefund } },
            },
          }),
        ]);
        const garantiasSel = Number(aggGarantiasSel._sum.monto || 0);
        const reembolsosSel = Number(aggReembolsosSel._sum.monto || 0);
        const pendienteSel = Number((garantiasSel - reembolsosSel).toFixed(2));
        if (pendienteSel <= 0 || Number(refund.monto_solicitado) > pendienteSel) {
          throw new ConflictError(
            `Monto solicitado excede saldo retenido pendiente ($${pendienteSel}) en la subasta seleccionada`,
            'REFUND_AMOUNT_EXCEEDS_RETAINED'
          );
        }
      }

      // Nota: Evitamos persistir auction_id en Refund para no depender de regenerar Prisma Client.
      // La trazabilidad y el cálculo de retenido se basan en MovementReferences (auction/refund),
      // por lo que no es necesario actualizar el campo en Refund para el correcto funcionamiento.

      // Crear Movement validado
      const movement = await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento_general: movementGeneral,
          tipo_movimiento_especifico: 'reembolso',
          monto: Number(refund.monto_solicitado),
          moneda: 'USD',
          tipo_pago: null,
          numero_cuenta_origen: null,
          voucher_url: voucherUrl,
          concepto: movementConcept,
          estado: 'validado',
          fecha_pago: new Date(),
          fecha_resolucion: new Date(),
          motivo_rechazo: null,
          numero_operacion: movementNumeroOperacion,
          references: {
            create: [
              ...(auctionIdForRefund ? [{ reference_type: 'auction', reference_id: auctionIdForRefund }] : []),
              { reference_type: 'refund', reference_id: refundId },
            ],
          },
        },
      });

      // Actualizar refund a 'procesado'
      const processed = await tx.refund.update({
        where: { id: refundId },
        data: {
          estado: 'procesado',
          fecha_procesamiento: new Date(),
        },
      });

      // Recalcular saldo_total y ajustar retenido de forma incremental según RN07
      await this._recalcularSaldoTotalTx(tx, userId);

      // Importante: recalcular retenido SIEMPRE tras procesar refund.
      // _recalcularSaldoRetenidoTx considera cualquier Movement 'reembolso' (entrada o salida),
      // por lo que también libera retenido cuando es 'mantener_saldo'.
      await this._recalcularSaldoRetenidoTx(tx, userId);

      // Notificar cliente: reembolso_procesado
      await notificationService.createAndSend({
        tx,
        user_id: userId,
        tipo: 'reembolso_procesado',
        titulo: 'Reembolso procesado',
        mensaje:
          refund.tipo_reembolso === 'mantener_saldo'
            ? `Se procesó su reembolso #${refundId} como saldo disponible.`
            : `Se procesó su reembolso #${refundId} y el dinero fue transferido.`,
        reference_type: 'refund',
        reference_id: refundId,
      });

      return { refund: processed, movement };
    });
  }

  // ---------------- Helpers (cálculo de cache) ----------------

  async _recalcularSaldoTotalTx(tx, userId) {
    // Importante: excluir entradas de tipo 'reembolso' (mantener_saldo) para no inflar saldo_total
    const entradas = await tx.movement.aggregate({
      _sum: { monto: true },
      where: {
        user_id: userId,
        estado: 'validado',
        tipo_movimiento_general: 'entrada',
        NOT: { tipo_movimiento_especifico: 'reembolso' },
      },
    });
    const salidas = await tx.movement.aggregate({
      _sum: { monto: true },
      where: {
        user_id: userId,
        estado: 'validado',
        tipo_movimiento_general: 'salida',
      },
    });

    const totalEntradas = Number(entradas._sum.monto || 0);
    const totalSalidas = Number(salidas._sum.monto || 0);
    const saldoTotal = Number((totalEntradas - totalSalidas).toFixed(2));

    await tx.user.update({
      where: { id: userId },
      data: { saldo_total: saldoTotal },
    });

    return saldoTotal;
  }

  async _recalcularSaldoRetenidoTx(tx, userId) {
    // Subastas del usuario y estados
    const offers = await tx.offer.findMany({
      where: { user_id: userId },
      select: {
        auction: { select: { id: true, estado: true } },
      },
    });

    // RN07: Estados que retienen. 'penalizada' NO retiene porque ya se aplicó la penalidad
    const retenedorStates = new Set(['finalizada', 'ganada', 'perdida']);
    const auctionIdsToRetain = offers
      .filter((o) => o.auction && retenedorStates.has(o.auction.estado))
      .map((o) => o.auction.id);

    // Garantías validadas asociadas a subastas retenedoras
    let sumGarantias = 0;
    if (auctionIdsToRetain.length > 0) {
      const validatedGuaranteeMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          references: {
            some: {
              reference_type: 'auction',
              reference_id: { in: auctionIdsToRetain },
            },
          },
        },
        select: { monto: true },
      });
      sumGarantias = validatedGuaranteeMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    // Reembolsos de salida ya procesados (validados) a restar, SOLO de estas subastas
    let sumReembolsos = 0;
    if (auctionIdsToRetain.length > 0) {
      const refundMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          // Considerar cualquier 'reembolso' (salida o entrada mantener_saldo) para liberar retenido
          tipo_movimiento_especifico: 'reembolso',
          references: {
            some: {
              reference_type: 'auction',
              reference_id: { in: auctionIdsToRetain },
            },
          },
        },
        select: { monto: true },
      });
      sumReembolsos = refundMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    const saldoRetenido = Number(Math.max(0, sumGarantias - sumReembolsos).toFixed(2));

    await tx.user.update({
      where: { id: userId },
      data: { saldo_retenido: saldoRetenido },
    });

    return saldoRetenido;
  }
}

module.exports = new RefundService();