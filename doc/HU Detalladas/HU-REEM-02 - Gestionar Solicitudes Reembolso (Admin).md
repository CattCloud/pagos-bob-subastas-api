# HU-REEM-02 — Gestionar Solicitudes de Reembolso (Admin)

## **Historia:**

Como **administrador**, quiero ver, revisar y gestionar las solicitudes de reembolso enviadas por los clientes, para confirmar o rechazar cada solicitud según las políticas de la empresa antes de proceder con el procesamiento.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Listado de solicitudes de reembolso:**
    - Mostrar tabla con columnas:
        - **Cliente** (nombre + documento)
        - **Monto Solicitado**
        - **Tipo** (Mantener Saldo / Devolver Dinero)
        - **Fecha Solicitud** (created_at)
        - **Estado** (Solicitado / Confirmado / Rechazado / Procesado)
        - **Motivo** (del cliente)
        - **Acciones** (Confirmar / Rechazar / Procesar)
- **CA-02:** **Orden por prioridad:**
    - Primero: estado `solicitado` (requieren llamada de confirmación)
    - Segundo: estado `confirmado` (requieren procesamiento)
    - Último: estado `procesado/rechazado` (historial)
- **CA-03:** **Filtros disponibles:**
    - Por estado (Todos / Solicitado / Confirmado / Rechazado / Procesado)
    - Por tipo de reembolso (Todos / Mantener Saldo / Devolver Dinero)
    - Por rango de fechas
    - Por búsqueda de cliente

---

### **Acciones Contextuales por Estado:**

### **Estado `solicitado`:**
- **Acción:** "Confirmar Solicitud" → Abre modal de confirmación
- **Acción:** "Rechazar Solicitud" → Abre modal de rechazo
- **Explicación:** "Requiere llamada al cliente para confirmar tipo de reembolso"

### **Estado `confirmado`:**
- **Acción:** "Procesar Reembolso" → Abre **HU-REEM-03**
- **Explicación:** "Cliente confirmó por teléfono, listo para procesar"

### **Estado `procesado/rechazado`:**
- **Acción:** "Ver Detalles" → Vista de solo lectura
- **Explicación:** "Proceso completado"

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar solicitudes no eliminadas
- **VN-02:** Verificar saldo disponible actual vs monto solicitado antes de confirmar
- **VN-03:** No permitir confirmar si cliente ya no tiene saldo suficiente
- **VN-04:** Validar que estado permite la acción (no procesar sin confirmar)

---

### **UI/UX:**

- **UX-01:** **Indicadores visuales claros:**
    - Estados con colores distintivos (naranja=solicitado, azul=confirmado, verde=procesado, rojo=rechazado)
    - Badge de urgencia para solicitudes antiguas (>3 días)
    - Contador en header: "X solicitudes requieren atención"
- **UX-02:** **Información contextual:**
    - Tooltip explicando proceso de confirmación telefónica
    - Saldo actual del cliente visible en cada fila
    - Tiempo transcurrido desde solicitud
- **UX-03:** **Acciones rápidas:**
    - Botones contextuales según estado
    - Confirmación adicional para acciones críticas

---

### **Modal de Confirmación (Estado `solicitado` → `confirmado`):**

- **MC-01:** **Mostrar información completa:**
    - Datos del cliente y contacto
    - Datos de la subasta y activo asociado
    - Detalles de la solicitud (monto, tipo, motivo)
    - Saldo actual del cliente
- **MC-02:** **Campos del modal:**
    - Checkbox: "Cliente confirmó telefónicamente el tipo de reembolso"
    - `fecha_respuesta_empresa` = now() (automático)
    - Campo opcional: comentarios del admin
- **MC-03:** **Al confirmar:**
    - Actualizar `Refund.estado = confirmado`
    - Registrar `Refund.fecha_respuesta_empresa = now()`
    - Crear notificación al cliente: solicitud confirmada

---

### **Modal de Rechazo (Estado `solicitado` → `rechazado`):**

- **MR-01:** **Campos obligatorios:**
    - Lista de motivos predefinidos (checkboxes):
        - "Saldo insuficiente"
        - "Información incorrecta"
        - "No cumple políticas"
        - "Cliente canceló telefónicamente"
    - Campo obligatorio para "Otros motivos"
- **MR-02:** **Al rechazar:**
    - Actualizar `Refund.estado = rechazado`
    - Registrar `Refund.fecha_respuesta_empresa = now()`
    - Guardar motivos en `Refund.motivo_rechazo`
    - Crear notificación al cliente con motivos específicos

---

### **Estados y Flujo:**

- **EF-01:** **Flujo normal:** solicitado → confirmado → procesado
- **EF-02:** **Flujo rechazo:** solicitado → rechazado (final)
- **EF-03:** **Actualización automática:** Lista se refresca cada 5 minutos
- **EF-04:** **Navegación:** Click en fila abre detalle expandido

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Proceso de Confirmación:**
- Confirmación telefónica obligatoria antes de procesar
- Admin debe verificar saldo actual vs solicitado
- No procesar sin confirmación explícita del cliente

### **Gestión de Estados:**
- Estados son secuenciales e irreversibles
- Una vez procesado no se puede modificar
- Historial completo mantenido para auditoría

### **Validaciones Críticas:**
- Saldo disponible puede cambiar entre solicitud y procesamiento
- Verificar integridad antes de cada acción
- Prevenir procesamiento de solicitudes obsoletas

---