# NUEVA INFORMACION: BOB EN COMPETENCIA GENERAL

### **1. PROCESO AMPLIADO DE SUBASTAS**

> Luego de que el cliente realizo el pago de una garantia ,Bob pasa por un proceso donde compite con otras empresas por el activo, es decir es como si la subasta que hizo Bob es para obtener el ganador que lo va representar en un subastas mas grande ahora contra otras empresas
> 

### **Flujo Actual Redefinido:**

1. Cliente gana subasta BOB → registra pago de garantía (8%)
2. Admin valida pago de garantía → `saldo_aplicado`
3. **NUEVO:** BOB participa en "subasta general" contra otras empresas
4. **NUEVO:** Si BOB gana → contacta al cliente para pago completo del vehículo
5. **NUEVO:** Si cliente paga completo → proceso exitoso
6. **NUEVO:** Si cliente NO paga completo → penalidad del 30%

### **2. REDEFINICIÓN DE PENALIDAD**

### **Concepto Anterior (INCORRECTO):**

> Malinterpretacion de la penalidad , la penalidad se aplicaba 30% en caso no halla realizado el pago de garantia pero eso no es lo correcto
> 
- Penalidad por NO pagar garantía del 8%
- Se aplicaba al saldo disponible

### **Concepto Nuevo (CORRECTO):**

- Penalidad por NO completar pago del vehículo después de que BOB ganó
- Se aplica al 30% del monto de garantía ya pagado
- El 70% restante se reembolsa al cliente

### **Ejemplo Práctico:**

```
Oferta ganadora: $12,000
Garantía (8%): $960
BOB gana subasta general → Cliente debe pagar $12,000 completos
Si cliente NO paga:
- Penalidad: $960 × 30% = $288 (BOB retiene)
- Reembolso: $960 × 70% = $672 (se devuelve al cliente)

```

### **3. NUEVOS ESTADOS DE AUCTION**

### **Estados Anteriores: No cambian**

- `activa`, `pendiente`, `en_validacion`, `finalizada`, `vencida`, `cancelada`

### **Estados Nuevos a Agregar:**

- `ganada`: BOB ganó contra competidores en subasta general
- `perdida`: BOB perdió contra competidores → proceder con reembolso
- `penalizada`: BOB ganó pero cliente no completó pago → aplicar penalidad 30%

### **4. IMPACTO EN ENTIDADES**

### **Auction - Campo Adicional:**

- `fecha_resultado_general`: timestamp del resultado gane o pierda

# MODIFICACION - AGREGACION Y ELIMINACION DE ENTIDADES

### **1. MODIFICACIONES EN ENTIDADES EXISTENTES**

- ❌ **`User_Balance`** - Reemplazada por cálculos desde `Movement`
- ❌ **`Guarantee_Payment`** - Funcionalidad absorbida por `Movement`

### **2. MODIFICACIONES EN ENTIDADES EXISTENTES**

### **2.1 Entidad `User` - CAMPOS AGREGADOS:**

```sql
User {
  // ... campos existentes ...
  saldo_total 
  saldo_retenido 
  // ... resto de campos ...
}

```

**Propósito de los nuevos campos:**

- **`saldo_total`**: Cache del saldo total calculado (para performance)
- **`saldo_retenido`**: Cache del saldo retenido calculado (para performance)
- **Nota**: Estos campos se actualizan automáticamente cada vez que se crea/actualiza un `Movement`

### **2.2 Entidad `Auction` - NUEVOS ESTADOS:**

- 'ganada',         // NUEVO - BOB ganó subasta general
- 'perdida',        // NUEVO - BOB perdió subasta general
- 'penalizada'      // NUEVO - Cliente no completó pago después de ganar BOB

```sql
Auction {
  // ... campos existentes ...
  fecha_resultado_general //Cuándo se resolvió la competencia BOB vs otras empresas
  estado ENUM(
    'activa',         // Existente
    'pendiente',      // Existente
    'en_validacion',  // Existente
    'finalizada',     // Existente
    'vencida',        // Existente
    'cancelada',      // Existente
    'ganada',         // NUEVO - BOB ganó subasta general
    'perdida',        // NUEVO - BOB perdió subasta general
    'penalizada'      // NUEVO - Cliente no completó pago después de ganar BOB
  )
  // ... resto de campos ...
}
```

### **3. NUEVAS ENTIDADES**

### **3.1 Entidad `Movement` - REDISEÑADA COMO TRANSACCIÓN PRINCIPAL:**

- id
- user_id
- tipo_movimiento_general   (entrada,salida)
- tipo_movimiento_especifico
- monto
- moneda	//(USD) se insertaran mas en el futuro
- tipo_pago (Deposito o Transferencia)
- numero_cuenta_origen* (Número de cuenta desde la que se hizo el pago)
- voucher_url* (Enlace al archivo del comprobante)
- concepto	(Concepto de pago)
- estado	(pendiente, validado,rechazado)
- fecha_pago (Fecha en que se hizo el pago)
- fecha_resolucion (Cuándo fue validado o rechazado)
- motivo_rechazo
- Numero de operacion
- created_at
- update_At

```sql
Movement {
  id (PK)
  user_id (FK)
  tipo_movimiento_general ENUM('entrada', 'salida')
  tipo_movimiento_especifico VARCHAR(50)
  monto DECIMAL(10,2)
  moneda VARCHAR(3) DEFAULT 'USD'
  tipo_pago ENUM('deposito', 'transferencia', 'ajuste_manual') NULL
  numero_cuenta_origen VARCHAR(50) NULL
  voucher_url VARCHAR(500) NULL
  concepto TEXT
  estado ENUM('pendiente', 'validado', 'rechazado')
  fecha_pago DATETIME NULL
  fecha_resolucion DATETIME NULL
  motivo_rechazo TEXT NULL
  numero_operacion VARCHAR(100) NULL
  created_at DATETIME
  updated_at DATETIME
}
```

**Tipos de Movimiento Específico Identificados:**

- `pago_garantia` - Pago de garantía del 8%
- `reembolso` - Devolución de dinero (completa o parcial)
- `penalidad` - Descuento del 30% por no completar pago del vehículo
- `ajuste_manual` - Correcciones administrativas

### **3.2 Entidad `Movement_References` - REFERENCIAS GENÉRICAS:**

- **Movement ↔ Movement_References** (1:N)

```sql
Movement_References {
  id (PK)
  movement_id (FK) -- Apunta a Movement
  reference_type VARCHAR(50) -- 'auction', 'offer', 'refund', 'user'
  reference_id INT -- ID de la entidad referenciada
  created_at DATETIME
}

```

**Casos de Uso de Referencias:**

```
Pago de Garantía:
- reference_type: 'auction', reference_id: 15
- reference_type: 'offer', reference_id: 8

Reembolso:
- reference_type: 'refund', reference_id: 3

Penalidad:
- reference_type: 'auction', reference_id: 15

```

### **3.3 Entidad `Billing`**

- **Billing ↔ Movement**  (Se crea automáticamente un Movement cuando se crea un Billing)
- id (PK)
- user_id (FK)
- billing_document_type ENUM('RUC', 'DNI')
- billing_document_number
- billing_name (Nombre o Razon Social)
- monto
- moneda
- concepto // Ejemplo : Compra vehículo Toyota Corolla 2020 - Subasta #15"
- auction_id (FK) -- Subasta relacionada
- created_at
- updated_at

# **REDEFINICIÓN DEL SISTEMA DE SALDOS**

### **1. CAMBIO PRINCIPAL DEL SISTEMA**

**Anterior:** El sistema manejaba saldos a través de una tabla dedicada `User_Balance` con campos específicos para cada tipo de saldo.

**Nuevo:** El sistema calcula todos los saldos dinámicamente desde dos fuentes:

### **`Movement`**: Para el saldo total y retenido

**Identidad Movement**

- id
- user_id
- tipo_movimiento_general   (entrada,salida)
- tipo_movimiento_especifico //por ahora se identifico -> pago_garantia,reembolso
- monto
- moneda	//(USD) se insertaran mas en el futuro
- tipo_pago (Deposito o Transferencia)
- numero_cuenta_origen* (Número de cuenta desde la que se hizo el pago)
- voucher_url* (Enlace al archivo del comprobante)
- concepto	(Concepto de pago)
- estado	(pendiente, validado,rechazado)
- fecha_pago (Fecha en que se hizo el pago)
- fecha_resolucion (Cuándo fue validado o rechazado)
- motivo_rechazo
- Numero de operacion
- created_at
- update_At

**Tipos de Movimiento Específico Identificados:**

- `pago_garantia` - Pago de garantía del 8%
- `reembolso` - Devolución de dinero (completa o parcial)
- `penalidad` - Descuento del 30% por no completar pago del vehículo
- `ajuste_manual` - Correcciones administrativas

### **`Billing`**: Para el saldo aplicado (ventas/uso del dinero)

**Entidad Billing** 

- id (PK)
- user_id (FK)
- billing_document_type ENUM('RUC', 'DNI')
- billing_document_number
- billing_name (Nombre o Razon Social)
- monto
- moneda
- concepto // Ejemplo : Compra vehículo Toyota Corolla 2020 - Subasta #15"
- auction_id (FK) -- Subasta relacionada
- created_at
- updated_at

### **2. NUEVA FÓRMULA OFICIAL DE SALDO DISPONIBLE**

```
Saldo Disponible = SALDO TOTAL - SALDO RETENIDO - SALDO APLICADO

```

### **3. DEFINICIÓN DE CADA TIPO DE SALDO**

### **3.1 SALDO TOTAL**

**Qué representa:** El dinero total que el cliente ha ingresado al sistema menos las salidas procesadas.

**Cómo se calcula:**

- Se suman todos los movimientos de tipo "entrada" (pagos de garantía, depósitos, ajustes positivos)
- Se restan todos los movimientos de tipo "salida" (penalidades, ajustes negativos, reembolsos procesados)
- Solo se consideran movimientos con estado "validado"

**Cache:** Se almacena en `User.saldo_total` y se actualiza automáticamente con cada movimiento validado.

### **3.2 SALDO RETENIDO**

**Qué representa:** Dinero temporalmente "congelado" por procesos que están en curso.

**Cuándo se retiene dinero:**

- **Pagos de Garantía**: Desde que se valida el pago hasta que BOB resuelve la competencia con otras empresas
- **Solicitudes de Reembolso**: Desde que el cliente solicita hasta que se procesa la devolución

**Momentos específicos de retención:**

- Cuando una subasta tiene estado `finalizada` (pago validado pero BOB aún no compite)
- Cuando hay una solicitud de reembolso en estado `pendiente`

**Cache:** Se almacena en `User.saldo_retenido` y se recalcula cuando cambian los estados de subastas o reembolsos.

### **3.3 SALDO APLICADO**

**Qué representa:** Dinero que ya fue utilizado/consumido del sistema para compras realizadas.

**Cuándo se aplica dinero:**

- Cuando BOB gana la competencia y se genera una factura al cliente
- Se crea un registro en la tabla `Billing` que representa la venta/uso del dinero

**Cómo se calcula:**

- Se suman todos los montos de la tabla `Billing` del cliente
- Representa las ventas completadas donde se usó el saldo del cliente

### **4. NUEVA ENTIDAD: BILLING**

**Propósito:** Registrar las ventas/uso del saldo cuando BOB gana una competencia y factura al cliente.

**Campos principales:**

- Información del cliente y facturación
- Monto utilizado del saldo
- Concepto de la venta (descripción del vehículo)
- Referencia a la subasta relacionada

**Función en el cálculo:** Los registros en `Billing` representan dinero "aplicado" que debe restarse del saldo disponible.

### **5. FLUJO DE ESTADOS Y RETENCIONES**

### **5.1 Estados de Subasta y su Impacto en Retenciones:**

| Estado Subasta | ¿Se Retiene? | Explicación |
| --- | --- | --- |
| `pendiente` | No | El cliente aún no ha registrado pago |
| `en_validacion` | No | El pago está registrado pero no validado |
| `finalizada` | **SÍ** | Pago validado, BOB aún no compite |
| `ganada` | No | BOB ganó, se creó Billing, dinero aplicado |
| `perdida` | No | BOB perdió, se procesó reembolso |
| `penalizada` | No | Se aplicó penalidad y reembolso parcial |

### **5.2 Transiciones de Estado y Cambios en Saldo:**

**Cuando subasta pasa a `finalizada`:**

- Saldo Total: Aumenta (entrada del pago de garantía)
- Saldo Retenido: Aumenta (dinero queda congelado)
- Saldo Disponible: No cambia (se cancela el aumento)

**Cuando subasta pasa de `finalizada` a `ganada`:**

- Se crea registro en `Billing`
- Saldo Retenido: Disminuye (ya no está congelado)
- Saldo Aplicado: Aumenta (se usó para la venta)
- Saldo Disponible: No cambia

**Cuando subasta pasa de `finalizada` a `perdida`:**

- Se procesa reembolso completo
- Saldo Total: Disminuye (salida de reembolso)
- Saldo Retenido: Disminuye (ya no está congelado)
- Saldo Disponible: Vuelve a cero

**Cuando subasta pasa de `finalizada` a `penalizada`:**

- Se procesa penalidad (30%) y reembolso parcial (70%)
- Saldo Total: Disminuye por ambos movimientos
- Saldo Retenido: Disminuye (ya no está congelado)
- Saldo Disponible: Vuelve a cero

### **6. IMPACTO EN FUNCIONALIDADES DEL SISTEMA**

### **6.1 Cálculos en Tiempo Real:**

- El sistema ya no almacena saldos precalculados (excepto cache en User)
- Cada consulta de saldo se calcula desde las fuentes: Movement y Billing
- Los campos cache (saldo_total y saldo_retenido) en User se actualizan automáticamente

### **6.2 Validaciones de Negocio:**

- Antes de permitir nuevos pagos, verificar saldo disponible
- No permitir reembolsos si hay saldo retenido por otras operaciones
- Validar que el saldo disponible nunca sea negativo

### **6.3 Reportes y Auditoría:**

- Todo movimiento de dinero queda registrado en Movement
- Las ventas/aplicaciones quedan en Billing
- Historial completo disponible para auditorías

### **8. CONSIDERACIONES TÉCNICAS**

- Implementar triggers automáticos para mantener cache de User actualizado
- Validar integridad de datos entre Movement, Billing y estados de Auction
- Crear índices apropiados para optimizar cálculos de saldo
- Implementar mecanismos de validación para evitar saldos negativos
- Planificar migración de datos existentes sin interrumpir operaciones

**Este nuevo sistema asegura que el saldo disponible del cliente siempre refleje exactamente el dinero que puede usar, considerando todo lo que está retenido por procesos en curso y todo lo que ya fue aplicado en ventas.**

# **ACLARACIONES IMPORTANTES:**

### **1. Movement vs Billing - NO se duplican**

`Movement` y `Billing` son independientes y NO se debe crear un Movement automático cuando se crea un Billing.

**Razón:** Si se creara un Movement de "salida" automáticamente, el cálculo sería:

```
Saldo Disponible = Saldo Total - Movement(salida) - Billing = INCORRECTO (doble descuento)

```

La fórmula correcta es:

```
Saldo Disponible = Saldo Total - Saldo Retenido - Saldo Aplicado(Billing)

```

### **2. Movement son transacciones REALES, no historial**

Los Movement no se crean automáticamente porque representan dinero real que necesita información específica (voucher, cuenta origen, etc.)

### **3. Billing es manual**

Se crea manualmente cuando el admin maneja el estado "ganada" de una subasta.

## **ACCION PARA EVITAR INCONSISTENCIAS EN LOS CAMPOS DE SALDO DEL USER:**

### ESTRATEGIA COMBINADA:

1. TIEMPO REAL - Para operaciones críticas:

- Crear/actualizar Movement → recalcular cache INMEDIATAMENTE
- Cambiar estado Auction → recalcular saldo_retenido INMEDIATAMENTE
- Crear Billing → NO tocar cache

2. VALIDACIÓN NOCTURNA (Opción C) - Detecta y corrige errores de sistema

- Job cada noche (2:00 AM) que compara cache vs cálculo real
- Si hay diferencias → corrige automáticamente
- Log detallado de inconsistencias para detectar bugs
