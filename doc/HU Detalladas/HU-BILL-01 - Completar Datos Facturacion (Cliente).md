# HU-BILL-01 — Completar Datos de Facturación (Cliente/Admin)

## **Historia:**

Como **cliente** (o **admin**), quiero completar los datos de facturación faltantes en un Billing ya creado automáticamente cuando BOB ganó la competencia, para finalizar el proceso de facturación y que mi saldo de garantía quede correctamente aplicado.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso múltiple:**
    - **Cliente:** Desde notificación `competencia_ganada` → enlace a "Completar Facturación"
    - **Cliente:** Desde "Mis Facturaciones" → botón "Completar Datos de Facturación" (si faltan datos)
    - **Admin:** Desde "Gestión de Facturaciones" → botón "Completar Datos de Facturación" (si faltan datos)
    - Badge de alerta hasta completar datos
- **CA-02:** **Mostrar información del Billing existente:**
    - **Estado actual:** "Datos de facturación pendientes"
    - Datos del vehículo (marca, modelo, año, placa)
    - Monto ya aplicado (saldo_retenido ya liberado)
    - Fecha de creación del Billing
    - Concepto ya generado automáticamente
- **CA-03:** **Formulario con campos faltantes:**
    - `billing_document_type` (radio): **RUC** | **DNI** *obligatorio*
    - `billing_document_number` (texto) *obligatorio*
    - `billing_name` (texto) - Nombre completo o Razón Social *obligatorio*
    - **Campos automáticos ya definidos:** monto, concepto, moneda (mostrar como solo lectura)
- **CA-04:** **Al confirmar datos:**
    - **Actualizar registro Billing existente** con:
        - `billing_document_type`, `billing_document_number`, `billing_name` = datos ingresados
        - `updated_at` = now()
    - **NO crear nuevo Billing** (ya existe desde HU-COMP-02)
    - **NO recalcular saldo_retenido** (ya fue liberado en HU-COMP-02)
    - Crear notificación de confirmación para cliente y admin

---

### **Validaciones de Negocio:**

- **VN-01:** Solo permitir acceso si existe Billing para la subasta/usuario con datos de facturación pendientes (billing_document_type = NULL)
- **VN-02:** **Para cliente:** Verificar que es el dueño del Billing
- **VN-03:** **Para admin:** Puede completar datos de cualquier Billing pendiente
- **VN-04:** `billing_document_number` debe cumplir formato según tipo:
    - **DNI:** 8 dígitos exactos
    - **RUC:** 11 dígitos exactos
- **VN-05:** `billing_name` debe tener entre 3-200 caracteres
- **VN-06:** No permitir duplicar `billing_document_number` para el mismo usuario
- **VN-07:** Verificar que el Billing existe y tiene datos pendientes antes de actualizar

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

**Después de procesar resultado "BOB ganó" (HU-COMP-02):**
```
Estado: ganada
Billing: Creado con datos parciales
Saldo Retenido: $0 (dinero ya liberado)
Saldo Aplicado: $960 (aplicado vía Billing)
Saldo Disponible: Total - $0 - $960
```

**Después de completar datos de facturación (HU-BILL-01):**
```
Estado: ganada (sin cambio)
Billing: Completado con todos los datos
Saldo Retenido: $0 (sin cambio)
Saldo Aplicado: $960 (sin cambio)
Saldo Disponible: Total - $0 - $960 (sin cambio)
```

**Nota:** Los saldos no cambian en esta HU, solo se completan los datos de facturación del Billing ya creado.

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Seguridad:**
- **Cliente:** Solo puede completar sus propios Billings pendientes
- **Admin:** Puede completar datos de cualquier Billing pendiente
- Datos de facturación no se pueden modificar una vez completados
- Validación de sesión activa

### **Performance:**
- Carga de datos de Billing existente optimizada
- No requiere cálculos de saldo (ya procesados en HU-COMP-02)
- Actualización directa del registro Billing

### **Experiencia:**
- Proceso simplificado (solo completar datos faltantes)
- Información clara de que el saldo ya fue aplicado
- Confirmación visual de datos completados exitosamente

### **Acceso Dual:**
- **Ruta Cliente:** `/users/:userId/billings` → "Completar Datos de Facturación"
- **Ruta Admin:** `/billing` → "Completar Datos de Facturación" (en Billings pendientes)

---