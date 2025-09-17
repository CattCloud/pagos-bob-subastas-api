# HU-NOT-02 — Panel de Notificaciones (Admin)

## **Historia:**

Como **administrador**, quiero ver todas las notificaciones del sistema en un panel centralizado para estar al día con eventos que requieren mi atención (pagos pendientes, solicitudes de reembolso, etc.) y poder gestionarlas eficientemente.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú admin:** "Notificaciones" con badge mostrando número de no leídas
- **CA-02:** **Listado de notificaciones en orden de prioridad:**
    - Primero: **Requieren acción inmediata** (pago_registrado, reembolso_solicitado)
    - Segundo: **Informativas recientes** (billing_generado, penalidad_procesada)
    - Último: **Historial** (notificaciones antiguas ya procesadas)
- **CA-03:** **Información mostrada por notificación:**
    - **Título** descriptivo
    - **Cliente relacionado** (nombre + documento)
    - **Mensaje** completo
    - **Fecha/hora** de creación
    - **Estado visual** (leída/no leída/requiere acción)
    - **Enlace directo** a la acción correspondiente
- **CA-04:** **Tipos de notificaciones para admin:**
    - 📩 `pago_registrado` - "Cliente registró pago pendiente validación"
    - 💸 `reembolso_solicitado` - "Cliente solicitó reembolso"
    - 📄 `billing_generado` - "Se generó factura para cliente"
    - ⚠️ `penalidad_procesada` - "Penalidad aplicada a cliente"
    - 📊 `competencia_perdida_procesada` - "BOB perdió - cliente puede solicitar reembolso"

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar notificaciones dirigidas a admin (`user_type = admin`)
- **VN-02:** Incluir notificaciones independientemente del estado de email
- **VN-03:** Filtrar por relevancia (priorizar las que requieren acción)
- **VN-04:** Validar sesión de administrador activa

---

### **UI/UX:**

- **UX-01:** **Header con gestión rápida:**
    - "Notificaciones del Sistema"
    - Contador: "X requieren acción | Y no leídas de Z total"
    - Botón: "Marcar todas como leídas"
- **UX-02:** **Diseño diferenciado por urgencia:**
    - **Requieren acción:** fondo rojo claro, icono de alerta
    - **Informativas no leídas:** fondo azul claro
    - **Leídas:** fondo normal
- **UX-03:** **Acciones directas integradas:**
    - **`pago_registrado`** → "Validar Pago" → **HU-VAL-02**
    - **`reembolso_solicitado`** → "Gestionar Solicitud" → **HU-REEM-02**  
    - **`billing_generado`** → "Ver Factura" → **HU-BILL-02** (gestión billing)
    - **`penalidad_procesada`** → "Ver Detalles" → **HU-SUB-07** (detalle subasta)
- **UX-04:** **Información contextual:**
    - Datos del cliente afectado siempre visibles
    - Monto involucrado cuando aplique
    - Estado actual del proceso relacionado
- **UX-05:** **Si no hay notificaciones:**
    > "No tiene notificaciones pendientes."
    > 
    > "Los eventos importantes del sistema aparecerán aquí."

---

### **Estados y Flujo:**

- **EF-01:** **Badge dinámico:** contador se actualiza automáticamente
- **EF-02:** **Al abrir panel:** notificaciones se marcan automáticamente como vistas
- **EF-03:** **Click en acción:** redirige al módulo correspondiente con contexto
- **EF-04:** **Actualización en tiempo real:** nuevas notificaciones aparecen inmediatamente

---

### **Filtros y Búsqueda:**

- **FIL-01:** **Filtros rápidos:**
    - "Requieren Acción" (pago_registrado, reembolso_solicitado)
    - "Solo No Leídas"
    - "Últimos 7 días"
    - "Por Cliente" (búsqueda de texto)
- **FIL-02:** **Búsqueda avanzada:**
    - Por tipo de evento
    - Por rango de fechas
    - Por cliente específico
    - Por monto involucrado

---

### **Gestión de Prioridades:**

### **🔴 ALTA PRIORIDAD (Requieren acción):**
- `pago_registrado` - Pago pendiente de validación
- `reembolso_solicitado` - Solicitud pendiente de confirmación

### **🔵 MEDIA PRIORIDAD (Informativas):**
- `billing_generado` - Factura creada exitosamente
- `penalidad_procesada` - Penalidad aplicada, cliente puede solicitar reembolso

### **🟢 BAJA PRIORIDAD (Historial):**
- Notificaciones ya procesadas o que no requieren acción

---

### **Integración con Sistema:**

```sql
-- Query para notificaciones de admin
SELECT 
    n.*,
    u.first_name, u.last_name, u.document_number,
    CASE n.tipo
        WHEN 'pago_registrado' THEN 'ALTA'
        WHEN 'reembolso_solicitado' THEN 'ALTA'
        WHEN 'billing_generado' THEN 'MEDIA'
        WHEN 'penalidad_procesada' THEN 'MEDIA'
        ELSE 'BAJA'
    END as prioridad
FROM Notifications n
LEFT JOIN User u ON n.reference_id = (
    SELECT user_id FROM Movement WHERE id = n.reference_id LIMIT 1
) OR n.reference_id = (
    SELECT user_id FROM Refund WHERE id = n.reference_id LIMIT 1
)
WHERE n.user_id IN (SELECT id FROM User WHERE user_type = 'admin')
ORDER BY 
    CASE prioridad WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END,
    n.created_at DESC
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Gestión de Atención:**
- Priorización automática por urgencia
- Acciones directas desde notificaciones
- Contexto completo para toma de decisiones

### **Eficiencia Operativa:**
- Navegación directa a módulos de gestión
- Información completa sin necesidad de buscar
- Actualización automática del estado

### **Auditoría:**
- Historial completo de notificaciones
- Trazabilidad de acciones tomadas
- Estados de procesamiento visibles

---