# HU-COMP-02 — Procesar Resultado "BOB Ganó" (Admin)

## **Historia:**

Como **sistema**, quiero procesar automáticamente el resultado cuando BOB gana la competencia externa, para cambiar el estado de la subasta a `ganada` y notificar al cliente que debe completar sus datos de facturación para aplicar su saldo.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** cuando admin selecciona "BOB GANÓ" en **HU-COMP-01**
- **CA-02:** Al ejecutarse:
    - Actualizar `Auction.estado = ganada`
    - Registrar `Auction.fecha_resultado_general = now()`
    - **CREAR Billing automático** con datos parciales:
        - `user_id` = usuario ganador (automático)
        - `auction_id` = subasta actual (automático)
        - `monto` = monto de garantía pagada (automático)
        - `moneda` = 'USD' (automático)
        - `concepto` = "Factura por Subasta [Marca] [Modelo] [Año] - Placa: [Placa]" (automático)
        - `billing_document_type` = NULL (pendiente de completar)
        - `billing_document_number` = NULL (pendiente de completar)
        - `billing_name` = NULL (pendiente de completar)
    - **Recalcular `User.saldo_retenido` INMEDIATAMENTE** (se resta el monto de garantía)
- **CA-03:** **Crear notificación automática** para el cliente:
    - **Tipo:** `competencia_ganada`
    - **Mensaje UI:** "¡BOB ganó la competencia! Complete sus datos de facturación para aplicar su saldo."
    - **Correo:** Envío automático vía EmailJS con misma información + enlace directo
    - **CTA:** Link directo a formulario de facturación

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** No ejecutar si ya existe Billing para esta subasta

---

### **UI/UX:**

- **UX-01:** **Proceso transparente** sin interfaz adicional (automático desde COMP-01)
- **UX-02:** **Toast de confirmación** en la pantalla admin:
    > "BOB ganó la competencia. Se ha notificado al cliente para completar facturación."
- **UX-03:** **Actualización automática** del detalle de subasta mostrando:
    - Estado: `ganada`
    - Mensaje: "Esperando datos de facturación del cliente"
    - Nuevo botón: "Ver Estado Facturación"

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `finalizada` (Bob gano la competencia general)
- **EF-02:** **Estado actual:** `ganada` (BOB ganó, esperando datos cliente)
- **EF-03:** **Próximo estado:** `facturada` (cuando cliente complete datos vía **HU-BILL-01**)
- **EF-04:** **Timeout:** Si cliente no completa datos en X días, admin puede marcar como abandonada

---

### **Integración con Sistema:**

- **INT-01:** **Notificación dual automática:**
    - Registro en tabla `Notifications` tipo `competencia_ganada`
    - Envío inmediato de correo vía EmailJS
- **INT-02:** **Actualización de menú cliente:**
    - Al recibir notificación, aparece opción "Completar Facturación" en menú
    - Badge de notificación hasta completar datos
- **INT-03:** **Cálculo de saldos:**
    - `saldo_retenido` se mantiene igual (dinero sigue congelado)
    - `saldo_disponible` no cambia hasta crear Billing

---

### **Campos de Base de Datos Actualizados:**

```sql
-- Actualizar estado de subasta
UPDATE Auction SET
    estado = 'ganada',
    fecha_resultado_general = NOW()
WHERE id = [auction_id]

-- Crear Billing automático con datos parciales
INSERT INTO Billing (
    user_id, auction_id, monto, moneda, concepto,
    billing_document_type, billing_document_number, billing_name,
    created_at, updated_at
) VALUES (
    [client_user_id], [auction_id], [monto_garantia], 'USD',
    'Factura por Subasta [Marca] [Modelo] [Año] - Placa: [Placa]',
    NULL, NULL, NULL,
    NOW(), NOW()
)

-- Recalcular saldo_retenido inmediatamente (liberar garantía)
UPDATE User SET saldo_retenido = saldo_retenido - [monto_garantia]
WHERE id = [client_user_id]

-- Crear notificación automática
INSERT INTO Notifications (
    user_id, tipo, titulo, mensaje,
    reference_type, reference_id,
    estado, email_status
) VALUES (
    [client_user_id], 'competencia_ganada',
    '¡BOB ganó la competencia!',
    'BOB ganó la competencia externa. Complete sus datos de facturación para finalizar el proceso.',
    'billing', [billing_id],
    'pendiente', 'pendiente'
)
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Flujo de Datos:**
- Información de subasta y cliente ya está cargada desde HU-COMP-01
- No requiere entrada adicional del admin
- Proceso completamente automático tras confirmación en COMP-01
- **Billing se crea automáticamente** con datos parciales, liberando inmediatamente el saldo retenido

### **Gestión de Errores:**
- Si falla notificación por correo: marcar como fallido para reintento
- Si falla actualización de estado: revertir y mostrar error al admin
- Si falla creación de Billing: revertir estado de subasta y saldo
- Log completo de errores para auditoría

### **Siguiente Paso:**
- Cliente (o admin) debe completar **HU-BILL-01** para agregar datos de facturación al Billing creado
- Admin puede hacer seguimiento desde detalle de subasta actualizado
- Billing aparece en gestión con estado "Datos pendientes"

---