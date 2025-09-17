# HU-NOT-01 — Panel de Notificaciones (Cliente)

## **Historia:**

Como **cliente**, quiero ver todas mis notificaciones del sistema en un panel organizado para estar al día con el estado de mis subastas, pagos y reembolsos, y poder marcarlas como leídas.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú cliente:** "Notificaciones" con badge mostrando número de no leídas
- **CA-02:** **Listado de notificaciones en orden cronológico** (más recientes primero):
    - **Título** de la notificación
    - **Mensaje** descriptivo completo
    - **Fecha/hora** de creación
    - **Estado visual** (leída/no leída)
    - **Tipo de evento** con icono distintivo
    - **Enlace de acción** si aplica (ir a detalle relacionado)
- **CA-03:** **Tipos de notificaciones mostradas:**
    - 🏆 `ganador_subasta` - "Ganó subasta de [vehículo]"
    - ✅ `pago_validado` - "Pago de garantía aprobado"
    - ❌ `pago_rechazado` - "Pago de garantía rechazado"
    - 🎯 `competencia_ganada` - "BOB ganó la competencia"
    - 😞 `competencia_perdida` - "BOB no ganó la competencia"
    - ⚠️ `penalidad_aplicada` - "Penalidad aplicada"
    - 💰 `reembolso_procesado` - "Reembolso completado"
    - 📄 `facturacion_completada` - "Facturación procesada"
- **CA-04:** **Acciones del panel:**
    - "Marcar todas como leídas"
    - "Limpiar notificaciones antiguas" (>30 días)
    - Click en notificación → marcar como leída + navegar a detalle

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar notificaciones del cliente autenticado (`user_id = session.user_id`)
- **VN-02:** Incluir notificaciones independientemente del estado de email (enviado/fallido)
- **VN-03:** Validar sesión activa del cliente
- **VN-04:** Máximo 100 notificaciones por página con paginación

---

### **UI/UX:**

- **UX-01:** **Header del panel:**
    - "Mis Notificaciones"
    - Contador: "X no leídas de Y total"
    - Filtro rápido: "Todas / No leídas / Últimos 7 días"
- **UX-02:** **Diseño de notificaciones:**
    - **No leídas:** fondo claro, texto en negrita, icono de punto azul
    - **Leídas:** fondo normal, texto regular, sin indicador
    - **Iconos por tipo:** distintivos para cada evento
    - **Timestamp:** "hace 2 horas", "ayer", "hace 3 días"
- **UX-03:** **Acciones contextúales:**
    - Click en notificación → acción específica según tipo:
        - `ganador_subasta` → ir a "Pagar Garantía"
        - `pago_validado` → ir a "Mis Garantías"
        - `competencia_ganada` → ir a "Completar Facturación"
        - `competencia_perdida` → ir a "Solicitar Reembolso"
        - `penalidad_aplicada` → ir a "Solicitar Reembolso"
        - `reembolso_procesado` → ir a "Historial Transacciones"
- **UX-04:** **Si no hay notificaciones:**
    > "No tiene notificaciones pendientes."
    > 
    > "Las notificaciones sobre sus subastas y pagos aparecerán aquí."

---

### **Estados y Flujo:**

- **EF-01:** **Badge en menú:** se actualiza automáticamente con contador de no leídas
- **EF-02:** **Al abrir panel:** marcar automáticamente como vistas (no leídas → leídas)
- **EF-03:** **Navegación contextual:** cada notificación redirige a la pantalla apropiada
- **EF-04:** **Actualización tiempo real:** nuevas notificaciones aparecen inmediatamente

---

### **Gestión de Estados:**

### **Estado `pendiente` (no leída):**
- **Visual:** Fondo destacado, texto en negrita, punto azul
- **Comportamiento:** Cuenta para badge del menú
- **Acción:** Se marca como `vista` al abrir panel

### **Estado `vista` (leída):**
- **Visual:** Aspecto normal, sin destacar
- **Comportamiento:** No cuenta para badge
- **Persistencia:** Se mantiene en historial

---

### **Integración con Sistema:**

```sql
-- Query para cargar notificaciones del cliente
SELECT 
    n.*,
    CASE n.reference_type
        WHEN 'auction' THEN CONCAT('Subasta #', n.reference_id)
        WHEN 'refund' THEN CONCAT('Reembolso #', n.reference_id)
        WHEN 'billing' THEN CONCAT('Factura #', n.reference_id)
        ELSE 'Sistema'
    END as contexto
FROM Notifications n
WHERE n.user_id = [client_user_id]
ORDER BY n.created_at DESC
LIMIT 100 OFFSET [page * 100]

-- Actualizar estado al abrir panel
UPDATE Notifications 
SET estado = 'vista', fecha_vista = NOW()
WHERE user_id = [client_user_id] AND estado = 'pendiente'
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización:**
- Badge se actualiza automáticamente en tiempo real
- Notificaciones se marcan como vistas al abrir panel
- Navegación contextual según tipo de evento

### **Performance:**
- Carga eficiente con paginación
- Consulta optimizada por usuario
- Actualización incremental del badge

### **Experiencia:**
- Panel similar a notificaciones de redes sociales
- Acciones claras y directas
- Información contextual suficiente

---