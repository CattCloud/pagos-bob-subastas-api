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
 * HU-BILL-01 — Completar Datos de Facturación (Cliente)
 * - Crea registro Billing para subasta 'ganada'
 * - Actualiza auction.estado = 'facturada'
 * - Recalcula cache de saldo_retenido inmediatamente
 * - Notifica a cliente (facturacion_completada) y a admin (billing_generado)
 */
class BillingService {

  /**
   * Crear Billing para una subasta ganada por el cliente autenticado
   * payload = {
   *   auction_id,
   *   billing_document_type, // RUC | DNI
   *   billing_document_number,
   *   billing_name
   * }
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

      // 2) Crear Billing
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
   * Helper: Recalcula y actualiza User.saldo_retenido sumando pagos de garantía validados
   * de subastas en estados que retienen: ['finalizada', 'ganada'].
   * Nota: En el contexto de billing, 'facturada'/'perdida'/'penalizada' no se consideran
   * porque este método se usa específicamente cuando se factura una subasta ganada.
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