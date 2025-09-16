// Exportar todos los middleware desde un punto central
const { httpLogger, Logger } = require('./logger');
const { 
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
} = require('./errorHandler');
const {
  createSession,
  getSession,
  destroySession,
  extractSession,
  requireAuth,
  requireRole,
  requireAdmin,
  requireClient,
  validateRouteAccess,
  renewSession,
  getSessionStats,
} = require('./auth');

module.exports = {
  // Logger
  httpLogger,
  Logger,
  
  // Error handling
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
  
  // Authentication
  createSession,
  getSession,
  destroySession,
  extractSession,
  requireAuth,
  requireRole,
  requireAdmin,
  requireClient,
  validateRouteAccess,
  renewSession,
  getSessionStats,
};