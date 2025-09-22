# HU-COMP-04 — Procesar Resultado "Cliente No Pagó Vehículo" (Admin)

## **Historia:**

Como **sistema**, quiero procesar automáticamente el resultado cuando BOB gana la competencia externa pero el cliente no completa el pago del vehículo, para aplicar la penalidad del 30% y **crear automáticamente el Movement de reembolso del 70%** que libera inmediatamente el dinero restante como saldo disponible.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** cuando admin selecciona "CLIENTE NO PAGÓ VEHÍCULO" en **HU-COMP-01**
- **CA-02:** Al ejecutarse:
    - Actualizar `Auction.estado = penalizada`
    - Registrar `Auction.fecha_resultado_general = now()`
    - **Ejecutar HU-PEN-01** automáticamente para aplicar penalidad del 30%
    - **Crear Movement de reembolso automático (70%):**
        - `user_id` = cliente ganador
        - `tipo_movimiento_general` = 'entrada'
        - `tipo_movimiento_especifico` = 'reembolso'
        - `monto` = monto_garantia × 0.70
        - `concepto` = "Reembolso automático 70% - Cliente se retiro del proceso de subasta"
        - `estado` = 'validado'
        - `moneda` = 'USD'
        - `fecha_pago` = now()
        - `fecha_resolucion` = now()
        - `auction_id_ref` = subasta asociada

    - Backend ejecuta función para recalcular saldos INMEDIATAMENTE:
        - `saldo_retenido` disminuye por monto de garantía completo
        - `saldo_total` disminuye solo por penalidad (30%)
        - `saldo_disponible` aumenta por el 70% restante
- **CA-03:** **Crear notificación automática:**
    - **Para el cliente:** tipo `penalidad_aplicada`
    - **Mensaje:** "Se aplicó penalidad del 30% ($[monto_penalidad]) por retiro del proceso de subasta. Su saldo disponible incluye los $[monto_70%] restantes."
    - **CTA:** Enlace directo a "Solicitar Transferencia en Efectivo" si desea el 70% transferido

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** Validar que no se duplica aplicación de penalidad para la misma subasta
- **VN-05:** Verificar que penalidad (30%) + reembolso (70%) = 100% del monto original
- **VN-06:** Crear referencias de ambos Movement a la subasta original

---

### **UI/UX:**

- **UX-01:** **Proceso transparente** sin interfaz adicional (automático desde COMP-01)
- **UX-02:** **Toast de confirmación** en la pantalla admin:
    > "Penalidad del 30% aplicada ($[monto]). Cliente tiene $[70%] disponible inmediatamente."
- **UX-03:** **Actualización automática** del detalle de subasta mostrando:
    - Estado: `penalizada`
    - Resumen: "Penalidad aplicada: $[30%] | Saldo disponible: $[70%]"
    - Información de ambos Movement generados (penalidad y reembolso)

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `finalizada` (pago validado, BOB aún no compite)
- **EF-02:** **Estado actual:** `penalizada` (penalidad aplicada + reembolso automático procesado)
- **EF-03:** **Estado final:** Cliente puede usar el 70% inmediatamente o solicitar transferencia en efectivo
- **EF-04:** **Impacto en saldos:**
    - Saldo Total: Disminuye solo por penalidad (30%)
    - Saldo Retenido: Disminuye por monto de garantía completo (dinero liberado)
    - Saldo Disponible: Aumenta por el 70% restante (dinero disponible inmediatamente)

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente:**
    - **Tipo:** `penalidad_aplicada`
    - **Mensaje UI:** "Se aplicó penalidad del 30% ($[monto_penalidad]) por no completar pago del vehículo. Tiene $[monto_70%] disponible en su cuenta para usar en otras subastas."
    - **Correo:** Envío automático vía EmailJS
    - **CTA:** "Solicitar Transferencia en Efectivo" del 70% (opcional)
    
- **NOT-02:** **Para el admin:**
    - **Tipo:** `penalidad_aplicada`
    - **Mensaje:** "Penalidad aplicada a cliente [nombre] - Subasta #[id]. Penalidad: $[30%] | Saldo disponible: $[70%]"



---

### **Ejemplo Práctico de Cálculo:**

```
Oferta ganadora: $12,000
Garantía pagada: $960 (8%)

BOB gana pero cliente no paga vehículo completo:
- Penalidad: $960 × 30% = $288 (BOB retiene)
- Reembolso automático: $960 × 70% = $672 (disponible inmediatamente)

Impacto en saldos del cliente:
Antes: Saldo Total $2000, Retenido $960, Disponible $1040
Después: Saldo Total $1712 ($2000-$288), Retenido $0, Disponible $1712 ($1040+$672)

Cliente puede usar inmediatamente $672 o solicitar transferencia en efectivo
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización Completa:**
- Cálculo automático de porcentajes (30% penalidad, 70% reembolso)
- Creación simultánea de ambos Movement
- Cliente puede usar el 70% inmediatamente para otras subastas

### **Auditoría:**
- Doble registro para trazabilidad (penalidad + reembolso automático)
- Referencias cruzadas a subasta original
- Log detallado de cálculos aplicados

### **Integridad:**
- Verificación de que penalidad + reembolso = 100% del monto original
- Validación de consistencia en saldos después de ambos Movement
- Prevención de duplicación de penalidades

### **Diferencia con Refund:**
- Ya NO es necesario que cliente solicite reembolso para tener el 70% disponible
- Refund será solo para convertir saldo_disponible → efectivo (transferencia)

---