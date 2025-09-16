const { Logger } = require('./logger');

// Clase para errores operacionales personalizados
class AppError extends Error {
  constructor(message, statusCode, code = 'GENERAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Errores específicos del negocio
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Sin permisos para realizar esta acción') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, 409, code);
  }
}

// Errores específicos del sistema BOB Subastas
class BusinessErrors {
  static UserNotFound() {
    return new NotFoundError('No se encontró ningún cliente registrado con estos datos');
  }
  
  static AuctionNotFound() {
    return new NotFoundError('Subasta');
  }
  
  static InvalidAuctionState(expectedState, currentState) {
    return new ConflictError(
      `La subasta debe estar en estado '${expectedState}', actualmente está en '${currentState}'`,
      'INVALID_AUCTION_STATE'
    );
  }
  
  static InvalidAmount(expected, received) {
    return new ValidationError(
      'El monto debe coincidir exactamente con el 8%',
      { expected, received, field: 'monto_garantia' }
    );
  }
  
  static PaymentAlreadyProcessed() {
    return new ConflictError(
      'Este pago ya fue procesado anteriormente',
      'ALREADY_PROCESSED'
    );
  }
  
  static InsufficientBalance(available, required) {
    return new ValidationError(
      'Saldo insuficiente para realizar la operación',
      { available, required }
    );
  }
  
  static InvalidFileType(allowedTypes) {
    return new ValidationError(
      `Tipo de archivo no permitido. Solo se aceptan: ${allowedTypes.join(', ')}`,
      { allowedTypes }
    );
  }
  
  static FileTooLarge(maxSize) {
    return new ValidationError(
      `Archivo demasiado grande. Tamaño máximo: ${maxSize / 1024 / 1024}MB`,
      { maxSize }
    );
  }
}

// Middleware de manejo de errores
const errorHandler = (error, req, res, next) => {
  let err = { ...error };
  err.message = error.message;

  // Log del error
  Logger.error(`Error ${error.statusCode || 500}: ${error.message}`, {
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Errores de Prisma
  if (error.code === 'P2002') {
    const message = 'Recurso duplicado - Ya existe un registro con estos datos';
    err = new ConflictError(message, 'DUPLICATE_ENTRY');
  }
  
  if (error.code === 'P2025') {
    err = new NotFoundError();
  }

  // Errores de validación de Joi
  if (error.isJoi) {
    const message = error.details.map(detail => detail.message).join(', ');
    err = new ValidationError(message);
  }

  // Errores de Multer (archivos)
  if (error.code === 'LIMIT_FILE_SIZE') {
    err = BusinessErrors.FileTooLarge(error.limit);
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    err = new ValidationError('Archivo no esperado o campo incorrecto');
  }

  // Respuesta del error
  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.isOperational ? err.message : 'Error interno del servidor',
      isOperational: err.isOperational || false,
      details: err.details || null,
      timestamp: new Date().toISOString(),
    },
  });
};

// Middleware para manejar rutas no encontradas
const notFound = (req, res, next) => {
  const error = new NotFoundError(`Endpoint ${req.method} ${req.path} no encontrado`);
  error.code = 'ENDPOINT_NOT_FOUND';
  next(error);
};

// Middleware para capturar errores async/await
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BusinessErrors,
  errorHandler,
  notFound,
  asyncHandler,
};