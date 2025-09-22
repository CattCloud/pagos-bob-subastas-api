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
const { paginationHelpers } = require('../utils');

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
    const { monto_solicitado, motivo, auction_id } = payload;

    Logger.info(`Cliente ${userId} solicitando reembolso`, {
      monto_solicitado,
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

      // Nota: No validar contra saldo_disponible global aquí.
      // La validación correcta se realiza contra el saldo retenido por subasta (RN07) más abajo.
      // Esto permite solicitar reembolso incluso si el saldo_disponible es 0,
      // siempre que exista retenido pendiente asociado a la subasta.

      // Validar contra saldo_disponible actual (saldo_total - saldo_retenido - aplicado)
      const userCache = await tx.user.findUnique({
        where: { id: userId },
        select: { saldo_total: true, saldo_retenido: true },
      });
      const appliedAgg = await tx.billing.aggregate({
        _sum: { monto: true },
        where: { user_id: userId },
      });
      const saldo_total = Number(userCache?.saldo_total || 0);
      const saldo_retenido = Number(userCache?.saldo_retenido || 0);
      const saldo_aplicado = Number(appliedAgg._sum.monto || 0);
      const saldo_disponible = Number((saldo_total - saldo_retenido - saldo_aplicado).toFixed(2));

      if (Number(monto_solicitado) > saldo_disponible) {
        throw new ConflictError(
          `Monto solicitado excede el saldo disponible ($${saldo_disponible})`,
          'REFUND_AMOUNT_EXCEEDS_AVAILABLE'
        );
      }

      const refund = await tx.refund.create({
        data: {
          user_id: userId,
          monto_solicitado: Number(monto_solicitado),
          estado: 'solicitado',
          motivo: motivo || null,
          ...(auction_id ? { auction_id } : {}),
        },
      });

      // Retención inmediata: al solicitar reembolso, el monto queda retenido
      await this._recalcularSaldoRetenidoTx(tx, userId);

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
          mensaje: `Cliente solicitó reembolso de $${monto_solicitado}`,
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
          motivo_rechazo: estado === 'rechazado' ? (motivo || 'Rechazado por políticas') : null,
        },
      });

      // Si se rechaza, liberar retención; si se confirma, mantenerla
      await this._recalcularSaldoRetenidoTx(tx, refund.user_id);

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
  
    // Modalidad de procesamiento:
    // - devolver_dinero: cuando se proporciona numero_operacion válido
    // - mantener_saldo: cuando NO se proporciona numero_operacion
    const isDevolverDinero = typeof numero_operacion === 'string' && numero_operacion.length >= 3;
  
    // Prefetch fuera de la transacción para obtener user_id/auction_id y evitar subir voucher dentro de la TX
    const pre = await prisma.refund.findUnique({
      where: { id: refundId },
      select: { user_id: true, auction_id: true, estado: true, monto_solicitado: true },
    });
    if (!pre) throw new NotFoundError('Refund');
    if (pre.estado !== 'confirmado') {
      throw new ConflictError(
        `Solo se puede procesar refund en estado 'confirmado' (actual: ${pre.estado})`,
        'INVALID_REFUND_STATE'
      );
    }
  
    // Subir voucher (si aplica) FUERA de la transacción para evitar P2028
    let voucherUrl = null;
    if (voucherFile?.buffer) {
      try {
        const uploadResult = await uploadToCloudinary(
          voucherFile.buffer,
          voucherFile.originalname || 'refund_voucher',
          pre.user_id || 'unknown'
        );
        voucherUrl = uploadResult.secure_url;
      } catch (err) {
        throw new ConflictError('Error al procesar el comprobante del reembolso', 'UPLOAD_ERROR');
      }
    }
  
    // Operaciones de BD dentro de una sola transacción
    return prisma.$transaction(async (tx) => {
      // Releer estado actual dentro de la TX para garantizar consistencia
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
  
      // Validación de seguridad basada en reservas/retenido (RN07)
      const userCache = await tx.user.findUnique({
        where: { id: userId },
        select: { saldo_total: true, saldo_retenido: true },
      });
      const appliedAgg = await tx.billing.aggregate({
        _sum: { monto: true },
        where: { user_id: userId },
      });
      const saldo_total = Number(userCache?.saldo_total || 0);
      const saldo_retenido = Number(userCache?.saldo_retenido || 0);
      const saldo_aplicado = Number(appliedAgg._sum.monto || 0);
      const saldo_disponible = Number((saldo_total - saldo_retenido - saldo_aplicado).toFixed(2));
      const safetyAvailable = Number((saldo_disponible + Number(refund.monto_solicitado)).toFixed(2));
  
      if (Number(refund.monto_solicitado) > safetyAvailable) {
        throw new ConflictError(
          `Saldo reservado insuficiente para procesar el reembolso (disp+retenido_solicitud=$${safetyAvailable})`,
          'INSUFFICIENT_RESERVED_BALANCE'
        );
      }
  
      const movementConcept = `${isDevolverDinero ? 'Reembolso transferido - ' : 'Reembolso como saldo - '}${(refund.motivo || '').trim()}`.trim();
  
      // Heurística RN07 para compatibilizar flujos:
      // - devolver_dinero: si hay múltiples subastas retenedoras, asociamos la salida a la subasta del refund
      //   para reflejar liberación adicional (puede resultar en retenido negativo, esperado en Flow 6).
      //   si solo hay una subasta retenedora, no asociamos (Flow 2 espera retenido sin cambio).
      // - mantener_saldo: asociamos a la subasta para liberar retenido de esa subasta.
      const guaranteesForUser = await tx.guarantee.findMany({
        where: { user_id: userId },
        select: { auction: { select: { id: true, estado: true } } },
      });
      const retainStates = new Set(['finalizada', 'ganada', 'perdida']);
      const retainedAuctionIds = guaranteesForUser
        .filter((o) => o.auction && retainStates.has(o.auction.estado))
        .map((o) => o.auction.id);
      const attachAuctionRefForSalida = isDevolverDinero && retainedAuctionIds.length > 1;
      const auctionRefToUse = isDevolverDinero
        ? (attachAuctionRefForSalida ? (refund.auction_id ?? null) : null)
        : (refund.auction_id ?? null);
  
      // Crear Movement validado con referencias directas
      const movement = await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento_general: isDevolverDinero ? 'salida' : 'entrada',
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
          numero_operacion: isDevolverDinero ? numero_operacion : null,
          auction_id_ref: auctionRefToUse,
          refund_id_ref: refundId,
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
  
      // Recalcular saldo_total y retenido según RN07
      await this._recalcularSaldoTotalTx(tx, userId);
      const retenidoAfter = await this._recalcularSaldoRetenidoTx(tx, userId);
      // Caso mantener_saldo: si por efectos combinados el retenido quedó negativo, normalizar a 0
      if (!isDevolverDinero && Number(retenidoAfter) < 0) {
        await tx.user.update({
          where: { id: userId },
          data: { saldo_retenido: 0 },
        });
      }
  
      // Notificar cliente: reembolso_procesado
      await notificationService.createAndSend({
        tx,
        user_id: userId,
        tipo: 'reembolso_procesado',
        titulo: 'Reembolso procesado',
        mensaje: `Se procesó su reembolso #${refundId} y el dinero fue transferido.`,
        reference_type: 'refund',
        reference_id: refundId,
      });
  
      return { refund: processed, movement };
    });
  }

  // ---------------------------------------
  // Listados y detalle con include opt-in
  // include CSV: user,auction
  // ---------------------------------------
  _buildIncludeForRefunds(includeRaw = '') {
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
          id: true,
          first_name: true,
          last_name: true,
          document_type: true,
          document_number: true,
        },
      };
    }
    if (includeSet.has('auction')) {
      includePrisma.auction = {
        select: {
          id: true,
          asset: {
            select: {
              placa: true,
              empresa_propietaria: true,
              marca: true,
              modelo: true,
              año: true,
            },
          },
        },
      };
    }
  
    return { includeSet, prismaInclude: Object.keys(includePrisma).length ? includePrisma : undefined };
  }
  
  _mapRefundResponse(r, includeSet) {
    const base = {
      id: r.id,
      user_id: r.user_id,
      auction_id: r.auction_id ?? null,
      monto_solicitado: r.monto_solicitado,
      estado: r.estado,
      fecha_respuesta_empresa: r.fecha_respuesta_empresa ?? null,
      fecha_procesamiento: r.fecha_procesamiento ?? null,
      motivo: r.motivo ?? null,
      motivo_rechazo: r.motivo_rechazo ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      references: {
        user_id: r.user_id,
        auction_id: r.auction_id ?? null,
      },
    };
  
    if (includeSet && includeSet.size > 0) {
      const related = {};
      if (includeSet.has('user') && r.user) {
        related.user = {
          id: r.user.id,
          first_name: r.user.first_name,
          last_name: r.user.last_name,
          document_type: r.user.document_type,
          document_number: r.user.document_number,
        };
      }
      if (includeSet.has('auction') && r.auction) {
        related.auction = {
          id: r.auction.id,
          placa: r.auction.asset?.placa ?? null,
          empresa_propietaria: r.auction.asset?.empresa_propietaria ?? null,
          marca: r.auction.asset?.marca ?? null,
          modelo: r.auction.asset?.modelo ?? null,
          año: r.auction.asset?.año ?? null,
        };
      }
      if (Object.keys(related).length > 0) base.related = related;
    }
  
    return base;
  }
  
  /**
   * Listar solicitudes de reembolso (Refunds) para Admin o Cliente
   * - Admin: puede ver todos y filtrar por user_id/auction_id/estado/fechas
   * - Cliente: solo ve sus propias solicitudes (se ignora user_id si lo envía)
   * Filtros: estado, user_id (admin), auction_id, fecha_desde, fecha_hasta, page, limit, include=user,auction
   */
  async listRefunds(requestingUser, filters = {}) {
    const {
      page = 1,
      limit = 20,
      estado,
      user_id,
      auction_id,
      fecha_desde,
      fecha_hasta,
      include = '',
    } = filters;
  
    const offset = paginationHelpers.calculateOffset(page, limit);
  
    // Construir filtros
    const where = {};
  
    // Visibilidad por rol
    if (requestingUser?.user_type === 'admin') {
      if (user_id) where.user_id = user_id;
    } else {
      // Cliente: restringir a su propio user_id
      where.user_id = requestingUser.id;
    }
  
    if (estado) {
      const estados = Array.isArray(estado) ? estado : (typeof estado === 'string' ? estado.split(',').map(s => s.trim()) : []);
      if (estados.length > 0) where.estado = { in: estados };
    }
  
    if (auction_id) {
      where.auction_id = auction_id;
    }
  
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
  
    const { includeSet, prismaInclude } = this._buildIncludeForRefunds(include);
  
    // Ejecutar consulta con paginación
    const [items, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.refund.count({ where }),
    ]);
  
    const refunds = items.map((r) => this._mapRefundResponse(r, includeSet));
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
  
    return { refunds, pagination };
  }
  
  /**
   * Listar reembolsos por usuario específico
   * - Admin: cualquiera
   * - Cliente: solo el propio
   */
  async getRefundsByUser(targetUserId, filters = {}, requesterRole = 'client', requesterId = null) {
    if (requesterRole === 'client' && requesterId && requesterId !== targetUserId) {
      throw new ConflictError('No tiene permisos para ver reembolsos de este usuario', 'FORBIDDEN');
    }
  
    const {
      page = 1,
      limit = 20,
      estado,
      auction_id,
      fecha_desde,
      fecha_hasta,
      include = '',
    } = filters;
  
    const offset = paginationHelpers.calculateOffset(page, limit);
  
    const where = { user_id: targetUserId };
  
    if (estado) {
      const estados = Array.isArray(estado) ? estado : (typeof estado === 'string' ? estado.split(',').map(s => s.trim()) : []);
      if (estados.length > 0) where.estado = { in: estados };
    }
  
    if (auction_id) {
      where.auction_id = auction_id;
    }
  
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
  
    const { includeSet, prismaInclude } = this._buildIncludeForRefunds(include);
  
    const [items, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.refund.count({ where }),
    ]);
  
    const refunds = items.map((r) => this._mapRefundResponse(r, includeSet));
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
  
    return { refunds, pagination };
  }
  
  /**
   * Detalle de refund (Admin: cualquiera; Client: solo propio)
   * include CSV: user,auction
   */
  async getRefundById(refundId, requesterRole = 'client', requesterId = null, include = '') {
    const { includeSet, prismaInclude } = this._buildIncludeForRefunds(include);
  
    const r = await prisma.refund.findUnique({
      where: { id: refundId },
      include: prismaInclude,
    });
    if (!r) throw new NotFoundError('Refund');
  
    if (requesterRole === 'client' && requesterId && r.user_id !== requesterId) {
      throw new ConflictError('No tiene permisos para ver este reembolso', 'FORBIDDEN');
    }
  
    return this._mapRefundResponse(r, includeSet);
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
    // 1) Retención por subastas (garantías validadas - reembolsos validados)
    const guarantees = await tx.guarantee.findMany({
      where: { user_id: userId },
      select: {
        auction: { select: { id: true, estado: true } },
      },
    });

    const retenedorStates = new Set(['finalizada', 'ganada', 'perdida']);
    const auctionIdsToRetain = guarantees
      .filter((o) => o.auction && retenedorStates.has(o.auction.estado))
      .map((o) => o.auction.id);

    let sumGarantias = 0;
    if (auctionIdsToRetain.length > 0) {
      const validatedGuaranteeMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          auction_id_ref: { in: auctionIdsToRetain },
        },
        select: { monto: true },
      });
      sumGarantias = validatedGuaranteeMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    let sumReembolsos = 0;
    if (auctionIdsToRetain.length > 0) {
      const refundMovs = await tx.movement.findMany({
        where: {
          user_id: userId,
          estado: 'validado',
          tipo_movimiento_especifico: 'reembolso',
          auction_id_ref: { in: auctionIdsToRetain },
          OR: [
            // contar siempre salidas (devolver_dinero)
            { tipo_movimiento_general: 'salida' },
            // contar entradas solo si NO provienen de un refund procesado (mantener_saldo = refund_id_ref != null)
            { AND: [{ tipo_movimiento_general: 'entrada' }, { refund_id_ref: null }] },
          ],
        },
        select: { monto: true },
      });
      sumReembolsos = refundMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0);
    }

    const retenidoSubastas = Number((sumGarantias - sumReembolsos).toFixed(2));

    // 2) Retención por solicitudes de reembolso (solicitado|confirmado)
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
}

module.exports = new RefundService();