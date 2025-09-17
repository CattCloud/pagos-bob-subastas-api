# HU-REEM-04 — Historial de Reembolsos (Cliente)

## **Historia:**

Como **cliente**, quiero ver un listado completo de todas mis solicitudes de reembolso realizadas para hacer seguimiento del estado de cada una y acceder rápidamente al detalle específico.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Listado en tabla (desktop) o tarjetas (mobile)** con columnas:
    - **Monto Solicitado**
    - **Tipo** (Mantener Saldo / Devolver Dinero)
    - **Fecha Solicitud** (created_at)
    - **Estado** (Solicitado / Confirmado / Rechazado / Procesado)
    - **Motivo** (del cliente, truncado)
- **CA-02:** **Orden por defecto:** fecha de solicitud descendente (más recientes primero)
- **CA-03:** **Al hacer clic en una fila:** redirigir a **HU-REEM-05** (Detalle de Reembolso)
- **CA-04:** **Filtros opcionales:**
    - Por estado (Todos / Solicitado / Confirmado / Rechazado / Procesado)
    - Por tipo (Todos / Mantener Saldo / Devolver Dinero)
    - Por rango de fechas

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar solicitudes del cliente autenticado (`user_id = session.user_id`)
- **VN-02:** Incluir todas las solicitudes independientemente del estado
- **VN-03:** Calcular y mostrar totales por estado para información general
- **VN-04:** Validar que cliente tiene sesión activa

---

### **UI/UX:**

- **UX-01:** **Acceso desde menú:** "Mis Reembolsos" o "Historial de Reembolsos"
- **UX-02:** **Estados con colores distintivos:**
    - `solicitado`: naranja - "En revisión"
    - `confirmado`: azul - "Confirmado, en procesamiento"  
    - `procesado`: verde - "Completado"
    - `rechazado`: rojo - "Rechazado"
- **UX-03:** **Información adicional por estado:**
    - **Solicitado:** "Se contactarán para confirmar detalles"
    - **Confirmado:** "En proceso de transferencia/aplicación"
    - **Procesado:** Mostrar fecha de procesamiento
    - **Rechazado:** Mostrar que puede ver motivo en detalle
- **UX-04:** **Responsive design:**
    - **Desktop:** tabla con columnas alineadas
    - **Mobile:** tarjetas apiladas con información principal
- **UX-05:** **Si no hay reembolsos:**
    > "No tiene solicitudes de reembolso registradas."
    > 
    > Botón: "Solicitar Reembolso"

---

### **Estados y Flujo:**

- **EF-01:** **Desde menú principal:** acceso directo al historial
- **EF-02:** **Click en solicitud:** abre detalle completo en **HU-REEM-05**
- **EF-03:** **Actualización automática:** datos se refrescan cada vez que se carga
- **EF-04:** **Navegación:** breadcrumb "Inicio > Mis Reembolsos"

---

### **Información Contextual:**

- **IC-01:** **Resumen en header:**
    - Total solicitudes realizadas
    - Monto total procesado históricamente
    - Solicitudes pendientes (solicitado + confirmado)
- **IC-02:** **Badges informativos:**
    - Tiempo transcurrido desde solicitud
    - Urgencia visual para solicitudes antiguas
    - Indicador de clickeabilidad

---

### **Acciones Rápidas:**

- **AR-01:** **Botón flotante:** "Nueva Solicitud" → **HU-REEM-01**
- **AR-02:** **Filtro rápido:** botones de estado para filtrar lista
- **AR-03:** **Búsqueda:** campo para buscar por monto o motivo
- **AR-04:** **Exportar:** opción de descargar historial en PDF/Excel

---

### **Casos de Uso Específicos:**

- **CU-01:** **Cliente nuevo:** historial vacío con CTA para primera solicitud
- **CU-02:** **Cliente con solicitudes:** lista completa con filtros funcionales
- **CU-03:** **Solicitudes pendientes:** destacar visualmente las que requieren atención
- **CU-04:** **Seguimiento activo:** fácil acceso al detalle de solicitudes en proceso

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Performance:**
- Paginación automática si >20 registros
- Carga lazy de detalles adicionales
- Caché de datos básicos para navegación rápida

### **Seguridad:**
- Solo mostrar solicitudes del cliente autenticado
- Validación de sesión en cada carga
- No exponer información de otros clientes

### **Usabilidad:**
- Interface intuitiva similar a historial bancario
- Estados claros y comprensibles
- Acceso rápido a acciones relacionadas

---