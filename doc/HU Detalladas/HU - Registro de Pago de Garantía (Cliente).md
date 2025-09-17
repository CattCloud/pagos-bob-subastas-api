# HU - Registro de Pago de Garantía (Cliente)

- Punto de partida: Pagina de Registro de Pago de Garantía
- El Registro de Pago de Garantía sigue un flujo paso a paso
- El formulario debe ser responsive

## **HU-PAG-01 — Validación de Datos del Cliente (Paso 1)**

### **Historia:**

Como cliente identificado, quiero ver y confirmar mis datos personales antes de proceder al registro de pago para asegurar que la transacción se asocie correctamente a mi cuenta.

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Mostrar pantalla de confirmación con datos cargados de sesión:
    - Nombre completo (`first_name + last_name`)
    - Tipo y número de documento
    - Teléfono de contacto
    - Saldo disponible actual (calculado desde Movement: Total - Retenido - Aplicado)
- **CA-02:** Datos deben mostrarse en modo solo lectura
- **CA-03:** Incluir botón "Confirmar y Continuar" para avanzar al paso 2
- **CA-04:** Incluir enlace "¿Los datos son incorrectos?" que muestre información de contacto para editar

### **Validaciones de Negocio:**

- **CA-05:** Verificar que el usuario tiene sesión válida
- **CA-06:** Recalcular saldo disponible en tiempo real al cargar la pantalla
- **CA-07:** Verificar que el cliente tiene al menos una subasta ganada pendiente de pago

### **UI/UX:**

- **CA-08:** Header con indicador de pasos: "Paso 1 de 4: Confirmar Datos"
- **CA-09:** Diseño tipo tarjeta con datos organizados visualmente:
    - Sección "Datos Personales"
    - Sección "Estado de Cuenta" (saldo disponible)
- **CA-10:** Botón principal destacado: "Confirmar y Continuar"
- **CA-11:** Mostrar número de teléfono parcialmente oculto: "+51 9XX-XXX-789"

### **Estados y Flujo:**

- **CA-12:** Si no hay subastas pendientes: mostrar mensaje:
    
    > "No tiene pagos de garantía pendientes por realizar."
    > 
- **CA-13:** Si sesión expiró: redirigir a identificación
- **CA-14:** Éxito: avanzar al Paso 2 (Selección de Subasta)

---

## **HU-PAG-02 — Selección de Subasta Ganada (Paso 2)**

### **Historia:**

Como cliente, quiero seleccionar la subasta específica por la cual realizaré el pago de garantía, para proceder con la transferencia correspondiente.

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Mostrar lista de subastas donde el cliente fue asignado como ganador:
    - Solo subastas con `Offer` donde `user_id = cliente` y `estado = activa`
    - Solo subastas con `Auction.estado = pendiente`
- **CA-02:** Para cada subasta mostrar:
    - Información del vehículo (`marca + modelo + año + placa`)
    - Monto de la oferta ganadora
    - Monto de garantía calculado (8%)
    - Fecha límite de pago (si existe)
    - Estado visual del tiempo restante
- **CA-03:** Permitir seleccionar solo UNA subasta por transacción
- **CA-04:** Botones "Volver" y "Continuar" (deshabilitado hasta seleccionar)

### **Validaciones de Negocio:**

- **CA-05:** Solo mostrar subastas donde no existe `Movement` tipo `pago_garantia` con `estado = validado` para esa subasta
- **CA-06:** Verificar que la subasta sigue en estado válido para recibir pagos
- **CA-07:** Recalcular monto de garantía en tiempo real (oferta * 0.08)

### **UI/UX:**

- **CA-08:** Header: "Paso 2 de 4: Seleccionar Subasta"
- **CA-09:** Cada subasta como tarjeta seleccionable con radio button
- **CA-10:** Destacar visualmente el monto de garantía a pagar
- **CA-11:** Badge de urgencia si quedan menos de 6 horas para límite
- **CA-12:** Si no hay subastas disponibles:
    
    > "No tiene subastas pendientes de pago de garantía."
    > 

### **Estados y Flujo:**

- **CA-13:** Seleccionar subasta debe actualizar preview del monto en botón "Continuar"
- **CA-14:** Volver: regresar al Paso 1 sin perder selección
- **CA-15:** Continuar: pasar al Paso 3 con subasta seleccionada

---

## **HU-PAG-03 — Registro de Datos de Pago (Paso 3)**

### **Historia:**

Como cliente, quiero registrar los detalles de mi depósito o transferencia bancaria para que el administrador pueda validar mi pago de garantía.

---

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Mostrar resumen de subasta seleccionada (solo lectura):
    - Vehículo y placa
    - Monto de oferta
    - Monto de garantía a pagar
- **CA-02:** Mostrar **información bancaria de BOB** para realizar el pago:
    - Número de cuenta destino
    - Nombre del beneficiario
    - Banco
    - Código interbancario
    - Instrucciones de pago (ej. “Usar número de subasta como referencia”)
- **CA-03:** Formulario con campos obligatorios:
    - `monto` (decimal) *obligatorio* 
    - `moneda` (select): USD por defecto *obligatorio* (Solo USD por ahora)
    - `tipo_pago` (radio o select): **Depósito** | **Transferencia Bancaria** *obligatorio*
    - `numero_cuenta_origen` (texto) *obligatorio*
    - `numero_operacion` (texto) - Número de referencia de la operación bancaria *obligatorio*
    - `fecha_pago` (date) *obligatorio*
    - `voucher_url` (file upload) *obligatorio*
    - `concepto` (texto opcional) - Descripción del pago
- **CA-04:** NOTA: Los datos de facturación se solicitarán cuando se aplique el saldo (no durante el registro del pago)

---

### **Validaciones de Negocio:**

- **CA-05:** `monto` debe coincidir exactamente con el 8% de la oferta ganadora (máximo 2 decimales)
- **CA-06:** `monto` debe ser mayor a 0 y menor a $999,999.99
- **CA-07:** `numero_cuenta_origen` debe tener formato válido (10-20 dígitos)
- **CA-08:** `numero_operacion` debe ser alfanumérico, entre 3-100 caracteres
- **CA-09:** `fecha_pago` no puede ser futura ni anterior a fecha inicio de subasta
- **CA-10:** Archivo de comprobante:
    - Formatos: PDF, JPG, PNG
    - Tamaño máximo: 5MB
    - Nombre debe ser descriptivo
- **CA-11:** `concepto` máximo 500 caracteres
- **CA-12:** No permitir duplicar `numero_operacion` para el mismo cliente

---

### **UI/UX:**

- **CA-10:** Header: "Paso 3 de 4: Datos del Pago"
- **CA-11:** Sección destacada con información bancaria (en la parte superior)
- **CA-12:** Campo de `tipo_pago` visible y claro (radio button / select)
- **CA-13:** Upload de comprobante con drag & drop
- **CA-14:** Preview del monto exacto a transferir destacado visualmente
- **CA-15:** Campo `monto` debe mostrar el monto exacto requerido como referencia: "Debe ingresar exactamente $XXX.XX (8% de su oferta)"
- **CA-16:** Campo `numero_operacion` con tooltip: "Número de referencia bancaria de su transferencia/depósito"

---

### **Estados y Flujo:**

- **CA-16:** Validación en tiempo real de campos críticos
- **CA-17:** Mostrar preview del archivo subido
- **CA-18:** Botón "Continuar" solo habilitado con formulario válido
- **CA-19:** Volver: mantener datos ingresados si no hay errores

---

## **HU-PAG-04 — Confirmación y Envío (Paso 4)**

### **Historia:**

Como cliente, quiero revisar toda la información antes de confirmar el registro para asegurarme de que los datos son correctos y completar el proceso.

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Mostrar resumen completo para confirmación:
    - **Datos del Cliente**: nombre, documento
    - **Subasta**: vehículo, placa, monto oferta
    - **Pago**: monto ingresado, monto garantía esperado (8%), cuenta origen, número operación, fecha, comprobante, moneda
- **CA-02:** Al confirmar, crear registro en `Movement`:
    - `user_id` = cliente actual
    - `tipo_movimiento_general` = 'entrada'
    - `tipo_movimiento_especifico` = 'pago_garantia'
    - `monto` = monto ingresado por el cliente
    - `moneda` = moneda seleccionada
    - `tipo_pago` = tipo seleccionado
    - `numero_cuenta_origen` = cuenta ingresada
    - `numero_operacion` = número ingresado
    - `voucher_url` = archivo subido
    - `concepto` = concepto ingresado
    - `estado` = 'pendiente'
    - `fecha_pago` = fecha ingresada
    - `created_at` = now()
- **CA-03:** Crear registros en `Movement_References`:
    - Referencia a `Auction`: `reference_type = 'auction'`, `reference_id = auction_id`
    - Referencia a `Offer`: `reference_type = 'offer'`, `reference_id = offer_id`
- **CA-04:** Actualizar estado de la subasta: `Auction.estado = 'en_validacion'`
- **CA-05:** Actualizar cache automático en `User`:
    - Backend ejecuta función para recalcular `saldo_total` y `saldo_retenido` INMEDIATAMENTE
- **CA-06:** Crear notificación automática:
    - **Para cliente**: tipo `pago_registrado` en UI
    - **Para admin**: tipo `pago_registrado` en UI + correo automático vía EmailJS

### **Validaciones de Negocio:**

- **CA-07:** Validación final: verificar que `monto` ingresado coincida exactamente con el 8% de la oferta
- **CA-08:** Verificar que subasta sigue disponible para pago
- **CA-09:** Verificar que no se duplicó el `numero_operacion` para este cliente
- **CA-10:** Confirmar que archivo de comprobante se guardó correctamente en Cloudinary
- **CA-11:** Validar integridad de todos los datos antes de crear registros
- **CA-12:** Verificar que no existe Movement pendiente para la misma subasta del cliente

### **UI/UX:**

- **CA-09:** Header: "Paso 4 de 4: Confirmación"
- **CA-10:** Resumen organizado en secciones colapsables
- **CA-11:** Checkbox obligatorio: "Confirmo que los datos son correctos"
- **CA-12:** Botón "Confirmar Pago" destacado, deshabilitado hasta marcar checkbox
- **CA-13:** Advertencia visible:
    
    > "Una vez confirmado, el registro será enviado para validación. No podrá modificar los datos."
    > 

### **Estados y Flujo:**

- **CA-14:** Proceso de guardado con loading state
- **CA-15:** Éxito: redirigir a pantalla de confirmación exitosa
- **CA-16:** Error: mostrar mensaje específico y permitir reintento
- **CA-17:** Botón "Volver" permite regresar al paso anterior

---

## **HU-PAG-05 — Confirmación Exitosa y Seguimiento**

### **Historia:**

Como cliente, quiero recibir confirmación de que mi pago fue registrado correctamente y conocer los próximos pasos para hacer seguimiento del proceso.

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Mostrar pantalla de confirmación con:
    - Número de referencia del pago registrado
    - Resumen del pago registrado
    - Información sobre el proceso de validación
    - Tiempo estimado de validación (2 horas)
- **CA-02:** Incluir opciones de navegación:
    - "Consultar Estado del Pago"
    - "Ver Historial de Pagos de Garantia"
- **CA-03:** Mostrar información de contacto para consultas

### **Validaciones de Negocio:**

- **CA-04:** Verificar que el registro `Movement` se creó correctamente
- **CA-05:** Confirmar que las referencias `Movement_References` se crearon
- **CA-06:** Validar que el cache de saldo se actualizó automáticamente
- **CA-07:** Confirmar que notificaciones se enviaron (UI + correo para admin)

### **UI/UX:**

- **CA-07:** Diseño de éxito con checkmark verde prominente
- **CA-08:** Mensaje principal claro:
    
    > "¡Pago registrado exitosamente!"
    > 
- **CA-09:** Número de referencia destacado y copiable
- **CA-10:** Timeline visual del proceso:
    - ✅ Pago registrado
    - ⏳ En validación (2 horas aprox.)
    - ⭕ Pendiente: Confirmación final
- **CA-11:** CTA secundarios organizados visualmente

### **Estados y Flujo:**

- **CA-12:** Desde esta pantalla, el cliente puede navegar a cualquier módulo
- **CA-13:** El sistema debe mantener la sesión activa
- **CA-14:** Opción de imprimir o descargar comprobante de registro

---

## **HU-PAG-06 — Seguimiento de Pago de Garantía**

### Historia:

Como cliente, quiero **ver el estado de mi pago de garantía en tiempo real** para saber si fue confirmado.

---

### Criterios de Aceptación

- **CA-01:** Debe mostrar de forma clara:
    - Número de referencia de pago.
    - Monto pagado.
    - Fecha y hora de registro.
    - Estado actual del pago:
        - ⏳ *Pendiente de Validación*
        - ✅ *Confirmado*
        - ❌ *Rechazado (con motivo)*
- **CA-02:** Debe incluir **timeline visual** o badges de progreso:
    1. Registro de Pago
    2. Validación en curso
    3. Aprobado/Rechazado
    4. Garantía Activada
- **CA-03:** Debe permitir **descargar nuevamente el comprobante** de pago.
- **CA-04:** Si el pago está *pendiente*, debe mostrar un mensaje de tranquilidad:
    
    > "Estamos revisando tu pago, normalmente toma menos de 24h."
    > 
- **CA-05:** Si el pago está *rechazado*, debe mostrar motivo y CTA:
    
    > "Tu pago fue rechazado: [motivo].
    > 
    > 
    > Volver a registrar pago"
    > 
- **CA-06:** Acceso:
    - Directo desde confirmación de pago (botón "Ver Estado").
    - Desde menú principal → "Mis Garantías" → seleccionar pago.
    - URL única `/mis-pagos/seguimiento/{id_pago}` para compartir o guardar.

---

### Flujo de Navegación

1. **Cliente registra pago** → es redirigido a HU-PAG-05 (Confirmación).
2. En HU-PAG-05, presiona **"Ver Estado"** → abre HU-PAG-06.
3. También puede llegar desde menú "Mis Garantías" → ver listado → seleccionar pago.

---

### Experiencia de Usuario (UX)

- UI simple, similar a tracking de envíos:
    - Barra de progreso o pasos (Stepper).
    - Colores claros para cada estado (amarillo = pendiente, verde = confirmado, rojo = rechazado).
    - Íconos (check, reloj, alerta).
- Reforzar **transparencia y confianza**: el usuario siente que su dinero está seguro y que puede verificar en cualquier momento.

---

## **HU-PAG-07 — Historial de Pagos de Garantía (Listado)**

### **Historia**

Como cliente, quiero ver un listado de todos mis pagos de garantía realizados para tener un control de mis transacciones y acceder rápidamente al detalle de cada una.

---

### **Criterios de Aceptación**

- **CA-01:** Mostrar en tabla (desktop) o tarjetas (mobile) con las siguientes columnas/campos:
    - **Subasta** ( `marca + modelo + año`)
    - **Monto Pagado**
    - **Fecha de Registro**
    - **Tipo de pago**
    - **Estado** (Pendiente, Confirmado, Rechazado)
- **CA-02:** Orden por defecto: fecha de registro **descendente** (últimos pagos primero).
- **CA-03:** Al hacer clic en una fila (o tarjeta en mobile), redirigir a **HU-PAG-06 Seguimiento de Pago** con `id` del movimiento correspondiente.
- **CA-04:** Debe ser responsive:
    - **Desktop:** tabla con columnas alineadas.
    - **Mobile:** tarjetas apiladas, cada tarjeta mostrando:
        - Estado como badge de color (amarillo/verde/rojo)
        - Datos principales de forma legible (placa, monto, fecha).
- **CA-05:** Si no hay pagos registrados:
    
    > Mostrar mensaje: "No tienes pagos de garantía registrados."
    > 

---

### **UI/UX**

- Botón de acceso en el menú: **"Mis Garantías"**.
- Filtro opcional (dropdown): **"Todos | Pendientes | Confirmados | Rechazados"**.
- Estado representado visualmente con color:
    - Amarillo: Pendiente
    - Verde: Confirmado
    - Rojo: Rechazado
- Icono en cada fila para dejar claro que es **clickeable**.

---

### **Flujo**

1. Cliente ingresa a "Mis Garantías".
2. Se listan los pagos en tabla o tarjetas.
3. Selecciona uno → se abre HU-PAG-07 (Seguimiento del Pago).

---

## **REGLAS DEL MÓDULO**

### **Navegación y Progreso:**

- Indicador visual de progreso en todos los pasos (1/4, 2/4, etc.)
- Botón "Volver" funcional en todos los pasos excepto confirmación final
- Breadcrumbs o stepper component para orientación del usuario
- Auto-guardado de progreso para recuperación en caso de interrupción

#