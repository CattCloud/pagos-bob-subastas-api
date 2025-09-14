# HU - Validacion de Pago de Garantías(ADMIN)

## **HU-VAL-01 — Historial de Pagos de Garantía**

### **Historia**

Como **administrador**, quiero ver el historial completo de pagos de garantía realizados por los clientes, con prioridad visual para los que están pendientes de validación, para poder revisarlos y procesarlos de forma eficiente.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar **tabla** (o tarjetas en mobile) con columnas:
    - **Cliente** (nombre completo + documento)
    - **Subasta** (marca + modelo + año + placa)
    - **Monto Garantía**
    - **Tipo de Pago** (Depósito / Transferencia)
    - **Fecha de Registro**
    - **Tiempo Transcurrido** (ej. "hace 2h 15min")
    - **Estado** (Pendiente, Validado, Rechazado)
- **CA-02:** Orden por defecto:
    - Primero mostrar **pendientes de validación**, ordenados por fecha ascendente (los más antiguos primero)
    - Luego los demás pagos en orden cronológico descendente (historial)
- **CA-03:** Filtros disponibles:
    - Por estado de garantía (Todos | Pendiente | Validado | Rechazado)
    - Por tipo de pago (Todos | Depósito | Transferencia)
    - Por rango de fechas
    - Por búsqueda de cliente (nombre o documento)
- **CA-04:** Indicadores visuales:
    - Resaltar filas con estado **Pendiente** (por ejemplo con un fondo suave o icono de alerta)
    - Mostrar **tiempo transcurrido desde el registro del pago** en tiempo real (actualizado automáticamente)
- **CA-05:** Al **hacer clic en una fila** de la tabla (o tarjeta en mobile), manda a pagina **Detalle de Pago Pendiente**

---

### **Validaciones de Negocio**

- **VN-01:** Mostrar todos los `Guarantee_Payment`, independientemente de su estado.
- **VN-02:** Resaltar los que tienen `estado = pendiente` para priorizar su atención.
- **VN-03:** Excluir pagos de subastas canceladas o vencidas.
- **VN-04:** Actualizar datos y contadores automáticamente cada 5 min.

---

### **UI/UX**

- **UX-01:** Header con contador:
    
    `"X pagos pendientes de validación" + "Total registros: Y"`
    
- **UX-02:** Resaltar filas pendientes con color de fondo diferenciado:
    - Normal: blanco
    - Urgente: amarillo claro
    - Crítico: rojo claro
- **UX-03:** Tabla **responsiva**:
    - **Desktop:** vista de tabla completa.
    - **Mobile:** cada fila se convierte en tarjeta con info principal (cliente, subasta, monto, estado, fecha)
- **UX-04:** Si no hay registros:
    
    > "No hay pagos de garantía registrados."
    > 

---

### **Estados y Flujo**

- **EF-01:** Click en fila → pagina **Detalle de Pago**.
- **EF-02:** Auto-refresh cada 5 min para mantener información actualizada.
- **EF-03:** Paginación si hay muchos registros.

---

## **HU-VAL-02 — Ver Detalle de Pago (Admin)**

### **Historia**

Como administrador, quiero ver todos los detalles de un pago de garantía específico, incluyendo el comprobante y su estado actual, para tomar una decisión informada si está pendiente, o para consultar su historial si ya fue validado o rechazado.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar información completa organizada en secciones:
    
    **Datos de la Subasta:**
    
    - Información del vehículo (marca, modelo, año, placa)
    - Estado actual de la subasta
    - Monto de la oferta ganadora
    - Monto de garantía calculado (8%)
    
    **Datos del Cliente:**
    
    - Nombre completo
    - Tipo y número de documento
    - Teléfono de contacto
    - Saldo actual del cliente
    
    **Detalles del Pago:**
    
    - Monto registrado por el cliente
    - Tipo de pago (Depósito / Transferencia)
    - Número de cuenta origen
    - Fecha de pago declarada
    - Fecha de registro en el sistema
    - Comentarios del cliente (si los hay)
    - **Estado actual del pago** (Pendiente | Validado | Rechazado)
- **CA-02:** Visualizador de comprobante:
    - Si es imagen: mostrar preview ampliable
    - Si es PDF: mostrar enlace para descargar/abrir
    - Botón para descargar archivo original
- **CA-03:** Validaciones automáticas visibles (solo en estado Pendiente):
    - ✅/❌ Monto coincide con el 8% exacto
    - ✅/❌ Fecha de pago está en rango válido
    - ✅/❌ Número de cuenta tiene formato válido
    - ⚠️ Advertencias si algo requiere atención

### **Diferencias por Estado**

- **Estado: Si es un Pago de Garantía Pendiente**
    - Mostrar **botones de acción**:
        - **"Aprobar Pago"** (verde)
        - **"Rechazar Pago"** (rojo)
    - Mostrar **validaciones automáticas**
    - Mostrar **contador de tiempo transcurrido** desde el registro (opcional para control interno)
- **Estado: Si es un Pago de Garantía Validado**
    - Ocultar botones de acción (pantalla es solo lectura)
    - Mostrar etiqueta **"Pago Validado"** con fecha de validacion
- **Estado: Si es un Pago de Garantía Rechazado**
    - Ocultar botones de acción (pantalla es solo lectura)
    - Mostrar etiqueta **"Pago Rechazado"** con:
        - Motivo de rechazo
        - Fecha de rechazó

---

### **Validaciones de Negocio**

- **VN-01:** Verificar que el pago sigue en estado `pendiente` antes de mostrar botones de acción
- **VN-02:** Calcular y mostrar diferencia si el monto no coincide exactamente
- **VN-03:** Validar que la fecha de pago no sea futura ni muy anterior
- **VN-04:** Verificar integridad del archivo de comprobante

---

### **UI/UX**

- **UX-01:** Layout de dos columnas:
    - Izquierda: información del pago
    - Derecha: comprobante y validaciones automáticas
- **UX-02:** Estado visual claro:
    - Badge **"Pendiente"**, **"Validado"** o **"Rechazado"** destacado
    - Mostrar historial de acciones (quién y cuándo cambió el estado)
- **UX-03:** En mobile: stack vertical con comprobante al final

---

### **Estados y Flujo**

- **EF-01:** Click en "Aprobar" → abrir **HU-VAL-03**
- **EF-02:** Click en "Rechazar" → abrir **HU-VAL-04**
- **EF-03:** Si el pago ya fue procesado por otro admin mientras se visualiza → mostrar mensaje y recargar en modo solo lectura

---

## **HU-VAL-03 — Aprobar Pago de Garantía**

### **Historia**

Como administrador, quiero aprobar un pago de garantía válido para actualizar el saldo del cliente y confirmar su participación en la subasta.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar modal de confirmación con:
    - Resumen del pago a aprobar
    - Impacto en el saldo del cliente
    - Confirmación de datos críticos (monto, cliente, subasta)
- **CA-02:** Al confirmar aprobación:
    - Actualizar `Guarantee_Payment.estado = validado`
    - Registrar `fecha_resolucion = now()`
    - Actualizar saldo del cliente:
        - `User_Balance.saldo_retenido -= monto_garantia`
        - `User_Balance.saldo_aplicado += monto_garantia`
    - Crear `Movement` tipo `garantia_validada`
    - Actualizar estado de la subasta a `finalizada`

### **Validaciones de Negocio**

- **VN-01:** Verificar que el pago sigue `pendiente` (no fue procesado por otro admin)
- **VN-02:** Confirmar que la subasta sigue en estado válido para recibir pagos
- **VN-03:** Validar que el cliente existe y está activo
- **VN-04:** Verificar integridad de los cálculos de saldo

### **UI/UX**

- **UX-01:** Modal con diseño de confirmación:
    - Título: "Aprobar Pago de Garantía"
    - Resumen visual del impacto
    - Campo de comentarios opcional
- **UX-02:** Botón "Confirmar Aprobación" requiere confirmación adicional
- **UX-03:** Loading state durante procesamiento
- **UX-04:** Toast de éxito tras completar

### **Estados y Flujo**

- **EF-01:** Éxito: cerrar modal, actualizar vista, mostrar confirmación
- **EF-02:** Error: mostrar mensaje específico sin cerrar modal
- **EF-03:** Tras aprobar: regresar a lista actualizada

---

## **HU-VAL-04 — Rechazar Pago de Garantía**

### **Historia**

Como administrador, quiero rechazar un pago de garantía inválido especificando el motivo para que el cliente pueda corregir y volver a registrarlo.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar modal con:
    - Lista de motivos predefinidos (checkbox múltiple):
        - "Monto incorrecto"
        - "Comprobante ilegible"
        - "Fecha de pago inválida"
        - "Número de cuenta incorrecto"
        - "Comprobante no corresponde al pago"
        - "Datos de facturación incorrectos"
    - Campo obligatorio para "Otros motivos" (texto libre)
    - Campo opcional para comentarios adicionales
- **CA-02:** Al confirmar rechazo:
    - Actualizar `Guarantee_Payment.estado = rechazado`
    - Registrar `fecha_resolucion = now()`
    - Guardar motivos seleccionados
    - Crear `Movement` tipo `garantia_rechazada`
    - Actualizar estado de la subasta a `pendiente`
    - Revertir saldo del cliente:
        - `User_Balance.saldo_retenido -= monto_garantia`
        - `User_Balance.saldo_total -= monto_garantia`

### **Validaciones de Negocio**

- **VN-01:** Al menos un motivo debe ser seleccionado
- **VN-02:** Si selecciona "Otros", el campo de texto es obligatorio
- **VN-03:** Verificar que el pago sigue `pendiente`
- **VN-04:** No permitir rechazo si la subasta ya venció o fue cancelada

### **UI/UX**

- **UX-01:** Modal con diseño de warning (colores de alerta)
- **UX-02:** Checkboxes con motivos claros y específicos
- **UX-03:** Preview del mensaje que se mostrará al cliente
- **UX-04:** Botón "Confirmar Rechazo" con confirmación adicional
- **UX-05:** Explicación: "El cliente podrá registrar un nuevo pago después del rechazo"

### **Estados y Flujo**

- **EF-01:** Tras rechazar: el cliente debe poder ver el motivo en su seguimiento
- **EF-03:** Se habilita para el cliente registrar un nuevo pago para la misma subasta

---

## **HU-VAL-06 — Marcar Pago de Garantía como Vencido**

### **Historia**

Como administrador, quiero marcar un pago de garantía como vencido para aplicar penalidades y permitir la reasignación de ganadores cuando corresponda.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Acceso desde:
    - **HU-SUB-07** (Detalle de Subasta) → botón **"Marcar como Vencido"** disponible únicamente para subastas con estado `pendiente`.
    - Modal de confirmación que muestra:
        - Información de la subasta y ganador actual.
        - Monto de penalidad que se aplicará.
        - Motivo del vencimiento (campo obligatorio).
- **CA-02:** **Vencimiento Automático** (cron job cada hora):
    - Para subastas con `fecha_limite_pago` definida.
    - Si `fecha_limite_pago < now()` **y** subasta sigue en estado `pendiente`.
    - Cambiar automáticamente `Auction.estado = vencida`.
    - Cambiar `Offer.estado = perdedora`.
    - Generar log de vencimientos automáticos para admin.
- **CA-03:** **Vencimiento Manual**:
    - Disponible independientemente de si hay fecha límite.
- **CA-04:** Al confirmar vencimiento:
    - Cambiar `Auction.estado = vencida`.
    - Cambiar `Offer.estado = perdedora`.
    - Aplicar penalidad: `min(saldo_disponible, monto_garantia * 0.30)`.
    - Actualizar `User_Balance.saldo_penalizado += monto_penalidad`.
    - Crear `Movement` tipo `penalidad`.
    - Registrar motivo del vencimiento.

### **Validaciones de Negocio**

- **VN-01:** Solo aplicar si subasta está en estado `pendiente`.
- **VN-02:** Verificar que existe `id_offerWin` (ganador asignado).
- **VN-03:** Si no tiene saldo disponible, registrar penalidad como \$0 pero mantener el registro del intento.

### **UI/UX**

- **UX-01:** Modal de confirmación con advertencia clara:
    
    > "Esta acción aplicará una penalidad de \$X al cliente \[nombre] y marcará la subasta como vencida. ¿Está seguro?"
    > 
- **UX-03:** Mostrar cálculo de penalidad en tiempo real.
- **UX-04:** Botón de confirmación en rojo con texto **"Marcar como Vencido"**.

### **Estados y Flujo**

- **EF-01:** Tras marcar como vencido, regresar a **HU-SUB-07** con estado actualizado.
- **EF-02:** Mostrar toast de confirmación con link a **"Reasignar Ganador"**.
- **EF-03:** Los vencimientos automáticos generan notificación diaria al admin.

---

## **HU-VAL-07 — Extender Plazo de Pago**

### **Historia**

Como administrador, quiero extender el plazo de pago de una garantía para dar más tiempo al cliente cuando existan circunstancias que lo justifiquen.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Acceso desde **HU-SUB-07** → botón "Extender Plazo de Pago"
- **CA-02:** Modal con:
    - Fecha límite actual (si existe)
    - Nueva fecha límite (datetime picker) *obligatorio*
    - Tiempo de extensión calculados automáticamente
- **CA-03:** Al confirmar:
    - Actualizar `Auction.fecha_limite_pago`
    - Crear registro de auditoría del cambio
    - Mantener estado de subasta `pendiente`

### **Validaciones de Negocio**

- **VN-01:** Solo para subastas en estado `pendiente`
- **VN-02:** Nueva fecha debe ser futura

### **UI/UX**

- **UX-01:** Mostrar claramente la fecha límite actual vs la nueva
- **UX-02:** Validación en tiempo real de la fecha seleccionada
- **UX-03:** Confirmación: "Se extenderá el plazo por X días(horas y minutos si es  menor a un dia) hasta [fecha]"

### **Estados y Flujo**

- **EF-01:** Tras extender, regresar a **HU-SUB-07** con fecha actualizada
- **EF-02:** Mostrar toast confirmando la extensión

---

## **REGLAS TRANSVERSALES DEL MÓDULO**

### **Validaciones Globales:**

- Los archivos de comprobante deben mantenerse accesibles siempre
- Las acciones críticas requieren confirmación adicional

### **Manejo de Errores:**

- Si la subasta cambió de estado durante validación: alertar y actualizar
- Si hay problemas con archivos: mostrar error específico