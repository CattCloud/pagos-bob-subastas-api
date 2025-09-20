const { prisma } = require('../config/database');
const { paginationHelpers } = require('../utils');

class UserService {
  /**
   * Listar usuarios con filtros y paginación (solo Admin)
   * Filtros soportados:
   *  - search: nombre, apellido, email, documento, teléfono (contains, case-insensitive)
   *  - document_type: DNI | CE | RUC | Pasaporte
   *  - user_type: admin | client
   *  - page, limit
   */
  async listUsers(filters = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      document_type,
      user_type,
    } = filters;

    const offset = paginationHelpers.calculateOffset(page, limit);

    // Construir filtros
    const where = {
      deleted_at: null,
    };

    if (document_type) {
      where.document_type = document_type;
    }

    if (user_type) {
      where.user_type = user_type;
    }

    if (search) {
      const s = String(search).trim();
      where.OR = [
        { first_name: { contains: s, mode: 'insensitive' } },
        { last_name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { document_number: { contains: s, mode: 'insensitive' } },
        { phone_number: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Ejecutar consulta con paginación
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: parseInt(limit),
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
          saldo_total: true,
          saldo_retenido: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const pagination = paginationHelpers.generatePaginationMeta(page, limit, total);

    return { users, pagination };
  }
}

module.exports = new UserService();