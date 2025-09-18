# Proyecto Bob - Definicion de Prerequisitos

## 1. Problema y objetivo del proyecto

### **¿Qué problema real resuelve la app?**

Actualmente BOB Subastas maneja los pagos de garantía de los ganadores a través de un **formulario de Google que alimenta un Google Sheet**, lo cual genera varios problemas críticos:

- **Cálculos manuales peligrosos** del saldo de clientes que puede llevar a errores financieros
- **Falta de centralización** de datos de pagos y saldos
- **Ausencia de validaciones automáticas** en los movimientos de dinero
- **Gestión manual** del proceso de garantías y reembolsos
- **Riesgo de pérdida de control** sobre los saldos retenidos de los clientes
- **Falta de seguimiento** del proceso completo desde la subasta interna hasta la competencia con otras empresas

### **¿Cuál es el objetivo principal (MVP)?**

Desarrollar un **sistema centralizado de gestión de pagos y saldos** que automatice y valide el proceso de:

- Registro de pagos de garantía (8% del valor de la oferta)
- Cálculo automático y preciso de saldos de clientes mediante sistema de transacciones
- Gestión de saldos retenidos durante todo el proceso de competencia externa
- Control de reembolsos y penalidades según resultado de competencia con otras empresas
- Manejo de facturación cuando BOB gana la competencia externa

### **¿Cuál es el resultado esperado al usarla?**

- **Eliminar errores** en el cálculo manual de saldos
- **Centralizar toda la información** de pagos y transacciones en un sistema robusto
- **Automatizar las validaciones** financieras críticas
- **Tener control total** sobre los movimientos de dinero en cada etapa del proceso
- **Reducir riesgos financieros** asociados a la gestión manual
- **Transparencia completa** del proceso desde subasta interna hasta resultado final

---

## 2. Usuarios y roles

### **¿Quiénes van a usar el sistema?**

Los usuarios son:

1. **Admin** (Empleados de BOB Subastas)
2. **Cliente** (Compradores/Postores)

### **¿Todos van a hacer lo mismo o algunos tendrán permisos diferentes?**

Tienen roles y permisos completamente diferentes:

**ADMIN:**

- Acceso a través de la ruta: `/admin-subastas`
- **Permisos:** Gestión completa del sistema
- **Tareas principales:**
    - Crear y gestionar subastas
    - Validar pagos de garantía (proceso manual con banco - 2 horas)
    - Registrar resultados de competencia externa (ganada/perdida/penalizada)
    - Generar facturas cuando BOB gana
    - Gestionar saldos de clientes con sistema de transacciones
    - Procesar reembolsos y penalidades

**CLIENTE:**

- Acceso a través de la ruta: `/pago-subastas`
- **Permisos:** Solo gestión de sus propios pagos y saldos
- **Tareas principales:**
    - Registrar pago de garantía cuando gana una subasta
    - Consultar su saldo disponible calculado en tiempo real
    - Ver historial de sus transacciones (pagos, reembolsos, penalidades)
    - Solicitar reembolsos de saldos no utilizados

> **Nota:** La funcionalidad de ofertar por subastas no se incluye puesto que es un sistema de gestión de pagos y subastas, no de subastas en tiempo real (eso es el Sistema Web de BOB, nuestro sistema es complementario).

### **Característica importante:**

- **No requiere autenticación tradicional** - La diferenciación se hace a través de las rutas de acceso

---

## 3. Historias de usuario

### Historias de usuario - ROL CLIENTE

### **Gestión de Pagos de Garantía:**

- **Como cliente**, quiero registrar mi pago de garantía (8% de mi oferta ganadora) para cumplir con los requisitos de la subasta antes del tiempo límite establecido.

### **Consulta de Saldo:**

- **Como cliente**, quiero consultar mi saldo actual calculado desde mis transacciones reales para saber cuánto dinero tengo disponible en el sistema.

### **Historial de Transacciones:**

- **Como cliente**, quiero ver el historial completo de mis transacciones (pagos de garantía, reembolsos, penalidades, usos) para tener transparencia total sobre mis movimientos financieros.

### **Gestión de Reembolsos:**

- **Como cliente**, quiero solicitar reembolso de mi saldo cuando BOB pierda en la competencia externa o no quiera mantener dinero retenido para futuras subastas.

### **Seguimiento de Estado Completo:**

- **Como cliente**, quiero saber el estado completo de mi pago: validación bancaria, resultado de competencia externa, y estado final para entender qué pasó con mi dinero.

### **Sistema de Notificaciones:**

- **Como cliente**, quiero recibir notificaciones automáticas en la UI y por correo electrónico sobre eventos importantes de mis subastas para estar siempre informado del estado de mis procesos.

### Historias de usuario - ROL ADMIN

### **Gestión de Pagos:**

- **Como admin**, quiero validar los pagos de garantía registrados por los clientes para confirmar que las transferencias bancarias son correctas.

### **Gestión de Competencia Externa:**

- **Como admin**, quiero registrar si BOB ganó, perdió o fue penalizada en la competencia externa para actualizar el estado de las subastas y procesar los saldos correspondientes.

### **Gestión de Facturación:**

- **Como admin**, quiero generar facturas cuando BOB gane la competencia externa para aplicar el saldo del cliente al pago del vehículo.

### **Gestión de Saldos con Transacciones:**

- **Como admin**, quiero consultar y gestionar los saldos calculados desde las transacciones de todos los clientes para tener control total sobre el dinero del sistema.

### **Gestión de Reembolsos y Penalidades:**

- **Como admin**, quiero procesar reembolsos cuando BOB pierde y aplicar penalidades cuando el cliente no completa el pago después de que BOB gana.

### **Reportes y Control:**

- **Como admin**, quiero ver reportes de transacciones y saldos para tener visibilidad completa del estado financiero del sistema.

### **Sistema de Notificaciones::**

- **Como admin**, quiero recibir notificaciones automáticas cuando los clientes registren pagos de garantía para poder validarlos oportunamente.

---

## 4. Definición de módulos / funcionalidades

### **MÓDULO 1: Gestión de Subastas**

**Rol**: Admin

**Funcionalidades:**

- **Como admin**, quiero registrar una nueva subasta con sus datos básicos para tener control de las subastas activas
- **Como admin**, quiero registrar al ganador de una subasta para iniciar el proceso de pago de garantía
- **Como admin**, quiero registrar el monto de la oferta ganadora para calcular automáticamente la garantía (8%)
- **Como admin**, quiero registrar el resultado de la competencia externa (ganada/perdida/penalizada) para actualizar el estado final de la subasta
- **Como admin**, quiero gestionar las transiciones de estado de subasta según el resultado de la competencia externa

### **MÓDULO 2: Gestión de Pagos de Garantía**

**Funcionalidades:**

- **Como cliente**, quiero acceder a un formulario de pago de garantía para registrar mi transferencia bancaria
- **Como cliente**, quiero ingresar los datos de mi pago (monto, comprobante, datos bancarios) para cumplir con el proceso
- **Como admin**, quiero ver todos los pagos pendientes de validación para procesarlos con el banco
- **Como admin**, quiero validar un pago de garantía (aprobar/rechazar) creando la transacción correspondiente
- **Como admin**, quiero ver el tiempo restante para validar pagos para cumplir con los límites establecidos

### **MÓDULO 3: Gestión de Saldos con Sistema de Transacciones**

**Funcionalidades:**

- **Como cliente**, quiero consultar mi saldo calculado en tiempo real desde mis transacciones para saber cuánto dinero tengo disponible
- **Como cliente**, quiero ver cómo se calculó mi saldo (total - retenido - aplicado) para tener transparencia
- **Como admin**, quiero consultar el saldo de cualquier cliente calculado desde sus transacciones para resolver consultas
- **Como admin**, quiero ver un resumen de todos los saldos para control financiero general

### **MÓDULO 4: Sistema de Transacciones**

**Funcionalidades:**

- **Como sistema**, quiero registrar cada movimiento de dinero como transacción para tener trazabilidad completa
- **Como cliente**, quiero ver mi historial completo de transacciones para hacer seguimiento de mi dinero
- **Como cliente**, quiero filtrar mis transacciones por fechas o tipo para encontrar información específica
- **Como admin**, quiero ver el historial de transacciones de cualquier cliente para soporte y auditoría
- **Como admin**, quiero crear transacciones manuales para ajustes o correcciones

### **MÓDULO 5: Gestión de Facturación**

**Funcionalidades:**

- **Como admin**, quiero crear facturas cuando BOB gane la competencia externa para aplicar el saldo del cliente
- **Como admin**, quiero gestionar la información de facturación de las ventas completadas
- **Como sistema**, quiero calcular el saldo aplicado desde las facturas generadas

### **MÓDULO 6: Gestión de Reembolsos y Penalidades**

**Funcionalidades:**

- **Como cliente**, quiero solicitar reembolso de mi saldo cuando BOB pierde para recuperar mi dinero
- **Como admin**, quiero procesar reembolsos completos cuando BOB pierde en la competencia externa
- **Como admin**, quiero aplicar penalidades del 30% y reembolsos parciales del 70% cuando el cliente no paga después de que BOB gana
- **Como admin**, quiero ver todas las solicitudes de reembolso para procesarlas
- **Como admin**, quiero marcar reembolsos como procesados para llevar control

### **MÓDULO 7: Sistema de Notificaciones**
**Funcionalidades:**

- **Como sistema**, quiero generar notificaciones automáticas en UI y correo para eventos críticos del proceso de subastas
- **Como cliente**, quiero ver mis notificaciones pendientes en un panel de la interfaz para estar al día con mis procesos
- **Como cliente**, quiero recibir correos automáticos sobre cambios importantes en mis subastas para no perder información crítica
- **Como admin**, quiero recibir alertas cuando hay pagos pendientes de validación para procesarlos rápidamente
- **Como usuario**, quiero marcar notificaciones como leídas para mantener organizada mi bandeja de notificaciones

---

## 5. Reglas de negocio 

### **REGLAS DEL PROCESO COMPLETO:**

**RN01 - Flujo Completo de Subasta:**

1. Cliente gana subasta BOB → registra pago de garantía (8%)
2. Admin valida pago de garantía → dinero queda retenido
3. BOB participa en competencia externa contra otras empresas
4. Según resultado de competencia:
   - **BOB gana:** Cliente debe completar datos facturación → se aplica saldo
   - **BOB pierde:** Se reembolsa completamente al cliente
   - **BOB gana pero cliente no paga vehículo completo:** 30% penalidad, 70% reembolso

### **REGLAS DE PAGOS DE GARANTÍA:**

**RN02 - Monto de Garantía:**

- El pago de garantía DEBE ser exactamente el 8% del monto de la oferta ganadora
- Si el monto ingresado no coincide con el 8%, el sistema DEBE rechazar el pago

**RN03 - Registro como Movimiento(Transacción):**

- Cuando el cliente registra su pago, se crea transacción tipo `pago_garantia`
- Cuando se valida, se actualiza automáticamente cache de saldo en User
- Solo movimientos validados afectan los cálculos de saldo

### **REGLAS DE TRANSACCIONES(Movimientos):**

**RN04 - Sistema de Transacciones:**

- Todo movimiento de dinero DEBE registrarse como transacción en Movement
- Las transacciones tienen tipo general (entrada/salida) y específico (pago_garantia, reembolso, penalidad, ajuste_manual)
- Las referencias a otras entidades se manejan a través de Movement_References
- **CRÍTICO:** Movement y Billing son independientes - NO crear Movement automático al crear Billing

**RN05 - Cálculo de Saldos:**

```
Saldo Disponible = SALDO TOTAL - SALDO RETENIDO - SALDO APLICADO

Donde:
- Saldo Total = Suma de transacciones validadas (entradas - salidas)
- Saldo Retenido = Dinero en procesos pendientes (subastas finalizadas, reembolsos solicitados)
- Saldo Aplicado = Suma de registros en Billing (ventas completadas)
```

### **REGLAS DE ESTADOS DE SUBASTA:**

**RN06 - Estados y Transiciones:**

Los estados de subasta siguen este flujo:
- `activa` → Subasta creada, sin ganador asignado
- `pendiente` → Ganador asignado, esperando que registre pago
- `en_validacion` → Cliente registró pago, admin debe validar
- `finalizada` → Pago validado y completado
- `vencida` → Tiempo límite agotado, ganador no pagó
- `cancelada` → Cancelada manualmente por admin
- `ganada`: BOB ganó competencia externa → crear Billing
- `perdida`: BOB perdió competencia externa → procesar reembolso
- `penalizada`: BOB ganó pero cliente no pagó → aplicar penalidad + reembolso parcial

**RN07 - Retención por Estados:**

- `finalizada`: Dinero SE retiene (BOB aún no compite)
- `perdida`: Dinero se retiene hasta que el reembolso sea procesado (proceso resuelto)
- `ganada`: Dinero se retiene hasta que se genere la factura (proceso resuelto)
- `penalizada` : Dinero se retiene hasta que el reembolso sea procesado y se aplique la penalid (proceso resuelto)
- `facturada`: Dinero NO se retiene (aplicado en Billing)

**RN - Reasignación de Ganador:**

Cuando el ganador original no realiza el pago antes del límite:

1. La subasta pasa a `vencida` temporalmente
2. **Reasignación**: Se registra la siguiente mejor oferta
3. **Reactivación**: Se puede establecer nueva fecha límite o manejo manual
4. **Notificación**: Se informa al nuevo ganador 


### **REGLAS DE PENALIDADES:**

**RN08 - Aplicación de Penalidad:**

- Penalidad se aplica SOLO cuando cliente no completa pago después de que BOB gana
- Penalidad = 30% del monto de garantía pagado
- Reembolso parcial = 70% del monto de garantía pagado
- Se crean dos transacciones: una de penalidad (salida) y una de reembolso (salida)

### **REGLAS DE FACTURACIÓN:**

**RN09 - Generación de Facturas:**

- Se crea Billing solo cuando subasta pasa a estado `ganada`
- Billing representa dinero aplicado/utilizado del saldo del cliente
- El monto en Billing debe coincidir con la garantía retenida

### **REGLAS DE INTEGRIDAD DEL SISTEMA:**

**RN10 - Consistencia de Cache:**

- Los campos `saldo_total` y `saldo_retenido` en User se actualizan automáticamente
- Actualización en tiempo real al crear/actualizar transacciones
- Validación nocturna para detectar inconsistencias

**RN11 - Validaciones de Seguridad:**

- Saldo disponible nunca puede ser negativo
- No permitir transacciones que generen inconsistencias
- Validar integridad entre Movement, Billing y estados de Auction

### **REGLAS DE REEMBOLSOS:**

**RN12 - Solicitud de Reembolso:**

- Un cliente puede solicitar reembolso de saldo disponible cualquier día
- La empresa DEBE confirmar con el cliente: mantener como saldo o devolver dinero

**RN13 - Procesamiento:**

- Los reembolsos pueden procesarse cualquier día de la semana
- Una vez procesado, NO se puede revertir

**RN14 - Diferenciación por Rutas:**

- Admin: acceso SOLO por `/admin-subastas`
- Cliente: acceso SOLO por `/pago-subastas`
- Sin autenticación tradicional

**RN15 - Identificación de Usuarios:**

- En `/pago-subastas`: cliente selecciona tipo de documento e ingresa número para acceder
- En `/admin-subastas`: acceso automático con datos del admin registrado
- Si un documento no existe, DEBE mostrar error y no permitir acceso


### **REGLAS DE NOTIFICACIONES (NUEVO):**

**RN16 - Sistema Dual de Notificaciones:**

- Cada evento crítico del sistema DEBE generar notificación automática en UI y correo
- Las notificaciones se crean simultáneamente: registro en base de datos + envío por EmailJS
- Si el correo falla, la notificación UI funciona independientemente
- Sistema de reintentos automáticos para correos fallidos

**RN17 - Eventos que Generan Notificaciones:**

- Asignación de ganador → notifica al cliente ganador
- Registro de pago → notifica al admin
- Validación de pago → notifica al cliente
- Cambios de estado de competencia → notifica al cliente
- Procesamiento de reembolsos → notifica al cliente
  
---

## 6. Datos y base de datos (nivel conceptual)
### **ENTIDAD 1: User**

**Representa:** Usuarios del sistema (clientes y admin)

**Atributos:**

- id (PK)
- first_name*
- last_name*
- email*
- phone_number (nullable para admin)
- document_type (nullable para admin)
- document_number* (ÚNICO - para identificación de clientes)
- user_type* (admin/client)
- saldo_total (cache calculado desde Movement)
- saldo_retenido (cache calculado según estados)
- created_at
- updated_at
- deleted_at

### **ENTIDAD 2: Auction **

**Representa**: Subastas que **YA terminaron** (tiempo agotado) pero pueden tener diferentes estados:
- `activa`: Se registro la subasta pero aun no se registra un ganador
- `finalizada`: Hay ganador ,el cliente pagó y se valido
- `pendiente`: Ganador aun no pagó, posible pasó al siguiente
- `en_validacion` : Después de que el cliente registra pago, pero aún no está validado
- `cancelada`: Se canceló por algún motivo
- `vencida`: El ganador no pago en la fecha limite de pago
- `ganada`: BOB ganó pero esperando datos facturación del cliente
- `facturada`: Cliente completó datos facturación, Billing generado y saldo aplicado
- `perdida`: BOB perdió contra competidores → proceder con reembolso
- `penalizada`: BOB ganó pero cliente no completó pago del vehículo → aplicar penalidad 30%

**Atributos:**

- id (PK)
- asset_id (FK)*
- fecha_inicio*
- fecha_fin*
- fecha_limite_pago (Momento exacto hasta el cual el ganador puede pagar)
- estado (activa, pendiente, en_validacion, finalizada, **ganada**, **facturada**, **perdida**, **penalizada**, vencida, cancelada)
- id_offerWin (es el id de la oferta que gano)
- fecha_resultado_general (cuándo se resolvió competencia externa)
- finished_at (Cuando ya paso la subasta a finalizado y se tiene un ganador establecido)
- created_at
- updated_at

### **ENTIDAD 3: Movement (TRANSACCIONES PRINCIPALES)**

**Representa:** Todas las transacciones de dinero del sistema

**Atributos:**

- id (PK)
- user_id (FK)*
- tipo_movimiento_general ENUM('entrada', 'salida')
- tipo_movimiento_especifico VARCHAR(50) (pago_garantia, reembolso, penalidad, ajuste_manual)
- monto DECIMAL(10,2)
- moneda VARCHAR(3) DEFAULT 'USD'
- tipo_pago ENUM('deposito', 'transferencia', 'ajuste_manual') NULL
- numero_cuenta_origen VARCHAR(50) NULL
- voucher_url VARCHAR(500) NULL
- concepto TEXT
- estado ENUM('pendiente', 'validado', 'rechazado')
- fecha_pago DATETIME NULL
- fecha_resolucion DATETIME NULL
- motivo TEXT NULL
- numero_operacion VARCHAR(100) NULL
- created_at DATETIME
- updated_at DATETIME

### **ENTIDAD 4: Movement_References (REFERENCIAS GENÉRICAS)**

**Representa:** Referencias de transacciones a otras entidades

**Atributos:**

- id (PK)
- movement_id (FK) -- Apunta a Movement
- reference_type VARCHAR(50) -- 'auction', 'offer', 'refund'
- reference_id INT -- ID de la entidad referenciada
- created_at DATETIME

### **ENTIDAD 5: Billing (FACTURACIÓN)**

**Representa:** Facturas generadas cuando BOB gana competencia externa

**Atributos:**

- id (PK)
- user_id (FK)
- billing_document_type ENUM('RUC', 'DNI')
- billing_document_number VARCHAR(20)
- billing_name VARCHAR(200) (Nombre o Razón Social)
- monto DECIMAL(10,2)
- moneda VARCHAR(3) DEFAULT 'USD'
- concepto TEXT -- "Compra vehículo Toyota Corolla 2020 - Subasta #15"
- auction_id (FK) -- Subasta relacionada
- created_at DATETIME
- updated_at DATETIME


### **ENTIDAD 5: Offer(Ofertas)**

**Representa: Ofertas relevantes realizadas en una subasta**, no solo la ganadora hasta el ranking 3.

**Atributos:**

- id (PK)
- auction_id (FK)* (Subasta en la que participa)
- user_id (FK)* (Usuario que hizo la oferta)
- monto_oferta* (Valor ofertado)
- fecha_oferta*
- posicion_ranking (1=ganador, 2=segundo, etc.)
- fecha_asignacion_ganador (Fecha/hora en que esta oferta fue declarada ganadora)
- estado (activa/ganadora/perdedora)

| Estado      | Significado                                                | Acciones que lo llevan a este estado                                         |
| ----------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `activa`    | Ganador preliminar asignado, pendiente de pago de garantía | Admin registra ganador y se crea offer con estado `activa`                   |
| `ganadora`  | Oferta confirmada, garantía pagada y validada              | Cuando el pago de garantía se confirma                                       |
| `perdedora` | Oferta descartada, ya no es candidata                      | Cuando se reasigna el ganador a otro usuario o la subasta se cierra sin pago |



### **ENTIDAD 6: Asset (Activos)**

**Representa:** Información del vehículo físico (placa, empresa, etc.)

**Atributos:**

- id (PK)
- placa*
- empresa_propietaria*
- marca
- modelo
- año
- estado(`disponible`, `vendido`, `retirado`)
- descripcion
- created_at
- updated_at


### **ENTIDAD 7: Refund (Reembolsos)**

**Representa:** Solicitudes de reembolso

**Atributos:**

- id (PK)
- user_id (FK)*
- monto_solicitado*
- tipo_reembolso* (mantener_saldo/devolver_dinero)
- estado
- auction_id //Subasta asociada
- fecha_respuesta_empresa (cuando la solicitud pasa a confirmado o rechazada)
- fecha_procesamiento (cuando admin procesa)
- motivo
- created_at
- updated_at

<aside>

Estados de solicitud de reembolso
- `solicitado` → Cliente hizo la solicitud
- `confirmado` → Empresa llamó y cliente confirmó el tipo,inicia el proceso de reembolso
- `rechazado` → El admin revisó la solicitud y decidió no aprobarla
- `procesado` → Admin completó el reembolso

### **ENTIDAD 8: Notifications**

**Representa:** Notificaciones automáticas del sistema enviadas por UI y correo electrónico

**Atributos:**

- id (PK)
- user_id (FK)*
- tipo 
- titulo Titulo Descriptivo
- mensaje TEXT
- estado ('pendiente', 'vista')
- email_status Estado de envio('pendiente', 'enviado', 'fallido')
- reference_type  (Referencia al elemento relacionado (subasta, transacción, factura))
- reference_id 
- fecha_creacion 
- fecha_vista 
- email_sent_at  (Fecha de envío exitoso del correo)
- email_error (Mensaje de error si falló el envío)
- created_at
- updated_at

**Tipos de notificación :**

- `ganador_subasta` - Cliente ganó una subasta
- `pago_vencido` - Cliente no hizo el pago de garantia a tiempo
- `pago_registrado` - Admin: cliente registró pago pendiente validación
- `pago_validado` - Cliente: pago fue aprobado
- `pago_rechazado` - Cliente: pago fue rechazado
- `competencia_ganada` - Cliente: BOB ganó la competencia externa
- `competencia_perdida` - Cliente: BOB perdió la competencia externa
- `penalidad_aplicada` - Cliente: se aplicó penalidad por incumplimiento
- `reembolso_procesado` - Cliente: reembolso fue completado
- `reembolso_solicitado` - Cliente solicita reembolso
  
---

## 7. Requisitos no funcionales

- **Responsive Design**: Compatible con móvil y desktop
- **Storage**: Archivos almacenados en Cloudinary
- **Performance**: Carga rápida con cache de saldos y cálculos optimizados
- **Integridad**: Sistema de validación automática de consistencia de datos
- **Seguridad**: Validación de sesiones temporales y transacciones
- **Auditoría**: Trazabilidad completa de todas las transacciones
- **Usabilidad**: Interfaz intuitiva para usuarios no técnicos
- **Confiabilidad**: Jobs nocturnos de validación de consistencia
- **Notificaciones**: Sistema dual UI + correo con EmailJS, máximo 200 correos/mes en plan gratuito
- **Tiempo real**: Notificaciones aparecen inmediatamente en UI al ocurrir eventos
  
---

## 8. Navegación del Sistema

### **CLIENTE - Menú Lateral:**
-  **Mis Garantías** (pantalla principal)
-  **Notificaciones** (nuevo - badge con contador)
-  **Pagar Garantía**
-  **Mi Saldo** (calculado desde transacciones)
-  **Historial de Transacciones**
-  **Solicitar Reembolso**

### **ADMIN - Menú Lateral:**
-  **Pagos de Garantía** (pantalla principal)
-  **Gestión de Subastas** 
-  **Nueva Subasta**
-  **Resultados de Competencia**
-  **Gestión de Saldos** (con sistema de transacciones)
-  **Gestión de Facturación**
-  **Gestión de Reembolsos**
