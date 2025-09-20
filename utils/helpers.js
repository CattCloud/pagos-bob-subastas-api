const { config } = require('../config');

// CÁLCULOS DE NEGOCIO
const businessCalculations = {
  // Calcular monto de garantía (8% del monto de oferta)
  calculateGuaranteeAmount: (offerAmount) => {
    return Math.round(offerAmount * config.business.guaranteePercentage * 100) / 100;
  },
  
  // Calcular penalidad (30% del saldo disponible)
  calculatePenalty: (availableBalance) => {
    return Math.round(availableBalance * config.business.penaltyPercentage * 100) / 100;
  },
  
  // Calcular saldo disponible
  calculateAvailableBalance: (balance) => {
    const available = balance.saldo_total - 
                     balance.saldo_retenido - 
                     balance.saldo_aplicado - 
                     balance.saldo_en_reembolso - 
                     balance.saldo_penalizado;
    
    return Math.max(0, Math.round(available * 100) / 100); // No permitir negativos
  },
  
  // Verificar si dos montos son iguales (considerando decimales)
  amountsEqual: (amount1, amount2, precision = 0.01) => {
    return Math.abs(amount1 - amount2) < precision;
  },
};

// FORMATEO DE DATOS
const formatters = {
  // Formatear moneda a USD
  currency: (amount, locale = 'es-PE') => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  },
  
  // Formatear fecha a formato local
  date: (date, locale = 'es-PE', options = {}) => {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    
    return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options })
      .format(new Date(date));
  },
  
  // Formatear documento (agregar guiones para RUC)
  document: (type, number) => {
    if (type === 'RUC' && number.length === 11) {
      return `${number.slice(0, 2)}-${number.slice(2, 10)}-${number.slice(10)}`;
    }
    if (type === 'DNI' && number.length === 8) {
      return `${number.slice(0, 4)}-${number.slice(4)}`;
    }
    return number;
  },
  
  // Formatear nombre completo
  fullName: (user) => {
    return `${user.first_name} ${user.last_name}`.trim();
  },
  
  // Formatear placa de vehículo
  licensePlate: (placa) => {
    return placa.toUpperCase().replace(/[^A-Z0-9]/g, '-');
  },
};

// VALIDACIONES DE NEGOCIO
const businessValidations = {
  
  // Validar que la fecha límite de pago sea futura
  isPaymentDeadlineValid: (deadline) => {
    return new Date(deadline) > new Date();
  },
  
  // Validar que el monto de garantía sea correcto
  isGuaranteeAmountValid: (guaranteeAmount, offerAmount) => {
    const expectedAmount = businessCalculations.calculateGuaranteeAmount(offerAmount);
    return businessCalculations.amountsEqual(guaranteeAmount, expectedAmount);
  },
  
  // Validar que haya saldo suficiente para una operación
  hasSufficientBalance: (availableBalance, requiredAmount) => {
    return availableBalance >= requiredAmount;
  },
  
  // Validar formato de placa vehicular
  isValidLicensePlate: (placa) => {
    // Formato peruano: ABC-123 o AB-1234
    const patterns = [
      /^[A-Z]{3}-\d{3}$/, // Formato antiguo: ABC-123
      /^[A-Z]{2}-\d{4}$/, // Formato nuevo: AB-1234
    ];
    
    return patterns.some(pattern => pattern.test(placa.toUpperCase()));
  },
};

// UTILIDADES DE ESTADO
const stateHelpers = {
  // Obtener siguientes estados válidos para una subasta
  getValidAuctionTransitions: (currentState) => {
    const transitions = {
      activa: ['pendiente', 'cancelada'],
      pendiente: ['en_validacion', 'vencida', 'cancelada'],
      en_validacion: ['finalizada', 'pendiente', 'vencida'],
      finalizada: [], // Estado final
      cancelada: [], // Estado final
      vencida: ['pendiente'], // Puede reasignarse
    };
    
    return transitions[currentState] || [];
  },
  
  // Verificar si una transición de estado es válida
  isValidStateTransition: (from, to) => {
    const validTransitions = stateHelpers.getValidAuctionTransitions(from);
    return validTransitions.includes(to);
  },
  
  // Obtener mensaje descriptivo del estado
  getStateDescription: (state, context = 'auction') => {
    const descriptions = {
      auction: {
        activa: 'Subasta activa, sin ganador asignado',
        pendiente: 'Ganador asignado, esperando pago de garantía',
        en_validacion: 'Pago registrado, esperando validación del administrador',
        finalizada: 'Subasta completada exitosamente',
        cancelada: 'Subasta cancelada por el administrador',
        vencida: 'Ganador no realizó pago antes del límite de tiempo',
      },
      payment: {
        pendiente: 'Pago registrado, esperando validación',
        validado: 'Pago aprobado por el administrador',
        rechazado: 'Pago rechazado, debe registrar nuevo pago',
      },
    };
    
    return descriptions[context]?.[state] || 'Estado desconocido';
  },
};

// UTILIDADES DE PAGINACIÓN
const paginationHelpers = {
  // Calcular offset para consultas
  calculateOffset: (page, limit) => {
    return (page - 1) * limit;
  },
  
  // Generar metadata de paginación
  generatePaginationMeta: (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  },
};

// UTILIDADES DE TIEMPO
const timeHelpers = {
  // Agregar horas a una fecha
  addHours: (date, hours) => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    return newDate;
  },
  
  // Verificar si una fecha ya pasó
  isPast: (date) => {
    return new Date(date) < new Date();
  },
  
  // Obtener tiempo restante en formato legible
  getTimeRemaining: (targetDate) => {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;
    
    if (diff <= 0) {
      return 'Vencido';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days} día${days > 1 ? 's' : ''}, ${hours} hora${hours > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hora${hours > 1 ? 's' : ''}, ${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    }
  },
};

// SANITIZACIÓN DE DATOS
const sanitizers = {
  // Limpiar entrada de texto
  sanitizeText: (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/\s+/g, ' ');
  },
  
  // Normalizar placa
  normalizePlate: (placa) => {
    if (!placa) return '';
    return placa.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(\w{2,3})(\d+)/, '$1-$2');
  },
  
  // Normalizar número de documento
  normalizeDocument: (number, type) => {
    if (!number) return '';
    const cleaned = number.replace(/\D/g, '');
    
    // Validar longitud según tipo
    const expectedLengths = {
      DNI: 8,
      CE: 9,
      RUC: 11,
      Pasaporte: [6, 12], // Rango variable
    };
    
    const expected = expectedLengths[type];
    if (Array.isArray(expected)) {
      return cleaned.length >= expected[0] && cleaned.length <= expected[1] ? cleaned : '';
    } else {
      return cleaned.length === expected ? cleaned : '';
    }
  },
};

module.exports = {
  businessCalculations,
  formatters,
  businessValidations,
  stateHelpers,
  paginationHelpers,
  timeHelpers,
  sanitizers,
};