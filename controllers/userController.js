const userService = require('../services/userService');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  validations: { querySchemas, validate },
} = require('../utils');
const { Logger } = require('../middleware/logger');

/**
 * Listar usuarios (solo Admin)
 * GET /users
 * Query:
 *  - search?: string (nombre, apellido, email, documento, teléfono)
 *  - document_type?: 'DNI' | 'CE' | 'RUC' | 'Pasaporte'
 *  - user_type?: 'admin' | 'client'
 *  - page?: number (default 1)
 *  - limit?: number (default 20)
 */
const listUsers = asyncHandler(async (req, res) => {
  const filters = validate(querySchemas.userFilters, req.query);

  Logger.info(`Admin ${req.user.email} listando usuarios`, {
    filters,
  });

  const result = await userService.listUsers(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  listUsers,
};