# HU-REEM-01 — Solicitar Reembolso (Cliente)

## **Historia:**

Como **cliente**, quiero solicitar reembolso de mi saldo cuando BOB pierde la competencia externa o cuando tengo saldo disponible que no deseo mantener en el sistema, especificando si quiero mantenerlo como saldo o recibirlo como dinero físico.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú cliente:** "Solicitar Reembolso"
- **CA-02:** **Mostrar información de saldo actual:**
    - Saldo total disponible para reembolso
    - Desglose de cómo se calculó (Total - Retenido - Aplicado)
    - Advertencia si hay saldo retenido no disponible
- **CA-03:** **Formulario con campos obligatorios:**
    - `monto_solicitado` (decimal) - Debe ser ≤ saldo disponible *obligatorio*
    - `tipo_reembolso` (radio buttons): *obligatorio*
        - 🏦 **"Mantener como Saldo"** - No requiere transferencia física, se mantiene en sistema
        - 💸 **"Devolver Dinero"** - Transferencia/depósito físico a cuenta del cliente
    - `motivo` (textarea) - Razón de la solicitud *obligatorio*
    - `subasta asociada` (select obligatorio) - Subasta asociada, mostrar subastas del cliente con estado `perdida` o `penalizada`
- **CA-04:** **Al confirmar solicitud:**
    - Crear registro en `Refund`:
        - `user_id` = cliente actual
        - `monto_solicitado` = monto ingresado
        - `tipo_reembolso` = tipo seleccionado
        - `estado` = 'solicitado'
        - `auction_id` = subasta seleccionada
        - `motivo` = motivo ingresado
        - `created_at` = now()
    - Crear notificación automática para admin tipo `reembolso_solicitado`
    - Crear notificación de confirmación para cliente

---

### **Validaciones de Negocio:**

- **VN-01:** `monto_solicitado` debe ser > 0 y ≤ saldo disponible actual
- **VN-02:** No permitir solicitud si cliente tiene reembolsos pendientes (`estado = solicitado` o `confirmado`)
- **VN-03:** `motivo` debe tener entre 10-500 caracteres
- **VN-04:** Verificar que cliente tiene saldo disponible > 0
- **VN-05:** `monto_solicitado` máximo 2 decimales
- **VN-06:** Recalcular saldo disponible en tiempo real antes de mostrar formulario
- **VN-07:** `auction_id` es obligatorio y debe corresponder a una subasta donde el cliente tenga saldo retenido
---

### **UI/UX:**

- **UX-01:** **Sección informativa clara:**
    - Saldo disponible destacado visualmente
    - Calculadora de reembolso en tiempo real
    - Explicación de cada tipo de reembolso
- **UX-02:** **Diferenciación visual de tipos:**
    - **Mantener Saldo:** 
        > "El dinero se mantiene en su cuenta BOB para futuras subastas"
    - **Devolver Dinero:**
        > "Se transferirá el dinero a su cuenta bancaria (proceso 2-3 días hábiles)"
- **UX-03:** **Validación en tiempo real:**
    - Monto no puede exceder saldo disponible
    - Preview del impacto en saldo tras reembolso
    - Botón "Enviar Solicitud" habilitado solo con datos válidos
- **UX-04:** **Confirmación antes de enviar:**
    > "¿Confirma su solicitud de reembolso? La empresa se contactará para confirmar detalles."

---

### **Estados y Flujo:**

- **EF-01:** **Punto de entrada:** Menú cliente o notificación automática cuando BOB pierde
- **EF-02:** **Solicitud enviada:**
    - Redirigir a pantalla de confirmación
    - Mostrar número de referencia
    - Timeline de proceso esperado
- **EF-03:** **Seguimiento posterior:**
    - Cliente puede ver estado en "Mis Solicitudes de Reembolso"
    - Notificaciones automáticas sobre cambios de estado

---

### **Casos de Uso Específicos:**

- **CU-01:** **BOB perdió competencia:**
    - Cliente recibe notificación `competencia_perdida`
    - Formulario pre-llenado con monto de garantía
    - Motivo sugerido: "BOB no ganó la competencia externa"
    
- **CU-02:** **Reembolso voluntario:**
    - Cliente ingresa libremente desde menú
    - Debe especificar monto y motivo personal
    - Sin pre-llenado de datos

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el admin:**
    - **Tipo:** `reembolso_solicitado`
    - **Mensaje:** "Cliente [nombre] solicitó reembolso de $[monto] - Tipo: [tipo]"
    
- **NOT-02:** **Para el cliente (confirmación):**
    - **Tipo:** `solicitud_enviada`
    - **Mensaje:** "Su solicitud de reembolso #[id] fue enviada. Se contactarán para confirmar detalles."

---



---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Validaciones de Saldo:**
- Cálculo de saldo disponible en tiempo real antes de mostrar formulario
- Verificación de saldo suficiente antes de permitir solicitud
- Validación de integridad de datos financieros

### **Tipos de Reembolso:**
- **Mantener Saldo:** Dinero permanece en sistema, aumenta saldo disponible
- **Devolver Dinero:** Dinero sale del sistema, disminuye saldo total

### **Experiencia de Usuario:**
- Proceso simple y guiado
- Información clara del impacto de cada tipo
- Seguimiento completo del estado de solicitud

---