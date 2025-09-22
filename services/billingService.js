const { prisma } = require('../config/database');
const { Logger } = require('../middleware/logger');
const {
  BusinessErrors,
  ConflictError,
  NotFoundError,
} = require('../middleware/errorHandler');
const { businessCalculations, formatters } = require('../utils');
const notificationService = require('./notificationService');

/**
 * Servicio de Billing (facturación)
 * - Flujo legacy: createBilling (mantiene compatibilidad si se usa)
 * - Flujo nuevo:
 *    - HU-COMP-02: Billing parcial creado automáticamente (auctionService)
 *    - HU-BILL-01: completeBilling → completa datos, marca subasta como 'facturada' y notifica
 */
class BillingService {

  /**
   * Crear Billing (flujo legacy). Mantener para compatibilidad si alguna UI lo usa.
   */
  async createBilling(userId, payload) {
    const {
      auction_id,
      billing_document_type,
      billing_document_number,
      billing_name,
    } = payload;

    Logger.info(`Cliente ${userId} creando Billing para subasta ${auction_id}`);

    return prisma.$transaction(async (tx) => {
      // 1) Cargar subasta + asset + guarantees
      const auction = await tx.auction.findUnique({
        where: { id: auction_id },
        include: {
          asset: true,
          guarantees: true,
        },
      });

      if (!auction) throw BusinessErrors.AuctionNotFound();

      // VN-01: Solo permitir si subasta está en estado 'ganada'
      if (auction.estado !== 'ganada') {
        throw new ConflictError(
          `Solo se puede facturar una subasta en estado 'ganada' (actual: ${auction.estado})`,
          'AUCTION_NOT_WON'
        );
      }

      // VN-02: Verificar ganador
      const winningGuaranteeId = auction.id_offerWin;
      const winningGuarantee = auction.guarantees.find((o) => o.id === winningGuaranteeId);
      if (!winningGuarantee || winningGuarantee.user_id !== userId) {
        throw new ConflictError(
          'Solo el ganador puede completar datos de facturación para esta subasta',
          'NOT_WINNER'
        );
      }

      // VN-06: No debe existir Billing previo para esta subasta
      const existingBilling = await tx.billing.findFirst({
        where: { auction_id, user_id: userId },
      });
      if (existingBilling) {
        throw new ConflictError(
          'Ya existe un Billing para esta subasta',
          'BILLING_ALREADY_EXISTS'
        );
      }

      // VN-05: No permitir duplicar billing_document_number para el mismo cliente
      const dupDoc = await tx.billing.findFirst({
        where: { user_id: userId, billing_document_number },
      });
      if (dupDoc) {
        throw new ConflictError(
          'El número de documento de facturación ya fue usado por este usuario',
          'DUPLICATE_BILLING_DOCUMENT'
        );
      }

      // Calcular monto a facturar = monto de garantía para esta subasta
      // Preferimos la suma de movimientos validados de 'pago_garantia' asociados a esta subasta.
      const agg = await tx.movement.aggregate({
        _sum: { monto: true },
        where: {
          user_id: userId,
          estado: 'validado',
          tipo_movimiento_general: 'entrada',
          tipo_movimiento_especifico: 'pago_garantia',
          auction_id_ref: auction_id,
        },
      });

      let montoGarantia = Number(agg._sum.monto || 0);
      // Fallback: si no encuentra movimientos (consistencia), calcular 8% de la oferta ganadora
      if (montoGarantia <= 0) {
        montoGarantia = businessCalculations.calculateGuaranteeAmount(Number(winningGuarantee.monto_oferta));
      }

      // Concepto: "Compra vehículo [marca] [modelo] [año] - Subasta #[id]"
      const concepto =
        `Compra vehículo ${auction.asset?.marca ?? ''} ${auction.asset?.modelo ?? ''} ${auction.asset?.año ?? ''} - Subasta #${auction.id}`;

      // 2) Crear Billing (completo)
      const billing = await tx.billing.create({
        data: {
          user_id: userId,
          billing_document_type,
          billing_document_number,
          billing_name,
          monto: montoGarantia,
          moneda: 'USD',
          concepto,
          auction_id,
        },
      });

      // 3) Actualizar subasta -> 'facturada'
      const updatedAuction = await tx.auction.update({
        where: { id: auction_id },
        data: { estado: 'facturada' },
        include: { asset: true },
      });

      // 4) Liberar retención solo de esta subasta específica (enfoque incremental)
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { saldo_retenido: true },
      });
      const newRetenido = Number(
        Math.max(0, Number(currentUser?.saldo_retenido || 0) - montoGarantia).toFixed(2)
      );
      await tx.user.update({
        where: { id: userId },
        data: { saldo_retenido: newRetenido },
      });

      // 5) Notificaciones
      // Cliente: facturacion_completada
      await notificationService.createAndSend({
        tx,
        user_id: userId,
        tipo: 'facturacion_completada',
        titulo: 'Facturación completada',
        mensaje: `Se registraron sus datos de facturación para la subasta ${updatedAuction.asset?.placa ?? ''}.` +
                 ` Su garantía fue aplicada.`,
        reference_type: 'billing',
        reference_id: billing.id,
      });

      // Admin: billing_generado (enviar al primer admin)
      const admin = await tx.user.findFirst({
        where: { user_type: 'admin' },
        select: { id: true, email: true, first_name: true, last_name: true },
      });
      if (admin) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { first_name: true, last_name: true, document_type: true, document_number: true },
        });
        const cliente = user ? formatters.fullName(user) : userId;
        await notificationService.createAndSend({
          tx,
          user_id: admin.id,
          tipo: 'billing_generado',
          titulo: 'Billing generado',
          mensaje: `Se generó Billing para ${cliente} - Subasta ${updatedAuction.asset?.placa ?? ''}. Monto aplicado: $${montoGarantia}`,
          reference_type: 'billing',
          reference_id: billing.id,
        });
      }

      return {
        billing,
        auction: updatedAuction,
      };
    });
  }

  /**
   * HU-BILL-01 — Completar Datos de Facturación sobre un Billing existente (cliente o admin)
   * - Actualiza billing_document_type, billing_document_number, billing_name
   * - Marca la subasta como 'facturada'
   * - No recalcula saldo_retenido (ya fue liberado en HU-COMP-02)
   * - Notifica a cliente (facturacion_completada) y admin (billing_generado)
   */
  async completeBilling(billingId, requesterRole = 'client', requesterId = null, payload) {
    const {
      billing_document_type,
      billing_document_number,
      billing_name,
    } = payload;

    return prisma.$transaction(async (tx) => {
      // Cargar billing + usuario + subasta
      const billing = await tx.billing.findUnique({
        where: { id: billingId },
        include: {
          auction: { include: { asset: true } },
        },
      });
      if (!billing) {
        throw new NotFoundError('Billing');
      }

      // Seguridad: Cliente solo su propio billing. Admin cualquiera.
      if (requesterRole === 'client' && requesterId && billing.user_id !== requesterId) {
        throw new ConflictError('No tiene permisos para modificar esta facturación', 'FORBIDDEN');
      }

      // VN-07: Verificar que el Billing tiene datos pendientes
      if (billing.billing_document_type && billing.billing_document_number && billing.billing_name) {
        throw new ConflictError('Este Billing ya está completado', 'BILLING_ALREADY_COMPLETED');
      }

      // VN-06: No permitir duplicar billing_document_number para el mismo usuario
      if (billing_document_number) {
        const dupDoc = await tx.billing.findFirst({
          where: {
            user_id: billing.user_id,
            billing_document_number,
            // Evitar choque con sí mismo si fuese un retry
            NOT: { id: billing.id },
          },
        });
        if (dupDoc) {
          throw new ConflictError(
            'El número de documento de facturación ya fue usado por este usuario',
            'DUPLICATE_BILLING_DOCUMENT'
          );
        }
      }

      // Actualizar datos de facturación
      const updatedBilling = await tx.billing.update({
        where: { id: billing.id },
        data: {
          billing_document_type,
          billing_document_number,
          billing_name,
        },
      });

      // Marcar subasta como 'facturada' (si todavía no lo está)
      if (billing.auction_id) {
        const auction = await tx.auction.findUnique({ where: { id: billing.auction_id }, select: { estado: true } });
        if (auction && auction.estado !== 'facturada') {
          await tx.auction.update({
            where: { id: billing.auction_id },
            data: { estado: 'facturada' },
          });
        }
      }

      // Notificaciones
      // Cliente: facturacion_completada
      await notificationService.createAndSend({
        tx,
        user_id: billing.user_id,
        tipo: 'facturacion_completada',
        titulo: 'Facturación completada',
        mensaje: `Sus datos de facturación han sido registrados exitosamente para la subasta ${billing.auction?.asset?.placa ?? ''}.`,
        reference_type: 'billing',
        reference_id: billing.id,
      });

      // Admin: billing_generado
      const admin = await tx.user.findFirst({
        where: { user_type: 'admin' },
        select: { id: true },
      });
      if (admin) {
        const user = await tx.user.findUnique({
          where: { id: billing.user_id },
          select: { first_name: true, last_name: true },
        });
        const cliente = user ? formatters.fullName(user) : billing.user_id;
        await notificationService.createAndSend({
          tx,
          user_id: admin.id,
          tipo: 'billing_generado',
          titulo: 'Billing generado',
          mensaje: `Se completó la facturación para ${cliente} - Subasta ${billing.auction?.asset?.placa ?? ''}. Monto aplicado: $${billing.monto}`,
          reference_type: 'billing',
          reference_id: billing.id,
        });
      }

      return {
        billing: updatedBilling,
      };
    });
  }
 
  // ---------------------------------------
  // Listados y detalle con include opt-in
  // ---------------------------------------
 
  _buildIncludeForBilling(includeRaw = '') {
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
          estado: true,
          fecha_resultado_general: true,
          asset: {
            select: {
              placa: true,
              empresa_propietaria: true,
              marca: true,
              modelo: true,
              año: true,
              descripcion: true,
            },
          },
        },
      };
    }
 
    return { includeSet, prismaInclude: Object.keys(includePrisma).length ? includePrisma : undefined };
  }
 
  _mapBillingResponse(b, includeSet) {
    const base = {
      id: b.id,
      user_id: b.user_id,
      auction_id: b.auction_id,
      billing_document_type: b.billing_document_type,
      billing_document_number: b.billing_document_number,
      billing_name: b.billing_name,
      monto: b.monto,
      moneda: b.moneda,
      concepto: b.concepto,
      created_at: b.created_at,
      updated_at: b.updated_at,
      references: {
        user_id: b.user_id,
        auction_id: b.auction_id,
      },
    };
 
    if (includeSet && includeSet.size > 0) {
      const related = {};
      if (includeSet.has('user') && b.user) {
        related.user = {
          id: b.user.id,
          first_name: b.user.first_name,
          last_name: b.user.last_name,
          document_type: b.user.document_type,
          document_number: b.user.document_number,
        };
      }
      if (includeSet.has('auction') && b.auction) {
        related.auction = {
          id: b.auction.id,
          estado: b.auction.estado,
          fecha_resultado_general: b.auction.fecha_resultado_general,
          placa: b.auction.asset?.placa ?? null,
          empresa_propietaria: b.auction.asset?.empresa_propietaria ?? null,
          marca: b.auction.asset?.marca ?? null,
          modelo: b.auction.asset?.modelo ?? null,
          año: b.auction.asset?.año ?? null,
          descripcion: b.auction.asset?.descripcion ?? null,
        };
      }
      if (Object.keys(related).length > 0) base.related = related;
    }
 
    return base;
  }
 
  /**
   * Listar facturaciones (Admin)
   * Filtros: fecha_desde, fecha_hasta, page, limit, include=user,auction
   */
  async listBillings(filters = {}) {
    const {
      page = 1,
      limit = 20,
      fecha_desde,
      fecha_hasta,
      include = '',
    } = filters;
 
    const skip = (Number(page) - 1) * Number(limit);
 
    const where = {};
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
 
    const { includeSet, prismaInclude } = this._buildIncludeForBilling(include);
 
    const [items, total] = await Promise.all([
      prisma.billing.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.billing.count({ where }),
    ]);
 
    const billings = items.map((b) => this._mapBillingResponse(b, includeSet));
 
    return {
      billings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    };
  }
 
  /**
   * Listar facturaciones por usuario (Admin: cualquiera; Client: solo propio)
   * Filtros: fecha_desde, fecha_hasta, page, limit, include=user,auction
   */
  async getBillingsByUser(targetUserId, filters = {}, requesterRole = 'client', requesterId = null) {
    if (requesterRole === 'client' && requesterId && requesterId !== targetUserId) {
      throw new ConflictError('No tiene permisos para ver facturaciones de este usuario', 'FORBIDDEN');
    }
 
    const {
      page = 1,
      limit = 20,
      fecha_desde,
      fecha_hasta,
      include = '',
    } = filters;
 
    const skip = (Number(page) - 1) * Number(limit);
 
    const where = { user_id: targetUserId };
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
 
    const { includeSet, prismaInclude } = this._buildIncludeForBilling(include);
 
    const [items, total] = await Promise.all([
      prisma.billing.findMany({
        where,
        include: prismaInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.billing.count({ where }),
    ]);
 
    const billings = items.map((b) => this._mapBillingResponse(b, includeSet));
 
    return {
      billings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        total_pages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    };
  }
 
  /**
   * Detalle de facturación (Admin: cualquiera; Client: solo propio)
   * include CSV: user,auction
   */
  async getBillingById(billingId, requesterRole = 'client', requesterId = null, include = '') {
    const { includeSet, prismaInclude } = this._buildIncludeForBilling(include);
 
    const b = await prisma.billing.findUnique({
      where: { id: billingId },
      include: prismaInclude,
    });
    if (!b) throw new NotFoundError('Billing');
 
    if (requesterRole === 'client' && requesterId && b.user_id !== requesterId) {
      throw new ConflictError('No tiene permisos para ver esta facturación', 'FORBIDDEN');
    }
 
    return this._mapBillingResponse(b, includeSet);
  }
 
  /**
   * Helper: Recalcula y actualiza User.saldo_retenido sumando pagos de garantía validados
   * de subastas en estados que retienen: ['finalizada', 'ganada'].
   * Nota: Método legado, no usado en completeBilling.
   */
  async _recalcularSaldoRetenidoTx(tx, userId) {
    const offers = await tx.guarantee.findMany({
      where: { user_id: userId },
      select: {
        auction: { select: { id: true, estado: true } },
      },
    });
 
    const retenedorStates = new Set(['finalizada', 'ganada']);
    const auctionIdsToRetain = offers
      .filter((o) => o.auction && retenedorStates.has(o.auction.estado))
      .map((o) => o.auction.id);
 
    if (auctionIdsToRetain.length === 0) {
      await tx.user.update({
        where: { id: userId },
        data: { saldo_retenido: 0 },
      });
      return 0;
    }
 
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
 
    const saldoRetenido = Number(
      validatedGuaranteeMovs.reduce((acc, m) => acc + Number(m.monto || 0), 0).toFixed(2)
    );
 
    await tx.user.update({
      where: { id: userId },
      data: { saldo_retenido: saldoRetenido },
    });
 
    return saldoRetenido;
  }
}
 
module.exports = new BillingService();