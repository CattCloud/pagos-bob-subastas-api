const express = require('express');
const cors = require('cors');
const { config, validateConfig } = require('./config');
const { connectDB } = require('./config/database');
const {
  httpLogger,
  errorHandler,
  notFound,
  extractSession,
  renewSession,
} = require('./middleware');
const { Logger } = require('./middleware/logger');

// Validar configuración antes de iniciar
validateConfig();

const app = express();
const PORT = config.port;

// Conectar a la base de datos
connectDB();

// Middleware base
app.use(cors({
  origin: config.frontend.url,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use(httpLogger);

// Middleware de autenticación (extrae sesión de headers)
app.use(extractSession);

// Middleware para renovar sesión
app.use(renewSession);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BOB Subastas API esta corriendo',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API Routes
app.use('/auth', require('./routes/auth'));
app.use('/auctions', require('./routes/auctions'));
app.use('/users', require('./routes/users'));
app.use('/movements', require('./routes/movements'));
app.use('/balances', require('./routes/balances'));
app.use('/jobs', require('./routes/jobs'));
app.use('/billing', require('./routes/billing'));
app.use('/notifications', require('./routes/notifications'));
app.use('/refunds', require('./routes/refunds'));

// 404 handler - Express 5.x compatible
app.use((req, res, next) => {
  if (!res.headersSent) {
    notFound(req, res, next);
  }
});

// Error handler global (debe ir al final)
app.use(errorHandler);

// Inicializar jobs programados
const auctionJobs = require('./jobs/auctionJobs');
auctionJobs.initializeJobs();

// Iniciar servidor
app.listen(PORT, () => {
  Logger.info(`BOB Subastas API corriendo en puerto ${PORT}`);
  Logger.info(`Link: http://localhost:${PORT}`);
  Logger.info(`Entorno: ${config.nodeEnv}`);
  
  if (config.nodeEnv === 'development') {
    Logger.info(`Documentación API: Consulta doc/DocumentacionAPI.md`);
    Logger.info(`Jobs manuales: http://localhost:${PORT}/api/jobs/list`);
  }
});

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  Logger.info('Recibida señal SIGTERM, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  Logger.info('Recibida señal SIGINT, cerrando servidor...');
  process.exit(0);
});

module.exports = app;