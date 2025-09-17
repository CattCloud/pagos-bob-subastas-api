# HU-BILL-01 — Completar Datos de Facturación (Cliente)

## **Historia:**

Como **cliente**, quiero completar mis datos de facturación cuando BOB gana la competencia externa, para que se genere el registro Billing correspondiente y se aplique mi saldo de garantía al pago del vehículo.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde notificación:**
    - Aparece opción "Completar Facturación" en menú cliente cuando recibe notificación `competencia_ganada`
    - Badge de alerta hasta completar datos
    - Link directo desde correo electrónico recibido
- **CA-02:** **Mostrar información de subasta ganada:**
    - Datos del vehículo (marca, modelo, año, placa)
    - Monto de garantía pagado que será aplicado
    - Mensaje de felicitación: "¡BOB ganó la competencia por su vehículo!"
- **CA-03:** **Formulario con campos obligatorios:**
    - `billing_document_type` (radio): **RUC** | **DNI** *obligatorio*
    - `billing_document_number` (texto) *obligatorio*
    - `billing_name` (texto) - Nombre completo o Razón Social *obligatorio*
    - **Campo automático:** `concepto` se genera automáticamente: "Compra vehículo [marca] [modelo] [año] - Subasta #[id]"
- **CA-04:** **Al confirmar datos:**
    - Crear registro en `Billing`:
        - `user_id` = cliente actual
        - `billing_document_type`, `billing_document_number`, `billing_name` = datos ingresados
        - `monto` = monto de garantía de la subasta
        - `moneda` = 'USD'
        - `concepto` = generado automáticamente
        - `auction_id` = subasta relacionada
        - `created_at` = now()
    - Actualizar `Auction.estado = facturada`
    - Backend ejecuta función para recalcular `User.saldo_retenido` INMEDIATAMENTE (pasa a 0)
    - Crear notificación de confirmación para cliente y admin

---

### **Validaciones de Negocio:**

- **VN-01:** Solo permitir acceso si subasta está en estado `ganada`
- **VN-02:** Verificar que el cliente es el ganador de la subasta (`id_offerWin`)
- **VN-03:** `billing_document_number` debe cumplir formato según tipo:
    - **DNI:** 8 dígitos exactos
    - **RUC:** 11 dígitos exactos
- **VN-04:** `billing_name` debe tener entre 3-200 caracteres
- **VN-05:** No permitir duplicar `billing_document_number` para el mismo cliente
- **VN-06:** Verificar que no existe Billing previo para esta subasta

---

### **UI/UX:**

- **UX-01:** **Header celebratorio:**
    > "¡Felicitaciones! BOB ganó la competencia"
- **UX-02:** **Sección informativa:**
    - Vehículo ganado con imagen destacada
    - Monto de garantía a aplicar claramente visible
    - Explicación: "Su garantía será aplicada al pago del vehículo"
- **UX-03:** **Formulario simple y claro:**
    - Radio buttons para tipo de documento
    - Placeholders específicos según tipo seleccionado
    - Preview del concepto generado automáticamente
- **UX-04:** **Validación en tiempo real:**
    - Formato de documento según tipo seleccionado
    - Caracteres permitidos en nombre/razón social
    - Botón "Confirmar Facturación" habilitado solo con datos válidos
- **UX-05:** **Confirmación antes de enviar:**
    > "¿Confirma que los datos de facturación son correctos? Una vez enviados no podrán modificarse."

---

### **Estados y Flujo:**

- **EF-01:** **Punto de entrada:** Notificación `competencia_ganada` → enlace a formulario
- **EF-02:** **Validación exitosa:** Mostrar preview de factura antes de confirmar
- **EF-03:** **Confirmación exitosa:**
    - Redirigir a pantalla de éxito
    - Mostrar resumen de aplicación de saldo
    - Opción de descargar comprobante de facturación
- **EF-04:** **Error:** Mostrar mensaje específico y permitir reintento

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente (confirmación):**
    - **Tipo:** `facturacion_completada`
    - **Mensaje:** "Sus datos de facturación han sido registrados exitosamente. Su saldo ha sido aplicado al pago del vehículo."
    
- **NOT-02:** **Para el admin (información):**
    - **Tipo:** `billing_generado`
    - **Mensaje:** "Se generó Billing para cliente [nombre] - Subasta #[id]. Saldo aplicado: $[monto]"



---

### **Cálculo de Saldos Actualizado:**

**Antes de completar facturación:**
```
Estado: ganada
Saldo Retenido: $960 (dinero congelado)
Saldo Aplicado: $0
Saldo Disponible: Total - $960 - $0
```

**Después de completar facturación:**
```
Estado: facturada  
Saldo Retenido: $0 (dinero ya no congelado)
Saldo Aplicado: $960 (aplicado vía Billing)
Saldo Disponible: Total - $0 - $960 (mismo resultado, diferente distribución)
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Seguridad:**
- Solo el cliente ganador puede acceder al formulario
- Datos de facturación no se pueden modificar una vez confirmados
- Validación de sesión activa del cliente

### **Performance:**
- Carga de datos de subasta optimizada
- Generación de concepto automática
- Actualización de cache de saldo en tiempo real

### **Experiencia:**
- Proceso guiado paso a paso
- Información clara del impacto en saldos
- Confirmación visual del éxito

---