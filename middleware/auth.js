const { v4: uuidv4 } = require('uuid');
const { UnauthorizedError, ForbiddenError, BusinessErrors } = require('./errorHandler');
const { Logger } = require('./logger');

// Store de sesiones en memoria (en producción usar Redis)
const sessions = new Map();

// Limpiar sesiones expiradas cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      Logger.info(`Sesión expirada eliminada: ${sessionId}`);
    }
  }
}, 10 * 60 * 1000);

// Crear nueva sesión
const createSession = (user, expiryHours = 1) => {
  const sessionId = uuidv4();
  const expiresAt = Date.now() + (expiryHours * 60 * 60 * 1000);
  
  const session = {
    id: sessionId,
    user,
    createdAt: Date.now(),
    expiresAt,
    lastAccess: Date.now(),
  };
  
  sessions.set(sessionId, session);
  
  Logger.info(`Nueva sesión creada para usuario: ${user.email} (${user.user_type})`);
  
  return {
    session_id: sessionId,
    expires_at: new Date(expiresAt).toISOString(),
  };
};

// Obtener sesión válida
const getSession = (sessionId) => {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }
  
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  // Actualizar último acceso
  session.lastAccess = Date.now();
  return session;
};

// Eliminar sesión
const destroySession = (sessionId) => {
  const deleted = sessions.delete(sessionId);
  if (deleted) {
    Logger.info(`Sesión eliminada: ${sessionId}`);
  }
  return deleted;
};

// Middleware para extraer sesión de headers
const extractSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      req.user = session.user;
      req.session = session;
    }
  }
  
  next();
};

// Middleware para requerir autenticación
const requireAuth = (req, res, next) => {
  if (!req.user) {
    throw new UnauthorizedError('Sesión requerida. Por favor inicie sesión');
  }
  next();
};

// Middleware para validar tipo de usuario
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Sesión requerida');
    }
    
    if (!allowedRoles.includes(req.user.user_type)) {
      throw new ForbiddenError(`Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}`);
    }
    
    next();
  };
};

// Middleware específico para rutas de admin
const requireAdmin = requireRole(['admin']);

// Middleware específico para rutas de cliente
const requireClient = requireRole(['client']);

// Middleware para validar acceso por ruta (según la arquitectura de BOB)
const validateRouteAccess = (req, res, next) => {
  const path = req.path;
  const user = req.user;
  
  // Rutas públicas (sin autenticación)
  const publicRoutes = ['/health', '/api/auth'];
  if (publicRoutes.some(route => path.startsWith(route))) {
    return next();
  }
  
  // Todas las demás rutas requieren autenticación
  if (!user) {
    throw new UnauthorizedError('Autenticación requerida');
  }
  
  // Validar acceso por tipo de usuario y ruta
  if (path.startsWith('/api/admin') || path.includes('admin')) {
    if (user.user_type !== 'admin') {
      throw new ForbiddenError('Solo administradores pueden acceder a esta ruta');
    }
  }
  
  // Los clientes pueden acceder a rutas generales y sus propios recursos
  if (user.user_type === 'client') {
    // Validar que solo acceden a sus propios recursos
    const userId = req.params.userId || req.params.id;
    if (userId && userId !== user.id) {
      throw new ForbiddenError('Solo puede acceder a sus propios recursos');
    }
  }
  
  next();
};

// Middleware para renovar sesión en cada request válido
const renewSession = (req, res, next) => {
  if (req.session) {
    // Extender expiración por 1 hora más
    req.session.expiresAt = Date.now() + (60 * 60 * 1000);
  }
  next();
};

// Obtener estadísticas de sesiones (útil para admin)
const getSessionStats = () => {
  const stats = {
    total: sessions.size,
    admin: 0,
    client: 0,
  };
  
  for (const session of sessions.values()) {
    stats[session.user.user_type]++;
  }
  
  return stats;
};

module.exports = {
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