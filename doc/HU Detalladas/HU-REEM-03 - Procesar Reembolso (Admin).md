# HU-REEM-03 — Procesar Reembolso (Admin)

## **Historia:**

Como **administrador**, quiero procesar las solicitudes de reembolso que ya fueron confirmadas telefónicamente, registrando los datos bancarios y comprobantes correspondientes para crear el Movement de salida que retire el dinero del sistema.


---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde HU-REEM-02** → botón "Procesar Reembolso" para solicitudes con estado `confirmado`
- **CA-02:** **Mostrar información de la solicitud:**
    - Datos del cliente y contacto
    - Monto confirmado para transferencia
    - Motivo original del cliente
    - Saldo disponible actual vs monto solicitado (verificación)
    - Fecha de confirmación telefónica
- **CA-03:** **Formulario**
    - `tipo_transferencia` (select): Transferencia / Depósito *obligatorio*
    - `numero_cuenta_destino` (texto) - Cuenta del cliente *obligatorio*
    - `numero_operacion_transferencia` (texto) - Número de la transferencia realizada *obligatorio*
    - `voucher_url` (file upload) - Comprobante de la transferencia realizada *obligatorio*
    - Campo informativo: Fecha de transferencia = today()
    
- **CA-04:** **Al confirmar procesamiento:**
    - Actualizar `Refund.estado = procesado`
    - Registrar `Refund.fecha_procesamiento = now()`
    - **Crear Movement de SALIDA:**
        - `user_id` = cliente de la solicitud
        - `tipo_movimiento_general` = 'salida'
        - `tipo_movimiento_especifico` = 'reembolso'
        - `monto` = monto_solicitado
        - `concepto` = "Reembolso en efectivo por Bob Subastas"
        - `estado` = 'validado'
        - `tipo_pago` = tipo_transferencia seleccionado
        - `numero_cuenta_origen` = cuenta BOB (00219400874425016691) <- Guardar en un archivo de constantes
        - `numero_operacion` = numero_operacion_transferencia
        - `voucher_url` = archivo comprobante subido
        - `fecha_pago` = now()
        - `fecha_resolucion` = now()
        - `refund_id_ref` = refund_id

        - Backend ejecuta función para recalcular saldos INMEDIATAMENTE:
            - `saldo_retenido` disminuye por monto solicitado (liberación de retención)
            - `saldo_total` disminuye por monto solicitado (dinero sale del sistema)
            - `saldo_disponible` se mantiene igual (ya estaba descontado desde la solicitud)    
        - Crear notificación `reembolso_procesado` para cliente

---

### **Validaciones de Negocio:**


- **VN-01:** Solo procesar solicitudes con estado `confirmado`
- **VN-02:** Verificar que cliente sigue teniendo saldo disponible ≥ monto solicitado
- **VN-03:** Validaciones bancarias:
    - `numero_cuenta_destino` formato válido (10-20 dígitos)
    - `numero_operacion_transferencia` debe ser único y alfanumérico (3-100 caracteres)
    - `voucher_url` archivo obligatorio (PDF, JPG, PNG, máximo 5MB)
- **VN-04:** No permitir procesar dos veces la misma solicitud
- **VN-05:** Validar que no existen otras solicitudes pendientes del mismo cliente para el mismo monto
- **VN-06:** Verificar que el monto sigue retenido desde la solicitud original antes de procesar el reembolso
---

### **UI/UX:**

### **UI/UX:**

- **UX-01:** **Sección informativa destacada:**
    - Resumen de la solicitud confirmada
    - Saldo disponible actual vs monto solicitado (alerta si hay diferencias)
    - Información de contacto del cliente para verificación
- **UX-02:** **Formulario bancario:**
    - Campos bancarios organizados visualmente
    - Preview del Movement de salida que se creará
    - Calculadora del impacto: saldo disponible después de transferencia
    - Upload de comprobante con preview
- **UX-03:** **Confirmación robusta:**
    > "¿Confirma el procesamiento de la transferencia? Se descontará $[monto] del saldo del cliente y se marcará como transferido. Esta acción es irreversible."
- **UX-04:** **Estados visuales:**
    - Loading durante procesamiento
    - Toast de éxito con resumen de transferencia
    - Error específico si falla algún paso
---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `confirmado` (cliente confirmó datos telefónicamente)
- **EF-02:** **Estado actual:** `procesado` (Movement de salida creado, dinero transferido)
- **EF-03:** **Éxito:** Regresar a lista actualizada con estado `procesado`
- **EF-04:** **Error:** Mostrar mensaje específico sin cambiar estado de Refund

---

### **Impacto en Saldos según Tipo:**

### **Transferencia en efectivo (Movement SALIDA):**
```
Ejemplo: Cliente solicita $500 (retención automática):
- Antes: Total $2000, Disponible $1500, Retenido $0
- Después: Total $2000, Disponible $1000, Retenido $500

Admin procesa transferencia:
- Después: Total $1500 (dinero sale)
- Disponible $1000 (sin cambio) 
- Retenido $0 (liberado)
```


---
### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente:**
    - **Tipo:** `reembolso_procesado`
    - **Mensaje:** "Su transferencia de $[monto] ha sido procesada exitosamente. Recibirá el dinero en su cuenta [banco_destino] en 2-3 días hábiles."
    
- **NOT-02:** **Para el admin (log):**
    - **Tipo:** `reembolso_procesado`
    - **Mensaje:** "Transferencia procesada - Cliente [nombre]: $[monto] → [banco_destino] - Op: [numero_operacion]"

---

## **DIFERENCIAS CON LA VERSIÓN ANTERIOR**

### **Eliminado:**
- Opción `mantener_saldo` (ya no existe)
- Lógica condicional según tipo de reembolso
- Movement de entrada (solo hay salida)

### **Simplificado:**
- Un solo tipo de Movement: SALIDA (transferencia efectivo)
- Un solo flujo de datos bancarios
- Proceso más directo y claro

### **Mejorado:**
- Campos bancarios más específicos y completos
- Mejor trazabilidad de operaciones bancarias
- Validaciones más robustas para transferencias reales

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Integridad Financiera:**
- Solo crear Movement de SALIDA (dinero sale del sistema)
- Verificación de saldo disponible en tiempo real antes de procesar
- Actualización inmediata de cache de saldos

### **Auditoría Bancaria:**
- Registro completo de datos bancarios utilizados
- Comprobante obligatorio de transferencia realizada
- Trazabilidad completa de la operación bancaria

### **Gestión de Errores:**
- Validación de saldo antes de crear Movement
- Rollback si falla actualización de saldos
- Validación de datos bancarios antes de procesar
- Notificación inmediata de errores al admin

---