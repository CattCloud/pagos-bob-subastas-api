const { prisma } = require('../config/database');
const {
  BusinessErrors,
  NotFoundError,
  ConflictError,
} = require('../middleware/errorHandler');
const {
  businessCalculations,
  formatters,
  paginationHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class BalanceService {
  /**
   * Obtener saldo de un usuario con la nueva fórmula:
   * Saldo Disponible = saldo_total(User) - saldo_retenido(User) - SUM(Billing.monto)
   */
  async getBalance(userId) {
    Logger.info(`Consultando saldo del usuario ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        document_type: true,
        document_number: true,
        saldo_total: true,
        saldo_retenido: true,
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Usuario');
    }

    // 3) Calcular saldo_aplicado desde Billing
    const appliedAgg = await prisma.billing.aggregate({
      _sum: { monto: true },
      where: { user_id: userId },
    });

    const saldo_aplicado = Number(appliedAgg._sum.monto || 0);
    const saldo_total = Number(user.saldo_total || 0);
    const saldo_retenido = Number(user.saldo_retenido || 0);
    const saldo_disponible = Number(
      (saldo_total - saldo_retenido - saldo_aplicado).toFixed(2)
    );

    return {
      user_id: userId,
      user: {
        name: formatters.fullName(user),
        document: formatters.document(user.document_type, user.document_number),
      },
      saldo_total,
      saldo_retenido,
      saldo_aplicado,
      saldo_disponible,
      updated_at: user.updated_at,
    };
  }

  /**
   * Obtener movimientos de un usuario (Movement) con filtros
   */
  async getUserMovements(userId, filters = {}) {
    const {
      tipo_especifico, // 'pago_garantia,reembolso,penalidad,ajuste_manual'
      estado, // 'pendiente,validado,rechazado'
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20,
    } = filters;

    const offset = paginationHelpers.calculateOffset(page, limit);

    Logger.info(`Consultando movements del usuario ${userId}`, { filters });

    const where = { user_id: userId };

    if (tipo_especifico) {
      const tipos = Array.isArray(tipo_especifico)
        ? tipo_especifico
        : String(tipo_especifico).split(',').map((t) => t.trim());
      where.tipo_movimiento_especifico = { in: tipos };
    }

    if (estado) {
      const estados = Array.isArray(estado)
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
          id: true,
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

    const [movements, total] = await Promise.all([
      prisma.movement.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.movement.count({ where }),
    ]);

    const formattedMovements = movements.map((m) => {
      const base = {
        id: m.id,
        tipo_movimiento_general: m.tipo_movimiento_general,
        tipo_movimiento_especifico: m.tipo_movimiento_especifico,
        monto: m.monto,
        moneda: m.moneda,
        estado: m.estado,
        concepto: m.concepto,
        numero_operacion: m.numero_operacion,
        fecha_pago: m.fecha_pago,
        fecha_resolucion: m.fecha_resolucion,
        motivo_rechazo: m.motivo_rechazo,
        created_at: m.created_at,
        references: {
          auction_id: m.auction_id_ref || null,
          guarantee_id: m.guarantee_id_ref || null,
          refund_id: m.refund_id_ref || null,
        },
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
          base.related = related;
        }
      }

      return base;
    });

    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);

    return { movements: formattedMovements, pagination };
  }

  /**
   * Resumen de saldos para admin (paginado)
   * Usa cache en User + cálculo de aplicado desde Billing
   */
  async getBalancesSummary(filters = {}) {
    const { page = 1, limit = 20, search } = filters;
    const offset = paginationHelpers.calculateOffset(page, limit);

    Logger.info('Consultando resumen de saldos para admin', { filters });

    const where = { user_type: 'client' };
    
    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { document_number: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          document_type: true,
          document_number: true,
          email: true,
          phone_number: true,
          saldo_total: true,
          saldo_retenido: true,
          updated_at: true,
        },
        orderBy: { saldo_total: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    // Calcular saldo_aplicado por usuario (Billing)
    const balances = [];
    for (const u of users) {
      const appliedAgg = await prisma.billing.aggregate({
        _sum: { monto: true },
        where: { user_id: u.id },
      });
      const saldo_aplicado = Number(appliedAgg._sum.monto || 0);
      const saldo_total = Number(u.saldo_total || 0);
      const saldo_retenido = Number(u.saldo_retenido || 0);
      const saldo_disponible = Number(
        (saldo_total - saldo_retenido - saldo_aplicado).toFixed(2)
      );

      balances.push({
        user: {
          id: u.id,
          name: formatters.fullName(u),
          document: (u.document_type && u.document_number) ? `${u.document_type}: ${u.document_number}` : (u.document_number ?? ''),
          email: u.email,
          phone: u.phone_number,
        },
        balance: {
          saldo_total,
          saldo_retenido,
          saldo_aplicado,
          saldo_disponible,
        },
        updated_at: u.updated_at,
      });
    }

    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    return { balances, pagination };
  }

  /**
   * Estadísticas globales de saldos con nueva arquitectura
   */
  async getBalanceStats() {
    Logger.info('Calculando estadísticas de saldos (nueva arquitectura)');

    const [userAgg, billingAgg, usersWithBalanceCount, movementsThisMonth] = await Promise.all([
      prisma.user.aggregate({
        where: { user_type: 'client' },
        _sum: {
          saldo_total: true,
          saldo_retenido: true,
        },
        _count: { id: true },
      }),
      prisma.billing.aggregate({
        where: { user: { user_type: 'client' } },
        _sum: { monto: true },
      }),
      prisma.user.count({
        where: { user_type: 'client', saldo_total: { gt: 0 } },
      }),
      (async () => {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        return prisma.movement.count({
          where: {
            created_at: {
              gte: currentMonth,
            },
          },
        });
      })(),
    ]);

    const saldo_total_sistema = Number(userAgg._sum.saldo_total || 0);
    const saldo_retenido_total = Number(userAgg._sum.saldo_retenido || 0);
    const saldo_aplicado_total = Number(billingAgg._sum.monto || 0);
    const saldo_disponible_total = Number(
      (saldo_total_sistema - saldo_retenido_total - saldo_aplicado_total).toFixed(2)
    );

    return {
      saldo_total_sistema,
      saldo_retenido_total,
      saldo_aplicado_total,
      saldo_disponible_total,
      total_usuarios_con_saldo: usersWithBalanceCount,
      total_usuarios: userAgg._count.id,
      movimientos_mes_actual: movementsThisMonth,
    };
  }

  /**
   * Crear ajuste manual como Movement validado (admin)
   * - ajuste_positivo: entrada/ajuste_manual
   * - ajuste_negativo: salida/ajuste_manual
   * - penalidad_manual: salida/penalidad
   */
  async createManualMovement(userId, movementData, adminUserId) {
    const { tipo_movimiento, monto, descripcion, motivo } = movementData;

    Logger.info(`Admin ${adminUserId} creando movimiento manual para usuario ${userId}`, {
      tipo: tipo_movimiento,
      monto,
      motivo,
    });

    if (typeof monto !== 'number' || monto <= 0) {
      throw new ConflictError('El monto debe ser un número positivo', 'INVALID_AMOUNT');
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId, user_type: 'client' },
      });
      if (!user) {
        throw BusinessErrors.UserNotFound ? BusinessErrors.UserNotFound() : new NotFoundError('Usuario');
      }

      let general = 'entrada';
      let especifico = 'ajuste_manual';
      let amount = Math.abs(monto);

      switch (tipo_movimiento) {
        case 'ajuste_positivo':
          general = 'entrada';
          especifico = 'ajuste_manual';
          break;
        case 'ajuste_negativo':
          general = 'salida';
          especifico = 'ajuste_manual';
          break;
        case 'penalidad_manual':
          general = 'salida';
          especifico = 'penalidad';
          break;
        default:
          throw new ConflictError(
            `Tipo de movimiento manual no válido: ${tipo_movimiento}`,
            'INVALID_MANUAL_MOVEMENT_TYPE'
          );
      }

      // Crear movement ya validado (afecta inmediatamente el saldo_total)
      const movement = await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento_general: general,
          tipo_movimiento_especifico: especifico,
          monto: amount,
          moneda: 'USD',
          tipo_pago: null,
          numero_cuenta_origen: null,
          voucher_url: null,
          concepto: `${descripcion} - Ajuste manual${motivo ? ` (${motivo})` : ''}`,
          estado: 'validado',
          fecha_pago: new Date(),
          fecha_resolucion: new Date(),
          motivo_rechazo: null,
          numero_operacion: null,
        },
      });

      // Sin referencias adicionales; Movement usa FKs directos (auction_id_ref, guarantee_id_ref, refund_id_ref)

      // Recalcular cache de saldo_total y saldo_retenido
      const saldo_total = await this._recalcularSaldoTotalTx(tx, userId);
      const saldo_retenido = await this._recalcularSaldoRetenidoTx(tx, userId);

      return {
        movement,
        updated_user_cache: {
          saldo_total,
          saldo_retenido,
        },
        user: {
          name: formatters.fullName(user),
          document: formatters.document(user.document_type, user.document_number),
        },
      };
    });
  }

  // -----------------------
  // Helpers internos de recálculo
  // -----------------------

  /**
   * Recalcula y actualiza User.saldo_total = sum(entradas validadas) - sum(salidas validadas)
   */
  async _recalcularSaldoTotalTx(tx, userId) {
    const entradas = await tx.movement.aggregate({
      _sum: { monto: true },
      where: {
        user_id: userId,
        estado: 'validado',
        tipo_movimiento_general: 'entrada',
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
   * Recalcula y actualiza User.saldo_retenido.
   * Regla RN07:
   *   - Retenemos garantías validadas de subastas en estados: ['finalizada','ganada','perdida','penalizada'].
   *   - 'facturada' NO retiene.
   *   - La retención efectiva se reduce por reembolsos ya procesados (salida/reembolso validados).
   */
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
          // Considerar cualquier 'reembolso' (entrada o salida) para liberar retenido
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
}

module.exports = new BalanceService();