# HU-REEM-05 — Detalle de Reembolso (Cliente)

## **Historia:**

Como **cliente**, quiero ver el detalle completo de una solicitud de reembolso específica para hacer seguimiento de su estado, conocer el motivo de rechazo si aplica, y descargar comprobantes cuando esté procesado.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde HU-REEM-04** → click en cualquier solicitud de reembolso
- **CA-02:** **Mostrar información completa organizada en secciones:**
    
    **Información General:**
    - Número de referencia de la solicitud
    - Fecha de solicitud (created_at)
    - Monto solicitado
    - Tipo de reembolso (Mantener Saldo / Devolver Dinero)
    - Estado actual con timeline visual
    - Motivo de la solicitud (ingresado por cliente)
    
    **Seguimiento del Proceso:**
    - Timeline/stepper con pasos del proceso
    - Fechas específicas de cada cambio de estado
    - Estado actual destacado visualmente
    
    **Información Específica por Estado:**
    - Ver detalles según estado actual (solicitado/confirmado/procesado/rechazado)

---

### **Diferencias por Estado:**

### **Estado `solicitado`:**
- **Información mostrada:**
    - "Su solicitud está en revisión"
    - "Se contactarán telefónicamente para confirmar detalles"
    - Tiempo transcurrido desde solicitud
- **Acciones disponibles:**
    - "Cancelar Solicitud" (si aún no fue contactado)

### **Estado `confirmado`:**
- **Información mostrada:**
    - "Solicitud confirmada telefónicamente"
    - "En proceso de [transferencia/aplicación] del monto"
    - Fecha de confirmación (fecha_respuesta_empresa)
- **Acciones disponibles:**
    - Solo lectura (en procesamiento)

### **Estado `procesado`:**
- **Información mostrada:**
    - "Reembolso completado exitosamente"
    - Fecha de procesamiento
    - **Si tipo = `mantener_saldo`:**
        - "El monto fue agregado a su saldo disponible"
        - Nuevo saldo disponible
    - **Si tipo = `devolver_dinero`:**
        - "El monto fue transferido a su cuenta"
        - Datos bancarios utilizados (parcialmente ocultos)
        - Número de operación del reembolso
- **Acciones disponibles:**
    - "Descargar Comprobante" (si voucher_url existe)
    - "Ver en Historial de Transacciones"

### **Estado `rechazado`:**
- **Información mostrada:**
    - "Solicitud rechazada"
    - Motivo detallado del rechazo
    - Fecha de rechazo (fecha_respuesta_empresa)
- **Acciones disponibles:**
    - "Nueva Solicitud de Reembolso" → **HU-REEM-01**

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar detalles de solicitudes del cliente autenticado
- **VN-02:** Verificar que la solicitud existe y no está eliminada
- **VN-03:** Validar sesión activa del cliente
- **VN-04:** Comprobar permisos de acceso al comprobante si existe

---

### **UI/UX:**

- **UX-01:** **Header con información clave:**
    - "Solicitud de Reembolso #[id]"
    - Estado actual con badge de color
    - Fecha de solicitud
- **UX-02:** **Timeline visual del proceso:**
    - Solicitud enviada (con fecha)
    - En revisión / Confirmada /  Rechazada
    - En procesamiento /  Procesada
    - Iconos y colores claros para cada estado
- **UX-03:** **Secciones colapsables:**
    - "Detalles de la Solicitud" (siempre visible)
    - "Información del Proceso" (según estado)
    - "Comprobantes" (solo si aplica)
- **UX-04:** **Botones contextuales:**
    - "Volver al Historial"
    - Botones específicos según estado actual
- **UX-05:** **Información helpful:**
    - Tooltip explicando cada estado
    - Tiempo estimado para próximo paso (si aplica)

---

### **Estados y Flujo:**

- **EF-01:** **Navegación:** breadcrumb "Inicio > Mis Reembolsos > Solicitud #[id]"
- **EF-02:** **Actualización automática:** datos se refrescan al cargar
- **EF-03:** **Acciones disponibles** cambian según estado actual
- **EF-04:** **URL única:** `/mis-reembolsos/detalle/{refund_id}` para compartir/guardar

---

### **Integración con Movement:**

- **IM-01:** **Si estado = `procesado`:**
    - Mostrar link "Ver en Historial de Transacciones"
    - Enlaza al Movement creado por el procesamiento
    - Información consistente entre Refund y Movement

---

### **Descarga de Comprobantes:**

- **DC-01:** **Si tipo = `devolver_dinero` y estado = `procesado`:**
    - Botón "Descargar Comprobante de Reembolso"
    - Acceso al voucher_url del Movement relacionado
    - Validación de permisos antes de mostrar enlace
- **DC-02:** **Si tipo = `mantener_saldo`:**
    - No hay comprobante físico
    - Mostrar confirmación de aplicación al saldo

---

### **Información de Referencia:**

```sql
-- Query para obtener datos completos
SELECT 
    r.*, u.first_name, u.last_name,
    m.voucher_url, m.numero_operacion 
FROM Refund r
LEFT JOIN User u ON r.user_id = u.id
LEFT JOIN Movement m ON (m.user_id = r.user_id 
    AND m.tipo_movimiento_especifico = 'reembolso' 
    AND m.created_at >= r.fecha_procesamiento)
WHERE r.id = [refund_id] AND r.user_id = [session_user_id]
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Transparencia:**
- Información completa sobre el proceso
- Estados claramente explicados
- Timeline visual para seguimiento

### **Accesibilidad:**
- Interface simple y clara
- Información contextual según estado
- Acciones evidentes para próximos pasos

### **Consistencia:**
- Datos consistentes con Movement relacionado
- Estados sincronizados entre Refund y UI
- Información alineada con notificaciones recibidas

---