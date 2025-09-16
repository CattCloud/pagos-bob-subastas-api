const winston = require('winston');
const { config } = require('../config');

// Configurar colores para los niveles de log
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Formato personalizado para logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Crear transports según el entorno
const transports = [
  // Console transport (siempre activo)
  new winston.transports.Console(),
  
  // File transport para logs de error
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport para todos los logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Crear logger
const Logger = winston.createLogger({
  level: config.logLevel,
  format,
  transports,
});

// Middleware de logging para Express
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;
    
    if (res.statusCode >= 400) {
      Logger.warn(message);
    } else {
      Logger.http(message);
    }
  });
  
  next();
};

module.exports = {
  Logger,
  httpLogger,
};