const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const config = {
  // Servidor
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Base de datos
  databaseUrl: process.env.DATABASE_URL,
  directUrl: process.env.DIRECT_URL,
  
  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  
  // Sesiones
  session: {
    secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
    expiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS) || 1,
  },
  
  // CORS
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5174',
  },
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Validaciones
  file: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
  },
  
  // Reglas de negocio
  business: {
    guaranteePercentage: 0.08, // 8% de garantía
    penaltyPercentage: 0.30,   // 30% de penalidad
    sessionExpiryMinutes: 60,  // 60 minutos de sesión
  },
};

// Validar configuraciones críticas
const validateConfig = () => {
  const required = [
    'DATABASE_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Variables de entorno faltantes:', missing.join(', '));
    console.error('Por favor revisa el archivo .env');
    process.exit(1);
  }
  
  // Validar configuración específica de Cloudinary
  try {
    const { validateCloudinaryConfig } = require('./cloudinary');
    validateCloudinaryConfig();
  } catch (error) {
    console.error('❌ Error en configuración de Cloudinary:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Configuración validada correctamente');
  console.log('✅ Cloudinary configurado correctamente');
};

module.exports = {
  config,
  validateConfig,
};