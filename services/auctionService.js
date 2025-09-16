const { prisma } = require('../config/database');
const { 
  BusinessErrors, 
  NotFoundError, 
  ConflictError 
} = require('../middleware/errorHandler');
const { 
  businessValidations,
  stateHelpers,
  formatters,
  paginationHelpers,
} = require('../utils');
const { Logger } = require('../middleware/logger');

class AuctionService {
  
  /**
   * Crear nueva subasta con activo asociado
   */
  async createAuction(auctionData) {
    const { fecha_inicio, fecha_fin, asset } = auctionData;
    
    Logger.info(`Creando nueva subasta para vehículo: ${asset.placa}`);
    
    // Verificar que no exista otra subasta activa con la misma placa
    const existingActiveAuction = await prisma.auction.findFirst({
      where: {
        asset: {
          placa: asset.placa.toUpperCase(),
        },
        estado: {
          in: ['activa', 'pendiente', 'en_validacion'],
        },
      },
    });
    
    if (existingActiveAuction) {
      throw new ConflictError(
        `Ya existe una subasta activa para el vehículo con placa ${asset.placa}`,
        'DUPLICATE_PLATE'
      );
    }
    
    // Transacción para crear activo y subasta
    const result = await prisma.$transaction(async (tx) => {
      // Crear o actualizar el activo
      const createdAsset = await tx.asset.upsert({
        where: { placa: asset.placa.toUpperCase() },
        update: {
          empresa_propietaria: asset.empresa_propietaria,
          marca: asset.marca,
          modelo: asset.modelo,
          año: asset.año,
          descripcion: asset.descripcion || null,
          estado: 'disponible',
        },
        create: {
          placa: asset.placa.toUpperCase(),
          empresa_propietaria: asset.empresa_propietaria,
          marca: asset.marca,
          modelo: asset.modelo,
          año: asset.año,
          descripcion: asset.descripcion || null,
          estado: 'disponible',
        },
      });
      
      // Crear subasta
      const auction = await tx.auction.create({
        data: {
          asset_id: createdAsset.id,
          fecha_inicio,
          fecha_fin,
          estado: 'activa',
        },
        include: {
          asset: true,
        },
      });
      
      return auction;
    });
    
    Logger.info(`Subasta creada exitosamente: ID ${result.id} - ${asset.placa}`);
    
    return result;
  }
  
  /**
   * Listar subastas con filtros y paginación
   */
  async getAuctions(filters = {}) {
    const { 
      estado, 
      search, 
      fecha_desde, 
      fecha_hasta, 
      page = 1, 
      limit = 20 
    } = filters;
    
    const offset = paginationHelpers.calculateOffset(page, limit);
    
    // Construir filtros de búsqueda
    const where = {};
    
    // Filtro por estados
    if (estado) {
      const estados = Array.isArray(estado) ? estado : estado.split(',').map(s => s.trim());
      where.estado = { in: estados };
    }
    
    // Filtro por fechas
    if (fecha_desde || fecha_hasta) {
      where.fecha_inicio = {};
      if (fecha_desde) where.fecha_inicio.gte = new Date(fecha_desde);
      if (fecha_hasta) where.fecha_inicio.lte = new Date(fecha_hasta);
    }
    
    // Filtro de búsqueda en activo
    if (search) {
      where.asset = {
        OR: [
          { placa: { contains: search, mode: 'insensitive' } },
          { marca: { contains: search, mode: 'insensitive' } },
          { modelo: { contains: search, mode: 'insensitive' } },
          { empresa_propietaria: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    
    // Ejecutar consulta con paginación
    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
        where,
        include: {
          asset: {
            select: {
              placa: true,
              marca: true,
              modelo: true,
              año: true,
              empresa_propietaria: true,
            },
          },
          offers: {
            where: { estado: 'activa' },
            include: {
              user: {
                select: {
                  first_name: true,
                  last_name: true,
                  document_type: true,
                  document_number: true,
                },
              },
            },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
      }),
      prisma.auction.count({ where }),
    ]);
    
    // Formatear resultados
    const formattedAuctions = auctions.map(auction => ({
      id: auction.id,
      asset: auction.asset,
      estado: auction.estado,
      fecha_inicio: auction.fecha_inicio,
      fecha_fin: auction.fecha_fin,
      fecha_limite_pago: auction.fecha_limite_pago,
      winner: auction.offers.length > 0 ? {
        name: formatters.fullName(auction.offers[0].user),
        document: formatters.document(
          auction.offers[0].user.document_type, 
          auction.offers[0].user.document_number
        ),
        monto_oferta: auction.offers[0].monto_oferta,
      } : null,
      created_at: auction.created_at,
    }));
    
    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);
    
    return { auctions: formattedAuctions, pagination };
  }
  
  /**
   * Obtener detalle de subasta específica
   */
  async getAuctionById(auctionId) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        asset: true,
        offers: {
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                document_type: true,
                document_number: true,
                phone_number: true,
              },
            },
          },
          orderBy: { posicion_ranking: 'asc' },
        },
        guarantee_payments: {
          include: {
            user: {
              select: {
                first_name: true,
                last_name: true,
                document_type: true,
                document_number: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
    
    if (!auction) {
      throw BusinessErrors.AuctionNotFound();
    }
    
    return auction;
  }
  
  /**
   * Cambiar estado de subasta
   */
  async updateAuctionStatus(auctionId, newStatus, motivo = null) {
    const auction = await this.getAuctionById(auctionId);
    
    // Validar transición de estado
    if (!stateHelpers.isValidStateTransition(auction.estado, newStatus)) {
      const validStates = stateHelpers.getValidAuctionTransitions(auction.estado);
      throw new ConflictError(
        `No se puede cambiar de '${auction.estado}' a '${newStatus}'. Estados válidos: ${validStates.join(', ')}`,
        'INVALID_STATE_TRANSITION'
      );
    }
    
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        estado: newStatus,
        finished_at: newStatus === 'finalizada' ? new Date() : null,
      },
      include: {
        asset: true,
      },
    });
    
    Logger.info(`Estado de subasta actualizado: ${auctionId} -> ${newStatus}`, {
      motivo,
      previousState: auction.estado,
    });
    
    return updatedAuction;
  }
  
  /**
   * Extender fecha límite de pago
   */
  async extendPaymentDeadline(auctionId, newDeadline, motivo = null) {
    const auction = await this.getAuctionById(auctionId);
    
    // Validar que la subasta pueda tener extensión
    if (!['pendiente', 'en_validacion'].includes(auction.estado)) {
      throw BusinessErrors.InvalidAuctionState('pendiente o en_validacion', auction.estado);
    }
    
    // Validar que la nueva fecha sea futura
    if (!businessValidations.isPaymentDeadlineValid(newDeadline)) {
      throw new ConflictError(
        'La fecha límite debe ser futura',
        'INVALID_DEADLINE'
      );
    }
    
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        fecha_limite_pago: new Date(newDeadline),
      },
      include: {
        asset: true,
      },
    });
    
    Logger.info(`Fecha límite extendida para subasta ${auctionId}`, {
      nuevaFecha: newDeadline,
      motivo,
    });
    
    return updatedAuction;
  }
  
  /**
   * Eliminar subasta (solo si no tiene ofertas)
   */
  async deleteAuction(auctionId) {
    const auction = await this.getAuctionById(auctionId);
    
    // Verificar que no tenga ofertas asociadas
    if (auction.offers.length > 0) {
      throw new ConflictError(
        'No se puede eliminar una subasta que tiene ofertas asociadas',
        'HAS_OFFERS'
      );
    }
    
    // Verificar que no tenga pagos asociados
    if (auction.guarantee_payments.length > 0) {
      throw new ConflictError(
        'No se puede eliminar una subasta que tiene pagos asociados',
        'HAS_PAYMENTS'
      );
    }
    
    await prisma.auction.delete({
      where: { id: auctionId },
    });
    
    Logger.info(`Subasta eliminada: ${auctionId} - ${auction.asset.placa}`);
    
    return { success: true };
  }
  
  /**
   * Obtener subastas vencidas que requieren procesamiento automático
   */
  async getExpiredAuctions() {
    const now = new Date();
    
    const expiredAuctions = await prisma.auction.findMany({
      where: {
        estado: 'pendiente',
        fecha_limite_pago: {
          lte: now,
        },
      },
      include: {
        asset: true,
        offers: {
          where: { estado: 'activa' },
          include: {
            user: true,
          },
        },
      },
    });
    
    return expiredAuctions;
  }
}

module.exports = new AuctionService();