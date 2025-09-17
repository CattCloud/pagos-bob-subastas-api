# HU-PEN-01 — Aplicar Penalidad (Admin)

## **Historia:**

Como **sistema**, quiero aplicar automáticamente la penalidad del 30% cuando BOB gana la competencia externa pero el cliente no completa el pago del vehículo, para registrar la penalidad como Movement y notificar al cliente sobre el 70% restante disponible para reembolso.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** desde **HU-COMP-04** cuando admin selecciona "CLIENTE NO PAGÓ VEHÍCULO"
- **CA-02:** **Calcular penalidad automáticamente:**
    - Obtener monto de garantía desde Movement tipo `pago_garantia` validado
    - Calcular penalidad: `monto_garantia × 0.30`
    - Calcular saldo restante disponible: `monto_garantia × 0.70`
- **CA-03:** **Crear Movement de penalidad:**
    - `user_id` = cliente penalizado
    - `tipo_movimiento_general` = 'salida'
    - `tipo_movimiento_especifico` = 'penalidad'
    - `monto` = monto_garantia × 0.30
    - `moneda` = 'USD'
    - `concepto` = "Penalidad 30% - Cliente no completó pago del vehículo"
    - `estado` = 'validado'
    - `fecha_pago` = now()
    - `fecha_resolucion` = now()
    - `numero_cuenta_origen` = cuenta BOB (penalidad queda en BOB)
    - `voucher_url` = NULL (no hay comprobante físico)
- **CA-04:** **Crear referencias del Movement:**
    - Registro en `Movement_References`:
        - `reference_type` = 'auction', `reference_id` = auction_id
- **CA-05:** **Actualizar cache de saldos:**
    - Backend ejecuta función para recalcular `User.saldo_total` y `User.saldo_retenido` INMEDIATAMENTE

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado para la subasta
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** No permitir aplicar penalidad duplicada para la misma subasta
- **VN-05:** El monto de penalidad debe ser exactamente el 30% del pago de garantía validado

---

### **UI/UX:**

- **UX-01:** **Proceso automático** sin interfaz adicional (ejecutado desde COMP-04)
- **UX-02:** **Logging interno** para admin:
    - "Penalidad del 30% aplicada a cliente [nombre] por $[monto]"
    - "Cliente tiene $[70%] disponible para solicitar reembolso"

---

### **Estados y Flujo:**

- **EF-01:** **Ejecución:** Parte del proceso automático de HU-COMP-04
- **EF-02:** **Impacto en saldos:**
    - Saldo Total: Disminuye por la penalidad (30%)
    - Saldo Retenido: Pasa a 0 (dinero ya no congelado)
    - Saldo Disponible: Aumenta por el 70% restante disponible para reembolso
- **EF-03:** **Siguiente paso:** Cliente puede solicitar reembolso del 70% vía **HU-REEM-01**

---

### **Ejemplo Práctico de Cálculo:**

```
Subasta: Toyota Corolla 2020
Oferta ganadora: $12,000
Garantía pagada: $960 (8%)

Cliente no paga vehículo completo:
- Penalidad BOB: $960 × 30% = $288
- Disponible cliente para reembolso: $960 × 70% = $672

Impacto en saldos:
Antes: Saldo Total $2000, Retenido $960, Disponible $1040
Después: Saldo Total $1712 ($2000-$288), Retenido $0, Disponible $1712

El cliente puede solicitar reembolso de hasta $672
```

---

### **Campos de Base de Datos Actualizados:**

```sql
-- Crear Movement de penalidad
INSERT INTO Movement (
    user_id, tipo_movimiento_general, tipo_movimiento_especifico,
    monto, moneda, concepto, estado, fecha_pago, fecha_resolucion, numero_cuenta_origen
) VALUES (
    [client_user_id], 'salida', 'penalidad',
    [monto_garantia * 0.30], 'USD', 'Penalidad 30% - Cliente no completó pago del vehículo',
    'validado', NOW(), NOW(), [cuenta_bob]
)

-- Crear referencias del Movement
INSERT INTO Movement_References (movement_id, reference_type, reference_id) VALUES
([movement_id], 'auction', [auction_id])

-- Recalcular cache de saldos vía función backend
CALL recalcularSaldosUsuario([client_user_id])
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización:**
- Cálculo automático del 30% de penalidad
- Creación inmediata de Movement de salida
- Actualización de cache de saldos en tiempo real

### **Transparencia:**
- Cliente recibe información completa sobre penalidad aplicada
- Explicación clara del monto disponible para reembolso
- Proceso de solicitud de reembolso del 70% disponible inmediatamente

### **Auditoría:**
- Registro detallado de la penalidad aplicada
- Referencias cruzadas a subasta original
- Trazabilidad completa del proceso de penalización

---