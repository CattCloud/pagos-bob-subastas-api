# HU-COMP-03 — Procesar Resultado "BOB Perdió" (Admin)

## **Historia:**

Como **sistema**, quiero procesar automáticamente el resultado cuando BOB pierde la competencia externa, para cambiar el estado de la subasta a `perdida` y **crear automáticamente el Movement de reembolso** que libera inmediatamente el dinero como saldo disponible para el cliente.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** cuando admin selecciona "BOB PERDIÓ" en **HU-COMP-01**
- **CA-02:** Al ejecutarse:
    - Actualizar `Auction.estado = perdida`
    - Registrar `Auction.fecha_resultado_general = now()`
    - **CREAR Movement de reembolso automáticamente:**
        - `user_id` = cliente ganador
        - `tipo_movimiento_general` = 'entrada'
        - `tipo_movimiento_especifico` = 'reembolso'
        - `monto` = monto de garantía pagado
        - `moneda` = 'USD'
        - `concepto` = "Reembolso automático como saldo disponible- BOB perdió competencia externa"
        - `estado` = 'validado'
        - `fecha_pago` = now()
        - `fecha_resolucion` = now()
        - `auction_id_ref` = subasta asociada

    - Backend ejecuta función para recalcular saldos INMEDIATAMENTE:
        - `saldo_retenido` disminuye por monto de garantía
        - `saldo_total` mantiene igual (entrada compensa la liberación)
        - `saldo_disponible` aumenta por monto de garantía
- **CA-03:** **Crear notificación automática:**
    - **Para el cliente:** tipo `competencia_perdida`
    - **Mensaje:** "BOB no ganó la competencia. Su garantía de $[monto] ya está disponible en su cuenta."
    - **CTA:** Enlace directo a "Solicitar Reembolso en Efectivo" si desea el dinero transferido

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** Validar que no se duplica el procesamiento para la misma subasta
- **VN-05:** Crear referencias del Movement a la subasta original

---

### **UI/UX:**

- **UX-01:** **Proceso transparente** sin interfaz adicional (automático desde COMP-01)
- **UX-02:** **Toast de confirmación** en la pantalla admin:
    > "BOB perdió la competencia. Reembolso de $[monto] procesado automáticamente al cliente."
- **UX-03:** **Actualización automática** del detalle de subasta mostrando:
    - Estado: `perdida`
    - Mensaje: "BOB perdió - Cliente tiene $[monto] disponible"
    - Información del Movement de reembolso automático creado

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `finalizada` (pago validado, BOB aún no compite)
- **EF-02:** **Estado actual:** `perdida` (BOB perdió, reembolso automático procesado)
- **EF-03:** **Estado final:** Cliente puede usar dinero inmediatamente o solicitar transferencia en efectivo (HU-REEM-01)
- **EF-04:** **Impacto en saldos:**
    - Saldo Total: Sin cambio (entrada de reembolso compensa liberación de retenido)
    - Saldo Retenido: Disminuye por monto de garantía (dinero liberado)
    - Saldo Disponible: Aumenta por monto de garantía (dinero disponible inmediatamente)

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente:**
    - **Tipo:** `competencia_perdida`
    - **Mensaje UI:** "BOB no logró ganar la competencia. Su garantía de $[monto] ya está disponible en su cuenta para usar en otras subastas."
    - **Correo:** Envío automático vía EmailJS 
    - **CTA:** "Solicitar Transferencia en Efectivo" (opcional)
    
- **NOT-02:** **Para el admin:**
    - **Tipo:** `competencia_perdida`
    - **Mensaje:** "BOB perdió competencia - Subasta #[id]. Reembolso automático de $[monto] procesado para cliente [nombre]"

---


### **Impacto en Sistema de Saldos:**

**Ejemplo práctico:**
```
Garantía pagada: $960
Antes del resultado:
- Saldo Total: $2000
- Saldo Retenido: $960 (congelado)
- Saldo Disponible: $1040

Después de BOB perder (automático):
- Saldo Total: $2000 (sin cambio)
- Saldo Retenido: $0 (liberado)
- Saldo Disponible: $2000 (cliente puede usar inmediatamente)
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización Completa:**
- Proceso completamente automático tras selección en COMP-01
- No requiere intervención adicional del admin o cliente
- Cliente puede usar dinero inmediatamente para otras subastas

### **Auditoría:**
- Registro completo del reembolso automático en Movement
- Referencias a subasta original
- Log de cambios en saldos del cliente

### **Gestión de Errores:**
- Si falla creación de Movement: revertir cambio de estado
- Si falla recálculo de saldos: generar alerta para admin
- Si falla notificación: marcar para reintento automático

### **Diferencia con Refund:**
- Ya NO es necesario que cliente solicite reembolso para tener el dinero disponible
- Refund será solo para convertir saldo_disponible → efectivo (transferencia)

---