# HU-REEM-03 — Procesar Reembolso (Admin)

## **Historia:**

Como **administrador**, quiero procesar las solicitudes de reembolso que ya fueron confirmadas telefónicamente, registrando los datos bancarios correspondientes y creando el Movement apropiado según el tipo de reembolso (mantener_saldo o devolver_dinero).

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde HU-REEM-02** → botón "Procesar Reembolso" para solicitudes con estado `confirmado`
- **CA-02:** **Mostrar información de la solicitud:**
    - Datos del cliente y contacto
    - Monto confirmado para reembolso
    - Tipo de reembolso confirmado telefónicamente
    - Motivo original del cliente
    - Saldo actual del cliente (verificación)
- **CA-03:** **Formulario según tipo de reembolso:**
    
    **Si tipo = `mantener_saldo`:**
    - Solo campos informativos (no requiere datos bancarios)
    - Confirmación: "El monto se mantendrá como saldo disponible"
    
    **Si tipo = `devolver_dinero`:**
    - `tipo_transferencia` (select): Transferencia / Depósito *obligatorio*
    - `numero_operacion_reembolso` (texto) - Número de la transferencia realizada *obligatorio*
    - `voucher_url` (file upload) - Comprobante del reembolso realizado *obligatorio*
- **CA-04:** **Al confirmar procesamiento:**
    - Actualizar `Refund.estado = procesado`
    - Registrar `Refund.fecha_procesamiento = now()`
    - **Crear Movement según tipo:**
        
        **Si `mantener_saldo`:**
        - `tipo_movimiento_general` = 'entrada'
        - `tipo_movimiento_especifico` = 'reembolso'
        - `monto` = monto_solicitado
        - `concepto` = "Reembolso mantenido como saldo - [motivo_original]"
        - `estado` = 'validado'
        - `numero_cuenta_origen` = cuenta BOB (ya que no hay transferencia real)
        
        **Si `devolver_dinero`:**
        - `tipo_movimiento_general` = 'salida'
        - `tipo_movimiento_especifico` = 'reembolso'
        - `monto` = monto_solicitado
        - `concepto` = "Reembolso transferido - [motivo_original]"
        - `estado` = 'validado'
        - `numero_cuenta_origen` = cuenta BOB
        - `numero_operacion` = numero_operacion_reembolso
        - `voucher_url` = archivo comprobante subido
    - Crear registros en Movement_References:
        - reference_type = 'auction', reference_id = auction_id del Refund
        - reference_type = 'refund', reference_id = refund_id
    - Backend ejecuta función para recalcular saldos INMEDIATAMENTE
    - Crear notificación `reembolso_procesado` para cliente

---

### **Validaciones de Negocio:**

- **VN-01:** Solo procesar solicitudes con estado `confirmado`
- **VN-02:** Verificar que cliente sigue teniendo saldo disponible ≥ monto solicitado
- **VN-03:** Para `devolver_dinero`:
    - `numero_cuenta_destino` formato válido (10-20 dígitos)
    - `numero_operacion` debe ser único y alfanumérico (3-100 caracteres)
    - `banco_destino` entre 3-50 caracteres
    - `voucher_url` archivo obligatorio (PDF, JPG, PNG, máximo 5MB)
- **VN-04:** No permitir procesar dos veces la misma solicitud
- **VN-05:** Validar que no existen otras solicitudes pendientes del mismo cliente

---

### **UI/UX:**

- **UX-01:** **Sección informativa destacada:**
    - Resumen de la solicitud confirmada
    - Saldo actual vs monto solicitado
    - Advertencia si hay diferencias
- **UX-02:** **Formulario dinámico:**
    - Campos bancarios solo aparecen si tipo = `devolver_dinero`
    - Preview del Movement que se creará
    - Calculadora del impacto en saldo del cliente
- **UX-03:** **Confirmación robusta:**
    > "¿Confirma el procesamiento del reembolso? Esta acción es irreversible y actualizará inmediatamente el saldo del cliente."
- **UX-04:** **Estados visuales:**
    - Loading durante procesamiento
    - Toast de éxito con resumen
    - Error específico si falla

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `confirmado` (cliente confirmó telefónicamente)
- **EF-02:** **Estado actual:** `procesado` (Movement creado, saldo actualizado)
- **EF-03:** **Éxito:** Regresar a lista actualizada con estado `procesado`
- **EF-04:** **Error:** Mostrar mensaje específico sin cambiar estado de Refund

---

### **Impacto en Saldos según Tipo:**

### **Tipo `mantener_saldo` (Movement ENTRADA):**
```
Ejemplo: Cliente solicita $500 mantener_saldo

Antes del procesamiento:
- Saldo Total: $2000
- Saldo Disponible: $1500
- Saldo "reembolsable": $500

Después del procesamiento:
- Saldo Total: $2000 (sin cambio)
- Saldo Disponible: $1500 (sin cambio real)
- Movement: +$500 ENTRADA (mantiene saldo en sistema)
```

### **Tipo `devolver_dinero` (Movement SALIDA):**
```
Ejemplo: Cliente solicita $500 devolver_dinero

Antes del procesamiento:
- Saldo Total: $2000
- Saldo Disponible: $1500

Después del procesamiento:
- Saldo Total: $1500 ($2000 - $500)
- Saldo Disponible: $1000 ($1500 - $500)
- Movement: -$500 SALIDA (dinero sale del sistema)
```

---

### **Campos de Base de Datos Actualizados:**

```sql
-- Actualizar solicitud de reembolso
UPDATE Refund SET 
    estado = 'procesado',
    fecha_procesamiento = NOW()
WHERE id = [refund_id]

-- Crear Movement según tipo
-- Si mantener_saldo:
INSERT INTO Movement (
    user_id, tipo_movimiento_general, tipo_movimiento_especifico,
    monto, concepto, estado, numero_cuenta_origen, fecha_resolucion
) VALUES (
    [client_user_id], 'entrada', 'reembolso',
    [monto_solicitado], 'Reembolso mantenido como saldo - [motivo]',
    'validado', [cuenta_bob], NOW()
)

-- Crear referencias del Movement de reembolso
INSERT INTO Movement_References (movement_id, reference_type, reference_id) VALUES 
([movement_id], 'auction', [refund.auction_id]),
([movement_id], 'refund', [refund_id])

-- Si devolver_dinero:
INSERT INTO Movement (
    user_id, tipo_movimiento_general, tipo_movimiento_especifico,
    monto, concepto, estado, numero_cuenta_origen, numero_operacion, fecha_resolucion
) VALUES (
    [client_user_id], 'salida', 'reembolso',
    [monto_solicitado], 'Reembolso transferido - [motivo]',
    'validado', [cuenta_bob], [numero_operacion_reembolso], NOW()
)


```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Integridad Financiera:**
- Verificación de saldo disponible en tiempo real
- Creación de Movement apropiado según tipo
- Actualización inmediata de cache de saldos

### **Auditoría Completa:**
- Registro de datos bancarios utilizados
- Trazabilidad de operaciones realizadas
- Historial de cambios de estado

### **Gestión de Errores:**
- Validación antes de crear Movement
- Rollback si falla actualización de saldos
- Notificación de errores al admin

---