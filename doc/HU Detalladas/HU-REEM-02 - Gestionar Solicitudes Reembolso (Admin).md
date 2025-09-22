# HU-REEM-02 — Gestionar Solicitudes de Reembolsos  (Admin)

## **Historia:**

Como **administrador**, quiero ver, revisar y gestionar las solicitudes de Reembolsos enviadas por los clientes, para confirmar o rechazar cada solicitud según las políticas de la empresa antes de proceder con la transferencia  o deposito bancario.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Listado de solicitudes de Reembolso:**
    - Mostrar tabla con columnas:
        - **Cliente** (nombre + documento)
        - **Monto Solicitado**
        - **Fecha Solicitud** (created_at)
        - **Estado** (Solicitado / Confirmado / Rechazado / Procesado)
        - **Motivo** (del cliente)
        - **Acciones** (Confirmar / Rechazar / Procesar)
- **CA-02:** **Orden por prioridad:**
    - Primero: estado `solicitado` (requieren llamada de confirmación)
    - Segundo: estado `confirmado` o `rechazado` (requieren procesamiento)
    - Último: Pasa de `confirmado` a estado `procesado` (historial)
- **CA-03:** **Filtros disponibles:**
    - Por estado (Todos / Solicitado / Confirmado / Rechazado / Procesado)
    - Por rango de fechas
    - Por rango de montos
    - Por búsqueda de cliente

---

### **Acciones Contextuales por Estado:**

### **Estado `solicitado`:**
- **Acción:** "Confirmar Solicitud" → Abre modal de confirmación
- **Acción:** "Rechazar Solicitud" → Abre modal de rechazo
- **Explicación:** "Requiere llamada al cliente para confirmar datos bancarios"

### **Estado `confirmado`:**
- **Acción:** "Procesar Transferencia" → Abre **HU-REEM-03**
- **Explicación:** "Cliente confirmó datos bancarios, listo para transferir"


### **Estado `procesado/rechazado`:**
- **Acción:** "Ver Detalles" → Vista de solo lectura
- **Explicación:** "Proceso completado"

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar solicitudes no eliminadas
- **VN-02:** Verificar saldo disponible actual vs monto solicitado antes de confirmar
- **VN-03:** No permitir confirmar si cliente ya no tiene saldo suficiente
- **VN-04:** Validar que estado permite la acción (no procesar sin confirmar)
- **VN-05:** Alertar si el saldo disponible cambió significativamente desde la solicitud

---

### **UI/UX:**

- **UX-01:** **Indicadores visuales claros:**
    - Estados con colores distintivos (naranja=solicitado, azul=confirmado, verde=procesado, rojo=rechazado)
    - Badge de urgencia para solicitudes antiguas (>3 días)
    - Contador en header: "X transferencias requieren atención"
- **UX-02:** **Información contextual:**
    - Tooltip explicando proceso de confirmación telefónica
    - Saldo disponible actual vs solicitado con indicador de diferencia
    - Tiempo transcurrido desde solicitud
- **UX-03:** **Acciones rápidas:**
    - Botones contextuales según estado
    - Confirmación adicional para acciones críticas
    - Vista rápida de datos de contacto del cliente

---

### **Modal de Confirmación (Estado `solicitado` → `confirmado`):**

- **MC-01:** **Mostrar información completa:**
    - Datos del cliente y contacto telefónico
    - Monto solicitado vs saldo disponible actual
    - Motivo de la solicitud
    - Historial reciente de transacciones del cliente
- **MC-02:** **Campos del modal:**
    - Checkbox: "Cliente confirmó telefónicamente sus datos bancarios"
    - Checkbox: "Cliente confirmó el monto exacto a transferir"  
    - `fecha_respuesta_empresa` = now() (automático)
    - Campo opcional: comentarios del admin sobre la llamada
- **MC-03:** **Al confirmar:**
    - Actualizar `Refund.estado = confirmado`
    - Registrar `Refund.fecha_respuesta_empresa = now()`
    - Crear notificación al cliente: "Solicitud de reembolso confirmado - se procesará en 24-48h"
    - NO modificar saldos (el dinero ya está retenido desde la solicitud)
    - Mantener retención hasta procesamiento final

---

### **Modal de Rechazo (Estado `solicitado` → `rechazado`):**

- **MR-01:** **Campos obligatorios:**
    - Lista de motivos predefinidos (checkboxes):
        - "Saldo insuficiente"
        - "Datos bancarios incorrectos"
        - "No cumple políticas de transferencia"
        - "Cliente canceló telefónicamente"
        - "Cuenta no verificada"
    - Campo obligatorio para "Otros motivos" 
- **MR-02:** **Al rechazar:**
    - Actualizar `Refund.estado = rechazado`
    - Registrar `Refund.fecha_respuesta_empresa = now()`
    - Guardar motivos en `Refund.motivo_rechazo`
    - Crear notificación al cliente con motivos específicos
    - Backend ejecuta función para liberar retención INMEDIATAMENTE:
        - `saldo_retenido` disminuye por monto solicitado
        - `saldo_disponible` aumenta por monto solicitado (dinero vuelve a estar disponible)
        - `saldo_total` se mantiene igual
---

### **Estados y Flujo:**

- **EF-01:** **Flujo normal:** solicitado → confirmado → procesado
- **EF-02:** **Flujo rechazo:** solicitado → rechazado (final)
- **EF-03:** **Actualización automática:** Lista se refresca cada 5 minutos
- **EF-04:** **Navegación:** Click en fila abre detalle expandido con historial

---

## **DIFERENCIAS CON LA VERSIÓN ANTERIOR**

### **Eliminado:**
- Diferenciación entre tipos de reembolso (solo hay transferencia bancaria)
- Lógica de `mantener_saldo` (ya no existe)

### **Simplificado:**
- Un solo tipo de proceso: transferencia en efectivo
- Interfaz más clara y directa
- Menos campos y opciones confusas

### **Mejorado:**
- Verificación en tiempo real de saldo disponible vs solicitado
- Mejor tracking de cambios en saldo del cliente
- Proceso más eficiente para admin

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Proceso de Confirmación:**
- Admin debe verificar saldo actual vs solicitado en tiempo real
- No procesar sin confirmación explícita del cliente y sus datos

### **Gestión de Estados:**
- Estados son secuenciales e irreversibles
- Una vez procesado no se puede modificar
- Historial completo mantenido para auditoría

### **Validaciones Críticas:**
- Saldo disponible puede cambiar entre solicitud y procesamiento
- Verificar integridad antes de cada acción
- Prevenir procesamiento de solicitudes con saldo insuficiente
- Alertar sobre discrepancias significativas en saldos


