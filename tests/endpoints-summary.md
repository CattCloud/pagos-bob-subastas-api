# Resumen de Endpoints Implementados - BOB Subastas API

## ENDPOINTS DISPONIBLES

### **AUTENTICACIÓN** (`/auth`)
- `POST /auth/client-login` - Login de cliente por documento
- `POST /auth/admin-access` - Acceso automático de admin
- `POST /auth/logout` - Cerrar sesión
- `GET /auth/session` - Validar sesión activa
- `GET /auth/sessions/stats` - Estadísticas de sesiones (Admin)

### **SUBASTAS** (`/auctions`)
- `GET /auctions/stats` - Estadísticas de subastas (Admin)
- `GET /auctions/expired` - Subastas vencidas (Admin)
- `GET /auctions` - Listar subastas con filtros
- `POST /auctions` - Crear nueva subasta (Admin)
- `GET /auctions/:id` - Detalle de subasta específica
- `POST /auctions/:id/winner` - Registrar ganador (Admin)
- `POST /auctions/:id/reassign-winner` - Reasignar ganador (Admin)
- `PATCH /auctions/:id/status` - Cambiar estado (Admin)
- `PATCH /auctions/:id/extend-deadline` - Extender plazo (Admin)
- `DELETE /auctions/:id` - Eliminar subasta (Admin)

### **USUARIOS** (`/users`)
- `GET /users/:userId/won-auctions` - Subastas ganadas por cliente
- `GET /users/:userId/can-participate` - Verificar elegibilidad
- `GET /users/:userId/balance` - Saldo de usuario
- `GET /users/:userId/movements` - Movimientos de usuario
- `POST /users/:userId/movements/manual` - Movimiento manual (Admin)
- `GET /users/offers/stats` - Estadísticas de ofertas (Admin)

### **MOVEMENTS (TRANSACCIONES)** (`/movements`)
- `GET /movements` - Listar transacciones (admin: todas, cliente: propias)
- `POST /movements` - Registrar pago de garantía (Cliente) como Movement
- `GET /movements/:id` - Detalle de transacción específica
- `PATCH /movements/:id/approve` - Aprobar Movement de pago (Admin)
- `PATCH /movements/:id/reject` - Rechazar Movement de pago (Admin)
- `GET /movements/:id/voucher` - Descargar comprobante

### **SALDOS** (`/balances`)
- `GET /balances/dashboard` - Resumen financiero (Admin)
- `GET /balances/stats` - Estadísticas de saldos (Admin)
- `GET /balances/summary` - Resumen de todos los saldos (Admin)

### **JOBS** (`/jobs`)
- `GET /jobs/status` - Estado de jobs programados (Admin)
- `GET /jobs/list` - Lista de jobs disponibles (Admin)
- `POST /jobs/run/:jobName` - Ejecutar job manual (Admin)
- `POST /jobs/process-expired` - Procesar vencidos (Admin)
- `GET /jobs/check-upcoming` - Verificar próximos vencimientos (Admin)
- `GET /jobs/daily-report` - Reporte diario (Admin)

---

##  **CONTROL DE ACCESO**

### Admin Only (22 endpoints)
- Todas las rutas de `/jobs`
- Todas las rutas de `/balances`
- Gestión de subastas (crear, editar, eliminar)
- Validación de pagos (aprobar/rechazar)
- Estadísticas y reportes

### Client Only (3 endpoints)
- `POST /movements` - Registrar pago de garantía

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

