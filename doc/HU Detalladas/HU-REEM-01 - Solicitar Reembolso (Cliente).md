# HU-REEM-01 — Solicitar Reembolso en Efectivo (Cliente)

## **Historia:**

Como **cliente**, quiero solicitar que me transfieran en efectivo parte o todo mi saldo disponible cuando no deseo mantenerlo en el sistema para futuras subastas.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú cliente:** "Solicitar Transferencia en Efectivo"
- **CA-02:** **Mostrar información de saldo actual:**
    - Saldo disponible para transferir (calculado como: Total - Retenido - Aplicado)
    - Explicación: "Este dinero ya está liberado en su cuenta BOB y puede ser transferido"
    - Advertencia si hay saldo retenido no disponible
- **CA-03:** **Formulario simplificado con campos obligatorios:**
    - `monto_solicitado` (decimal) - Debe ser ≤ saldo disponible *obligatorio*
    - `motivo` (textarea) - Razón del reembolso *obligatorio*
    - `auction_id` (select) - Subasta relacionada de donde proviene el saldo (opcional para contexto)
- **CA-04:** **Al confirmar solicitud:**
    - Crear registro en `Refund`:
        - `user_id` = cliente actual
        - `monto_solicitado` = monto ingresado
        - `estado` = 'solicitado'
        - `auction_id` = subasta seleccionada (si aplica)
        - `motivo` = motivo ingresado
        - `created_at` = now()
    - Crear notificación automática para admin tipo `reembolso_solicitado`
    - Crear notificación de confirmación para cliente
    - Backend ejecuta función para recalcular saldos INMEDIATAMENTE:
        - `saldo_retenido` aumenta por monto solicitado (retención preventiva)
        - `saldo_disponible` disminuye por monto solicitado
        - `saldo_total` se mantiene igual
---

### **Validaciones de Negocio:**

- **VN-01:** `monto_solicitado` debe ser > 0 y ≤ saldo disponible actual
- **VN-02:** No permitir solicitud si cliente tiene reembolsos pendientes (`estado = solicitado` o `confirmado`)
- **VN-03:** `motivo` debe tener entre 10-500 caracteres
- **VN-04:** Verificar que cliente tiene saldo disponible > 0
- **VN-05:** `monto_solicitado` máximo 2 decimales
- **VN-06:** Recalcular saldo disponible en tiempo real antes de mostrar formulario
- **VN-07:** `auction_id` es opcional pero si se selecciona debe ser válida
- **VN-08:** Al crear solicitud, el monto se retiene automáticamente para prevenir doble uso del dinero mientras está pendiente de aprobación
---

### **UI/UX:**

- **UX-01:** **Sección informativa clara:**
    - Saldo disponible destacado visualmente
    - Calculadora de transferencia en tiempo real
    - Explicación del proceso: "Se transferirá o depositara a su cuenta bancaria en 2-3 días hábiles"
- **UX-02:** **Información del proceso:**
    - **Paso 1:** "Envía solicitud"
    - **Paso 2:** "Confirmación telefónica (1 día)"
    - **Paso 3:** "Reembolso bancario(2-3 días)"
- **UX-03:** **Validación en tiempo real:**
    - Monto no puede exceder saldo disponible
    - Preview del saldo restante después de reembolso
    - Botón "Solicitar Reembolso" habilitado solo con datos válidos
- **UX-04:** **Confirmación antes de enviar:**
    > "¿Confirma su solicitud de reembolso? BOB se contactará para confirmacion"

---

### **Estados y Flujo:**

- **EF-01:** **Punto de entrada:** Menú cliente "Reembolsos"
- **EF-02:** **Solicitud enviada:**
    - Redirigir a pantalla de Reembolsos
    - Mostrar reembolso solicitado en Historial de Reembolsos
    - Timeline del proceso esperado
- **EF-03:** **Seguimiento posterior:**
    - Cliente puede ver estado en "Reembolsos"
    - Notificaciones automáticas sobre cambios de estado
- **EF-04**: Impacto inmediato en saldos:
    - Cliente NO puede usar el monto solicitado mientras esté pendiente
    - Dinero queda "congelado" hasta resolución de solicitud
    - Previene conflictos si cliente intenta usar mismo dinero en otras subastas
---

### **Casos de Uso Específicos:**

- **CU-01:** **Después de competencia perdida:**
    - Cliente ya tiene saldo disponible (liberado automáticamente)
    - Decide convertirlo en efectivo
    - Motivo típico: "Quiero el dinero en mi cuenta bancaria"
    
- **CU-02:** **Retiro voluntario de saldo acumulado:**
    - Cliente tiene saldo de múltiples operaciones
    - Ya no quiere participar en más subastas
    - Motivo típico: "Retiro de fondos acumulados"

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el admin:**
    - **Tipo:** `reembolso_solicitado`
    - **Mensaje:** "Cliente [nombre] solicitó transferencia de $[monto] a cuenta bancaria"
    
- **NOT-02:** **Para el cliente (confirmación):**
    - **Tipo:** `reembolso_solicitado`
    - **Mensaje:** "Su solicitud de transferencia #[id] fue enviada. Se contactarán para confirmar datos bancarios."

---

## **DIFERENCIAS CON LA VERSIÓN ANTERIOR**

### **Eliminado:**
- Opción `mantener_saldo` (ya no necesaria porque el dinero ya está disponible automáticamente)
- Validación de `saldo_retenido` (ahora solo válida `saldo_disponible`)


### **Simplificado:**
- Un solo tipo de reembolso: transferencia en efectivo
- Proceso más directo y claro
- Menos confusión conceptual

### **Mejorado:**
- Cliente ya tiene el dinero disponible cuando llega aquí
- Proceso más fluido para convertir saldo → efectivo
- Experiencia más intuitiva

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Validaciones de Saldo:**
- Solo permite transferir saldo que ya está disponible (no retenido)
- Verificación en tiempo real de saldo antes de solicitud
- Validación de integridad de datos financieros

### **Proceso Simplificado:**
- Un solo flujo: saldo_disponible → transferencia bancaria
- No más confusión entre "mantener" y "devolver"
- Cliente siempre mantiene control sobre su dinero disponible

### **Experiencia de Usuario:**
- Proceso guiado paso a paso
- Información clara de tiempos de procesamiento
- Seguimiento completo del estado de transferencia

---