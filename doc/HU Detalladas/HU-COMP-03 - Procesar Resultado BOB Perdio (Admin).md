# HU-COMP-03 — Procesar Resultado "BOB Perdió" (Admin)

## **Historia:**

Como **sistema**, quiero procesar automáticamente el resultado cuando BOB pierde la competencia externa, para cambiar el estado de la subasta a `perdida` e iniciar el proceso de reembolso completo al cliente.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** cuando admin selecciona "BOB PERDIÓ" en **HU-COMP-01**
- **CA-02:** Al ejecutarse:
    - Actualizar `Auction.estado = perdida`
    - Registrar `Auction.fecha_resultado_general = now()`
    - Backend ejecuta función para recalcular `User.saldo_retenido` INMEDIATAMENTE (pasa a 0)
    - NO crear Movement de reembolso automáticamente
    - El cliente debe solicitar reembolso mediante **HU-REEM-01**
- **CA-03:** **Crear notificación automática:**
    - **Para el cliente:** tipo `competencia_perdida`
    - **Mensaje:** "BOB no ganó la competencia. Su garantía está disponible para reembolso."
    - **CTA:** Enlace directo a "Solicitar Reembolso" con monto pre-llenado

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** Validar que no se duplica el procesamiento para la misma subasta

---

### **UI/UX:**

- **UX-01:** **Proceso transparente** sin interfaz adicional (automático desde COMP-01)
- **UX-02:** **Toast de confirmación** en la pantalla admin:
    > "BOB perdió la competencia. Se ha procesado reembolso completo al cliente."
- **UX-03:** **Actualización automática** del detalle de subasta mostrando:
    - Estado: `perdida`
    - Mensaje: "BOB perdió - Reembolso procesado"
    - Información del reembolso realizado

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `finalizada` (pago validado, BOB aún no compite)
- **EF-02:** **Estado actual:** `perdida` (BOB perdió, reembolso procesado)
- **EF-03:** **Estado final:** Proceso completado, no requiere acciones adicionales
- **EF-04:** **Impacto en saldos:**
    - Saldo Total: Sin cambio hasta que cliente solicite reembolso
    - Saldo Retenido: Disminuye a 0 (dinero ya no congelado)
    - Saldo Disponible: Aumenta (dinero ahora disponible para solicitar reembolso)

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente:**
    - **Tipo:** `competencia_perdida`
    - **Mensaje UI:** "BOB no logró ganar la competencia. Su garantía de $[monto] está disponible para reembolso."
    - **Correo:** Envío automático vía EmailJS con enlace directo a solicitar reembolso
    - **CTA:** "Solicitar Reembolso" con monto pre-llenado
    
    
- **NOT-02:** **Para el admin:**
    - **Tipo:** `competencia_perdida_procesada`
    - **Mensaje:** "BOB perdió competencia - Subasta #[id]. Cliente [nombre] puede solicitar reembolso de $[monto]"

---

### **Campos de Base de Datos Actualizados:**

```sql
-- Actualizar estado de subasta
UPDATE Auction SET
    estado = 'perdida',
    fecha_resultado_general = NOW()
WHERE id = [auction_id]

-- Recalcular saldo_retenido vía función backend (pasa a 0)
CALL recalcularSaldoRetenido([client_user_id])

-- Crear notificación automática
INSERT INTO Notifications (
    user_id, tipo, titulo, mensaje, reference_type, reference_id, estado, email_status
) VALUES (
    [client_user_id], 'competencia_perdida', 'BOB no ganó la competencia',
    'BOB no logró ganar la competencia. Su garantía de $[monto] está disponible para reembolso.',
    'auction', [auction_id], 'pendiente', 'pendiente'
)
```

---

### **Impacto en Sistema de Saldos:**

**Ejemplo práctico:**
```
Garantía pagada: $960
Antes del reembolso:
- Saldo Total: $2000
- Saldo Retenido: $960  
- Saldo Disponible: $1040

Después del reembolso:
- Saldo Total: $1040 ($2000 - $960)
- Saldo Retenido: $0 (ya no está congelado)
- Saldo Disponible: $1040 (vuelve al estado original)
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización:**
- Proceso completamente automático tras selección en COMP-01
- No requiere intervención adicional del admin o cliente
- Reembolso se procesa inmediatamente

### **Auditoría:**
- Registro completo del reembolso en Movement
- Referencias a subasta original
- Log de cambios en saldos del cliente

### **Gestión de Errores:**
- Si falla creación de Movement: revertir cambio de estado
- Si falla notificación: marcar para reintento automático
- Si falla cálculo de saldos: generar alerta para admin

---