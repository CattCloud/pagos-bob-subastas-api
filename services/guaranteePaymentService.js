const { prisma } = require('../config/database');
const { uploadToCloudinary } = require('../config/cloudinary');
const { 
  BusinessErrors, 
  NotFoundError, 
  ConflictError 
} = require('../middleware/errorHandler');
const { 
  businessCalculations,
  businessValidations,
  formatters,
  paginationHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class GuaranteePaymentService {
  
  /**
   * Registrar pago de garantía
   */
  async createGuaranteePayment(userId, paymentData, voucherFile) {
    const { 
      auction_id, 
      monto_garantia, 
      tipo_pago, 
      numero_cuenta_origen, 
      fecha_pago,
      billing_document_type, 
      billing_name, 
      comentarios 
    } = paymentData;
    
    Logger.info(`Cliente ${userId} registrando pago de garantía para subasta ${auction_id}`, {
      monto: monto_garantia,
      tipo_pago,
    });
    
    const result = await prisma.$transaction(async (tx) => {
      // Verificar que la subasta existe y está en estado correcto
      const auction = await tx.auction.findUnique({
        where: { id: auction_id },
        include: {
          asset: true,
          offers: {
            where: { 
              estado: 'activa',
              user_id: userId,
            },
          },
        },
      });
      
      if (!auction) {
        throw BusinessErrors.AuctionNotFound();
      }
      
      // Verificar que la subasta está en estado 'pendiente'
      if (auction.estado !== 'pendiente') {
        throw BusinessErrors.InvalidAuctionState('pendiente', auction.estado);
      }
      
      // Verificar que el usuario es el ganador actual
      const userOffer = auction.offers.find(offer => offer.user_id === userId);
      if (!userOffer) {
        throw new ConflictError(
          'Solo el ganador actual puede registrar el pago de garantía',
          'NOT_CURRENT_WINNER'
        );
      }
      
      // Verificar que no existe un pago previo para esta oferta
      const existingPayment = await tx.guaranteePayment.findUnique({
        where: { offer_id: userOffer.id },
      });
      
      if (existingPayment) {
        throw BusinessErrors.PaymentAlreadyProcessed();
      }
      
      // Validar que el monto es correcto (8% de la oferta)
      const expectedAmount = businessCalculations.calculateGuaranteeAmount(userOffer.monto_oferta);
      if (!businessValidations.isGuaranteeAmountValid(monto_garantia, userOffer.monto_oferta)) {
        throw BusinessErrors.InvalidAmount(expectedAmount, monto_garantia);
      }
      
      // Validar fecha de pago
      const paymentDate = new Date(fecha_pago);
      const auctionStart = new Date(auction.fecha_inicio);
      const now = new Date();
      
      if (paymentDate > now) {
        throw new ConflictError(
          'La fecha de pago no puede ser futura',
          'FUTURE_PAYMENT_DATE'
        );
      }
      
      if (paymentDate < auctionStart) {
        throw new ConflictError(
          'La fecha de pago no puede ser anterior al inicio de la subasta',
          'INVALID_PAYMENT_DATE'
        );
      }
      
      // Subir comprobante a Cloudinary
      let voucherUrl;
      try {
        const uploadResult = await uploadToCloudinary(
          voucherFile.buffer, 
          voucherFile.originalname, 
          userId
        );
        voucherUrl = uploadResult.secure_url;
        
        Logger.info(`Comprobante subido exitosamente: ${uploadResult.public_id}`);
      } catch (error) {
        Logger.error('Error subiendo comprobante a Cloudinary:', error);
        throw new ConflictError(
          'Error al procesar el archivo del comprobante',
          'UPLOAD_ERROR'
        );
      }
      
      // Crear registro de pago
      const guaranteePayment = await tx.guaranteePayment.create({
        data: {
          user_id: userId,
          auction_id: auction_id,
          offer_id: userOffer.id,
          monto_garantia: monto_garantia,
          tipo_pago,
          numero_cuenta_origen,
          voucher_url: voucherUrl,
          comentarios,
          estado: 'pendiente',
          fecha_pago: paymentDate,
          billing_document_type,
          billing_name,
        },
      });
      
      // Actualizar saldo del usuario
      await tx.userBalance.upsert({
        where: { user_id: userId },
        update: {
          saldo_total: { increment: monto_garantia },
          saldo_retenido: { increment: monto_garantia },
        },
        create: {
          user_id: userId,
          saldo_total: monto_garantia,
          saldo_retenido: monto_garantia,
          saldo_aplicado: 0,
          saldo_en_reembolso: 0,
          saldo_penalizado: 0,
        },
      });
      
      // Registrar movimiento
      await tx.movement.create({
        data: {
          user_id: userId,
          tipo_movimiento: 'retencion',
          monto: monto_garantia,
          descripcion: `Pago de garantía de $${monto_garantia} registrado - Pendiente de validación para subasta ${auction.asset.placa}`,
          reference_type: 'pago',
          reference_id: guaranteePayment.id,
        },
      });
      
      // Actualizar estado de subasta a 'en_validacion'
      const updatedAuction = await tx.auction.update({
        where: { id: auction_id },
        data: { estado: 'en_validacion' },
        include: { asset: true },
      });
      
      // Obtener saldo actualizado
      const updatedBalance = await tx.userBalance.findUnique({
        where: { user_id: userId },
      });
      
      return {
        guarantee_payment: guaranteePayment,
        auction: updatedAuction,
        balance: updatedBalance,
      };
    });
    
    Logger.info(`Pago de garantía registrado exitosamente: ID ${result.guarantee_payment.id}`);
    
    return result;
  }
  
  /**
   * Aprobar pago de garantía
   */
  async approvePayment(paymentId, adminUserId, comentarios = null) {
    Logger.info(`Admin ${adminUserId} aprobando pago ${paymentId}`);
    
    const result = await prisma.$transaction(async (tx) => {
      // Obtener pago con relaciones
      const payment = await tx.guaranteePayment.findUnique({
        where: { id: paymentId },
        include: {
          user: true,
          auction: { include: { asset: true } },
          offer: true,
        },
      });
      
      if (!payment) {
        throw new NotFoundError('Pago de garantía');
      }
      
      // Verificar que el pago está pendiente
      if (payment.estado !== 'pendiente') {
        throw BusinessErrors.PaymentAlreadyProcessed();
      }
      
      // Aprobar pago
      const approvedPayment = await tx.guaranteePayment.update({
        where: { id: paymentId },
        data: {
          estado: 'validado',
          fecha_resolucion: new Date(),
          comentarios: comentarios || payment.comentarios,
        },
      });
      
      // Actualizar saldo del usuario (mover de retenido a aplicado)
      const updatedBalance = await tx.userBalance.update({
        where: { user_id: payment.user_id },
        data: {
          saldo_retenido: { decrement: payment.monto_garantia },
          saldo_aplicado: { increment: payment.monto_garantia },
        },
      });
      
      // Registrar movimiento de validación
      await tx.movement.create({
        data: {
          user_id: payment.user_id,
          tipo_movimiento: 'garantia_validada',
          monto: payment.monto_garantia,
          descripcion: `Pago de garantía de $${payment.monto_garantia} validado para subasta ${payment.auction.asset.placa} y aplicado como parte del pago`,
          reference_type: 'pago',
          reference_id: paymentId,
        },
      });
      
      // Actualizar oferta a 'ganadora'
      await tx.offer.update({
        where: { id: payment.offer_id },
        data: { estado: 'ganadora' },
      });
      
      // Actualizar subasta a 'finalizada'
      const finalizedAuction = await tx.auction.update({
        where: { id: payment.auction_id },
        data: {
          estado: 'finalizada',
          finished_at: new Date(),
        },
        include: { asset: true },
      });
      
      return {
        guarantee_payment: approvedPayment,
        auction: finalizedAuction,
        balance: updatedBalance,
        user: {
          name: formatters.fullName(payment.user),
          document: formatters.document(payment.user.document_type, payment.user.document_number),
        },
      };
    });
    
    Logger.info(`Pago aprobado exitosamente: ${paymentId} - Usuario: ${result.user.name}`);
    
    return result;
  }
  
  /**
   * Rechazar pago de garantía
   */
  async rejectPayment(paymentId, adminUserId, rejectionData) {
    const { motivos, otros_motivos, comentarios } = rejectionData;
    
    Logger.warn(`Admin ${adminUserId} rechazando pago ${paymentId}`, { motivos, otros_motivos });
    
    const result = await prisma.$transaction(async (tx) => {
      // Obtener pago con relaciones
      const payment = await tx.guaranteePayment.findUnique({
        where: { id: paymentId },
        include: {
          user: true,
          auction: { include: { asset: true } },
        },
      });
      
      if (!payment) {
        throw new NotFoundError('Pago de garantía');
      }
      
      // Verificar que el pago está pendiente
      if (payment.estado !== 'pendiente') {
        throw BusinessErrors.PaymentAlreadyProcessed();
      }
      
      // Construir motivo de rechazo
      let motivoRechazo = motivos.join(', ');
      if (otros_motivos) {
        motivoRechazo += `, ${otros_motivos}`;
      }
      
      // Rechazar pago
      const rejectedPayment = await tx.guaranteePayment.update({
        where: { id: paymentId },
        data: {
          estado: 'rechazado',
          fecha_resolucion: new Date(),
          motivo_rechazo: motivoRechazo,
          comentarios: comentarios || payment.comentarios,
        },
      });
      
      // Actualizar saldo del usuario (quitar retención, mantener histórico en total)
      const updatedBalance = await tx.userBalance.update({
        where: { user_id: payment.user_id },
        data: {
          saldo_retenido: { decrement: payment.monto_garantia },
        },
      });
      
      // Registrar movimiento de rechazo
      await tx.movement.create({
        data: {
          user_id: payment.user_id,
          tipo_movimiento: 'garantia_rechazada',
          monto: -payment.monto_garantia,
          descripcion: `Pago de garantía de $${payment.monto_garantia} rechazado: ${motivoRechazo}`,
          reference_type: 'pago',
          reference_id: paymentId,
        },
      });
      
      // Devolver subasta a estado 'pendiente'
      const revertedAuction = await tx.auction.update({
        where: { id: payment.auction_id },
        data: { estado: 'pendiente' },
        include: { asset: true },
      });
      
      return {
        guarantee_payment: rejectedPayment,
        auction: revertedAuction,
        balance: updatedBalance,
        user: {
          name: formatters.fullName(payment.user),
          document: formatters.document(payment.user.document_type, payment.user.document_number),
        },
      };
    });
    
    Logger.warn(`Pago rechazado: ${paymentId} - Usuario: ${result.user.name} - Motivo: ${result.guarantee_payment.motivo_rechazo}`);
    
    return result;
  }
  
  /**
   * Listar pagos de garantía con filtros
   */
  async getGuaranteePayments(filters = {}, userRole = 'client', userId = null) {
    const { estado, page = 1, limit = 20, fecha_desde, fecha_hasta } = filters;
    const offset = paginationHelpers.calculateOffset(page, limit);
    
    // Construir filtros base
    const where = {};
    
    // Si es cliente, solo sus pagos
    if (userRole === 'client') {
      where.user_id = userId;
    }
    
    // Filtro por estado
    if (estado) {
      const estados = Array.isArray(estado) ? estado : estado.split(',').map(s => s.trim());
      where.estado = { in: estados };
    }
    
    // Filtro por fechas
    if (fecha_desde || fecha_hasta) {
      where.created_at = {};
      if (fecha_desde) where.created_at.gte = new Date(fecha_desde);
      if (fecha_hasta) where.created_at.lte = new Date(fecha_hasta);
    }
    
    // Ejecutar consulta
    const [payments, total] = await Promise.all([
      prisma.guaranteePayment.findMany({
        where,
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              document_type: true,
              document_number: true,
            },
          },
          auction: {
            include: {
              asset: {
                select: {
                  placa: true,
                  marca: true,
                  modelo: true,
                  año: true,
                },
              },
            },
          },
          offer: {
            select: {
              monto_oferta: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.guaranteePayment.count({ where }),
    ]);
    
    // Formatear resultados
    const formattedPayments = payments.map(payment => ({
      id: payment.id,
      auction: {
        id: payment.auction.id,
        asset: payment.auction.asset,
        estado: payment.auction.estado,
      },
      user: userRole === 'admin' ? {
        name: formatters.fullName(payment.user),
        document: formatters.document(payment.user.document_type, payment.user.document_number),
      } : undefined,
      payment_details: {
        monto_oferta: payment.offer.monto_oferta,
        monto_garantia: payment.monto_garantia,
        tipo_pago: payment.tipo_pago,
        fecha_pago: payment.fecha_pago,
        billing_name: payment.billing_name,
        estado: payment.estado,
        motivo_rechazo: payment.motivo_rechazo,
      },
      voucher_url: payment.voucher_url,
      comentarios: payment.comentarios,
      created_at: payment.created_at,
      fecha_resolucion: payment.fecha_resolucion,
    }));
    
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    
    return { payments: formattedPayments, pagination };
  }
  
  /**
   * Obtener detalle de pago específico
   */
  async getPaymentById(paymentId, userRole = 'client', userId = null) {
    const payment = await prisma.guaranteePayment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        auction: {
          include: { asset: true },
        },
        offer: true,
      },
    });
    
    if (!payment) {
      throw new NotFoundError('Pago de garantía');
    }
    
    // Verificar permisos si es cliente
    if (userRole === 'client' && payment.user_id !== userId) {
      throw new ConflictError(
        'No tiene permisos para ver este pago',
        'FORBIDDEN'
      );
    }
    
    return payment;
  }
}

module.exports = new GuaranteePaymentService();