const { prisma } = require('../config/database');
const { 
  createSession, 
  destroySession, 
  getSession 
} = require('../middleware/auth');
const { 
  BusinessErrors, 
  asyncHandler 
} = require('../middleware/errorHandler');
const { 
  validations: { userSchemas, validate } 
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Login de cliente por documento
 * POST /api/auth/client-login
 */
const clientLogin = asyncHandler(async (req, res) => {
  // Validar datos de entrada
  const { document_type, document_number } = validate(userSchemas.clientLogin, req.body);
  
  Logger.info(`Intento de login de cliente: ${document_type} ${document_number}`);
  
  // Buscar usuario en la base de datos
  const user = await prisma.user.findFirst({
    where: {
      document_type,
      document_number,
      user_type: 'client',
      deleted_at: null,
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      document_type: true,
      document_number: true,
      user_type: true,
      created_at: true,
    },
  });
  
  if (!user) {
    Logger.warn(`Cliente no encontrado: ${document_type} ${document_number}`);
    throw BusinessErrors.UserNotFound();
  }
  
  // Crear sesión
  const sessionData = createSession(user, 1); // 1 hora de duración
  
  Logger.info(`Login exitoso para cliente: ${user.email}`);
  
  res.status(200).json({
    success: true,
    data: {
      user,
      session: sessionData,
    },
    message: 'Sesión iniciada exitosamente',
  });
});

/**
 * Acceso automático de administrador
 * POST /api/auth/admin-access
 */
const adminAccess = asyncHandler(async (req, res) => {
  Logger.info('Intento de acceso de administrador');
  
  // Buscar el usuario administrador
  const admin = await prisma.user.findFirst({
    where: {
      user_type: 'admin',
      deleted_at: null,
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
      document_type: true,
      document_number: true,
      user_type: true,
      created_at: true,
    },
  });
  
  if (!admin) {
    Logger.error('Usuario administrador no encontrado en la base de datos');
    throw BusinessErrors.UserNotFound();
  }
  
  // Crear sesión para admin
  const sessionData = createSession(admin, 8); // 8 horas de duración para admin
  
  Logger.info(`Acceso de administrador exitoso: ${admin.email}`);
  
  res.status(200).json({
    success: true,
    data: {
      user: admin,
      session: sessionData,
    },
    message: 'Acceso de administrador exitoso',
  });
});

/**
 * Cerrar sesión
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const sessionId = req.headers['x-session-id'] || 
                   req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(200).json({
      success: true,
      message: 'No hay sesión activa para cerrar',
    });
  }
  
  const wasDestroyed = destroySession(sessionId);
  
  if (wasDestroyed) {
    Logger.info(`Sesión cerrada: ${sessionId}`);
  }
  
  res.status(200).json({
    success: true,
    message: 'Sesión cerrada exitosamente',
  });
});

/**
 * Validar sesión activa
 * GET /api/auth/session
 */
const validateSession = asyncHandler(async (req, res) => {
  const sessionId = req.headers['x-session-id'] || 
                   req.headers['authorization']?.replace('Bearer ', '');
  
  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'No se proporcionó ID de sesión',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  const session = getSession(sessionId);
  
  if (!session) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'SESSION_EXPIRED',
        message: 'Sesión expirada o inválida',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Verificar que el usuario aún existe en la base de datos
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      user_type: true,
      deleted_at: true,
    },
  });
  
  if (!user || user.deleted_at) {
    // Usuario eliminado, invalidar sesión
    destroySession(sessionId);
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'USER_DELETED',
        message: 'Usuario no válido',
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      session: {
        id: session.id,
        user: session.user,
        expires_at: new Date(session.expiresAt).toISOString(),
        last_access: new Date(session.lastAccess).toISOString(),
      },
    },
    message: 'Sesión válida',
  });
});

/**
 * Obtener estadísticas de sesiones (solo para admin)
 * GET /api/auth/sessions/stats
 */
const getSessionStats = asyncHandler(async (req, res) => {
  const { getSessionStats: getStats } = require('../middleware/auth');
  
  const stats = getStats();
  
  res.status(200).json({
    success: true,
    data: {
      sessions: stats,
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = {
  clientLogin,
  adminAccess,
  logout,
  validateSession,
  getSessionStats,
};