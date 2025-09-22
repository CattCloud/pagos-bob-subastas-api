# PLANNING FRONTEND - BOB SUBASTAS
**TODO-LIST-UPDATE para Desarrollo Frontend Interactivo**

---

## **CONTEXTO Y DOCUMENTACIÓN OBLIGATORIA**

### **📋 DOCUMENTOS DE REFERENCIA CRÍTICOS:**
- ✅ [`doc/Prerequisitos.md`](./Prerequisitos.md) - Problema, objetivos, reglas RN01-RN17, flujo completo
- ✅ [`doc/DocumentacionAPI.md`](./DocumentacionAPI.md) - Endpoints, contratos, ejemplos, códigos de error
- ✅ [`doc/CONTEXTO_FRONTEND_BACKEND.md`](./CONTEXTO_FRONTEND_BACKEND.md) - Guía principal integración
- ✅ [`doc/Arquitectura_Stack.md`](./Arquitectura_Stack.md) - Stack tecnológico y estructura carpetas
- ✅ [`doc/Arquitectura Funcional.md`](./Arquitectura%20Funcional.md) - Módulos funcionales y prioridad
- ✅ [`doc/ColoresFrontend.md`](./ColoresFrontend.md) - Paleta colores y tipografía
- ✅ [`doc/Notificaciones.md`](./Notificaciones.md) - Sistema dual notificaciones
- ✅ [`doc/test`](./docTest) - Test realizados en el backend - Pueden usarse como guias para ver el comportamiento del backend

### **📋 HISTORIAS DE USUARIO (19 HU):**
- ✅ HU Identificación Cliente, Registro Pago, Validación Pagos (Admin)
- ✅ HU Gestión Subastas, COMP-01/02/03/04 (competencia externa)
- ✅ HU BILL-01 (facturación), REEM-01/02/03/04/05 (reembolsos)
- ✅ HU SALDO-01 (mi saldo), TRANS-01 (historial)
- ✅ HU NOT-01/02 (notificaciones cliente/admin), PEN-01 (penalidades)

---

## **PLANIFICACIÓN FRONTEND POR FASES**

### 🚀 **FASE 1: VERIFICACIÓN DE CONFIGURACIÓN Y ARQUITECTURA BASE (ACTUALIZADA)**

**Objetivo:** Validar que el proyecto React esté correctamente configurado, estructurado y conectado al backend usando `fetch`.

---

### ✅ **TODO DETALLADO (VERIFICACIÓN)**

- [ ] **1.1** Verificar que el proyecto React con Vite fue creado correctamente  
  > Confirmar que `vite.config.js`, `main.jsx` y `App.jsx` existen y que el proyecto corre con `npm run dev`.

- [ ] **1.2** Verificar instalación de dependencias principales  
  ```bash
  npm ls react-router-dom tailwindcss react-hook-form
  npm ls @tanstack/react-query react-hot-toast react-icons
  npm ls react-dropzone
  ```
  > Validar que todas estén presentes en `package.json` y sin conflictos.  
  ✅ **Nota:** No se usa Axios. Se usará `fetch` nativo.

- [ ] **1.3** Verificar configuración de TailwindCSS con colores personalizados  
  > Confirmar que `tailwind.config.js` incluye la paleta definida en [`doc/ColoresFrontend.md`](./ColoresFrontend.md) y que `index.css` importa Tailwind correctamente.

- [ ] **1.4** Verificar estructura de carpetas según [`doc/Arquitectura_Stack.md`](./Arquitectura_Stack.md)  
  ```bash
  tree src -L 2
  ```
  > Validar existencia de:
  ```
  src/
  ├── components/ (ui/, forms/, layout/, common/)
  ├── pages/ (client/, admin/, auth/)
  ├── hooks/
  ├── services/
  ├── utils/
  ├── constants/
  ├── index.css
  ```

- [ ] **1.5** Verificar que `src/index.css` contiene variables CSS según paleta  
  > Confirmar que están definidas para su uso en el codigo.

- [ ] **1.6** Verificar servicio base API (`src/services/api.js`) usando `fetch`  
  > Confirmar que se usa `fetch` para llamadas a `http://localhost:3000` con defensas como `try/catch`, headers, y manejo de errores.

- [ ] **1.7** Verificar configuración de React Router con rutas principales  
  > Confirmar que `/pago-subastas` y `/admin-subastas` están definidas en `router` y que navegan correctamente.

---

### 🧪 **PUNTO DE TESTING 1**

- [ ] Proyecto ejecuta correctamente (`npm run dev`)
- [ ] Navegación entre rutas básicas funciona
- [ ] Colores Tailwind se aplican correctamente
- [ ] Conexión con API base (`GET /`) responde exitosamente usando `fetch`

---

### **🔐 FASE 2: SISTEMA DE AUTENTICACIÓN**
**Objetivo:** Implementar identificación sin password según RN14-RN15

**TODO DETALLADO:**
- [ ] **2.1** Crear componentes UI base (`src/components/ui/`):
  - `Button.jsx`, `Input.jsx`, `Card.jsx`, `Modal.jsx`, `Toast.jsx`
- [ ] **2.2** Implementar identificación cliente (`src/pages/auth/ClientLogin.jsx`):
  - Formulario document_type + document_number
  - Validación con react-hook-form
  - Conexión POST `/auth/client-login`
- [ ] **2.3** Implementar acceso admin (`src/pages/auth/AdminLogin.jsx`):
  - Acceso automático con POST `/auth/admin-access`
- [ ] **2.4** Crear context de autenticación (`src/contexts/AuthContext.jsx`):
  - Gestión de sesión (session_id en localStorage)
  - Estado global user + session
  - Auto-renovación de sesión
- [ ] **2.5** Implementar middleware de rutas protegidas
- [ ] **2.6** Crear layouts base (`src/components/layout/`):
  - `ClientLayout.jsx`, `AdminLayout.jsx`

**🧪 PUNTO DE TESTING 2:**
- Probar login cliente con documento válido/inválido
- Probar acceso admin automático
- Verificar persistencia de sesión
- Probar protección de rutas
- Validar layouts responsive

---

### **💰 FASE 3: MÓDULO SALDOS Y DASHBOARD BÁSICO**
**Objetivo:** Implementar fórmula central: Disponible = Total - Retenido - Aplicado

**TODO DETALLADO:**
- [ ] **3.1** Crear servicio de saldos (`src/services/balanceService.js`):
  - GET `/users/:id/balance`
  - Hook personalizado `useBalance()`
- [ ] **3.2** Implementar página Mi Saldo (`src/pages/client/MyBalance.jsx`):
  - Mostrar fórmula desglosada visualmente
  - Cards para cada componente del saldo
  - Enlaces rápidos a historial y reembolso
- [ ] **3.3** Dashboard admin básico (`src/pages/admin/Dashboard.jsx`):
  - Resumen saldos todos los clientes
  - Stats básicas del sistema
- [ ] **3.4** Crear componente BalanceCard reutilizable
- [ ] **3.5** Implementar formato de monedas y helpers

**🧪 PUNTO DE TESTING 3:**
- Verificar cálculo de saldos coincide con backend
- Probar fórmula visual clara para usuario
- Validar formato correcto de monedas
- Testing responsivo en móvil/desktop

---

### **📋 FASE 4: MÓDULO TRANSACCIONES E HISTORIAL**
**Objetivo:** HU-TRANS-01 completo con filtros y detalles

**TODO DETALLADO:**
- [ ] **4.1** Crear servicio movements (`src/services/movementService.js`):
  - GET `/users/:id/movements` con filtros
  - GET `/movements/:id` para detalles
- [ ] **4.2** Implementar página Historial (`src/pages/client/TransactionHistory.jsx`):
  - Lista paginada de transacciones
  - Filtros por tipo, estado, fechas
  - Búsqueda y ordenamiento
- [ ] **4.3** Crear componentes:
  - `TransactionCard.jsx` - Item de transacción
  - `TransactionFilters.jsx` - Panel filtros
  - `TransactionDetail.jsx` - Modal detalle
- [ ] **4.4** Implementar página Movements Admin (`src/pages/admin/MovementsManagement.jsx`):
  - Lista todos los movements
  - Acciones de aprobación/rechazo
- [ ] **4.5** Gestión de comprobantes (vouchers):
  - Visualización de archivos Cloudinary
  - Descarga con GET `/movements/:id/voucher`

**🧪 PUNTO DE TESTING 4:**
- Probar filtros funcionan correctamente
- Verificar paginación
- Probar visualización de comprobantes
- Testing UX de transacciones

---

### **💳 FASE 5: MÓDULO PAGOS DE GARANTÍA**
**Objetivo:** HU Registro Pago completo con upload de archivos

**TODO DETALLADO:**
- [ ] **5.1** Crear formulario multi-step (`src/pages/client/PaymentRegistration.jsx`):
  - Step 1: Validación datos cliente
  - Step 2: Selección subasta ganada
  - Step 3: Datos pago + upload voucher
  - Step 4: Confirmación
- [ ] **5.2** Implementar upload de archivos con react-dropzone:
  - Validación tipos: PDF/JPG/PNG, max 5MB
  - Preview y confirmación
  - Conexión POST `/movements` (multipart/form-data)
- [ ] **5.3** Crear componentes:
  - `PaymentForm.jsx` - Formulario pago
  - `FileUpload.jsx` - Upload voucher
  - `AuctionSelector.jsx` - Seleccionar subasta
- [ ] **5.4** Validaciones frontend:
  - Monto exacto 8% según RN02
  - Fecha pago válida
  - Número operación único
- [ ] **5.5** Integrar con sistema de notificaciones

**🧪 PUNTO DE TESTING 5:**
- Probar upload de archivos diferentes tipos
- Verificar validación monto 8%
- Probar formulario multi-step UX
- Testing integración con backend

---

### **🔔 FASE 6: SISTEMA DE NOTIFICACIONES**
**Objetivo:** HU-NOT-01/02 con 8 tipos de notificaciones

**TODO DETALLADO:**
- [ ] **6.1** Crear servicio notificaciones (`src/services/notificationService.js`):
  - GET `/notifications` con filtros
  - PATCH `/notifications/:id/read`
  - PATCH `/notifications/mark-all-read`
- [ ] **6.2** Implementar panel notificaciones (`src/pages/client/Notifications.jsx`):
  - Lista con estados y tipos
  - Badge contador en header
  - Marcar como leídas
- [ ] **6.3** Crear componentes:
  - `NotificationBadge.jsx` - Badge con contador
  - `NotificationCard.jsx` - Item notificación
  - `NotificationPanel.jsx` - Panel lateral/modal
- [ ] **6.4** Notificaciones admin (`src/pages/admin/NotificationsAdmin.jsx`):
  - Filtros por usuario y tipo
  - Priorización alta/media/baja
- [ ] **6.5** Toast notifications para acciones inmediatas:
  - React Hot Toast configurado
  - Notificaciones en tiempo real

**🧪 PUNTO DE TESTING 6:**
- Probar contador badge actualiza
- Verificar filtros y estados
- Testing notificaciones tiempo real
- Probar UX panel notificaciones

---

### **💸 FASE 7: MÓDULO REEMBOLSOS**
**Objetivo:** HU-REEM-01/04/05 completo con auction_id obligatorio

**TODO DETALLADO:**
- [ ] **7.1** Crear servicio reembolsos (`src/services/refundService.js`):
  - POST `/refunds` (con auction_id obligatorio)
  - GET historial reembolsos cliente
- [ ] **7.2** Implementar solicitud reembolso (`src/pages/client/RefundRequest.jsx`):
  - Formulario con auction_id, monto, tipo, motivo
  - Validaciones: saldo disponible, max 2 decimales
  - Selección tipo: mantener_saldo vs devolver_dinero
- [ ] **7.3** Historial reembolsos (`src/pages/client/RefundHistory.jsx`):
  - Lista solicitudes con estados
  - Timeline visual del proceso
- [ ] **7.4** Detalle reembolso (`src/pages/client/RefundDetail.jsx`):
  - Información completa solicitud
  - Descarga comprobantes si aplica
- [ ] **7.5** Gestión admin (`src/pages/admin/RefundManagement.jsx`):
  - Lista solicitudes pendientes
  - Acciones confirmar/rechazar/procesar
  - Upload voucher para devolver_dinero

**🧪 PUNTO DE TESTING 7:**
- Probar validación auction_id obligatorio
- Verificar tipos reembolso funcionan
- Probar flujo completo solicitado→procesado
- Testing admin gestión reembolsos

---

### **🏆 FASE 8: MÓDULO SUBASTAS Y COMPETENCIA EXTERNA (ADMIN)**
**Objetivo:** HU Gestión Subastas + HU-COMP-01/02/03/04

**TODO DETALLADO:**
- [ ] **8.1** Crear servicio subastas (`src/services/auctionService.js`):
  - GET `/auctions` con filtros
  - POST `/auctions` crear nueva
  - PATCH `/auctions/:id/competition-result`
- [ ] **8.2** Gestión subastas (`src/pages/admin/AuctionManagement.jsx`):
  - Lista con filtros estado, fecha, búsqueda
  - Crear nueva subasta + activo
  - Registrar ganador
- [ ] **8.3** Resultados competencia (`src/pages/admin/CompetitionResults.jsx`):
  - Registrar resultado: ganada/perdida/penalizada
  - Activación automática procesos
  - Visualización estados finales
- [ ] **8.4** Crear componentes:
  - `AuctionCard.jsx` - Item subasta
  - `AuctionForm.jsx` - Formulario crear
  - `WinnerAssignment.jsx` - Asignar ganador
  - `CompetitionResultForm.jsx` - Resultado competencia
- [ ] **8.5** Integrar con notificaciones automáticas

**🧪 PUNTO DE TESTING 8:**
- Probar CRUD completo subastas
- Verificar asignación ganador y cálculo 8%
- Probar resultados competencia externa
- Testing flujo admin completo

---

### **🧾 FASE 9: MÓDULO FACTURACIÓN**
**Objetivo:** Implementar HU-COMP-02 + HU-BILL-01 según backend actual:
- Al marcar “ganada” (Admin), el backend crea automáticamente un Billing parcial (sin datos de facturación) y libera saldo_retenido.
- Cliente/Admin deben poder completar los datos de facturación del Billing existente con PATCH `/api/billing/:id/complete`.
- Listados y detalle con include=user,auction para evitar solicitar recursos extra.

Referencias backend obligatorias:
- Endpoints en [`doc/DocumentacionAPI.md`](./DocumentacionAPI.md): Billing list/detail/user-list y PATCH complete.
- HU funcionales: [`doc/HU Detalladas/HU-COMP-02 - Procesar Resultado BOB Gano (Admin).md`](./HU%20Detalladas/HU-COMP-02%20-%20Procesar%20Resultado%20BOB%20Gano%20(Admin).md), [`doc/HU Detalladas/HU-BILL-01 - Completar Datos Facturacion (Cliente).md`](./HU%20Detalladas/HU-BILL-01%20-%20Completar%20Datos%20Facturacion%20(Cliente).md)

**TODO DETALLADO:**
- [ ] **9.1 Servicio Billing (frontend)**
  - Crear `src/services/billing.js` con métodos:
    - listByUser(userId, params): GET `/users/:userId/billings?include=auction`
    - listAll(params): GET `/billing?include=user,auction` (admin)
    - getById(id, include='user,auction'): GET `/billing/:id?include=user,auction`
    - complete(id, dto): PATCH `/billing/:id/complete` con body { billing_document_type, billing_document_number, billing_name }
  - Manejo de errores mapeados a UI:
    - 409/BILLING_ALREADY_COMPLETED → “Esta facturación ya fue completada”
    - 409/DUPLICATE_BILLING_DOCUMENT → “El número de documento ya fue usado por este usuario”
    - 403/FORBIDDEN → “No tiene permisos sobre esta facturación”
  - Headers con session_id como en base API.

- [ ] **9.2 Vista Cliente: “Mis Facturaciones”**
  - Ruta sugerida: `/pago-subastas/billing` (en App Router del cliente).
  - Listado: consumir listByUser(userId, include=auction) y mostrar cards:
    - Campos: Billing ID, concepto, monto, moneda, created_at, related.auction.{placa, marca, modelo, año, empresa_propietaria}, estado visual “Datos pendientes” si cualquier billing_document_* es null.
  - Acción “Completar Datos” visible solo si campos pendientes:
    - Navegar a `/pago-subastas/billing/:id/complete`
  - Integración con notificaciones:
    - Si llega `tipo=competencia_ganada` con referencia al billing, deep-link a `/pago-subastas/billing/:id/complete`.

- [ ] **9.3 Formulario Completar Facturación (Cliente y Admin)**
  - Componente dedicado: `BillingCompleteForm.jsx`
  - Campos obligatorios:
    - billing_document_type: radio RUC | DNI
    - billing_document_number: input con máscara/validación:
      - DNI: exactamente 8 dígitos
      - RUC: exactamente 11 dígitos
    - billing_name: 3-200 caracteres
  - Mostrar en solo-lectura: monto, moneda, concepto, resumen de subasta (placa, marca, modelo, año).
  - Confirmación modal antes de enviar: “Una vez enviados no podrán modificarse.”
  - Éxito: toast + redirección a detalle de billing o listado.
  - Errores: mapear mensajes de backend según códigos (ver 9.1).

- [ ] **9.4 Detalle de Factura (Cliente/Admin)**
  - Ruta: `/pago-subastas/billing/:id` (cliente) y `/admin-subastas/billing/:id` (admin).
  - Consumir getById(include=user,auction).
  - Mostrar:
    - Datos cliente (related.user) si admin
    - Datos subasta (related.auction)
    - Datos facturación: documento tipo/número, nombre, monto, concepto, fechas
  - Si está pendiente y el rol lo permite, botón “Completar Datos” → usa el mismo `BillingCompleteForm`.

- [ ] **9.5 Gestión Billing (Admin)**
  - Página: `/admin-subastas/billing`
  - Listado con filtros: rango fechas, estado (pendiente/completa), búsqueda por placa/cliente
    - “Pendiente” si algún billing_document_* es null
  - Columns: ID, cliente, subasta(placa), monto, created_at, estado, acción
  - Acción rápida “Completar Datos” (abre formulario modo admin).

- [ ] **9.6 Componentes UI**
  - BillingCard.jsx: card para listado (cliente)
  - BillingStatusBadge.jsx: “Pendiente” | “Completada”
  - BillingList.jsx: lista paginada + paginación común
  - BillingDetail.jsx: detalle
  - BillingCompleteForm.jsx: formulario de completar
  - BillingFilters.jsx (admin): filtros fecha/estado/búsqueda

- [ ] **9.7 Reglas de Visibilidad/Flujo**
  - El backend crea el Billing automáticamente al marcar “ganada”; no hay botón de “Crear” en frontend.
  - “Completar Datos” solo se muestra si hay campos pendientes.
  - Tras completar:
    - No cambia saldos en UI (ya se liberó retenido al crear Billing). Mostrar aclaración “Su garantía ya fue aplicada”.
  - Notificaciones:
    - competencia_ganada → CTA “Completar facturación” (deep-link)
    - facturacion_completada (cliente) → confirmar finalización
    - billing_generado (admin) → visibilidad en gestión

- [ ] **9.8 Integración con rutas y navegación**
  - Agregar rutas a la estructura del router:
    - Cliente:
      - `/pago-subastas/billing` (Listado)
      - `/pago-subastas/billing/:id` (Detalle)
      - `/pago-subastas/billing/:id/complete` (Formulario completar)
    - Admin:
      - `/admin-subastas/billing` (Gestión)
      - `/admin-subastas/billing/:id` (Detalle)
  - Enlaces desde:
    - Panel de notificaciones (items con reference_type=billing)
    - Cards de subastas ganadas (si corresponde)

- [ ] **9.9 Validaciones en Frontend**
  - DNI 8 dígitos exactos; RUC 11 dígitos exactos (bloquear envío si no cumple).
  - billing_name entre 3 y 200 caracteres.
  - Deshabilitar botón enviar mientras POST/PATCH pendiente.
  - Mostrar errores backend legibles.

- [ ] **9.10 Estados vacíos y loaders**
  - Listado sin datos: mensaje contextual “No tienes facturaciones pendientes.”
  - Skeletons para cards/detalle.

**🧪 PUNTO DE TESTING 9:**
- [ ] Simular notificación competencia_ganada → deep-link a completar y enviar PATCH exitoso.
- [ ] Validar errores:
  - Billing ya completado (409/BILLING_ALREADY_COMPLETED)
  - Documento duplicado (409/DUPLICATE_BILLING_DOCUMENT)
  - Acceso denegado (403/FORBIDDEN)
- [ ] Cliente: ver listado, completar, ver detalle.
- [ ] Admin: ver gestión, completar en nombre del cliente, ver detalle.
- [ ] Verificar que saldos no cambian en esta fase (mensaje aclaratorio).

---

### **⚖️ FASE 10: MÓDULO VALIDACIÓN PAGOS (ADMIN)**
**Objetivo:** HU Validación Pagos Admin completo

**TODO DETALLADO:**
- [ ] **10.1** Dashboard validación (`src/pages/admin/PaymentValidation.jsx`):
  - Lista pagos pendientes priorizada
  - Visualización comprobantes Cloudinary
  - Acciones aprobar/rechazar
- [ ] **10.2** Detalle pago (`src/components/admin/PaymentDetail.jsx`):
  - Información completa movement
  - Preview voucher
  - Formulario aprobación/rechazo
- [ ] **10.3** Componentes específicos:
  - `PaymentCard.jsx` - Item pago pendiente
  - `VoucherViewer.jsx` - Visualizador comprobantes
  - `PaymentActions.jsx` - Acciones admin
- [ ] **10.4** Validaciones automáticas:
  - Monto coincide con 8%
  - Fecha válida
  - Documento legible

**🧪 PUNTO DE TESTING 10:**
- Probar workflow aprobación/rechazo
- Verificar visualización comprobantes
- Testing validaciones automáticas
- Probar impact en cache saldos

---

### **🎯 FASE 11: MÓDULOS AUXILIARES Y UX**
**Objetivo:** Completar funcionalidades restantes

**TODO DETALLADO:**
- [ ] **11.1** Implementar búsquedas y filtros avanzados
- [ ] **11.2** Sistema de estados y indicadores visuales
- [ ] **11.3** Gestión de errores y loading states
- [ ] **11.4** Breadcrumbs y navegación
- [ ] **11.5** Configurar React Query para cache
- [ ] **11.6** Optimizar rendimiento y lazy loading

**🧪 PUNTO DE TESTING 11:**
- Probar rendimiento con datos reales
- Testing responsive completo
- Verificar estados loading/error
- Probar navegación UX

---

### **🔧 FASE 12: INTEGRACIÓN Y PULIMENTO**
**Objetivo:** Conectar todos los módulos y testing end-to-end

**TODO DETALLADO:**
- [ ] **12.1** Integración completa entre módulos
- [ ] **12.2** Testing contra tests backend existentes:
  - Probar contra `flow1-bob-ganada-tests.js`
  - Probar contra `flow2-bob-perdida-refund-tests.js`
  - Probar contra `flow3-bob-penalidad-tests.js`
  - Probar contra `validaciones-negocio-tests.js`
- [ ] **12.3** Refinamiento UX/UI:
  - Feedback visual inmediato
  - Confirmaciones para acciones críticas
  - Estados de carga y vacío
- [ ] **12.4** Optimización final:
  - Bundle size optimization
  - Lazy loading components
  - Error boundaries
- [ ] **12.5** Documentación de usuario final

**🧪 PUNTO DE TESTING FINAL:**
- Testing E2E completo contra backend
- Verificar todos los 19 HU funcionan
- Probar todos los flujos de tests backend
- Validación UX con usuarios reales

---

## **CONFIGURACIÓN TÉCNICA ESPECÍFICA**

### **🎨 COLORES TAILWIND (index.css):**
```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

@layer base {
  :root {
    /* Primarios BOB */
    --color-primary-50: #f0f9ff;
    --color-primary-100: #e0f2fe;
    --color-primary-500: #0891b2;
    --color-primary-600: #0e7490;
    --color-primary-700: #164e63;
    
    /* Secundarios */
    --color-secondary-50: #fffbeb;
    --color-secondary-100: #fef3c7;
    --color-secondary-500: #f59e0b;
    --color-secondary-600: #d97706;
    --color-secondary-700: #b45309;
    
    /* Estados */
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-error: #ef4444;
    --color-info: #3b82f6;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded;
  }
  
  .card-base {
    @apply bg-white shadow-md rounded-lg p-6 border border-gray-200;
  }
  
  .input-base {
    @apply w-full px-3 py-2 border border-gray-300 rounded focus:ring-primary-500 focus:border-primary-500;
  }
}
```

### **🔌 API Service Base:**
```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para session_id automático
apiClient.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('session_id');
  if (sessionId) {
    config.headers['X-Session-ID'] = sessionId;
  }
  return config;
});

export default apiClient;
```

### **📱 Estructura Rutas:**
```javascript
// src/App.jsx estructura propuesta
<Routes>
  <Route path="/pago-subastas" element={<ClientRoutes />}>
    <Route index element={<MyGuarantees />} />
    <Route path="balance" element={<MyBalance />} />
    <Route path="transactions" element={<TransactionHistory />} />
    <Route path="payment" element={<PaymentRegistration />} />
    <Route path="refunds" element={<RefundManagement />} />
    <Route path="notifications" element={<Notifications />} />
  </Route>
  
  <Route path="/admin-subastas" element={<AdminRoutes />}>
    <Route index element={<PaymentValidation />} />
    <Route path="auctions" element={<AuctionManagement />} />
    <Route path="competition" element={<CompetitionResults />} />
    <Route path="billing" element={<BillingManagement />} />
    <Route path="refunds" element={<RefundManagement />} />
    <Route path="balances" element={<BalanceManagement />} />
  </Route>
</Routes>
```

---

## **METODOLOGÍA DE DESARROLLO**

### **🔄 CICLO ITERATIVO POR FASE:**
1. **Desarrollo**: Implementar TODO de la fase
2. **Testing Internal**: Verificar funciona localmente
3. **Integración**: Conectar con backend en localhost:3000
4. **Validación Usuario**: Presentar avance para feedback
5. **Refinamiento**: Ajustar según feedback antes de continuar

### **📋 CRITERIOS DE VALIDACIÓN POR FASE:**
- ✅ Funcionalidad cumple HU correspondiente
- ✅ UX/UI sigue paleta de ColoresFrontend.md
- ✅ Responsive móvil/desktop
- ✅ Conecta correctamente con API backend
- ✅ Manejo adecuado de errores
- ✅ Performance aceptable

### **🧪 TESTING REQUIREMENTS:**
- Usar tests backend como referencia de comportamiento esperado
- Validar contra DocumentacionAPI.md contratos
- Probar todos los casos de error (validaciones-negocio-tests.js)
- Verificar fórmula saldos: `Disponible = Total - Retenido - Aplicado`

---

## **SIGUIENTE PASO:**

**COMENZAR FASE 1** - Configuración inicial y arquitectura base. Una vez completada la fase 1, presentar resultado para validación antes de continuar con Fase 2.

**IMPORTANTE:** Cada fase requiere aprobación explícita antes de continuar a la siguiente fase.