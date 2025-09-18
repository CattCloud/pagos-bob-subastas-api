# BOB Subastas API

API backend para el sistema de gestión de pagos de garantía en subastas industriales de BOB Subastas. Sistema que automatiza y valida el proceso de pagos del 8% de garantía, cálculo de saldos y gestión de reembolsos.

## Características Principales

- ✅ Gestión completa de subastas y activos
- ✅ Sistema de ganadores con reasignaciones automáticas
- ✅ Registro y validación de pagos de garantía como Movement
- ✅ Gestión automática de saldos (cache en User) y movimientos (Movement)
- ✅ Facturación (Billing) y Reembolsos (Refunds)
- ✅ Notificaciones persistentes y envío de correos (EmailJS S2S)
- ✅ Jobs automáticos para vencimientos y penalidades
- ✅ Subida de archivos a Cloudinary
- ✅ Sesiones simples por header (sin auth tradicional)
- ✅ Endpoints REST documentados

## Stack Tecnológico

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | 18+ | Runtime de JavaScript |
| **Express.js** | 5.x | Framework web |
| **PostgreSQL** | 14+ | Base de datos principal |
| **Prisma** | 6.x | ORM y migraciones |
| **Cloudinary** | 2.x | Almacenamiento de archivos |
| **Winston** | 3.x | Sistema de logging |
| **Joi** | 18.x | Validación de datos |
| **Node-cron** | 4.x | Jobs programados |

## Instalación

### Prerrequisitos

- **Node.js 18+** y npm
- **PostgreSQL 14+** (local o Neon Cloud)
- **Cuenta de Cloudinary** para almacenamiento de archivos
- **Git** para control de versiones

### 1. Clonar el repositorio

```bash
git clone https://github.com/CattCloud/pagos-bob-subastas-api.git
cd pagos-bob-subastas-api
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env

# Editar .env con tus datos reales
```

**Variables requeridas en `.env`:**

```env
# DATABASE (PostgreSQL)
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"
DIRECT_URL="postgresql://username:password@hostname/database?sslmode=require"

# CLOUDINARY
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# SERVIDOR
PORT=3000
NODE_ENV=development
SESSION_SECRET=tu_clave_secreta_muy_segura

# FRONTEND
FRONTEND_URL=http://localhost:5173

# EMAILJS (Server-to-Server)
EMAILJS_SERVICE_ID=service_xxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx
EMAILJS_PRIVATE_KEY=xxxxxxxxxxxxxxxx
EMAIL_SENDER_NAME="BOB Subastas"
EMAIL_SENDER="no-reply@bobsubastas.com"
```

### 4. Configurar base de datos

```bash
# Generar cliente de Prisma
npm run db:generate

# Aplicar schema a la base de datos
npm run db:push

# Poblar datos iniciales (admin y usuarios de prueba)
npm run db:seed
```

### 5. Iniciar servidor

```bash
# Desarrollo 
npm run dev

# Producción
npm start
```

El servidor estará disponible en: `http://localhost:3000`

---

## Comandos Disponibles

### Base de datos
```bash
npm run db:generate     # Generar cliente Prisma
npm run db:push         # Aplicar schema sin migraciones
npm run db:migrate      # Crear migración nueva
npm run db:studio       # Abrir Prisma Studio
npm run db:seed         # Poblar datos iniciales
npm run db:reset        # Resetear DB completa (¡cuidado!)
npm run db:setup        # Setup completo: push + generate + seed
```

### Servidor
```bash
npm start               # Iniciar en producción
npm run dev             # Iniciar en desarrollo
npm run test            # Ejecutar pruebas básicas
npm run test:endpoints  # Probar endpoints (servidor debe estar corriendo)
```

---

## Estructura del Proyecto

```
├── config/                 # Configuraciones (DB, Cloudinary, etc.)
├── controllers/           # Controladores de endpoints
├── middleware/            # Auth, logging, manejo de errores
├── services/              # Lógica de negocio
├── routes/                # Definición de rutas
├── utils/                 # Validaciones y helpers
├── jobs/                  # Jobs programados/cron
├── prisma/                # Schema y migraciones
├── tests/                 # Pruebas y documentación
├── logs/                  # Archivos de log (creados automáticamente)
├── doc/                   # Documentación del proyecto
├── .env.example           # Plantilla de variables de entorno
└── index.js               # Punto de entrada principal
```

---

## Endpoints Principales

### Health Check
```
GET /                # Estado del servidor
```

### Autenticación
```
POST /auth/client-login     # Login cliente por documento
POST /auth/admin-access     # Acceso automático admin
GET /auth/session          # Validar sesión
POST /auth/logout          # Cerrar sesión
```

### Subastas (Admin)
```
GET /auctions              # Listar subastas
POST /auctions             # Crear subasta
POST /auctions/:id/winner  # Asignar ganador
```

### Movements (Transacciones)
```
GET /movements                          # Listar transacciones (admin: todas, cliente: propias)
POST /movements                         # Registrar pago de garantía (Cliente) como Movement
PATCH /movements/:id/approve            # Aprobar Movement de pago (Admin)
PATCH /movements/:id/reject             # Rechazar Movement de pago (Admin)
GET /movements/:id/voucher              # Descargar comprobante
```

**Ver lista completa**: [`tests/endpoints-summary.md`](tests/endpoints-summary.md)

---

## Jobs Automáticos

El sistema incluye jobs programados que se ejecutan automáticamente:

| Job | Frecuencia | Descripción |
|-----|------------|-------------|
| **Subastas vencidas** | Cada 30 min | Aplica penalidades y marca vencidas |
| **Próximos vencimientos** | Cada hora | Logs de advertencia para vencimientos |
| **Reporte diario** | 6:00 AM | Estadísticas del día anterior |
| **Limpieza sesiones** | Cada 4 horas | Complementa limpieza del middleware |

### Ejecutar jobs manualmente:
```bash
# Con la API corriendo
curl -X POST http://localhost:3000/api/jobs/process-expired \
  -H "X-Session-ID: tu_session_id_admin"
```

---

## Documentación de API

- **Endpoints completos**: [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md)
- **Reglas de negocio**: [`doc/Prerequisitos.md`](doc/Prerequisitos.md)
- **Arquitectura**: [`doc/Arquitectura y Stack.md`](doc/Arquitectura%20y%20Stack.md)
- **Historias de usuario**: [`doc/HU Detalladas/`](doc/HU%20Detalladas/)

---

## Deployment

### Desarrollo Local
1. Seguir pasos de instalación arriba
2. Usar base de datos local PostgreSQL
3. `npm run dev`

### Producción (Railway/Render)

#### 1. Preparar para deployment
```bash
# Agregar al .gitignore
echo ".env" >> .gitignore
echo "logs/" >> .gitignore
```

#### 2. Variables de entorno en producción
- Configurar todas las variables del `.env.example`
- Usar URLs de producción para DATABASE_URL y FRONTEND_URL
- Usar SESSION_SECRET seguro (32+ caracteres aleatorios)

#### 3. Scripts de deployment
```json
{
  "scripts": {
    "build": "prisma generate",
    "start": "node index.js",
    "postdeploy": "prisma db push && node prisma/seed.js"
  }
}
```

#### 4. Configuración Railway/Render
- **Puerto**: Variable `PORT` (automática)
- **Base de datos**: Usar addon PostgreSQL
- **Comando de inicio**: `npm start`
- **Comando de build**: `npm run build`

---

## Configuración Adicional

### PostgreSQL (Neon Cloud)
1. Crear cuenta en [Neon](https://neon.tech)
2. Crear nueva base de datos
3. Copiar `DATABASE_URL` y `DIRECT_URL` al `.env`

### Cloudinary
1. Crear cuenta en [Cloudinary](https://cloudinary.com)
2. Obtener credenciales del dashboard
3. Configurar en `.env`

### Logging
- Los logs se guardan en `logs/combined.log` y `logs/error.log`
- En desarrollo: logs en consola con colores
- En producción: logs solo en archivos

---

## Testing

### Prueba rápida
```bash
# 1. Iniciar servidor
npm run dev

# 2. En otra terminal, probar health check
curl http://localhost:3000/health

# 3. Login admin
curl -X POST http://localhost:3000/api/auth/admin-access \
  -H "Content-Type: application/json"

# 4. Ejecutar suite de pruebas completa
npm run test:endpoints
```

### Con herramientas GUI
- **Postman**: Importar endpoints desde `doc/DocumentacionAPI.md`


---

## Contribución

1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Add: nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

