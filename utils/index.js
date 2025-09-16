// Exportar todas las utilidades desde un punto central
const {
  baseSchemas,
  userSchemas,
  auctionSchemas,
  offerSchemas,
  guaranteePaymentSchemas,
  refundSchemas,
  querySchemas,
  validate,
} = require('./validations');

const {
  businessCalculations,
  formatters,
  businessValidations,
  stateHelpers,
  paginationHelpers,
  timeHelpers,
  sanitizers,
} = require('./helpers');

module.exports = {
  // Validaciones
  validations: {
    baseSchemas,
    userSchemas,
    auctionSchemas,
    offerSchemas,
    guaranteePaymentSchemas,
    refundSchemas,
    querySchemas,
    validate,
  },
  
  // Helpers
  businessCalculations,
  formatters,
  businessValidations,
  stateHelpers,
  paginationHelpers,
  timeHelpers,
  sanitizers,
};