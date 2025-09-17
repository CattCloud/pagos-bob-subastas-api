## **DOCUMENTACIÓN REFINADA (UI + CORREO)**

### **ENTIDAD NOTIFICATIONS**

**Propósito:** Registrar eventos importantes del sistema que requieren atención del usuario (cliente o admin) con notificación dual en UI y correo electrónico

**Estructura:**

- Identificador único de notificación
- Usuario destinatario
- Tipo de evento específico
- Título corto para mostrar en UI
- Mensaje descriptivo completo
- Estado de lectura (pendiente/vista)
- Referencia al elemento relacionado (subasta, transacción, factura)
- Estado de envío de correo (pendiente/enviado/fallido)
- Fechas de creación, visualización y envío de correo

**Tipos de notificación identificados:**

- `ganador_subasta` - Cliente ganó una subasta
- `pago_registrado` - Admin: cliente registró pago pendiente validación
- `pago_validado` - Cliente: pago fue aprobado
- `pago_rechazado` - Cliente: pago fue rechazado
- `competencia_ganada` - Cliente: BOB ganó la competencia externa
- `competencia_perdida` - Cliente: BOB perdió la competencia externa
- `penalidad_aplicada` - Cliente: se aplicó penalidad por incumplimiento
- `reembolso_procesado` - Cliente: reembolso fue completado

### **EVENTOS QUE GENERAN NOTIFICACIONES (LÓGICA FRONTEND-BACKEND)**

**Para Clientes:**

**Cuando admin registra ganador de subasta:**

- Se crea notificación tipo `ganador_subasta`
- Mensaje incluye felicitación y recordatorio de fecha límite de pago
- **DUAL:** Se registra en base de datos Y se envía correo vía EmailJS
- Se envía al cliente que ganó

**Cuando admin valida pago de garantía:**

- Si aprueba: notificación `pago_validado` con confirmación
- Si rechaza: notificación `pago_rechazado` con motivo específico
- **DUAL:** Se registra en base de datos Y se envía correo vía EmailJS
- Se envía al cliente que registró el pago

**Cuando admin cambia estado de subasta a resultado de competencia:**

- Estado `ganada`: notificación `competencia_ganada` - BOB ganó, dinero aplicado a compra
- Estado `perdida`: notificación `competencia_perdida` - BOB perdió, se procesará reembolso
- Estado `penalizada`: notificación `penalidad_aplicada` - penalidad aplicada por incumplimiento
- **DUAL:** Cada evento se registra en base de datos Y se envía correo vía EmailJS

**Cuando admin procesa reembolso:**

- Notificación `reembolso_procesado` confirmando devolución de dinero
- **DUAL:** Se registra en base de datos Y se envía correo vía EmailJS

**Para Admins:**

**Cuando cliente registra pago de garantía:**

- Se crea notificación tipo `pago_registrado`
- Mensaje indica que hay pago pendiente de validación bancaria
- **DUAL:** Se registra en base de datos Y se envía correo vía EmailJS
- Se envía al usuario admin del sistema

### **FLUJO DE NOTIFICACIÓN DUAL**

**Proceso automático:**

1. **Evento del sistema** ocurre (admin registra ganador, valida pago, etc.)
2. **Crear registro** en tabla `Notifications`
3. **Simultáneamente:** Enviar correo usando EmailJS al email del usuario
4. **Actualizar estado** de envío de correo en el registro

**Manejo de errores:**

- Si el correo falla, se marca como `email_fallido` para reintentar posteriormente
- La notificación UI funciona independientemente del estado del correo
- Sistema de reintentos para correos fallidos

### **EXPERIENCIA DE USUARIO**

**Notificación por correo:**

- **Asunto:** Título de la notificación
- **Cuerpo:** Mensaje descriptivo completo + enlace al sistema
- **Remitente:** BOB Subastas (configurado en EmailJS)
- **Template:** Diseño consistente con identidad de BOB

**Visualización en interfaz:**

- Ícono de campana en header con badge numérico mostrando notificaciones no leídas
- Panel desplegable al hacer click mostrando lista de notificaciones
- Notificaciones ordenadas por fecha (más recientes primero)
- Distinción visual entre leídas y no leídas

**Interacción:**

- Al abrir panel de notificaciones, se marcan como vistas automáticamente
- Click en notificación específica redirige al detalle correspondiente (subasta, pago, etc.)
- Opción de "marcar todas como leídas"

**Estados de referencia:**

- Notificaciones sobre subastas enlazan al detalle de la subasta
- Notificaciones sobre pagos enlazan al seguimiento del pago
- Notificaciones sobre reembolsos enlazan al historial de transacciones

### **REGLAS DE NEGOCIO**

**Creación automática:** Las notificaciones se generan automáticamente cuando ocurren los eventos específicos en el backend, no requieren acción manual

**Envío dual obligatorio:** Cada notificación DEBE intentar enviarse tanto a UI como a correo electrónico

**Destinatarios específicos:** Cada notificación se dirige al usuario relevante (cliente afectado o admin del sistema) usando su email registrado

**Persistencia:** Las notificaciones se mantienen en el sistema para historial del usuario, sin límite de tiempo definido

**Unicidad:** Cada evento genera máximo una notificación por usuario para evitar spam

**Gestión de fallos:** Si el correo falla, no impide que la notificación aparezca en UI, y se programa reintento automático

### **CONFIGURACIÓN TÉCNICA**

**Integración con EmailJS:**

- Servicio configurado con templates predefinidos para cada tipo de notificación
- API key y service ID configurados en variables de entorno
- Límite de 200 correos/mes en plan gratuito

**Campos adicionales en tabla Notifications:**

- `email_status` - Estado del envío (pendiente/enviado/fallido)
- `email_sent_at` - Fecha de envío exitoso del correo
- `email_error` - Mensaje de error si falló el envío
