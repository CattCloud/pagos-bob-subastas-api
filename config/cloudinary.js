const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración de almacenamiento en memoria para luego subir a Cloudinary
const storage = multer.memoryStorage();

// Configurar multer para vouchers
const uploadVoucher = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB límite
  },
  fileFilter: (req, file, cb) => {
    // Verificar tipos de archivo permitidos
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se aceptan JPG, PNG y PDF'), false);
    }
  },
});

// Función para subir archivo a Cloudinary
const uploadToCloudinary = async (fileBuffer, fileName, userId = 'unknown') => {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const publicId = `voucher_${userId}_${timestamp}`;
    
    cloudinary.uploader.upload_stream(
      {
        folder: 'bob-subastas/vouchers',
        public_id: publicId,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(fileBuffer);
  });
};

// Función para eliminar archivo de Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error eliminando archivo de Cloudinary:', error);
    throw error;
  }
};

// Función para obtener URL optimizada
const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...options,
  });
};

// Función para extraer public_id de una URL de Cloudinary
const extractPublicId = (cloudinaryUrl) => {
  try {
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
    const match = cloudinaryUrl.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
};

// Función para validar configuración de Cloudinary
const validateCloudinaryConfig = () => {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Configuración de Cloudinary incompleta. Faltan: ${missing.join(', ')}`);
  }
  
  return true;
};

module.exports = {
  cloudinary,
  uploadVoucher,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedUrl,
  extractPublicId,
  validateCloudinaryConfig,
};