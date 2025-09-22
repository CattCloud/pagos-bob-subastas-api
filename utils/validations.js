const Joi = require('joi');

// Esquemas base
const baseSchemas = {
  // Documentos
  documentType: Joi.string().valid('DNI', 'CE', 'RUC', 'Pasaporte'),
  dniNumber: Joi.string().pattern(/^\d{8}$/).messages({
    'string.pattern.base': 'DNI debe tener exactamente 8 dígitos',
  }),
  ceNumber: Joi.string().pattern(/^\d{9}$/).messages({
    'string.pattern.base': 'CE debe tener exactamente 9 dígitos',
  }),
  rucNumber: Joi.string().pattern(/^\d{11}$/).messages({
    'string.pattern.base': 'RUC debe tener exactamente 11 dígitos',
  }),
  passportNumber: Joi.string().min(6).max(12).alphanum(),

  // Monetarios
  currency: Joi.number().positive().precision(2).max(999999.99),
  percentage: Joi.number().min(0).max(1),

  // Fechas
  datetime: Joi.date().iso(),
  futureDatetime: Joi.date().iso().greater('now'),

  // Archivos
  fileType: Joi.string().valid('image/jpeg', 'image/jpg', 'image/png', 'application/pdf'),

  // Estados
  userType: Joi.string().valid('admin', 'client'),
  auctionStatus: Joi.string().valid('activa', 'pendiente', 'en_validacion', 'finalizada', 'vencida', 'cancelada', 'ganada', 'facturada', 'perdida', 'penalizada'),
  paymentStatus: Joi.string().valid('pendiente', 'validado', 'rechazado'),
  guaranteeStatus: Joi.string().valid('activa', 'ganadora', 'perdedora'),
  refundStatus: Joi.string().valid('solicitado', 'confirmado', 'rechazado', 'procesado', 'cancelado'),

  // IDs
  cuid: Joi.string().pattern(/^c[a-z0-9]{24}$/).messages({
    'string.pattern.base': 'ID debe ser un CUID válido',
  }),
  uuid: Joi.string().uuid(),
};

// Validación condicional de documento
const documentNumber = Joi.alternatives().conditional('document_type', [
  { is: 'DNI', then: baseSchemas.dniNumber },
  { is: 'CE', then: baseSchemas.ceNumber },
  { is: 'RUC', then: baseSchemas.rucNumber },
  { is: 'Pasaporte', then: baseSchemas.passportNumber },
]);

// Paginación y rango de fechas (separados para evitar referencia circular)
const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const dateRange = Joi.object({
  fecha_desde: baseSchemas.datetime.optional(),
  fecha_hasta: baseSchemas.datetime.optional(),
});

// USUARIOS
const userSchemas = {
  createUser: Joi.object({
    first_name: Joi.string().min(2).max(50).required(),
    last_name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    phone_number: Joi.string().pattern(/^\+51\d{9}$/).required().messages({
      'string.pattern.base': 'Teléfono debe tener formato +51XXXXXXXXX',
      'any.required': 'El teléfono es obligatorio',
    }),
    document_type: baseSchemas.documentType.required(),
    document_number: documentNumber.required(),
    user_type: baseSchemas.userType.default('client'),
  }),
  clientLogin: Joi.object({
    document_type: baseSchemas.documentType.required(),
    document_number: documentNumber.required(),
  }),
};

// SUBASTAS
const auctionSchemas = {
  createAuction: Joi.object({
    asset: Joi.object({
      placa: Joi.string().pattern(/^[A-Z0-9-]{6,10}$/).required().messages({
        'string.pattern.base': 'Placa debe tener formato válido (ej: ABC-123)',
        'any.required': 'La placa es obligatoria',
      }),
      empresa_propietaria: Joi.string().min(3).max(100).required(),
      marca: Joi.string().min(2).max(50).required(),
      modelo: Joi.string().min(1).max(50).required(),
      año: Joi.number().integer().min(1990).max(new Date().getFullYear() + 1).required(),
      descripcion: Joi.string().max(500).optional(),
    }).required(),
  }),
  updateStatus: Joi.object({
    estado: baseSchemas.auctionStatus.required(),
    motivo: Joi.string().min(10).max(500).required(),
  }),
  extendDeadline: Joi.object({
    fecha_limite_pago: baseSchemas.futureDatetime.required(),
    motivo: Joi.string().min(10).max(500).required(),
  }),
  competitionResult: Joi.object({
    resultado: Joi.string().valid('ganada', 'perdida', 'penalizada').required(),
    observaciones: Joi.string().max(500).optional(),
  }),
};

// GARANTÍAS
const guaranteeSchemas = {
  createWinner: Joi.object({
    user_id: baseSchemas.cuid.required(),
    monto_oferta: baseSchemas.currency.required(),
    fecha_limite_pago: baseSchemas.futureDatetime.optional(),
  }),
  reassignWinner: Joi.object({
    user_id: baseSchemas.cuid.required(),
    monto_oferta: baseSchemas.currency.required(),
    motivo_reasignacion: Joi.string().max(200).optional(),
  }),
};

// BILLING
const billingSchemas = {
  createBilling: Joi.object({
    auction_id: baseSchemas.cuid.required(),
    billing_document_type: Joi.string().valid('RUC', 'DNI').required(),
    billing_document_number: Joi.alternatives().conditional('billing_document_type', [
      { is: 'RUC', then: baseSchemas.rucNumber.required() },
      { is: 'DNI', then: baseSchemas.dniNumber.required() },
    ]),
    billing_name: Joi.string().min(3).max(200).required(),
  }),
};


// REEMBOLSOS
const refundSchemas = {
  createRefund: Joi.object({
    // Enforce máximo 2 decimales sin redondeo (422 si excede)
    monto_solicitado: Joi.number()
      .positive()
      .max(999999.99)
      .custom((v, helpers) => {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return helpers.error('number.base');
        }
        const s = String(v);
        const dot = s.indexOf('.');
        if (dot !== -1) {
          const decimals = s.length - dot - 1;
          if (decimals > 2) {
            return helpers.error('number.precision', { limit: 2 });
          }
        }
        return v;
      })
      .required(),
    motivo: Joi.string().min(10).max(500).required(),
    // auction_id ya no es obligatorio; el reembolso ahora opera sobre saldo disponible
    auction_id: baseSchemas.cuid.optional(),
  }),
  manageRefund: Joi.object({
    estado: Joi.string().valid('confirmado', 'rechazado').required(),
    motivo: Joi.string().max(300).optional(),
  }),
  processRefund: Joi.object({
    tipo_transferencia: Joi.string().valid('transferencia', 'deposito').optional(),
    banco_destino: Joi.string().min(3).max(50).optional(),
    numero_cuenta_destino: Joi.string().min(10).max(20).optional(),
    numero_operacion: Joi.string().min(3).max(100).required(),
    // Permitir opcionalmente pasar auction_id para trazabilidad explícita
    auction_id: baseSchemas.cuid.optional(),
  }),
};

// MOVIMIENTOS (Movement)
const movementSchemas = {
  createPayment: Joi.object({
    auction_id: baseSchemas.cuid.required(),
    monto: baseSchemas.currency.required(),
    tipo_pago: Joi.string().valid('deposito', 'transferencia').required(),
    numero_cuenta_origen: Joi.string().min(10).max(20).required(),
    numero_operacion: Joi.string().max(100).optional(),
    fecha_pago: baseSchemas.datetime.required(),
    moneda: Joi.string().length(3).uppercase().default('USD'),
    concepto: Joi.string().max(300).default('Pago de garantía'),
  }),
  approve: Joi.object({
    comentarios: Joi.string().max(300).optional(),
  }),
  reject: Joi.object({
    motivos: Joi.array().items(Joi.string().valid(
      'Monto incorrecto',
      'Comprobante ilegible',
      'Datos bancarios incorrectos',
      'Fecha de pago inválida',
      'Documento de facturación incorrecto'
    )).min(1).required(),
    otros_motivos: Joi.string().max(200).optional(),
    comentarios: Joi.string().max(300).optional(),
  }),
  listFilters: Joi.object({
    tipo_especifico: Joi.alternatives().try(
      Joi.string().valid('pago_garantia', 'reembolso', 'penalidad', 'ajuste_manual'),
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    estado: Joi.alternatives().try(
      Joi.string().valid('pendiente', 'validado', 'rechazado'),
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    // Param opcional para enriquecer respuesta: include=auction,user,refund,guarantee
    include: Joi.string().max(100).optional(),
  }).concat(pagination).concat(dateRange),
};
// CONSULTAS Y FILTROS
const querySchemas = {
  pagination,
  dateRange,
  auctionFilters: Joi.object({
    estado: Joi.alternatives().try(
      baseSchemas.auctionStatus,
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    search: Joi.string().max(100).optional(),
  }).concat(pagination).concat(dateRange),
  movementFilters: Joi.object({
    tipo: Joi.alternatives().try(
      Joi.string().valid(
        'retencion', 'garantia_validada', 'garantia_rechazada',
        'penalidad', 'reembolso_solicitado', 'reembolso_aprobado',
        'reembolso_como_saldo', 'reembolso_rechazado'
      ),
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
  }).concat(pagination).concat(dateRange),
  notificationFilters: Joi.object({
    estado: Joi.alternatives().try(
      Joi.string().valid('pendiente', 'vista'),
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    tipo: Joi.alternatives().try(
      Joi.string().valid(
        'ganador_subasta',
        'pago_registrado',
        'pago_validado',
        'pago_rechazado',
        'competencia_ganada',
        'competencia_perdida',
        'penalidad_aplicada',
        'facturacion_completada',
        'billing_generado',
        'reembolso_procesado',
        'reembolso_solicitado'
      ),
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    search: Joi.string().max(100).optional(),
  }).concat(pagination).concat(dateRange),
  refundFilters: Joi.object({
    estado: Joi.alternatives().try(
      baseSchemas.refundStatus,
      Joi.string().custom((value) => value.split(',').map(s => s.trim()))
    ).optional(),
    user_id: baseSchemas.cuid.optional(),
    auction_id: baseSchemas.cuid.optional(),
    // Param opcional para enriquecer respuesta: include=user,auction
    include: Joi.string().max(100).optional(),
  }).concat(pagination).concat(dateRange),
  userFilters: Joi.object({
    search: Joi.string().max(100).optional(),
    document_type: baseSchemas.documentType.optional(),
    user_type: baseSchemas.userType.optional(),
  }).concat(pagination),
};

// Función helper
const validate = (schema, data, options = {}) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true,
    ...options,
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value,
    }));

    const validationError = new Error('Datos de entrada inválidos');
    validationError.isJoi = true;
    validationError.details = error.details;
    validationError.validationDetails = details;
    throw validationError;
  }

  return value;
};

module.exports = {
  baseSchemas,
  userSchemas,
  auctionSchemas,
  guaranteeSchemas,
  billingSchemas,
  refundSchemas,
  querySchemas,
  validate,
  movementSchemas,
};