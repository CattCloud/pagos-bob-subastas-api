const cron = require('node-cron');
const { prisma } = require('../config/database');
const auctionService = require('../services/auctionService');
const offerService = require('../services/offerService');
const { 
  businessCalculations,
  formatters,
  timeHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class AuctionJobs {
  
  /**
   * Procesar subastas vencidas automáticamente
   */
  async processExpiredAuctions() {
    Logger.info('🕐 Iniciando proceso de subastas vencidas automáticas');
    
    try {
      // Obtener subastas vencidas
      const expiredAuctions = await auctionService.getExpiredAuctions();
      
      if (expiredAuctions.length === 0) {
        Logger.info('✅ No hay subastas vencidas para procesar');
        return { processed: 0 };
      }
      
      Logger.info(`📋 Encontradas ${expiredAuctions.length} subastas vencidas para procesar`);
      
      let processedCount = 0;
      let errorsCount = 0;
      
      for (const auction of expiredAuctions) {
        try {
          await this.processExpiredAuction(auction);
          processedCount++;
        } catch (error) {
          Logger.error(`❌ Error procesando subasta vencida ${auction.id}:`, error);
          errorsCount++;
        }
      }
      
      Logger.info(`✅ Proceso completado: ${processedCount} procesadas, ${errorsCount} errores`);
      
      return {
        processed: processedCount,
        errors: errorsCount,
        total: expiredAuctions.length,
      };
      
    } catch (error) {
      Logger.error('❌ Error crítico en proceso de subastas vencidas:', error);
      throw error;
    }
  }
  
  /**
   * Procesar una subasta vencida individual
   */
  async processExpiredAuction(auction) {
    Logger.info(`⏰ Procesando subasta vencida: ${auction.id} - ${auction.asset.placa}`);
    
    const result = await prisma.$transaction(async (tx) => {
      // Obtener la oferta ganadora actual
      const currentOffer = auction.offers.find(offer => offer.estado === 'activa');
      
      if (!currentOffer) {
        Logger.warn(`⚠️  Subasta ${auction.id} sin oferta ganadora activa`);
        return null;
      }
      
      const currentWinner = currentOffer.user;
      
      // 1. Aplicar penalidad al ganador actual
      let penaltyApplied = 0;
      const userBalance = await tx.userBalance.findUnique({
        where: { user_id: currentWinner.id },
      });
      
      if (userBalance) {
        const availableBalance = businessCalculations.calculateAvailableBalance(userBalance);
        penaltyApplied = businessCalculations.calculatePenalty(availableBalance);
        
        if (penaltyApplied > 0) {
          // Aplicar penalidad
          await tx.userBalance.update({
            where: { user_id: currentWinner.id },
            data: {
              saldo_penalizado: { increment: penaltyApplied },
            },
          });
          
          // Registrar movimiento de penalidad
          await tx.movement.create({
            data: {
              user_id: currentWinner.id,
              tipo_movimiento: 'penalidad',
              monto: -penaltyApplied,
              descripcion: `Penalidad automática del 30% por vencimiento de plazo de pago - Subasta ${auction.asset.placa}`,
              reference_type: 'subasta',
              reference_id: auction.id,
            },
          });
          
          Logger.warn(`💰 Penalidad aplicada: $${penaltyApplied} a ${formatters.fullName(currentWinner)}`);
        }
      }
      
      // 2. Marcar oferta actual como perdedora
      await tx.offer.update({
        where: { id: currentOffer.id },
        data: { estado: 'perdedora' },
      });
      
      // 3. Actualizar estado de subasta a 'vencida'
      await tx.auction.update({
        where: { id: auction.id },
        data: { estado: 'vencida' },
      });
      
      return {
        auction_id: auction.id,
        previous_winner: formatters.fullName(currentWinner),
        penalty_applied: penaltyApplied,
        placa: auction.asset.placa,
      };
    });
    
    if (result) {
      Logger.info(`✅ Subasta ${result.auction_id} procesada: Penalidad $${result.penalty_applied} aplicada a ${result.previous_winner}`);
    }
    
    return result;
  }
  
  /**
   * Verificar y notificar subastas próximas a vencer
   */
  async checkUpcomingExpirations() {
    Logger.info('🔔 Verificando subastas próximas a vencer');
    
    try {
      // Buscar subastas que vencen en las próximas 2 horas
      const upcomingDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
      
      const upcomingExpirations = await prisma.auction.findMany({
        where: {
          estado: 'pendiente',
          fecha_limite_pago: {
            lte: upcomingDeadline,
            gt: new Date(),
          },
        },
        include: {
          asset: true,
          offers: {
            where: { estado: 'activa' },
            include: {
              user: {
                select: {
                  first_name: true,
                  last_name: true,
                  email: true,
                  phone_number: true,
                  document_type: true,
                  document_number: true,
                },
              },
            },
          },
        },
      });
      
      if (upcomingExpirations.length === 0) {
        Logger.info('✅ No hay subastas próximas a vencer');
        return { notifications: 0 };
      }
      
      Logger.warn(`⚠️  ${upcomingExpirations.length} subastas próximas a vencer en 2 horas`);
      
      // Log de advertencia para cada subasta próxima a vencer
      upcomingExpirations.forEach(auction => {
        const winner = auction.offers[0]?.user;
        const timeRemaining = timeHelpers.getTimeRemaining(auction.fecha_limite_pago);
        
        if (winner) {
          Logger.warn(`⏳ URGENTE - ${formatters.fullName(winner)} (${winner.email}) - Subasta ${auction.asset.placa} vence en: ${timeRemaining}`);
        }
      });
      
      return { notifications: upcomingExpirations.length };
      
    } catch (error) {
      Logger.error('❌ Error verificando subastas próximas a vencer:', error);
      throw error;
    }
  }
  
  /**
   * Limpiar sesiones expiradas (complementa el middleware de auth)
   */
  async cleanupExpiredSessions() {
    // Este job complementa la limpieza automática del middleware de auth
    Logger.info('🧹 Sesiones - limpieza manejada por middleware de auth');
    return { message: 'Limpieza manejada por middleware' };
  }
  
  /**
   * Generar reporte diario de actividades
   */
  async generateDailyReport() {
    Logger.info('📊 Generando reporte diario de actividades');
    
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      // Estadísticas del día anterior
      const stats = await Promise.all([
        // Subastas creadas
        prisma.auction.count({
          where: {
            created_at: { gte: yesterday, lt: today },
          },
        }),
        // Pagos registrados
        prisma.guaranteePayment.count({
          where: {
            created_at: { gte: yesterday, lt: today },
          },
        }),
        // Pagos validados
        prisma.guaranteePayment.count({
          where: {
            estado: 'validado',
            fecha_resolucion: { gte: yesterday, lt: today },
          },
        }),
        // Subastas finalizadas
        prisma.auction.count({
          where: {
            estado: 'finalizada',
            finished_at: { gte: yesterday, lt: today },
          },
        }),
        // Movimientos totales
        prisma.movement.count({
          where: {
            created_at: { gte: yesterday, lt: today },
          },
        }),
      ]);
      
      const report = {
        fecha: yesterday.toISOString().split('T')[0],
        subastas_creadas: stats[0],
        pagos_registrados: stats[1],
        pagos_validados: stats[2],
        subastas_finalizadas: stats[3],
        movimientos_totales: stats[4],
      };
      
      Logger.info('📈 Reporte diario generado:', report);
      
      return report;
      
    } catch (error) {
      Logger.error('❌ Error generando reporte diario:', error);
      throw error;
    }
  }
  
  /**
   * Inicializar todos los jobs programados
   */
  initializeJobs() {
    Logger.info('🚀 Inicializando jobs programados...');
    
    // Procesar subastas vencidas cada 30 minutos
    cron.schedule('*/30 * * * *', async () => {
      try {
        await this.processExpiredAuctions();
      } catch (error) {
        Logger.error('❌ Error en job de subastas vencidas:', error);
      }
    }, {
      name: 'process-expired-auctions',
      timezone: 'America/Lima',
    });
    
    // Verificar próximos vencimientos cada hora
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkUpcomingExpirations();
      } catch (error) {
        Logger.error('❌ Error en job de próximos vencimientos:', error);
      }
    }, {
      name: 'check-upcoming-expirations',
      timezone: 'America/Lima',
    });
    
    // Reporte diario a las 6:00 AM
    cron.schedule('0 6 * * *', async () => {
      try {
        await this.generateDailyReport();
      } catch (error) {
        Logger.error('❌ Error en job de reporte diario:', error);
      }
    }, {
      name: 'daily-report',
      timezone: 'America/Lima',
    });
    
    // Limpieza de sesiones cada 4 horas (complementa middleware)
    cron.schedule('0 */4 * * *', async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        Logger.error('❌ Error en job de limpieza:', error);
      }
    }, {
      name: 'cleanup-sessions',
      timezone: 'America/Lima',
    });
    
    Logger.info('✅ Jobs programados inicializados correctamente');
    Logger.info('📅 Cronograma activo:');
    Logger.info('   • Subastas vencidas: cada 30 minutos');
    Logger.info('   • Próximos vencimientos: cada hora');
    Logger.info('   • Reporte diario: 6:00 AM');
    Logger.info('   • Limpieza: cada 4 horas');
  }
  
  /**
   * Ejecutar job específico manualmente (para testing/admin)
   */
  async runJob(jobName) {
    Logger.info(`🔧 Ejecutando job manual: ${jobName}`);
    
    const jobs = {
      'process-expired': () => this.processExpiredAuctions(),
      'check-upcoming': () => this.checkUpcomingExpirations(),
      'daily-report': () => this.generateDailyReport(),
      'cleanup-sessions': () => this.cleanupExpiredSessions(),
    };
    
    const job = jobs[jobName];
    if (!job) {
      throw new Error(`Job no encontrado: ${jobName}. Disponibles: ${Object.keys(jobs).join(', ')}`);
    }
    
    return await job();
  }
}

module.exports = new AuctionJobs();