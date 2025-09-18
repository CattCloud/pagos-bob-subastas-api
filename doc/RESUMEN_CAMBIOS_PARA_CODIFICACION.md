# RESUMEN DE CAMBIOS PARA CODIFICACIÓN - Sistema BOB Subastas

## **🎯 PROPÓSITO DE ESTE DOCUMENTO**

**CONTEXTO CRÍTICO** para el modelo de codificación que debe actualizar el código existente para reflejar completamente los cambios documentados en `DocumentacionCambios.md` y `Notificaciones.md`.

**El código actual fue desarrollado con documentación anterior y NO refleja los cambios críticos implementados.**

---

## **🔴 CAMBIOS CRÍTICOS QUE AFECTAN CÓDIGO**

### **1. ENTIDADES ELIMINADAS COMPLETAMENTE**

#### **❌ `Guarantee_Payment` - ELIMINAR COMPLETAMENTE**
- **Archivos afectados:** 
  - [`controllers/guaranteePaymentController.js`](controllers/guaranteePaymentController.js) → **ELIMINAR**
  - [`services/guaranteePaymentService.js`](services/guaranteePaymentService.js) → **ELIMINAR**
  - [`routes/guaranteePayments.js`](routes/guaranteePayments.js) → **REEMPLAZAR** por `/movements`
- **En Prisma Schema:** Eliminar modelo `GuaranteePayment`
- **Funcionalidad:** Reemplazada 100% por `Movement` tipo `pago_garantia`

#### **❌ `User_Balance` - ELIMINAR COMPLETAMENTE**
- **Archivos afectados:**
  - [`controllers/balanceController.js`](controllers/balanceController.js) → **ACTUALIZAR** para usar cache User + cálculo Billing
  - [`services/balanceService.js`](services/balanceService.js) → **REESCRIBIR** con nueva lógica
- **En Prisma Schema:** Eliminar modelo `UserBalance`
- **Funcionalidad:** Reemplazada por cache automático en `User` + cálculo dinámico

---

### **2. ENTIDADES NUEVAS QUE REQUIEREN CÓDIGO COMPLETO**

#### **✅ `Movement` - ENTIDAD CENTRAL (REDISEÑADA)**
- **Nueva estructura completa** diferente a la anterior
- **Campos nuevos críticos:**
  - `tipo_movimiento_general` ENUM('entrada', 'salida')
  - `tipo_movimiento_especifico` VARCHAR(50)
  - `numero_operacion` VARCHAR(100) NULL
  - `motivo_rechazo` TEXT NULL
- **Archivos nuevos necesarios:**
  - `controllers/movementController.js` (nuevo)
  - `services/movementService.js` (nuevo)
  - `routes/movements.js` (nuevo)

#### **✅ `Movement_References` - NUEVA ENTIDAD**
- **Sistema de referencias genéricas** para Movement
- **Archivos nuevos necesarios:**
  - `services/movementReferenceService.js` (nuevo)
- **Integración:** Automática al crear Movement

#### **✅ `Billing` - NUEVA ENTIDAD**
- **Facturación cuando BOB gana** competencia externa
- **Archivos nuevos necesarios:**
  - `controllers/billingController.js` (nuevo)
  - `services/billingService.js` (nuevo)
  - `routes/billing.js` (nuevo)

#### **✅ `Refund` - NUEVA ENTIDAD**
- **Sistema de solicitudes de reembolso**
- **Archivos nuevos necesarios:**
  - `controllers/refundController.js` (nuevo)
  - `services/refundService.js` (nuevo)
  - `routes/refunds.js` (nuevo)

#### **✅ `Notifications` - NUEVA ENTIDAD**
- **Sistema de notificaciones duales** (UI + EmailJS)
- **Archivos nuevos necesarios:**
  - `controllers/notificationController.js` (nuevo)
  - `services/notificationService.js` (nuevo)
  - `services/emailService.js` (nuevo - integración EmailJS)
  - `routes/notifications.js` (nuevo)

---

### **3. CAMBIOS EN ENTIDADES EXISTENTES**

#### **🔄 `User` - CAMPOS AGREGADOS**
```sql
-- AGREGAR a modelo User:
saldo_total      DECIMAL(10,2) DEFAULT 0
saldo_retenido   DECIMAL(10,2) DEFAULT 0
```
- **Funcionalidad:** Cache automático actualizado vía lógica de aplicación

#### **🔄 `Auction` - CAMPOS Y ESTADOS AGREGADOS**
```sql
-- AGREGAR a modelo Auction:
fecha_resultado_general DATETIME NULL

-- ACTUALIZAR ENUM estado:
'activa', 'pendiente', 'en_validacion', 'finalizada', 'vencida', 'cancelada',
'ganada', 'facturada', 'perdida', 'penalizada'  // NUEVOS ESTADOS
```

---

## **🔄 LÓGICA DE NEGOCIO COMPLETAMENTE REDISEÑADA**

### **1. NUEVA FÓRMULA DE SALDO DISPONIBLE**

#### **❌ FÓRMULA ANTERIOR (INCORRECTA):**
```javascript
saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado - saldo_en_reembolso - saldo_penalizado
```

#### **✅ FÓRMULA NUEVA (CORRECTA):**
```javascript
// Saldo Disponible = SALDO TOTAL - SALDO RETENIDO - SALDO APLICADO
const saldoDisponible = user.saldo_total - user.saldo_retenido - saldoAplicadoFromBilling;

// Donde:
// - saldo_total: Cache desde Movement validados (campo en User)
// - saldo_retenido: Cache desde estados de subasta (campo en User)  
// - saldoAplicadoFromBilling: SUM(Billing.monto) del cliente
```

### **2. ACTUALIZACIÓN DE CACHE DE SALDOS**

#### **❌ MÉTODO ANTERIOR:**
- Actualización manual de campos en `User_Balance`

#### **✅ MÉTODO NUEVO:**
```javascript
// Función que debe ejecutarse INMEDIATAMENTE después de:
// - Crear/actualizar Movement
// - Cambiar estado de Auction

async function recalcularCacheSaldos(userId) {
  // Recalcular saldo_total desde Movement validados
  const saldoTotal = await calculateSaldoTotalFromMovements(userId);
  
  // Recalcular saldo_retenido desde estados de subasta
  const saldoRetenido = await calculateSaldoRetenidoFromAuctions(userId);
  
  // Actualizar cache en User
  await updateUserSaldoCache(userId, saldoTotal, saldoRetenido);
}
```

---

## **🆕 NUEVAS FUNCIONALIDADES A IMPLEMENTAR**

### **1. COMPETENCIA EXTERNA DE BOB**

#### **Estados nuevos a agregar en código:**
- `ganada`: BOB ganó pero esperando datos facturación cliente
- `facturada`: Cliente completó datos, Billing generado  
- `perdida`: BOB perdió, cliente debe solicitar reembolso
- `penalizada`: BOB ganó pero cliente no pagó vehículo

#### **Lógica a implementar:**
```javascript
// En auctionController.js - NUEVO ENDPOINT
POST /auctions/:id/competition-result
{
  "resultado": "ganada" | "perdida" | "penalizada",
  "observaciones": "texto opcional"
}

// Acciones automáticas según resultado:
// - ganada: crear notificación competencia_ganada
// - perdida: liberar saldo_retenido + notificar cliente
// - penalizada: aplicar penalidad 30% + notificar cliente
```

### **2. SISTEMA DE NOTIFICACIONES DUALES**

#### **8 tipos de eventos automáticos:**
```javascript
// En cada operación crítica, agregar:
await createNotification({
  user_id: targetUserId,
  tipo: 'pago_registrado' | 'pago_validado' | 'competencia_ganada' | etc,
  titulo: 'Título descriptivo',
  mensaje: 'Mensaje completo',
  reference_type: 'auction' | 'movement' | 'refund' | 'billing',
  reference_id: relacionId
});

// Y simultáneamente:
await sendEmailViaEmailJS({
  to: userEmail,
  subject: titulo,
  body: mensaje,
  actionLink: linkDirecto
});
```

### **3. SISTEMA DE REEMBOLSOS COMPLETO**

#### **Flujo a implementar:**
```javascript
// PASO 1: Cliente solicita (refundController.js)
POST /refunds - crea Refund estado 'solicitado'

// PASO 2: Admin confirma (refundController.js) 
PATCH /refunds/:id/confirm - cambia a 'confirmado'

// PASO 3: Admin procesa (refundController.js)
PATCH /refunds/:id/process - crea Movement + cambia a 'procesado'

// Tipos de Movement según tipo_reembolso:
// - mantener_saldo: Movement tipo 'entrada' (aumenta disponible)
// - devolver_dinero: Movement tipo 'salida' (dinero sale del sistema)
```

---

## **🔧 ARCHIVOS DE CÓDIGO ACTUALES QUE NECESITAN MODIFICACIÓN**

### **ARCHIVOS CON LÓGICA OBSOLETA (ACTUALIZAR):**

#### **1. [`controllers/auctionController.js`](controllers/auctionController.js)**
- ✅ Mantener funciones existentes  
- 🔄 **AGREGAR:** gestión de nuevos estados (ganada, perdida, penalizada, facturada)
- 🔄 **AGREGAR:** endpoint `/competition-result` para resultado competencia externa
- 🔄 **MODIFICAR:** lógica de asignación de ganador para crear notificación automática

#### **2. [`controllers/balanceController.js`](controllers/balanceController.js)**
- 🔄 **REESCRIBIR COMPLETAMENTE:** nueva lógica de cálculo de saldos
- 🔄 **ELIMINAR:** referencias a `User_Balance`
- 🔄 **IMPLEMENTAR:** cálculo desde cache User + Billing

#### **3. [`services/auctionService.js`](services/auctionService.js)**
- 🔄 **AGREGAR:** funciones para gestión de competencia externa
- 🔄 **AGREGAR:** funciones de recálculo de saldo_retenido
- 🔄 **MODIFICAR:** validaciones para nuevos estados

#### **4. [`services/balanceService.js`](services/balanceService.js)**
- 🔄 **REESCRIBIR COMPLETAMENTE:** nueva arquitectura de saldos
- 🔄 **IMPLEMENTAR:** funciones de recálculo de cache automático

#### **5. [`prisma/schema.prisma`](prisma/schema.prisma)**
- ❌ **ELIMINAR:** modelos `GuaranteePayment` y `UserBalance`
- ✅ **AGREGAR:** modelos `Movement`, `Movement_References`, `Billing`, `Refund`, `Notifications`
- 🔄 **MODIFICAR:** modelo `User` (agregar campos cache)
- 🔄 **MODIFICAR:** modelo `Auction` (agregar nuevos estados y fecha_resultado_general)

---

### **ARCHIVOS NUEVOS A CREAR:**

#### **CONTROLLERS:**
- `controllers/movementController.js` - Gestión central de transacciones
- `controllers/billingController.js` - Facturación cuando BOB gana
- `controllers/refundController.js` - Sistema de reembolsos
- `controllers/notificationController.js` - Panel de notificaciones

#### **SERVICES:**
- `services/movementService.js` - Lógica de transacciones + cache saldos
- `services/billingService.js` - Gestión de facturación
- `services/refundService.js` - Gestión de reembolsos
- `services/notificationService.js` - Creación de notificaciones
- `services/emailService.js` - Integración con EmailJS

#### **ROUTES:**
- `routes/movements.js` - Rutas de transacciones (reemplaza guaranteePayments)
- `routes/billing.js` - Rutas de facturación
- `routes/refunds.js` - Rutas de reembolsos  
- `routes/notifications.js` - Rutas de notificaciones

---

## **📊 MAPEO DE FUNCIONALIDADES OBSOLETAS → NUEVAS**

### **REGISTRO DE PAGO:**
```javascript
// ANTES (OBSOLETO):
POST /guarantee-payments → crea GuaranteePayment + actualiza UserBalance

// AHORA (CORRECTO):
POST /movements → crea Movement + Movement_References + recalcula cache User + crea notificaciones
```

### **VALIDACIÓN DE PAGO:**
```javascript
// ANTES (OBSOLETO):
PATCH /guarantee-payments/:id/approve → actualiza GuaranteePayment + UserBalance

// AHORA (CORRECTO):  
PATCH /movements/:id/approve → actualiza Movement + recalcula cache User + crea notificación
```

### **CÁLCULO DE SALDOS:**
```javascript
// ANTES (OBSOLETO):
SELECT * FROM UserBalance WHERE user_id = ?

// AHORA (CORRECTO):
// Cache desde User + cálculo Billing
const saldoTotal = user.saldo_total; // cache
const saldoRetenido = user.saldo_retenido; // cache  
const saldoAplicado = await calculateSaldoAplicadoFromBilling(userId);
const saldoDisponible = saldoTotal - saldoRetenido - saldoAplicado;
```

---

## **🆕 NUEVAS FUNCIONALIDADES REQUERIDAS**

### **1. GESTIÓN DE COMPETENCIA EXTERNA**

#### **Endpoint nuevo crítico:**
```javascript
// auctionController.js
PATCH /auctions/:id/competition-result
{
  "resultado": "ganada" | "perdida" | "penalizada", 
  "observaciones": "opcional"
}

// Lógica automática según resultado:
switch(resultado) {
  case 'ganada':
    // cambiar estado a 'ganada'
    // crear notificación 'competencia_ganada' al cliente
    // mantener saldo_retenido (esperando facturación)
    break;
    
  case 'perdida':
    // cambiar estado a 'perdida'
    // liberar saldo_retenido (recalcular cache)
    // crear notificación 'competencia_perdida' con link reembolso
    break;
    
  case 'penalizada':
    // cambiar estado a 'penalizada'
    // crear Movement tipo 'penalidad' (30%)
    // liberar saldo_retenido (recalcular cache)  
    // crear notificación 'penalidad_aplicada' con info 70% disponible
    break;
}
```

### **2. SISTEMA DE FACTURACIÓN (CLIENTE GANADOR)**

#### **Endpoint cliente cuando BOB gana:**
```javascript
// billingController.js
POST /billing
{
  "auction_id": 1,
  "billing_document_type": "RUC" | "DNI",
  "billing_document_number": "12345678901",
  "billing_name": "Empresa Cliente S.A."
}

// Lógica automática:
// - crear registro Billing
// - cambiar Auction.estado = 'facturada' 
// - liberar saldo_retenido (recalcular cache User)
// - crear notificación 'facturacion_completada'
```

### **3. SISTEMA DE REEMBOLSOS COMPLETO**

#### **Flujo de 3 endpoints:**
```javascript
// 1. refundController.js
POST /refunds - Cliente solicita reembolso
{
  "monto_solicitado": 500.00,
  "tipo_reembolso": "mantener_saldo" | "devolver_dinero", 
  "motivo": "BOB no ganó competencia"
}

// 2. refundController.js  
PATCH /refunds/:id/confirm - Admin confirma telefónicamente
// estado: 'solicitado' → 'confirmado'

// 3. refundController.js
PATCH /refunds/:id/process - Admin procesa con datos bancarios
// crear Movement según tipo + estado: 'confirmado' → 'procesado'
```

### **4. SISTEMA DE NOTIFICACIONES AUTOMÁTICAS**

#### **Integración en cada operación crítica:**
```javascript
// En TODOS los controladores, agregar después de operaciones:

// Ejemplo en movementController.js approve:
await notificationService.createAndSend({
  user_id: clientId,
  tipo: 'pago_validado',
  titulo: 'Pago de garantía aprobado',
  mensaje: 'Su pago de garantía fue aprobado exitosamente.',
  reference_type: 'movement',
  reference_id: movementId
});

// Y también para admin cuando aplique:
await notificationService.createAndSend({
  user_id: adminId, 
  tipo: 'pago_registrado',
  // ... resto de datos
});
```

---

## **🔧 FUNCIONES DE RECÁLCULO DE CACHE (CRÍTICAS)**

### **Funciones que DEBEN implementarse y ejecutarse INMEDIATAMENTE:**

```javascript
// balanceService.js - NUEVA FUNCIÓN CRÍTICA
async function recalcularSaldoTotal(userId) {
  // Suma Movement validados: entradas - salidas
  const entradas = await sumMovementsByType(userId, 'entrada', 'validado');
  const salidas = await sumMovementsByType(userId, 'salida', 'validado');
  const saldoTotal = entradas - salidas;
  
  await updateUserCache(userId, { saldo_total: saldoTotal });
  return saldoTotal;
}

async function recalcularSaldoRetenido(userId) {
  // Suma saldos de subastas en estados que retienen dinero
  const estadosRetencion = ['finalizada', 'ganada']; // NO 'facturada', 'perdida', 'penalizada'
  const saldoRetenido = await sumSaldosFromAuctionStates(userId, estadosRetencion);
  
  await updateUserCache(userId, { saldo_retenido: saldoRetenido });
  return saldoRetenido;
}

// EJECUTAR ESTAS FUNCIONES INMEDIATAMENTE DESPUÉS DE:
// - Crear Movement → recalcularSaldoTotal()
// - Validar Movement → recalcularSaldoTotal() 
// - Cambiar estado Auction → recalcularSaldoRetenido()
// - Crear Billing → NO ejecutar (Billing no afecta cache)
```

---

## **📝 CAMBIOS EN VALIDACIONES**

### **VALIDACIONES NUEVAS A IMPLEMENTAR:**

```javascript
// movementController.js - validaciones POST /movements
// 1. numero_operacion único por cliente
await validateUniqueOperationNumber(numero_operacion, user_id);

// 2. monto exacto 8% de oferta ganadora  
const montoEsperado = ofertaGanadora * 0.08;
if (monto !== montoEsperado) {
  throw new ValidationError('INVALID_AMOUNT', 'Monto debe coincidir exactamente con 8%');
}

// 3. no duplicar Movement pago_garantia validado para misma subasta
await validateNoDuplicatePaymentForAuction(user_id, auction_id);
```

---

## **📋 ENDPOINTS QUE CAMBIAN DE RUTA**

### **MIGRACIONES DE RUTAS:**
```javascript
// ANTES (ELIMINAR):
/guarantee-payments/* 

// AHORA (IMPLEMENTAR):
/movements/*

// Mapeo específico:
GET /guarantee-payments → GET /movements?tipo_especifico=pago_garantia
POST /guarantee-payments → POST /movements  
PATCH /guarantee-payments/:id/approve → PATCH /movements/:id/approve
PATCH /guarantee-payments/:id/reject → PATCH /movements/:id/reject
```

---

## **⚡ PRIORIDADES DE IMPLEMENTACIÓN**

### **🔴 CRÍTICO - IMPLEMENTAR PRIMERO:**
1. **Migrar Prisma Schema** - eliminar entidades obsoletas, agregar nuevas
2. **Crear Movement central** - controllers, services, routes
3. **Implementar funciones de cache** - recálculo automático saldos
4. **Migrar endpoints** - /guarantee-payments → /movements

### **🟡 IMPORTANTE - IMPLEMENTAR SEGUNDO:**
1. **Sistema de notificaciones** - controllers, services, EmailJS
2. **Competencia externa** - nuevos estados y lógica
3. **Sistema de reembolsos** - entidad Refund completa

### **🟢 COMPLEMENTARIO - IMPLEMENTAR TERCERO:**
1. **Sistema de facturación** - entidad Billing
2. **Paneles de notificaciones** - UI de navegación
3. **Dashboards mejorados** - Mi Saldo, Historial Transacciones

---

## **🚨 INCONSISTENCIAS CRÍTICAS A CORREGIR**

### **1. CONCEPTO DE PENALIDAD:**
```javascript
// INCORRECTO en código actual (si existe):
// Penalidad por NO pagar garantía

// CORRECTO a implementar:
// Penalidad SOLO cuando BOB gana pero cliente no paga vehículo completo
// Se aplica cuando estado = 'penalizada' (no cuando estado = 'vencida')
```

### **2. MOMENTO DE LIBERACIÓN DE SALDO_RETENIDO:**
```javascript
// INCORRECTO:
// Liberar saldo_retenido cuando estado = 'ganada'

// CORRECTO:
// Liberar saldo_retenido cuando estado = 'facturada' (cuando se crea Billing)
// En estado 'ganada' el dinero SIGUE retenido esperando facturación
```

---

## **📦 DEPENDENCIAS NUEVAS A INSTALAR**

```json
// package.json - agregar dependencias:
{
  "@emailjs/nodejs": "^4.0.0", // Para envío de correos desde backend
  // O desde frontend si se prefiere:
  "@emailjs/browser": "^4.0.0"
}
```

---

## **🎯 RESULTADO ESPERADO DESPUÉS DE CODIFICACIÓN**

### **ARQUITECTURA FINAL:**
- ✅ **Movement** como entidad central de todas las transacciones
- ✅ **Cache automático** de saldos actualizado en tiempo real
- ✅ **Competencia externa** completamente funcional con 4 estados nuevos
- ✅ **Sistema de reembolsos** con flujo solicitud→confirmación→procesamiento
- ✅ **Notificaciones automáticas** UI + correo en todos los eventos críticos
- ✅ **Facturación separada** del registro de pago
- ✅ **Eliminación completa** de entidades obsoletas

### **VALIDACIÓN DE ÉXITO:**
- ❌ **Cero referencias** a `GuaranteePayment` o `UserBalance` en código
- ✅ **Fórmula única** de saldo disponible funcionando
- ✅ **8 tipos de notificaciones** automáticas operativas  
- ✅ **19 HU Detalladas** reflejadas en código funcional

---

**Este documento debe servir como guía completa para que el modelo de codificación entienda exactamente qué debe cambiar, eliminar, crear y cómo debe funcionar la nueva arquitectura.**

---