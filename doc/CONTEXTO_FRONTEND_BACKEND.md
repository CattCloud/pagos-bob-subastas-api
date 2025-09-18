# CONTEXTO FRONTEND-BACKEND: Guía para Desarrollo del Cliente

## **INTRODUCCIÓN**

Esta documentación es el **punto de entrada principal** para el desarrollo del frontend de BOB Subastas. El sistema utiliza una **arquitectura completamente separada** donde:

- **Backend (API REST)**: Sistema de gestión de pagos y saldos (este proyecto)
- **Frontend (Cliente Web)**: Interfaz de usuario independiente que consume el API

El frontend se conectará al backend a través de **llamadas HTTP al API REST** documentado en este proyecto.

---

## **DOCUMENTACIÓN OBLIGATORIA DE REFERENCIA**

### **📋 Documentos de Contexto del Sistema:**
- [`doc/Prerequisitos.md`](doc/Prerequisitos.md) - **CRÍTICO**: Problema, objetivos, reglas de negocio (RN01-RN17), flujo completo
- [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md) - **CRÍTICO**: Endpoints, contratos, ejemplos de request/response, códigos de error
- [`doc/Notificaciones.md`](doc/Notificaciones.md) - Sistema dual de notificaciones UI + correo
- [`doc/ColoresFrontend.md`](doc/ColoresFrontend.md) - Paleta de colores y guía visual del sistema

### **📋 Historias de Usuario Detalladas (doc/HU Detalladas/):**
Cada HU contiene criterios de aceptación, validaciones de negocio, UX/UI y casos de uso específicos:

**Autenticación y Usuarios:**
- [`doc/HU Detalladas/HU - Identificación de Cliente.md`](doc/HU%20Detalladas/HU%20-%20Identificación%20de%20Cliente.md)

**Pagos y Validaciones:**
- [`doc/HU Detalladas/HU - Registro de Pago de Garantía (Cliente).md`](doc/HU%20Detalladas/HU%20-%20Registro%20de%20Pago%20de%20Garantía%20(Cliente).md)
- [`doc/HU Detalladas/HU - Validacion de Pago de Garantías(ADMIN).md`](doc/HU%20Detalladas/HU%20-%20Validacion%20de%20Pago%20de%20Garantías(ADMIN).md)

**Gestión de Subastas:**
- [`doc/HU Detalladas/HU- Gestión de Subastas (ADMIN).md`](doc/HU%20Detalladas/HU-%20Gestión%20de%20Subastas%20(ADMIN).md)

**Competencia Externa:**
- [`doc/HU Detalladas/HU-COMP-01 - Gestionar Resultado Competencia Externa (Admin).md`](doc/HU%20Detalladas/HU-COMP-01%20-%20Gestionar%20Resultado%20Competencia%20Externa%20(Admin).md)
- [`doc/HU Detalladas/HU-COMP-02 - Procesar Resultado BOB Gano (Admin).md`](doc/HU%20Detalladas/HU-COMP-02%20-%20Procesar%20Resultado%20BOB%20Gano%20(Admin).md)
- [`doc/HU Detalladas/HU-COMP-03 - Procesar Resultado BOB Perdio (Admin).md`](doc/HU%20Detalladas/HU-COMP-03%20-%20Procesar%20Resultado%20BOB%20Perdio%20(Admin).md)
- [`doc/HU Detalladas/HU-COMP-04 - Procesar Resultado Cliente No Pago Vehiculo (Admin).md`](doc/HU%20Detalladas/HU-COMP-04%20-%20Procesar%20Resultado%20Cliente%20No%20Pago%20Vehiculo%20(Admin).md)

**Facturación:**
- [`doc/HU Detalladas/HU-BILL-01 - Completar Datos Facturacion (Cliente).md`](doc/HU%20Detalladas/HU-BILL-01%20-%20Completar%20Datos%20Facturacion%20(Cliente).md)

**Reembolsos:**
- [`doc/HU Detalladas/HU-REEM-01 - Solicitar Reembolso (Cliente).md`](doc/HU%20Detalladas/HU-REEM-01%20-%20Solicitar%20Reembolso%20(Cliente).md)
- [`doc/HU Detalladas/HU-REEM-02 - Gestionar Solicitudes Reembolso (Admin).md`](doc/HU%20Detalladas/HU-REEM-02%20-%20Gestionar%20Solicitudes%20Reembolso%20(Admin).md)
- [`doc/HU Detalladas/HU-REEM-03 - Procesar Reembolso (Admin).md`](doc/HU%20Detalladas/HU-REEM-03%20-%20Procesar%20Reembolso%20(Admin).md)
- [`doc/HU Detalladas/HU-REEM-04 - Historial Reembolsos (Cliente).md`](doc/HU%20Detalladas/HU-REEM-04%20-%20Historial%20Reembolsos%20(Cliente).md)
- [`doc/HU Detalladas/HU-REEM-05 - Detalle Reembolso (Cliente).md`](doc/HU%20Detalladas/HU-REEM-05%20-%20Detalle%20Reembolso%20(Cliente).md)

**Saldos y Transacciones:**
- [`doc/HU Detalladas/HU-SALDO-01 - Mi Saldo (Cliente).md`](doc/HU%20Detalladas/HU-SALDO-01%20-%20Mi%20Saldo%20(Cliente).md)
- [`doc/HU Detalladas/HU-TRANS-01 - Historial Transacciones (Cliente).md`](doc/HU%20Detalladas/HU-TRANS-01%20-%20Historial%20Transacciones%20(Cliente).md)

**Notificaciones:**
- [`doc/HU Detalladas/HU-NOT-01 - Panel Notificaciones (Cliente).md`](doc/HU%20Detalladas/HU-NOT-01%20-%20Panel%20Notificaciones%20(Cliente).md)
- [`doc/HU Detalladas/HU-NOT-02 - Panel Notificaciones (Admin).md`](doc/HU%20Detalladas/HU-NOT-02%20-%20Panel%20Notificaciones%20(Admin).md)

**Penalidades:**
- [`doc/HU Detalladas/HU-PEN-01 - Aplicar Penalidad (Admin).md`](doc/HU%20Detalladas/HU-PEN-01%20-%20Aplicar%20Penalidad%20(Admin).md)

---

## **CONEXIÓN AL BACKEND**

### **Configuración Base:**
```javascript
const API_BASE = 'http://localhost:3000'; // Desarrollo
// const API_BASE = 'https://api.bobsubastas.com'; // Producción

// Headers requeridos en TODAS las peticiones autenticadas
const headers = {
  'X-Session-ID': sessionId, // Obtenido del login
  'Content-Type': 'application/json'
};
```

### **Autenticación (Sin password):**
```javascript
// LOGIN CLIENTE - Identificación por documento
POST /auth/client-login
{
  "document_type": "DNI|CE|RUC|Pasaporte",
  "document_number": "12345678"
}
// Respuesta: { success: true, data: { user, session } }

// LOGIN ADMIN - Acceso automático
POST /auth/admin-access
// Respuesta: { success: true, data: { user, session } }
```

### **Gestión de Sesiones:**
- **Duración**: 1 hora desde última actividad
- **Renovación**: Automática con cada request válido
- **Header**: `X-Session-ID` en TODAS las peticiones autenticadas

---

## **FÓRMULA CENTRAL DEL SISTEMA**

**CRÍTICO - Implementar en frontend para mostrar saldos:**

```javascript
// Fórmula oficial implementada en el backend
Saldo Disponible = Saldo Total - Saldo Retenido - Saldo Aplicado

// El backend ya calcula esto, pero el frontend debe entender la lógica para UX
```

**Significado de cada saldo:**
- **Total**: Dinero que el cliente ha ingresado al sistema
- **Retenido**: Dinero temporalmente congelado (pagos validados esperando competencia)
- **Aplicado**: Dinero ya utilizado en compras completadas (facturación)
- **Disponible**: Dinero que el cliente puede usar o solicitar reembolso

---

## **FLUJOS PRINCIPALES DEL SISTEMA**

### **📊 Tests como Ejemplos de Uso (tests/):**

Los siguientes archivos contienen **ejemplos reales de uso del API** que el frontend debe implementar:

**Flujos Básicos:**
- [`tests/flow1-bob-ganada-tests.js`](tests/flow1-bob-ganada-tests.js) - BOB gana competencia → facturación
- [`tests/flow2-bob-perdida-refund-tests.js`](tests/flow2-bob-perdida-refund-tests.js) - BOB pierde → reembolso devolver_dinero
- [`tests/flow3-bob-penalidad-tests.js`](tests/flow3-bob-penalidad-tests.js) - Cliente no paga → penalidad 30% + reembolso 70%
- [`tests/flow4-bob-perdida-mantener-saldo-tests.js`](tests/flow4-bob-perdida-mantener-saldo-tests.js) - BOB pierde → reembolso mantener_saldo

**Flujos Avanzados:**
- [`tests/flow6-multiples-subastas-mixto-tests.js`](tests/flow6-multiples-subastas-mixto-tests.js) - Cliente con 4 subastas simultáneas (resultados mixtos)
- [`tests/flow7-subasta-vencida-tests.js`](tests/flow7-subasta-vencida-tests.js) - Subasta vencida por no pago (sin impacto financiero)
- [`tests/flow8-extiende-plazo-pago-tests.js`](tests/flow8-extiende-plazo-pago-tests.js) - Admin extiende plazo de pago
- [`tests/flow9-reintentos-pago-rechazado-tests.js`](tests/flow9-reintentos-pago-rechazado-tests.js) - Múltiples rechazos hasta aprobar

**Tests de Integración:**
- [`tests/hu-bill-refund-tests.js`](tests/hu-bill-refund-tests.js) - End-to-end de billing y reembolsos
- [`testedge-balance-testss/edge-balance-tests.js`](tests/edge-balance-tests.js) - Casos edge de balances
- [`validaciones-negocio-tests`](tests/validaciones-negocio-tests.js) 
---

## **ENDPOINTS CRÍTICOS PARA FRONTEND**

### **🔐 Autenticación:**
```javascript
// Diferenciación por rutas (según Prerequisitos.md)
// Cliente: acceso por /pago-subastas
// Admin: acceso por /admin-subastas

POST /auth/client-login    // Cliente se identifica con documento
POST /auth/admin-access    // Admin acceso directo
```

### **💰 Saldos y Transacciones:**
```javascript
GET /users/:id/balance     // Saldo calculado en tiempo real
GET /users/:id/movements   // Historial de transacciones
```

### **🏦 Pagos de Garantía:**
```javascript
POST /movements            // Cliente registra pago (multipart/form-data)
PATCH /movements/:id/approve  // Admin aprueba
PATCH /movements/:id/reject   // Admin rechaza
```

### **🏆 Gestión de Subastas:**
```javascript
GET /auctions             // Listar subastas (admin)
POST /auctions            // Crear subasta (admin)
POST /auctions/:id/winner // Registrar ganador (admin)
PATCH /auctions/:id/competition-result // Resultado competencia (admin)
```

### **💸 Reembolsos:**
```javascript
POST /refunds             // Solicitar reembolso (cliente) - REQUIERE auction_id
PATCH /refunds/:id/manage // Confirmar/rechazar (admin)
PATCH /refunds/:id/process // Procesar reembolso (admin)
```

### **🧾 Facturación:**
```javascript
POST /billing             // Completar datos facturación (cliente)
```

### **🔔 Notificaciones:**
```javascript
GET /notifications        // Listar notificaciones
PATCH /notifications/mark-all-read    // Marcar todas como leídas
PATCH /notifications/:id/read         // Marcar una como leída
```

---

## **REGLAS DE NEGOCIO CRÍTICAS PARA UX**

### **🚨 Validaciones de Frontend (Prerequisitos.md RN02-RN15):**

**Pagos de Garantía:**
- Monto DEBE ser exactamente 8% de la oferta ganadora
- Solo ganadores de subastas pueden registrar pagos
- Fecha de pago no puede ser futura ni anterior al inicio de subasta

**Saldos:**
- Saldo disponible NUNCA puede ser negativo
- Reembolsos solo de saldo disponible (no retenido)
- Fórmula: `Disponible = Total - Retenido - Aplicado`

**Estados de Subasta:**
- `finalizada` → dinero retenido (esperando competencia)
- `ganada` → mantener retención (esperando facturación)
- `facturada` → liberar retención + aplicar saldo
- `perdida` → mantener retención (hasta procesar reembolso)
- `penalizada` → liberar retención (penalidad + reembolso ya aplicados)

**Reembolsos:**
- Requieren `auction_id` obligatorio (cambio reciente)
- Tipos: `mantener_saldo` (queda en sistema) vs `devolver_dinero` (transferencia)
- Solo una solicitud pendiente por cliente

---

## **NAVEGACIÓN PROPUESTA (Prerequisitos.md)**

### **CLIENTE (/pago-subastas):**
- **Mis Garantías** (pantalla principal)
- **Notificaciones** (badge con contador)
- **Pagar Garantía**
- **Mi Saldo** (calculado desde transacciones)
- **Historial de Transacciones**
- **Solicitar Reembolso**

### **ADMIN (/admin-subastas):**
- **Pagos de Garantía** (pantalla principal)
- **Gestión de Subastas**
- **Nueva Subasta**
- **Resultados de Competencia**
- **Gestión de Saldos**
- **Gestión de Facturación**
- **Gestión de Reembolsos**

---

## **EJEMPLOS DE INTEGRACIÓN CON EL API**

### **🔍 Consultar Saldo de Cliente:**
```javascript
// Ver tests/flow1-bob-ganada-tests.js línea 159
const response = await fetch(`${API_BASE}/users/${userId}/balance`, {
  headers: { 'X-Session-ID': sessionId }
});
const { data } = await response.json();
// data.balance contiene: saldo_total, saldo_retenido, saldo_aplicado, saldo_disponible
```

### **💳 Registrar Pago de Garantía:**
```javascript
// Ver tests/flow1-bob-ganada-tests.js línea 122
const form = new FormData();
form.append('auction_id', auctionId);
form.append('monto', String(guaranteeAmount));
form.append('tipo_pago', 'transferencia');
form.append('numero_cuenta_origen', '1234567890');
form.append('numero_operacion', 'OP-ABC123');
form.append('fecha_pago', new Date().toISOString());
form.append('voucher', fileBlob, 'voucher.png');

const response = await fetch(`${API_BASE}/movements`, {
  method: 'POST',
  headers: { 'X-Session-ID': sessionId },
  body: form
});
```

### **💸 Solicitar Reembolso:**
```javascript
// Ver tests/flow2-bob-perdida-refund-tests.js línea 172
const response = await fetch(`${API_BASE}/refunds`, {
  method: 'POST',
  headers: { 'X-Session-ID': sessionId, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    auction_id: auctionId,        // OBLIGATORIO desde HU-REEM-01
    monto_solicitado: amount,
    tipo_reembolso: 'devolver_dinero', // o 'mantener_saldo'
    motivo: 'Explicación del cliente'
  })
});
```

### **🔔 Obtener Notificaciones:**
```javascript
// Ver tests/hu-bill-refund-tests.js línea 154
const response = await fetch(`${API_BASE}/notifications?limit=10`, {
  headers: { 'X-Session-ID': sessionId }
});
// Filtros disponibles: estado, tipo, fecha_desde, fecha_hasta, page, limit
```

---

## **TIPOS DE DATOS Y VALIDACIONES**

### **🎯 Documentos de Identificación:**
```javascript
document_type: 'DNI' | 'CE' | 'RUC' | 'Pasaporte'
// DNI: 8 dígitos, CE: 9 dígitos, RUC: 11 dígitos, Pasaporte: 6-12 alfanumérico
```

### **💰 Montos y Decimales:**
```javascript
// Todos los montos con máximo 2 decimales
// Máximo: 999,999.99
// Garantía: monto_oferta * 0.08 (8%)
```

### **📅 Fechas:**
```javascript
// Formato ISO 8601 requerido: "2024-01-21T12:00:00Z"
// Fechas futuras para inicio/fin de subastas
```

### **📎 Archivos:**
```javascript
// Vouchers/comprobantes: PDF, JPG, PNG (máximo 5MB)
// Subida a Cloudinary automática en backend
```

---

## **ESTADOS DEL SISTEMA**

### **📊 Estados de Subasta:**
```javascript
// Flujo principal:
'activa' → 'pendiente' → 'en_validacion' → 'finalizada'
         ↓
// Resultado competencia:
'ganada' → 'facturada'  // Cliente completa facturación
'perdida'               // BOB perdió → reembolso
'penalizada'           // Cliente no pagó → penalidad + reembolso parcial
'vencida'              // Cliente no registró pago a tiempo

// Estados especiales:
'cancelada'            // Cancelada manualmente
```

### **💳 Estados de Movement:**
```javascript
'pendiente'   // Pago registrado, esperando validación admin
'validado'    // Pago aprobado → afecta saldos
'rechazado'   // Pago rechazado → NO afecta saldos
```

### **💸 Estados de Refund:**
```javascript
'solicitado'  // Cliente solicita
'confirmado'  // Admin confirma telefónicamente
'rechazado'   // Admin rechaza
'procesado'   // Admin procesa → Movement validado creado
```

### **🔔 Estados de Notification:**
```javascript
'pendiente'   // No vista por usuario
'vista'       // Marcada como leída

// Email status independiente:
'pendiente' | 'enviado' | 'fallido'
```

---

## **CASOS DE USO PRINCIPALES**

### **🎯 Cliente Gana Subasta:**
1. Login cliente → HU-Identificación
2. Ve que ganó (notificación) → HU-NOT-01
3. Registra pago garantía → HU-Registro Pago
4. Espera validación admin
5. **BOB compete externamente**
6. Si BOB gana: completa facturación → HU-BILL-01
7. Si BOB pierde: solicita reembolso → HU-REEM-01

### **🎯 Admin Gestiona Subasta:**
1. Login admin
2. Crea subasta → HU-Gestión Subastas
3. Registra ganador → HU-Gestión Subastas
4. Valida pago garantía → HU-Validación Pagos
5. Registra resultado competencia → HU-COMP-01
6. Procesa facturación/reembolso/penalidad → HU-COMP-02/03/04

---

## **NOTIFICACIONES AUTOMÁTICAS**

**Sistema dual UI + correo** (ver [`doc/Notificaciones.md`](doc/Notificaciones.md)):

**Tipos implementados:**
- `ganador_subasta` - Cliente ganó subasta
- `pago_registrado` - Admin: pago pendiente validación  
- `pago_validado` - Cliente: pago aprobado
- `pago_rechazado` - Cliente: pago rechazado
- `competencia_ganada` - Cliente: BOB ganó competencia externa
- `competencia_perdida` - Cliente: BOB perdió competencia externa
- `penalidad_aplicada` - Cliente: penalidad por no pagar vehículo
- `facturacion_completada` - Cliente: factura generada exitosamente
- `billing_generado` - Admin: nueva factura creada
- `reembolso_procesado` - Cliente: reembolso completado
- `reembolso_solicitado` - Admin: nueva solicitud de reembolso

---

## **MANEJO DE ERRORES**

### **📋 Códigos de Estado Esperados:**
```javascript
200 - Operación exitosa
201 - Recurso creado
400 - Datos inválidos (validación Joi)
401 - No autenticado (sesión expirada)
403 - Sin permisos (rol incorrecto)
404 - Recurso no encontrado
409 - Conflicto de estado de negocio
422 - Validación de negocio fallida
500 - Error interno servidor
```

### **📋 Estructura de Error Estándar:**
```javascript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje amigable para usuario",
    "isOperational": true,
    "details": { "field": "monto", "expected": 960.00 },
    "timestamp": "2024-01-21T12:00:00Z"
  }
}
```

---

## **CONSIDERACIONES TÉCNICAS**

### **🚀 Performance:**
- Saldos calculados en tiempo real (cache automático en backend)
- Paginación disponible en listados: `?page=1&limit=20`
- Filtros por fechas: `?fecha_desde=2024-01-01&fecha_hasta=2024-01-31`

### **📱 Responsivo:**
- Compatible móvil y desktop (ver [`doc/ColoresFrontend.md`](doc/ColoresFrontend.md))
- Archivos de hasta 5MB para vouchers

### **🔒 Seguridad:**
- Validación de sesión en cada request
- Autorización por rol (admin/cliente)
- Datos sensibles manejados por backend

### **📊 Tiempo Real:**
- Notificaciones aparecen inmediatamente en UI
- Saldos actualizados automáticamente tras operaciones
- Estados de subasta reflejan progreso en tiempo real

---

## **ARQUITECTURA DE DATOS (FRONTEND)**

### **🗃️ Store/Estado Sugerido:**
```javascript
// Estado global recomendado
{
  auth: {
    user: { id, name, document, user_type },
    session: { session_id, expires_at },
    isAuthenticated: boolean
  },
  balance: {
    saldo_total: number,
    saldo_retenido: number, 
    saldo_aplicado: number,
    saldo_disponible: number,
    updated_at: string
  },
  notifications: {
    items: [],
    unreadCount: number,
    pagination: { page, limit, total }
  },
  auctions: { ... },
  movements: { ... },
  refunds: { ... }
}
```

---

## **PRÓXIMOS PASOS**

1. **Revisar documentación completa** en [`doc/Prerequisitos.md`](doc/Prerequisitos.md) y [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md)
2. **Estudiar los tests** como ejemplos de flujos reales
3. **Implementar autenticación** según diferenciación de rutas
4. **Desarrollar pantallas principales** según HU detalladas
5. **Integrar sistema de notificaciones** dual UI + correo
6. **Validar todos los flujos** contra los tests existentes

---

## **SOPORTE Y DEBUGGING**

### **🔧 Herramientas de Desarrollo:**
- Servidor backend: `npm run dev` en puerto 3000
- Tests disponibles: `node tests/flow1-bob-ganada-tests.js` (y otros)
- Base de datos: SQLite en desarrollo, consultar con Prisma Studio

### **📞 Recursos de Ayuda:**
- Logs detallados en backend para debugging
- Estructura de errores consistente para handling
- Tests como documentación ejecutable de cada flujo

**El frontend puede comenzar desarrollo inmediatamente con esta documentación como guía principal.**