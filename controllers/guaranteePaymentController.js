const guaranteePaymentService = require('../services/guaranteePaymentService');
const { uploadVoucher } = require('../config/cloudinary');
const { 
  asyncHandler 
} = require('../middleware/errorHandler');
const { 
  validations: { guaranteePaymentSchemas, querySchemas, validate } 
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Registrar pago de garantía
 * POST /api/guarantee-payments
 */
const createGuaranteePayment = [
  // Middleware de multer para subir archivo
  uploadVoucher.single('voucher'),
  
  asyncHandler(async (req, res) => {
    // Verificar que se subió el archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'Se requiere el comprobante de pago (voucher)',
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    // Validar datos de entrada
    const paymentData = validate(guaranteePaymentSchemas.createPayment, req.body);
    
    Logger.info(`Cliente ${req.user.email} registrando pago de garantía`, {
      auction_id: paymentData.auction_id,
      monto: paymentData.monto_garantia,
      tipo_pago: paymentData.tipo_pago,
    });
    
    // Crear pago usando el servicio
    const result = await guaranteePaymentService.createGuaranteePayment(
      req.user.id,
      paymentData,
      req.file
    );
    
    res.status(201).json({
      success: true,
      data: {
        guarantee_payment: {
          id: result.guarantee_payment.id,
          auction_id: result.guarantee_payment.auction_id,
          monto_garantia: result.guarantee_payment.monto_garantia,
          estado: result.guarantee_payment.estado,
          voucher_url: result.guarantee_payment.voucher_url,
          created_at: result.guarantee_payment.created_at,
        },
        balance_updated: {
          saldo_total: result.balance.saldo_total,
          saldo_retenido: result.balance.saldo_retenido,
          saldo_disponible: result.balance.saldo_total - 
                           result.balance.saldo_retenido - 
                           result.balance.saldo_aplicado - 
                           result.balance.saldo_en_reembolso - 
                           result.balance.saldo_penalizado,
        },
        auction_updated: {
          id: result.auction.id,
          estado: result.auction.estado,
        },
      },
      message: 'Pago de garantía registrado exitosamente',
    });
  })
];

/**
 * Listar pagos de garantía
 * GET /api/guarantee-payments
 */
const getGuaranteePayments = asyncHandler(async (req, res) => {
  // Validar parámetros de consulta
  const filters = validate(querySchemas.pagination, req.query);
  
  // Agregar filtros específicos
  if (req.query.estado) {
    filters.estado = req.query.estado;
  }
  if (req.query.fecha_desde) {
    filters.fecha_desde = req.query.fecha_desde;
  }
  if (req.query.fecha_hasta) {
    filters.fecha_hasta = req.query.fecha_hasta;
  }
  
  Logger.info(`Consultando pagos de garantía - ${req.user.user_type}: ${req.user.email}`, {
    filters,
  });
  
  // Obtener pagos usando el servicio
  const result = await guaranteePaymentService.getGuaranteePayments(
    filters,
    req.user.user_type,
    req.user.id
  );
  
  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Obtener detalle de pago específico
 * GET /api/guarantee-payments/:id
 */
const getGuaranteePaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  Logger.info(`Consultando detalle de pago ${id} - ${req.user.user_type}: ${req.user.email}`);
  
  // Obtener pago usando el servicio
  const payment = await guaranteePaymentService.getPaymentById(
    id,
    req.user.user_type,
    req.user.id
  );
  
  res.status(200).json({
    success: true,
    data: {
      payment,
    },
  });
});

/**
 * Aprobar pago de garantía
 * PATCH /api/guarantee-payments/:id/approve
 */
const approveGuaranteePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validar datos de entrada
  const { comentarios } = validate(guaranteePaymentSchemas.approvePayment, req.body);
  
  Logger.info(`Admin ${req.user.email} aprobando pago ${id}`, { comentarios });
  
  // Aprobar pago usando el servicio
  const result = await guaranteePaymentService.approvePayment(
    id,
    req.user.id,
    comentarios
  );
  
  res.status(200).json({
    success: true,
    data: {
      guarantee_payment: {
        id: result.guarantee_payment.id,
        estado: result.guarantee_payment.estado,
        fecha_resolucion: result.guarantee_payment.fecha_resolucion,
      },
      balance_updated: {
        saldo_retenido: result.balance.saldo_retenido,
        saldo_aplicado: result.balance.saldo_aplicado,
      },
      auction_updated: {
        id: result.auction.id,
        estado: result.auction.estado,
        finished_at: result.auction.finished_at,
      },
      user: result.user,
    },
    message: 'Pago de garantía aprobado exitosamente',
  });
});

/**
 * Rechazar pago de garantía
 * PATCH /api/guarantee-payments/:id/reject
 */
const rejectGuaranteePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validar datos de entrada
  const rejectionData = validate(guaranteePaymentSchemas.rejectPayment, req.body);
  
  Logger.warn(`Admin ${req.user.email} rechazando pago ${id}`, {
    motivos: rejectionData.motivos,
    otros_motivos: rejectionData.otros_motivos,
  });
  
  // Rechazar pago usando el servicio
  const result = await guaranteePaymentService.rejectPayment(
    id,
    req.user.id,
    rejectionData
  );
  
  res.status(200).json({
    success: true,
    data: {
      guarantee_payment: {
        id: result.guarantee_payment.id,
        estado: result.guarantee_payment.estado,
        motivo_rechazo: result.guarantee_payment.motivo_rechazo,
        fecha_resolucion: result.guarantee_payment.fecha_resolucion,
      },
      balance_updated: {
        saldo_retenido: result.balance.saldo_retenido,
      },
      auction_updated: {
        id: result.auction.id,
        estado: result.auction.estado,
      },
      user: result.user,
    },
    message: 'Pago de garantía rechazado',
  });
});

/**
 * Descargar comprobante de pago
 * GET /api/guarantee-payments/:id/voucher
 */
const downloadVoucher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  Logger.info(`Descargando comprobante de pago ${id} - ${req.user.user_type}: ${req.user.email}`);
  
  // Obtener pago usando el servicio
  const payment = await guaranteePaymentService.getPaymentById(
    id,
    req.user.user_type,
    req.user.id
  );
  
  if (!payment.voucher_url) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VOUCHER_NOT_FOUND',
        message: 'No se encontró el comprobante para este pago',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Redirigir a la URL de Cloudinary
  res.redirect(payment.voucher_url);
});

/**
 * Obtener estadísticas de pagos para dashboard admin
 * GET /api/guarantee-payments/stats
 */
const getPaymentStats = asyncHandler(async (req, res) => {
  Logger.info(`Admin ${req.user.email} consultando estadísticas de pagos`);
  
  // Obtener estadísticas usando el servicio
  const stats = await Promise.all([
    // Pagos pendientes de validación
    guaranteePaymentService.getGuaranteePayments({ estado: 'pendiente', limit: 1 }, 'admin'),
    // Pagos validados este mes
    guaranteePaymentService.getGuaranteePayments({ 
      estado: 'validado',
      fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      limit: 1 
    }, 'admin'),
    // Pagos rechazados este mes
    guaranteePaymentService.getGuaranteePayments({ 
      estado: 'rechazado',
      fecha_desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      limit: 1 
    }, 'admin'),
  ]);
  
  const statistics = {
    pendientes_validacion: stats[0].pagination.total,
    validados_mes: stats[1].pagination.total,
    rechazados_mes: stats[2].pagination.total,
    tasa_aprobacion_mes: stats[1].pagination.total > 0 ? 
      Math.round((stats[1].pagination.total / (stats[1].pagination.total + stats[2].pagination.total)) * 100) : 0,
  };
  
  res.status(200).json({
    success: true,
    data: {
      statistics,
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  createGuaranteePayment,
  getGuaranteePayments,
  getGuaranteePaymentById,
  approveGuaranteePayment,
  rejectGuaranteePayment,
  downloadVoucher,
  getPaymentStats,
};