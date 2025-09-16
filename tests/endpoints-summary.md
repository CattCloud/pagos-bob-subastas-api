# Resumen de Endpoints Implementados - BOB Subastas API

## ENDPOINTS DISPONIBLES

### **AUTENTICACIÓN** (`/api/auth`)
- `POST /api/auth/client-login` - Login de cliente por documento
- `POST /api/auth/admin-access` - Acceso automático de admin
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/session` - Validar sesión activa
- `GET /api/auth/sessions/stats` - Estadísticas de sesiones (Admin)

### **SUBASTAS** (`/api/auctions`)
- `GET /api/auctions/stats` - Estadísticas de subastas (Admin)
- `GET /api/auctions/expired` - Subastas vencidas (Admin)
- `GET /api/auctions` - Listar subastas con filtros
- `POST /api/auctions` - Crear nueva subasta (Admin)
- `GET /api/auctions/:id` - Detalle de subasta específica
- `POST /api/auctions/:id/winner` - Registrar ganador (Admin)
- `POST /api/auctions/:id/reassign-winner` - Reasignar ganador (Admin)
- `PATCH /api/auctions/:id/status` - Cambiar estado (Admin)
- `PATCH /api/auctions/:id/extend-deadline` - Extender plazo (Admin)
- `DELETE /api/auctions/:id` - Eliminar subasta (Admin)

### **USUARIOS** (`/api/users`)
- `GET /api/users/:userId/won-auctions` - Subastas ganadas por cliente
- `GET /api/users/:userId/can-participate` - Verificar elegibilidad
- `GET /api/users/:userId/balance` - Saldo de usuario
- `GET /api/users/:userId/movements` - Movimientos de usuario
- `POST /api/users/:userId/movements/manual` - Movimiento manual (Admin)
- `GET /api/users/offers/stats` - Estadísticas de ofertas (Admin)

### **PAGOS DE GARANTÍA** (`/api/guarantee-payments`)
- `GET /api/guarantee-payments/stats` - Estadísticas de pagos (Admin)
- `GET /api/guarantee-payments` - Listar pagos con filtros
- `POST /api/guarantee-payments` - Registrar pago (Cliente)
- `GET /api/guarantee-payments/:id` - Detalle de pago específico
- `PATCH /api/guarantee-payments/:id/approve` - Aprobar pago (Admin)
- `PATCH /api/guarantee-payments/:id/reject` - Rechazar pago (Admin)
- `GET /api/guarantee-payments/:id/voucher` - Descargar comprobante

### **SALDOS** (`/api/balances`)
- `GET /api/balances/dashboard` - Resumen financiero (Admin)
- `GET /api/balances/stats` - Estadísticas de saldos (Admin)
- `GET /api/balances/summary` - Resumen de todos los saldos (Admin)

### **JOBS** (`/api/jobs`)
- `GET /api/jobs/status` - Estado de jobs programados (Admin)
- `GET /api/jobs/list` - Lista de jobs disponibles (Admin)
- `POST /api/jobs/run/:jobName` - Ejecutar job manual (Admin)
- `POST /api/jobs/process-expired` - Procesar vencidos (Admin)
- `GET /api/jobs/check-upcoming` - Verificar próximos vencimientos (Admin)
- `GET /api/jobs/daily-report` - Reporte diario (Admin)

---

##  **CONTROL DE ACCESO**

### Admin Only (22 endpoints)
- Todas las rutas de `/api/jobs`
- Todas las rutas de `/api/balances`
- Gestión de subastas (crear, editar, eliminar)
- Validación de pagos (aprobar/rechazar)
- Estadísticas y reportes

### Client Only (3 endpoints)
- `POST /api/guarantee-payments` - Registrar pago

### Both Admin & Client (12 endpoints)
- Autenticación básica
- Consulta de datos propios (cliente) / todos (admin)
- Descarga de comprobantes

---

## **FUNCIONALIDADES CORE IMPLEMENTADAS**

✅ **Gestión completa de subastas y activos**
✅ **Sistema de ganadores y reasignaciones automáticas**
✅ **Registro y validación de pagos de garantía**
✅ **Gestión completa de saldos con cálculos automáticos**
✅ **Historial detallado de movimientos**
✅ **Jobs automáticos para vencimientos y penalidades**
✅ **Subida de archivos a Cloudinary**
✅ **Sistema de sesiones sin autenticación tradicional**
✅ **Manejo robusto de errores**
✅ **Logging completo con Winston**

---

## **CÓMO PROBAR**

1. **Configurar base de datos**: Actualizar `.env` con PostgreSQL real
2. **Setup inicial**: `npm run db:setup`
3. **Iniciar servidor**: `npm run dev`
4. **Probar check**: GET `http://localhost:3000`
5. **Login admin**: POST `/api/auth/admin-access`
6. **Usar session ID** en header `X-Session-ID` para requests autenticados
7. **Ejecutar pruebas**: `npm run test:endpoints` (requiere servidor corriendo)

---

