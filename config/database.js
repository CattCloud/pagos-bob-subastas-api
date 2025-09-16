const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // En desarrollo, usar una instancia global para evitar múltiples conexiones
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

// Función para conectar a la base de datos
const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Conectado a PostgreSQL');
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    process.exit(1);
  }
};

// Función para desconectar de la base de datos
const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('Desconectado de PostgreSQL');
  } catch (error) {
    console.error('❌ Error desconectando de la base de datos:', error);
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB
};