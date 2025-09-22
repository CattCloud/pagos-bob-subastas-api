const { prisma } = require('../config/database');
const { uploadToCloudinary } = require('../config/cloudinary');
const {
  BusinessErrors,
  NotFoundError,
  ConflictError,
} = require('../middleware/errorHandler');
const { Logger } = require('../middleware/logger');
const {
  businessCalculations,
  businessValidations,
  formatters,
} = require('../utils');

/**
 * Servicio central de Movements (transacciones)
 * Implementa registro, aprobación y rechazo de pago de garantía bajo arquitectura Movement.
 */
class MovementService {
  /**
   * Registrar pago de garantía (Movement entrada, tipo_especifico = pago_garantia)
   * - Valida subasta y oferta ganadora del usuario
   * - Valida monto exacto (8%)
   * - Valida unicidad de numero_operacion para el usuario
   * - Sube voucher a Cloudinary
   * - Crea Movement en estado 'pendiente'
   * - Crea Movement_References a auction y guarantee
   * - Actualiza Auction.estado = 'en_validacion'
   * - Recalcula cache saldos (por estado de subasta)
   */
  async createPaymentMovement(userId, data, voucherFile) {
    const {
      auction_id,
      monto,
      tipo_pago, // 'deposito' | 'transferencia'
      numero_cuenta_origen,
      numero_operacion,
      fecha_pago,
      moneda = 'USD',
      concepto = 'Pago de garantía',
    } = data;

    Logger.info(`Cliente ${userId} registrando Movement pago_garantia para subasta ${auction_id}`);

    // Snapshot del retenido actual para garantizar que movimientos pendientes no lo alteren (RN07)
    const userBeforeCache = await prisma.user.findUnique({
      where: { id: userId },
      select: { saldo_retenido: true },
    });
    const retenidoBefore = Number(userBeforeCache?.saldo_retenido || 0);

// Subir voucher a Cloudinary FUERA de la transacción para evitar P2028
let voucherUrl = null;
if (voucherFile?.buffer) {
  try {
    const uploadResult = await uploadToCloudinary(
      voucherFile.buffer,
      voucherFile.originalname || 'payment_voucher',
      userId
    );
    voucherUrl = uploadResult.secure_url;
    Logger.info(`Comprobante subido (pre-TX): ${uploadResult.public_id}`);
  } catch (err) {
    Logger.error('Error subiendo voucher a Cloudinary (pre-TX):', err);
    throw new ConflictError('Error al procesar el archivo del comprobante', 'UPLOAD_ERROR');
  }
}
    const result = await prisma.$transaction(async (tx) => {
      // 1) Validar subasta
      const auction = await tx.auction.findUnique({
        where: { id: auction_id },
        include: {
          asset: true,
          guarantees: {
            where: { user_id: userId },
            orderBy: { posicion_ranking: 'asc' },
            take: 1,
          },
        },
      });

      if (!auction) throw BusinessErrors.AuctionNotFound();

      if (!['pendiente', 'en_validacion'].includes(auction.estado)) {
        throw BusinessErrors.InvalidAuctionState('pendiente|en_validacion', auction.estado);
      }

      // 2) Validar que el usuario tiene garantía asociada a la subasta (ganador vigente)
      const userGuarantee = auction.guarantees?.[0];
      if (!userGuarantee) {
        throw new ConflictError(
          'Solo el ganador/ganadora puede registrar el pago de garantía para esta subasta',
          'NOT_CURRENT_WINNER'
        );
      }

      // 3) Validar monto exacto = 8% de oferta
      const expectedAmount =
        businessCalculations?.calculateGuaranteeAmount?.(userGuarantee.monto_oferta) ??
        Number((Number(userGuarantee.monto_oferta) * 0.08).toFixed(2));

      const isValidGuarantee =
        businessValidations?.isGuaranteeAmountValid?.(monto, userGuarantee.monto_oferta) ??
        Number(monto) === expectedAmount;

      if (!isValidGuarantee) {
        throw BusinessErrors.InvalidAmount(expectedAmount, monto);
      }

            // 4) Validar fecha de pago (solo no futura; subasta ya no tiene fecha_inicio/fin)
            const paymentDate = new Date(fecha_pago);
            const now = new Date();
      
            if (paymentDate > now) {
              throw new ConflictError('La fecha de pago no puede ser futura', 'FUTURE_PAYMENT_DATE');
            }

      // 5) Validar unicidad de numero_operacion por usuario
      if (numero_operacion) {
        const dupOp = await tx.movement.findFirst({
          where: {
            user_id: userId,
            numero_operacion,
          },
        });
        if (dupOp) {
          throw new ConflictError(
            'El número de operación ya fue registrado por este usuario',
            'DUPLICATE_OPERATION_NUMBER'
          );
        }
      }

      // 6) Voucher ya subido fuera de la transacción (pre-TX). Usamos voucherUrl obtenido previamente.

      // 7) Crear Movement pendiente con referencias directas
      const movement = await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          monto,
          moneda,
          tipo_pago: tipo_pago ?? null,
          numero_cuenta_origen: numero_cuenta_origen ?? null,
          voucher_url: voucherUrl,
          concepto,
          estado: 'pendiente',
          fecha_pago: paymentDate,
          numero_operacion: numero_operacion ?? null,
          auction_id_ref: auction_id,
          guarantee_id_ref: userGuarantee.id,
        },
      });

      // 9) Cambiar estado de subasta -> 'en_validacion'
      const updatedAuction = await tx.auction.update({
        where: { id: auction_id },
        data: { estado: 'en_validacion' },
        include: { asset: true },
      });

      // 10) NO recalcular retenido en registro pendiente (RN07): evitar alterar cache hasta aprobación
      // Asegurar explícitamente que el cache de retenido no cambie por efectos colaterales
      await tx.user.update({
        where: { id: userId },
        data: { saldo_retenido: retenidoBefore },
      });


      return {
        movement,
        auction: updatedAuction,
      };
    });

    // Notificación fuera de la transacción (evita mantener la TX abierta)
    await this._notifySafe('pago_registrado', {
      tx: null,
      user_id: userId,
      titulo: 'Pago registrado',
      mensaje: `Se registró tu pago de garantía para la subasta ${result.auction.asset?.placa ?? ''}. Pendiente de validación.`,
      reference_type: 'movement',
      reference_id: result.movement.id,
    });

    return result;
  }

  /**
   * Aprobar Movement de pago de garantía:
   * - movement.estado: pendiente -> validado (+ fecha_resolucion)
   * - auction.estado: en_validacion -> finalizada
   * - Recalc: saldo_total (desde Movement validados), saldo_retenido (estados que retienen)
   * - Notificación 'pago_validado'
   */
  async approvePaymentMovement(movementId, adminUserId, comentarios = null) {
    Logger.info(`Admin ${adminUserId} aprobando Movement ${movementId}`);
  
    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.movement.findUnique({
        where: { id: movementId },
        include: { user: true },
      });
      if (!movement) throw new NotFoundError('Movement');
  
      if (movement.estado !== 'pendiente') {
        throw BusinessErrors.PaymentAlreadyProcessed();
      }
      if (
        movement.tipo_movimiento_general !== 'entrada' ||
        movement.tipo_movimiento_especifico !== 'pago_garantia'
      ) {
        throw new ConflictError('Solo es posible aprobar pagos de garantía en estado pendiente', 'INVALID_MOVEMENT_TYPE');
      }
  
      const approved = await tx.movement.update({
        where: { id: movementId },
        data: {
          estado: 'validado',
          fecha_resolucion: new Date(),
          concepto: comentarios ? `${movement.concepto} | ${comentarios}` : movement.concepto,
        },
      });
  
      const auction_id = movement.auction_id_ref;
      if (!auction_id) {
        throw new ConflictError('Movement sin referencia a subasta', 'MISSING_AUCTION_REFERENCE');
      }
  
      const finalizedAuction = await tx.auction.update({
        where: { id: auction_id },
        data: { estado: 'finalizada', finished_at: new Date() },
        include: { asset: true },
      });
  
      await this._recalcularSaldoTotalTx(tx, movement.user_id);
      await this._recalcularSaldoRetenidoTx(tx, movement.user_id);
  
      return {
        movement: approved,
        auction: finalizedAuction,
        user: {
          data: movement.user,
          name: formatters.fullName(movement.user),
          document: formatters.document(movement.user.document_type, movement.user.document_number),
        },
      };
    });
  
    // Notificación pago_validado fuera de la transacción para evitar P2028
    await this._notifySafe('pago_validado', {
      tx: null,
      user_id: result.movement.user_id,
      titulo: 'Pago de garantía aprobado',
      mensaje: `Tu pago de garantía fue validado para la subasta ${result.auction.asset?.placa ?? ''}.`,
      reference_type: 'movement',
      reference_id: result.movement.id,
    });
  
    return result;
  }

  /**
   * Rechazar Movement de pago de garantía:
   * - movement.estado: pendiente -> rechazado (+ motivo_rechazo, fecha_resolucion)
   * - auction.estado: en_validacion -> pendiente
   * - Recalc: saldo_total (no varía por pendiente), saldo_retenido
   * - Notificación 'pago_rechazado'
   */
  async rejectPaymentMovement(movementId, adminUserId, rejectionData) {
    const { motivos = [], otros_motivos, comentarios } = rejectionData || {};
    Logger.warn(`Admin ${adminUserId} rechazando Movement ${movementId}`, { motivos, otros_motivos });
  
    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.movement.findUnique({
        where: { id: movementId },
        include: { user: true },
      });
      if (!movement) throw new NotFoundError('Movement');
  
      if (movement.estado !== 'pendiente') {
        throw BusinessErrors.PaymentAlreadyProcessed();
      }
      if (
        movement.tipo_movimiento_general !== 'entrada' ||
        movement.tipo_movimiento_especifico !== 'pago_garantia'
      ) {
        throw new ConflictError('Solo es posible rechazar pagos de garantía en estado pendiente', 'INVALID_MOVEMENT_TYPE');
      }
  
      let motivoRechazo = Array.isArray(motivos) ? motivos.join(', ') : String(motivos || '');
      if (otros_motivos) motivoRechazo = motivoRechazo ? `${motivoRechazo}, ${otros_motivos}` : otros_motivos;
  
      const rejected = await tx.movement.update({
        where: { id: movementId },
        data: {
          estado: 'rechazado',
          fecha_resolucion: new Date(),
          motivo_rechazo: motivoRechazo,
          concepto: comentarios ? `${movement.concepto} | ${comentarios}` : movement.concepto,
        },
      });
  
      const auction_id = movement.auction_id_ref;
      if (!auction_id) {
        throw new ConflictError('Movement sin referencia a subasta', 'MISSING_AUCTION_REFERENCE');
      }
  
      const revertedAuction = await tx.auction.update({
        where: { id: auction_id },
        data: { estado: 'pendiente' },
        include: { asset: true },
      });
  
      return {
        movement: rejected,
        auction: revertedAuction,
        user: {
          data: movement.user,
          name: formatters.fullName(movement.user),
          document: formatters.document(movement.user.document_type, movement.user.document_number),
        },
        motivoRechazo,
      };
    });
  
    // Notificación fuera de la transacción
    await this._notifySafe('pago_rechazado', {
      tx: null,
      user_id: result.movement.user_id,
      titulo: 'Pago de garantía rechazado',
      mensaje: `Tu pago fue rechazado. Motivo: ${result.motivoRechazo}`,
      reference_type: 'movement',
      reference_id: result.movement.id,
    });
  
    return result;
  }

  /**
   * Listar movements del usuario (o admin: de todos con filtros)
   */
  async listMovements(filters = {}, userRole = 'client', userId = null) {
    const {
      tipo_especifico, // 'pago_garantia,reembolso,penalidad,ajuste_manual'
      estado, // 'pendiente,validado,rechazado'
      page = 1,
      limit = 20,
      fecha_desde,
      fecha_hasta,
    } = filters;

    const skip = (Number(page) - 1) * Number(limit);

    const where = {};

    if (userRole === 'client' && userId) {
      where.user_id = userId;
    }

    if (tipo_especifico) {
      const tipos =
        Array.isArray(tipo_especifico)
          ? tipo_especifico
          : String(tipo_especifico).split(',').map((t) => t.trim());
      where.tipo_movimiento_especifico = { in: tipos };
    }

    if (estado) {
      const estados =
        Array.isArray(estado)
          ? estado
          : String(estado).split(',').map((s) => s.trim());
      where.estado = { in: estados };
    }

    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }

    // include (opt-in): include=auction,user,refund,guarantee
    const includeKeysRaw = filters?.include || '';
    const includeSet = new Set(
      String(includeKeysRaw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );

    const includePrisma = {};
    if (includeSet.has('user')) {
      includePrisma.user = {
        select: {
          first_name: true,
          last_name: true,
          document_type: true,
          document_number: true,
        },
      };
    }
    if (includeSet.has('auction')) {
      includePrisma.auction_ref = {
        select: {
          id: true,
          estado: true,
          asset: {
            select: {
              empresa_propietaria: true,
              marca: true,
              modelo: true,
              año: true,
              placa: true,
            },
          },
        },
      };
    }
    if (includeSet.has('guarantee')) {
      includePrisma.guarantee_ref = {
        select: {
          id: true,
          auction_id: true,
          user_id: true,
          posicion_ranking: true,
        },
      };
    }
    if (includeSet.has('refund')) {
      includePrisma.refund_ref = {
        select: {
          id: true,
          estado: true,
        },
      };
    }
    const prismaInclude = Object.keys(includePrisma).length ? includePrisma : undefined;

    const [movs, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.movement.count({ where }),
    ]);

    const formatted = movs.map((m) => {
      const base = {
        id: m.id,
        tipo_movimiento_general: m.tipo_movimiento_general,
        tipo_movimiento_especifico: m.tipo_movimiento_especifico,
        monto: m.monto,
        estado: m.estado,
        concepto: m.concepto,
        numero_operacion: m.numero_operacion,
        created_at: m.created_at,
        references: [
          ...(m.auction_id_ref ? [{ type: 'auction', id: m.auction_id_ref }] : []),
          ...(m.guarantee_id_ref ? [{ type: 'guarantee', id: m.guarantee_id_ref }] : []),
          ...(m.refund_id_ref ? [{ type: 'refund', id: m.refund_id_ref }] : []),
        ],
      };

      // related (opt-in vía include)
      if (includeSet.size > 0) {
        const related = {};
        if (includeSet.has('user') && m.user) {
          related.user = {
            first_name: m.user.first_name,
            last_name: m.user.last_name,
            document_type: m.user.document_type,
            document_number: m.user.document_number,
          };
        }
        if (includeSet.has('auction') && m.auction_ref) {
          related.auction = {
            id: m.auction_ref.id,
            estado: m.auction_ref.estado,
            empresa_propietaria: m.auction_ref.asset?.empresa_propietaria ?? null,
            marca: m.auction_ref.asset?.marca ?? null,
            modelo: m.auction_ref.asset?.modelo ?? null,
            año: m.auction_ref.asset?.año ?? null,
            placa: m.auction_ref.asset?.placa ?? null,
          };
        }
        if (includeSet.has('guarantee') && m.guarantee_ref) {
          related.guarantee = {
            id: m.guarantee_ref.id,
            auction_id: m.guarantee_ref.auction_id,
            user_id: m.guarantee_ref.user_id,
            posicion_ranking: m.guarantee_ref.posicion_ranking ?? null,
          };
        }
        if (includeSet.has('refund') && m.refund_ref) {
          related.refund = {
            id: m.refund_ref.id,
            estado: m.refund_ref.estado,
          };
        }
        if (Object.keys(related).length > 0) {
          base.related = related;
        }
      }

      return base;
    });

    return {
      movements: formatted,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    };
  }

  /**
   * Obtener detalle de movement (con include opt-in)
   * include CSV: auction,user,refund,guarantee
   */
  async getMovementById(movementId, userRole = 'client', userId = null, includeRaw = '') {
    // Parse include
    const includeSet = new Set(
      String(includeRaw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  
    const includePrisma = {};
    if (includeSet.has('user')) {
      includePrisma.user = {
        select: {
          first_name: true,
          last_name: true,
          document_type: true,
          document_number: true,
        },
      };
    }
    if (includeSet.has('auction')) {
      includePrisma.auction_ref = {
        select: {
          id: true,
          estado: true,
          asset: {
            select: {
              empresa_propietaria: true,
              marca: true,
              modelo: true,
              año: true,
              placa: true,
            },
          },
        },
      };
    }
    if (includeSet.has('guarantee')) {
      includePrisma.guarantee_ref = {
        select: {
          id: true,
          auction_id: true,
          user_id: true,
          posicion_ranking: true,
        },
      };
    }
    if (includeSet.has('refund')) {
      includePrisma.refund_ref = {
        select: {
          id: true,
          estado: true,
        },
      };
    }
  
    const prismaInclude = Object.keys(includePrisma).length ? includePrisma : undefined;
  
    const m = await prisma.movement.findUnique({
      where: { id: movementId },
      include: prismaInclude,
    });
    if (!m) throw new NotFoundError('Movement');
  
    if (userRole === 'client' && userId && m.user_id !== userId) {
      throw new ConflictError('No tiene permisos para ver este movement', 'FORBIDDEN');
    }
  
    const result = {
      ...m,
      references: [
        ...(m.auction_id_ref ? [{ type: 'auction', id: m.auction_id_ref }] : []),
        ...(m.guarantee_id_ref ? [{ type: 'guarantee', id: m.guarantee_id_ref }] : []),
        ...(m.refund_id_ref ? [{ type: 'refund', id: m.refund_id_ref }] : []),
      ],
    };
  
    if (includeSet.size > 0) {
      const related = {};
      if (includeSet.has('user') && m.user) {
        related.user = {
          first_name: m.user.first_name,
          last_name: m.user.last_name,
          document_type: m.user.document_type,
          document_number: m.user.document_number,
        };
      }
      if (includeSet.has('auction') && m.auction_ref) {
        related.auction = {
          id: m.auction_ref.id,
          estado: m.auction_ref.estado,
          empresa_propietaria: m.auction_ref.asset?.empresa_propietaria ?? null,
          marca: m.auction_ref.asset?.marca ?? null,
          modelo: m.auction_ref.asset?.modelo ?? null,
          año: m.auction_ref.asset?.año ?? null,
          placa: m.auction_ref.asset?.placa ?? null,
        };
      }
      if (includeSet.has('guarantee') && m.guarantee_ref) {
        related.guarantee = {
          id: m.guarantee_ref.id,
          auction_id: m.guarantee_ref.auction_id,
          user_id: m.guarantee_ref.user_id,
          posicion_ranking: m.guarantee_ref.posicion_ranking ?? null,
        };
      }
      if (includeSet.has('refund') && m.refund_ref) {
        related.refund = {
          id: m.refund_ref.id,
          estado: m.refund_ref.estado,
        };
      }
      if (Object.keys(related).length > 0) {
        result.related = related;
      }
    }
  
    return result;
  }

  // -----------------------
  // Helpers internos (cache)
  // -----------------------

  /**
   * Recalcula y actualiza User.saldo_total = sum(entradas validadas) - sum(salidas validadas)
   */
  async _recalcularSaldoTotalTx(tx, userId) {
    // Unificación de regla: excluir entradas 'reembolso' para no inflar saldo_total
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

  /**
   * Recalcula y actualiza User.saldo_retenido (RN07):
   * retenido = sum(pagos_garantia validados en subastas con estado en
   * ['finalizada','ganada','perdida','penalizada']) - sum(reembolsos validados (entrada o salida)).
   * 'facturada' NO retiene.
   */
  async _recalcularSaldoRetenidoTx(tx, userId) {
    // 1) Retención por subastas: garantías validadas - reembolsos validados (entrada o salida)
    const offers = await tx.guarantee.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        auction: { select: { id: true, estado: true } },
      },
    });

    const retenedorStates = new Set(['finalizada', 'ganada', 'perdida']);
    const auctionIdsToRetain = offers
      .filter((o) => o.auction && retenedorStates.has(o.auction.estado))
      .map((o) => o.auction.id);

    let sumGarantias = 0;
    if (auctionIdsToRetain.length > 0) {
      const guaranteeMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          auction_id_ref: { in: auctionIdsToRetain },
        },
        select: { monto: true },
      });
      sumGarantias = guaranteeMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    let sumReembolsos = 0;
    if (auctionIdsToRetain.length > 0) {
      const refundMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          // considerar cualquier 'reembolso' (entrada o salida)
          tipo_movimiento_especifico: 'reembolso',
          auction_id_ref: { in: auctionIdsToRetain },
        },
        select: { monto: true },
      });
      sumReembolsos = refundMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    const retenidoSubastas = Number(Math.max(0, sumGarantias - sumReembolsos).toFixed(2));

    // 2) Retención por solicitudes de reembolso en curso (solicitado|confirmado)
    const pendingRefundsAgg = await tx.refund.aggregate({
      _sum: { monto_solicitado: true },
      where: {
        user_id: userId,
        estado: { in: ['solicitado', 'confirmado'] },
      },
    });
    const retenidoSolicitudes = Number(pendingRefundsAgg._sum.monto_solicitado || 0);

    const saldoRetenido = Number((retenidoSubastas + retenidoSolicitudes).toFixed(2));

    await tx.user.update({
      where: { id: userId },
      data: { saldo_retenido: saldoRetenido },
    });

    return saldoRetenido;
  }

  /**
   * Notificación segura: intenta crear Notification (y enviar email) si existe notificationService/emailService
   * Para no bloquear el flujo si aún no está implementado, atrapa errores y loggea.
   */
  async _notifySafe(tipo, { tx, user_id, titulo, mensaje, reference_type, reference_id }) {
    try {
      // Crear notificación (persistencia) usando el cliente disponible
      const db = tx || prisma;
      const notif = await db.notification.create({
        data: {
          user_id,
          tipo,
          titulo,
          mensaje,
          estado: 'pendiente',
          email_status: 'pendiente',
          reference_type: reference_type ?? null,
          reference_id: reference_id ?? null,
        },
      });

      // Enviar correo fuera de la transacción para evitar timeouts P2028/expired tx
      setTimeout(async () => {
        try {
          // Lazy import para no romper si no existe
          // eslint-disable-next-line global-require, import/no-dynamic-require
          const emailService = require('./emailService');
          await emailService.send({
            toUserId: user_id,
            subject: titulo,
            body: mensaje,
          });

          await prisma.notification.update({
            where: { id: notif.id },
            data: {
              email_status: 'enviado',
              email_sent_at: new Date(),
            },
          });
        } catch (emailErr) {
          Logger.warn(`Fallo envío de correo para notificación ${tipo}: ${emailErr.message || 'undefined'}`);
          try {
            await prisma.notification.update({
              where: { id: notif.id },
              data: {
                email_status: 'fallido',
                email_error: emailErr?.message?.slice(0, 300) ?? 'unknown_error',
              },
            });
          } catch (updErr) {
            Logger.warn(`No se pudo actualizar estado de email para notificación (${tipo}): ${updErr.message}`);
          }
        }
      }, 200);
    } catch (err) {
      Logger.warn(`No se pudo crear/enviar notificación (${tipo}): ${err.message}`);
    }
  }
}

module.exports = new MovementService();