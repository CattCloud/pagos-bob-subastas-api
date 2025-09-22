# FLUJOS DE NEGOCIO - SISTEMA DE PAGOS BOB SUBASTAS
## Documento para Presentación a Clientes

---

## 1. PROCESO EXITOSO COMPLETO - BOB GANA LA COMPETENCIA EXTERNA

### 1.1 - Administrador registra la subasta
- **Estado Inicial:** `Subasta.estado = ACTIVA`
- **Acción:** Admin crea nueva subasta con datos del vehículo (placa, marca, modelo, año)
- **Impacto:** Sin cambios en saldos del cliente

### 1.2 - Administrador asigna ganador a la subasta
- **Estado:** `Subasta.estado = PENDIENTE`
- **Acción:** Admin registra cliente ganador con monto de oferta y fecha límite de pago
- **Impacto:** Sin cambios en saldos del cliente

### 1.3 - Ganador realiza pago de garantía (8% del monto ofertado)
- **Estado:** `Subasta.estado = EN_VALIDACION`
- **Acción:** Cliente sube comprobante de pago de garantía
- **Impacto:** Sin cambios hasta validación

### 1.4 - Administrador valida pago de garantía
- **Estado:** `Subasta.estado = FINALIZADA`
- **Acción:** Admin aprueba el pago registrado
- **Movimiento de dinero:**
  - ✅ Movimiento entrada (aumenta monto total)
  - ✅ Retención aumenta (dinero queda congelado)
  - **Fórmula:** `saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado`

### 1.5 - BOB gana competencia → Administrador procesa resultado como ganada
- **Estado:** `Subasta.estado = GANADA`
- **Acción:** Admin registra resultado "ganada" → Sistema genera factura automáticamente
- **Movimiento de dinero:**
  - ✅ Retención se libera (reduce)
  - ✅ Aplicado aumenta (dinero aplicado a la factura)
  - ✅ Total se mantiene igual
  - **Resultado:** Cliente tiene dinero aplicado para pago del vehículo

### 1.6 - Cliente o Admin completan la factura
- **Estado:** Proceso completado
- **Acción:** Se ingresan datos de facturación (RUC/DNI, nombre/razón social)
- **Impacto:** Sin cambios en saldos (solo se completan datos administrativos)

---

## 2. BOB PIERDE LA COMPETENCIA EXTERNA - PROCESO DE REEMBOLSO

### 2.1 - 2.4 - Proceso inicial idéntico al Flujo 1
- Mismos pasos hasta validación de pago de garantía

### 2.5 - BOB pierde competencia → Reembolso automático
- **Estado:** `Subasta.estado = PERDIDA`
- **Acción:** Admin registra resultado "perdida" → Sistema procesa reembolso automático
- **Movimiento de dinero:**
  - ✅ Movimiento entrada automático (reembolso)
  - ✅ Retención se libera completamente
  - ✅ Disponible aumenta por monto completo
  - **Resultado:** Cliente tiene dinero disponible inmediatamente

### 2.6 - Cliente solicita transferencia en efectivo (opcional)
- **Acción:** Cliente puede solicitar que le transfieran el dinero a su cuenta bancaria
- **Proceso:** Admin confirma y procesa transferencia
- **Movimiento de dinero:**
  - ✅ Movimiento salida (transferencia)
  - ✅ Total disminuye por monto transferido
  - **Resultado:** Cliente recibe dinero en su cuenta bancaria

---

## 3. BOB GANA PERO CLIENTE NO PAGA VEHÍCULO - PENALIDAD 30%

### 3.1 - 3.4 - Proceso inicial hasta validación de pago

### 3.5 - BOB gana pero cliente no paga vehículo → Penalidad automática
- **Estado:** `Subasta.estado = PENALIZADA`
- **Acción:** Admin registra "penalizada" → Sistema aplica penalidad 30%
- **Movimiento de dinero:**
  - ✅ Movimiento salida por penalidad (30% del monto)
  - ✅ Movimiento entrada automático por reembolso (70% del monto)
  - ✅ Total disminuye solo por la penalidad
  - ✅ Disponible aumenta por el 70% restante
  - **Resultado:** BOB retiene 30%, cliente tiene 70% disponible

### 3.6 - Cliente solicita transferencia del 70% restante (opcional)
- Similar al flujo de reembolso, pero solo por el 70% disponible

---

## 4. SUBASTA VENCIDA POR NO PAGO

### 4.1 - 4.2 - Administrador crea subasta y asigna ganador


### 4.3 - Cliente NO registra pago de garantía
- **Situación:** Cliente no sube comprobante dentro del plazo

### 4.4 - Administrador marca subasta como vencida
- **Estado:** `Subasta.estado = VENCIDA`
- **Acción:** Admin marca manualmente como vencida por no pago
- **Impacto:** Sin impacto financiero (nunca hubo Movement de pago)
- **Resultado:** Subasta cerrada sin consecuencias económicas

---

## 5. EXTENSIÓN DE PLAZO DE PAGO

### 5.1 - 5.2 - Proceso inicial normal

### 5.3 - Administrador extiende plazo de pago
- **Acción:** Admin modifica fecha límite de pago (ej: +4 horas)
- **Justificación:** Cliente solicita extensión por motivos válidos

### 5.4 - Cliente registra pago dentro del nuevo plazo
- **Resultado:** Proceso continúa normalmente hacia validación

---

## 6. PAGO RECHAZADO CON MÚLTIPLES REINTENTOS

### 6.1 - 6.2 - Proceso inicial normal

### 6.3 - Cliente registra pago → Admin RECHAZA (Intento 1)
- **Motivo:** Ej. "Monto incorrecto"
- **Impacto:** Sin cambios en saldos (rechazo no afecta balance)

### 6.4 - Cliente registra nuevo pago → Admin RECHAZA (Intento 2)
- **Motivo:** Ej. "Comprobante ilegible"
- **Impacto:** Sin cambios en saldos

### 6.5 - Cliente registra pago correcto → Admin APRUEBA (Intento 3)
- **Resultado:** Solo el pago aprobado actualiza saldos
- **Principio:** Rechazos previos no impactan el balance del cliente

---

## 7. CLIENTE CON MÚLTIPLES SUBASTAS SIMULTÁNEAS (ESCENARIO MIXTO)

### 7.1 - Cliente participa en 4 subastas simultáneas (A, B, C, D)
- **Subastas:** Honda Civic (A), Toyota Corolla (B), Nissan Sentra (C), Hyundai Elantra (D)
- **Ofertas:** $10,000 (A), $12,500 (B), $9,000 (C), $11,200 (D)
- **Garantías:** $800 (A), $1,000 (B), $720 (C), $896 (D) = $3,416 total

### 7.2 - Cliente paga todas las garantías → Admin valida todas
- **Impacto:** Total +$3,416, Retenido +$3,416, Disponible sin cambios

### 7.3 - Resultados mixtos procesados:
- **A: GANADA** → Retenido -$800, Aplicado +$800 (facturación automática)
- **B: PERDIDA** → Retenido -$1,000, Disponible +$1,000 (reembolso automático)
- **C: PENALIZADA** → Total -$216, Retenido -$720, Disponible +$504 (penalidad 30% + reembolso 70%)
- **D: PERDIDA** → Retenido -$896, Disponible +$896 (reembolso automático)

### 7.4 - Cliente gestiona reembolsos opcionales:
- **B:** Solicita transferencia de $1,000 → Total -$1,000
- **C:** Solicita transferencia de $504 → Total -$504  
- **D:** Mantiene $896 en sistema para futuras subastas

### 7.5 - Resultado final:
- **Total:** $1,696 (penalidad aplicada)
- **Retenido:** $0 (todo liberado)
- **Aplicado:** $800 (factura de subasta A)
- **Disponible:** $896 (saldo de subasta D mantenido)

---

## 8. FLUJOS DE GESTIÓN DE REEMBOLSOS

### 8.1 - Cliente solicita reembolso en efectivo
- **Requisito:** Tener saldo disponible > $0
- **Proceso:** 
  1. Cliente completa formulario con monto deseado
  2. Dinero se retiene automáticamente (previene doble uso)
  3. Admin recibe notificación

### 8.2 - Admin gestiona solicitud de reembolso
- **Acciones posibles:** Confirmar, Rechazar, Solicitar información adicional
- **Si confirma:** Solicitud pasa a estado "confirmado"
- **Si rechaza:** Dinero se libera de vuelta al cliente

### 8.3 - Admin procesa transferencia
- **Acción:** Admin sube comprobante de transferencia bancaria
- **Movimiento:** Salida del sistema → Total disminuye
- **Resultado:** Cliente recibe dinero en su cuenta bancaria

---

## CONCEPTOS CLAVE DEL SISTEMA

### Estados de Subasta:
- **ACTIVA:** Recién creada por admin
- **PENDIENTE:** Ganador asignado, esperando pago
- **EN_VALIDACION:** Pago registrado, esperando validación
- **FINALIZADA:** Pago validado, BOB puede competir
- **GANADA:** BOB ganó, cliente debe facturar
- **PERDIDA:** BOB perdió, dinero disponible automáticamente
- **PENALIZADA:** Cliente no pagó vehículo, penalidad aplicada
- **VENCIDA:** Sin pago dentro del plazo

### Tipos de Movimiento:
- **Entrada + Pago Garantía:** Cliente paga → dinero entra al sistema
- **Entrada + Reembolso:** Dinero liberado automáticamente como disponible
- **Salida + Penalidad:** Descuento por incumplimiento del cliente
- **Salida + Transferencia:** Dinero enviado a cuenta bancaria del cliente

### Fórmula de Saldos:
```
saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado
```
- **Total:** Todo el dinero del cliente en el sistema
- **Retenido:** Dinero congelado temporalmente
- **Aplicado:** Dinero usado en facturas/pagos
- **Disponible:** Dinero que el cliente puede usar libremente

---

## VENTAJAS DEL SISTEMA

✅ **Automatización completa:** Procesos automáticos según resultado de competencia  
✅ **Transparencia total:** Cliente ve movimientos de dinero en tiempo real  
✅ **Flexibilidad:** Cliente puede mantener dinero o solicitar transferencia  
✅ **Seguridad:** Validaciones y confirmaciones en cada paso crítico  
✅ **Trazabilidad:** Historial completo de todas las transacciones  
✅ **Escalabilidad:** Manejo de múltiples subastas simultáneas  

---

*Este documento presenta los flujos más importantes del sistema para demostración a clientes. Cada flujo ha sido probado y validado mediante tests automatizados.*