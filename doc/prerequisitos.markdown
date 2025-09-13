# Proyecto Bob - Definicion de Preerequisitos
## 1. Problema y objetivo del proyecto

### **¿Qué problema real resuelve la app?**

Actualmente BOB Subastas maneja los pagos de garantía de los ganadores a través de un **formulario de Google que alimenta un Google Sheet**, lo cual genera varios problemas críticos:

- **Cálculos manuales peligrosos** del saldo de clientes que puede llevar a errores financieros
- **Falta de centralización** de datos de pagos y saldos
- **Ausencia de validaciones automáticas** en los movimientos de dinero
- **Gestión manual** del proceso de garantías y reembolsos
- **Riesgo de pérdida de control** sobre los saldos retenidos de los clientes

### **¿Cuál es el objetivo principal (MVP)?**

Desarrollar un **sistema centralizado de gestión de pagos y saldos** que automatice y valide el proceso de:

- Registro de pagos de garantía (8% del valor de la oferta)
- Cálculo automático y preciso de saldos de clientes
- Gestión de saldos retenidos hasta el fin de subasta
- Control de reembolsos cuando el cliente no gana

### **¿Cuál es el resultado esperado al usarla?**

- **Eliminar errores** en el cálculo manual de saldos
- **Centralizar toda la información** de pagos en una sola aplicación
- **Automatizar las validaciones** financieras críticas
- **Tener control total** sobre los movimientos de dinero de cada cliente
- **Reducir riesgos financieros** asociados a la gestión manual

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
    - Gestionar saldos de clientes
    - Procesar reembolsos (miércoles en lote)

**CLIENTE:**

- Acceso a través de la ruta: `/pago-subastas`
- **Permisos:** Solo gestión de sus propios pagos y saldos
- **Tareas principales:**
    - Registrar pago de garantía cuando gana una subasta
    - Consultar su saldo disponible
    - Ver historial de sus movimientos (pagos, reembolsos)
    - Solicitar reembolsos de saldos no utilizados

<aside>

La funcionalidad de ofertar por subastas , no se incluye puesto que es un sistema de gestion de pagos y subastas, no de subastas en tiempo real(eso es el Sistema Web de BOB, nuestro sistema es complementario a eso)

</aside>

### **Característica importante:**

- **No requiere autenticación tradicional** - La diferenciación se hace a través de las rutas de acceso

---

## 3. Historias de usuario

### Historias de usuario - ROL CLIENTE

### **Gestión de Pagos de Garantía:**

- **Como cliente**, quiero registrar mi pago de garantía (8% de mi oferta ganadora) para cumplir con los requisitos de la subasta antes de las 10am del día siguiente.

### **Consulta de Saldo:**

- **Como cliente**, quiero consultar mi saldo actual para saber cuánto dinero tengo disponible retenido en el sistema.

### **Historial de Movimientos:**

- **Como cliente**, quiero ver el historial completo de mis movimientos (pagos de garantía, reembolsos, uso de saldos) para tener transparencia sobre mis transacciones.

### **Gestión de Reembolsos:**

- **Como cliente**, quiero solicitar el reembolso de mi saldo cuando no gane una subasta o no quiera mantener dinero retenido para futuras subastas.

### **Seguimiento de Estado:**

- **Como cliente**, quiero saber si mi pago de garantía ha sido validado por el banco para confirmar que cumplí con el proceso correctamente.

### Historias de usuario - ROL ADMIN

**Gestión de Pagos:**

- **Como admin**, quiero validar los pagos de garantía registrados por los clientes para confirmar que las transferencias bancarias son correctas.

**Gestión de Saldos:**

- **Como admin**, quiero consultar y gestionar los saldos de todos los clientes para tener control total sobre el dinero retenido en el sistema.

**Gestión de Reembolsos:**

- **Como admin**, quiero procesar los reembolsos de los clientes (los miércoles en lote) para devolver el dinero de saldos no utilizados.

**Administración de Subastas:**

- **Como admin**, quiero registrar las subastas y sus ganadores para vincular los pagos de garantía con las subastas correspondientes.

**Reportes y Control:**

- **Como admin**, quiero ver reportes de movimientos y saldos para tener visibilidad completa del estado financiero del sistema.

---

## 4. Definición de módulos / funcionalidades

### **MÓDULO 1: Gestión de Subastas**

**Rol**: Admin

**Funcionalidades:**

- **Como admin**, quiero registrar una nueva subasta con sus datos básicos para tener control de las subastas activas
- **Como admin**, quiero registrar al ganador de una subasta para iniciar el proceso de pago de garantía
- **Como admin**, quiero registrar el monto de la oferta ganadora para calcular automáticamente la garantía (8%)

### **MÓDULO 2: Gestión de Pagos de Garantía**

**Funcionalidades:**

- **Como cliente**, quiero acceder a un formulario de pago de garantía para registrar mi transferencia bancaria
- **Como cliente**, quiero ingresar los datos de mi pago (monto, comprobante, datos bancarios) para cumplir con el proceso
- **Como admin**, quiero ver todos los pagos pendientes de validación para procesarlos con el banco
- **Como admin**, quiero validar un pago de garantía (aprobar/rechazar) para actualizar el estado del cliente
- **Como admin**, quiero ver el tiempo restante para validar pagos para cumplir con el límite de 10am

### **MÓDULO 3: Gestión de Saldos**

**Funcionalidades:**

- **Como cliente**, quiero consultar mi saldo actual para saber cuánto dinero tengo retenido
- **Como cliente**, quiero ver cómo se calculó mi saldo (pagos - usos) para tener transparencia (Cálculo automático de saldos por cliente,Aplicación automática de saldo al ganar subasta,Retención de saldo hasta fin de subasta)
- **Como admin**, quiero consultar el saldo de cualquier cliente para resolver consultas
- **Como admin**, quiero ver un resumen de todos los saldos para control financiero general()

### **MÓDULO 4: Historial de Movimientos**

**Funcionalidades:**

- **Como cliente**, quiero ver mi historial completo de movimientos para hacer seguimiento de mi dinero (Registro de todos los movimientos por cliente-Visualización de historial personal (cliente))
- **Como cliente**, quiero filtrar mis movimientos por fechas o tipo para encontrar información específica
- **Como admin**, quiero ver el historial de movimientos de cualquier cliente para soporte y auditoría(Vista completa de movimientos por admin - Filtros por fechas, cliente, tipo de movimiento)

### **MÓDULO 5: Gestión de Reembolsos**

**Funcionalidades:**

- **Como cliente**, quiero solicitar reembolso de mi saldo para recuperar mi dinero no utilizado
- **Como admin**, quiero ver todas las solicitudes de reembolso para procesarlas (Procesamiento de reembolsos en lote )
- **Como admin**, quiero marcar reembolsos como procesados para llevar control del lote semanal (Estados de reembolso (solicitado/procesado/completado) - Cálculo de reembolsos totales/parciales)

---

## 5. Reglas de negocio

### **REGLAS DE PAGOS DE GARANTÍA:**

**RN01 - Monto de Garantía:**

- El pago de garantía DEBE ser exactamente el 8% del monto de la oferta ganadora
- Si el monto ingresado no coincide con el 8%, el sistema DEBE rechazar el pago

**RN02 - Límite de Tiempo para Pago:**

- El ganador tiene hasta las 10am del día siguiente al cierre de subasta para registrar su pago
- A las 10:01am el sistema DEBE automáticamente marcar al ganador como "No pagó"

**RN03 - Paso Automático al Siguiente Ganador:**

- Si el ganador no registra el pago antes de las 10am, el sistema DEBE automáticamente:
    - Pasar la victoria al siguiente ganador (segunda oferta más alta)
    - Aplicar penalidad del 30% al ganador anterior (si tiene saldo disponible)
    - Notificar al nuevo ganador que tiene hasta las 10am del siguiente día

**RN04 - Moneda y Método de Pago:**

- Solo se aceptan pagos en dólares (USD) por transferencia bancaria o depósito
- Cualquier pago en otra moneda o método DEBE ser rechazado

### **REGLAS DE VALIDACIÓN DE PAGOS:**

**RN05 - Proceso de Validación:**

- Todo pago registrado DEBE ser validado manualmente por un admin
- Un pago puede tener estados: Pendiente → Validado/Rechazado
- Un pago rechazado requiere nuevo registro del cliente
- **Definición automática de fecha de limite de pago:**
    - Por defecto, el admin define un pago de subasta como no realizada si el cliente no realiza el pago(El estado de subasta pasa a vencida)
    - Pero puede ser automatico y ajustable manualmente al crear la subasta (opcional) indicando una fecha de limite de pago.
- **Cambio de estado automático:**
    - Si llega la hora límite y no se realizo(todavia no validado) un pago de garantía, el estado de subasta pasa a vencida.
    - Se genera penalidad para el ganador original y se reasigna al siguiente postor (si existe).
- **Validación de pago:**
    - Si el pago de garantía es realizado(todavía no validado) antes de fecha de limite de pago, el estado de la subasta pasa a finalizada.

**RN05 - Reasignación de ganador y reactivación de subasta**

Cuando el ganador original no realiza el pago de la garantía antes de la fecha limite de pago, ocurre lo siguiente:

1. La subasta pasa a vencida temporalmente.
2. **Reasignación:**
    - Se selecciona la siguiente mejor oferta en el ranking de pujas.(Actualizando la informacio de oferta relacionada en la subasta)
3. **Reactivación:**
    - Se recalcula una fecha limite de pago(por defecto, 10:00 a.m. del día siguiente).
    - Se cambia el estado de la subasta de vencida a activa nuevamente, pero ahora solo para el nuevo ganador.
4. **Notificación:**
    - Se genera una notificación para el nuevo ganador informando que ahora tiene derecho a pagar la garantía.
    - Se genera una notificación para el ganador anterior indicando la penalidad aplicada.

> Nota: Si no existen más postores elegibles, la subasta se cancela definitivamente (cancelada).

### **REGLAS DE SALDOS:**

**RN06 - Retención y Uso de Saldo:**

- El saldo se mantiene retenido hasta que termine la subasta
- Si gana: saldo se usa automáticamente como parte del pago final
- Si no gana: saldo queda disponible para futuras subastas o reembolso

**RN07 - Cálculo de Saldo:**

- Saldo = Pagos validados - Saldos utilizados - Reembolsos procesados
- El saldo NUNCA puede ser negativo

**RN08 - Aplicación de Penalidades:**

- La penalidad del 30% se descuenta automáticamente del saldo disponible
- Si no tiene saldo suficiente, queda como deuda pendiente

### **REGLAS DE REEMBOLSOS:**

**RN09 - Solicitud de Reembolso:**

- Un cliente puede solicitar reembolso de saldo no retenido cualquier día
- La empresa DEBE llamar al cliente para confirmar: mantener como saldo o devolver dinero

**RN10 - Cambio de Decisión:**

- Un cliente PUEDE cambiar su decisión de reembolso mientras esté en estado "Solicitado"
- NO puede cambiar si ya está "En proceso" o "Procesado"

**RN11 - Procesamiento:**

- Los reembolsos pueden procesarse cualquier día de la semana
- Una vez procesado, NO se puede revertir

### **REGLAS DE ACCESO:**

**RN12 - Diferenciación por Rutas:**

- Admin: acceso SOLO por `/admin-subastas`
- Cliente: acceso SOLO por `/pago-subastas`
- Sin autenticación tradicional

**RN13 - Permisos por Rol:**

- Admin: puede gestionar todo el sistema
- Cliente: solo puede ver y gestionar sus propios datos

### REGLA DE IDENTIFICACION EN EL SISTEMA

**RN14 - Identificación de Usuarios:**

- En la ruta `/pago-subastas`, al acceder , el cliente DEBE seleccionar su tipo e ingresar su número de documento para acceder a sus datos
- El sistema DEBE validar que el documento existe en la base de datos antes de mostrar información
- En la ruta `/admin-subastas`, el sistema accederá automáticamente con los datos del **único admin registrado**
- Si un documento no existe en el sistema, DEBE mostrar mensaje de error y no permitir acceso

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
- created_at
- updated_at
- deleted_at

### **ENTIDAD 3: Asset (Activos)**

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

### **ENTIDAD 4: Auction (Subastas)**

**Representa**: Subastas que **YA terminaron** (tiempo agotado) pero pueden tener diferentes estados:

- `activa`: Se registro la subasta pero aun no se registra un ganador
- `finalizada_con_ganador`: Hay ganador y pagó
- `pendiente`: Ganador aun no pagó, posible pasó al siguiente
- `cancelada`: Se canceló por algún motivo
- `vencida`: El ganador no pago en la fecha limite de pago
  
**Atributos:**

- id (PK)
- asset_id (FK)*
- fecha_inicio*
- fecha_fin*
- fecha_limite_pago (Momento exacto hasta el cual el ganador puede pagar.)
- estado (activa,pendiente, finalizada, cancelada, vencida)
- id_offerWin (es el id de la oferta que gano)
- finished_at (Cuando ya paso la subasta a finalizado y se tiene un ganador establecido)
- pago_validado (Indica si el pago de la garantía fue validado)
- created_at
- updated_at

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

### **ENTIDAD 6: Guarantee_Payment (Pago de Garantía)**

**Representa**: Pagos del 8% realizados por ganadores (exitosos o fallidos)

**Atributos:**

- id (PK)
- user_id (FK)*
- auction_id (FK)* (Subasta relacionada)
- offer_id (FK)*  (Oferta relacionada)
- monto_garantia*
- tipo_pago (Deposito o Transferencia)
- numero_cuenta_origen* (Número de cuenta desde la que se hizo el pago)
- voucher_url* (Enlace al archivo del comprobante)
- comentarios
- estado (pendiente/validado/rechazado)
- fecha_pago (Fecha en que se hizo la transferencia)
- fecha_validacion (Cuándo fue validado por el admin)
- billing_document_type (RUC/DNI) (Dato para facturacion)
- billing_name (Escribir Razon Social o Nombre) (Dato para facturacion)
- created_at
- updated_at

### **ENTIDAD 7: User_Balance (Saldo de Usuario)**

**Representa:** Saldo actual de cada cliente

**Atributos:**

- id (PK)
- user_id (FK)*
- saldo_total*
- saldo_retenido*
- saldo_aplicado*
- saldo_enReembolso*
- saldo_penalizado*
- updated_at

<aside>

Saldo disponible es calculable, no necesita almacenarse

```jsx
monto_disponible =
  monto_total
  − monto_retenido
  − monto_aplicado
  − monto_en_reembolso
  − monto_penalizado
```

</aside>

| Campo | Qué representa | Ejemplo narrativo |
| --- | --- | --- |
| `saldo_total` | Suma de todos los pagos de garantía validados. | Erick ha pagado $960 en total por garantías |
| `saldo_disponible` | Dinero que puede usarse para otra subasta o solicitarse como reembolso | Si la subasta fue cancelada o no ganó, los $960 pasan a disponible |
| `saldo_retenido` | Dinero que el cliente **ya pagó como garantía**, pero que **aún no ha sido aplicado** porque la subasta está en proceso de terminar. | Si la subasta aún está en proceso, los $960 están retenidos |
| `saldo_aplicado` | Dinero que ya se usó como parte del pago final de una subasta(subasta concluida) | Si Erick ganó y el pago fue aplicado, los $960 se mueven aquí |
| `saldo_en_reembolso` | Dinero que está en proceso de devolución (solicitado pero no completado) | Si Erick pidió reembolso, los $960 se mueven aquí hasta que se procese |
| `saldo_penalizado` | Dinero descontado por penalidades (por no pagar a tiempo, por ejemplo) | Si Erick no pagó a tiempo, se le descuenta $288 (30%) aquí |

### **ENTIDAD 8: Movement (Movimientos)**

**Representa:** Historial de todos los movimientos financieros

- Registrar cada evento que modifica el saldo del cliente

**Atributos:**

- id (PK)
- user_id (FK)*
- tipo_movimiento*
- monto*
- descripcion*
- reference_type (`pago`, `subasta`, `reembolso`)
- reference_id
- created_at

| **Tipo Movimiento** | **¿Cuándo ocurre?** | **Efecto en Saldo** | **Descripción** | **Reference Type** | **Reference ID** |
| --- | --- | --- | --- | --- | --- |
| `retencion` | Cliente ganador registra pago de garantía (a espera de validación) | `saldo_total` ↑, `saldo_retenido` ↑ | "Pago de garantía de $X registrado - Pendiente de validación” | `pago` | `guarantee_payment.id` |
| `garantia_validada` | Admin valida un pago de garantía registrado por cliente y se usa como parte del pago | `saldo_retenido`↓
`saldo_aplicado` ↑ | "Pago de garantía de $X validado para subasta [vehiculo] y se usa como parte del pago" | `pago` | `guarantee_payment.id` |
| `garantia_rechazada` | Admin rechaza un pago de garantía (datos incorrectos, monto erróneo, etc.) | Sin efecto en saldo(solo registro histórico) | "Pago de garantía de $X rechazado: [motivo]" | `pago` | `guarantee_payment.id` |
| `penalidad` | Cliente ganó pero NO pagó garantía antes de 10am (30% de penalidad) | `saldo_disponible`↓
`saldo_penalizado` ↑ | "Penalidad de $X aplicada por no pagar garantía a tiempo" | `subasta` | `auction.id` |
| `reembolso_solicitado` | Cliente solicita reembolso de su saldo disponible | `saldo_disponible` ↓
`saldo_en_reembolso` ↑ | "Reembolso de $X solicitado - En proceso de confirmación" | `reembolso` | `refund.id` |
| `reembolso_aprobado` | Admin procesa reembolso (tipo "devolver_dinero") | `saldo_en_reembolso` ↓(dinero sale del sistema) | "Reembolso de $X procesado - Dinero transferido" | `reembolso` | `refund.id` |
| `reembolso_como_saldo` | Cuando el cliente eligió "mantener_saldo” | `saldo_en_reembolso` ↓, `saldo_disponible` ↑ | "Reembolso de $X procesado - Saldo disponible aumenta" | `reembolso` | `refund.id` |
| `reembolso_rechazado` | Admin rechaza solicitud de reembolso | `saldo_en_reembolso` ↓
`saldo_disponible` ↑ | "Reembolso de $X rechazado: [motivo] - Saldo restaurado" | `reembolso` | `refund.id` |

### **ENTIDAD 9: Refund (Reembolsos)**

**Representa:** Solicitudes de reembolso

**Atributos:**

- id (PK)
- user_id (FK)*
- monto_solicitado*
- tipo_reembolso* (mantener_saldo/devolver_dinero)
- estado
- fecha_solicitud
- fecha_respuesta_empresa (cuando la solicitud pasa a confirmado o rechazada)
- fecha_procesamiento (cuando admin procesa)
- motivo
- created_at
- updated_at

<aside>

Estados

- `solicitado` → Cliente hizo la solicitud
- `confirmado` → Empresa llamó y cliente confirmó el tipo
- `rechazado` → El admin revisó la solicitud y decidió no aprobarla
- `procesado` → Admin completó el reembolso
- `cancelado` → Cliente canceló la solicitud
</aside>

---

## 7. Requisitos no funcionales

- Sera responsive (Movil - Desktop)
