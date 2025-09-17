# HU-COMP-04 — Procesar Resultado "Cliente No Pagó Vehículo" (Admin)

## **Historia:**

Como **sistema**, quiero procesar automáticamente el resultado cuando BOB gana la competencia externa pero el cliente no completa el pago del vehículo, para aplicar la penalidad del 30% y procesar el reembolso del 70% restante.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Ejecución automática** cuando admin selecciona "CLIENTE NO PAGÓ VEHÍCULO" en **HU-COMP-01**
- **CA-02:** Al ejecutarse:
    - Actualizar `Auction.estado = penalizada`
    - Registrar `Auction.fecha_resultado_general = now()`
    - **Ejecutar HU-PEN-01** automáticamente para aplicar penalidad del 30%
    - Backend ejecuta función para recalcular saldos INMEDIATAMENTE
    - **Crear notificación automática:** informar al cliente sobre penalidad y 70% disponible para reembolso
    - El cliente debe solicitar reembolso del 70% restante mediante **HU-REEM-01**

---

### **Validaciones de Negocio:**

- **VN-01:** Solo ejecutar si subasta está en estado `finalizada`
- **VN-02:** Verificar que existe Movement tipo `pago_garantia` validado
- **VN-03:** Confirmar que el cliente ganador existe y está activo
- **VN-04:** Validar que no se duplica aplicación de penalidad para la misma subasta
- **VN-05:** Solo aplicar penalidad - el reembolso del 70% será gestionado por solicitud del cliente

---

### **UI/UX:**

- **UX-01:** **Proceso transparente** sin interfaz adicional (automático desde COMP-01)
- **UX-02:** **Toast de confirmación** en la pantalla admin:
    > "Se aplicó penalidad del 30%. Cliente puede solicitar reembolso del 70% restante ($[monto])."
- **UX-03:** **Actualización automática** del detalle de subasta mostrando:
    - Estado: `penalizada`
    - Resumen: "Penalidad aplicada: $[30%] | Disponible para reembolso: $[70%]"
    - Información del Movement de penalidad generado

---

### **Estados y Flujo:**

- **EF-01:** **Estado anterior:** `finalizada` (pago validado, BOB aún no compite)
- **EF-02:** **Estado actual:** `penalizada` (penalidad aplicada + reembolso procesado)
- **EF-03:** **Estado final:** Proceso completado, no requiere acciones adicionales
- **EF-04:** **Impacto en saldos:**
    - Saldo Total: Disminuye solo por penalidad (30%)
    - Saldo Retenido: Disminuye a 0 (dinero ya no congelado)
    - Saldo Disponible: Aumenta por 70% disponible para solicitar reembolso

---

### **Notificaciones Generadas:**

- **NOT-01:** **Para el cliente:**
    - **Tipo:** `penalidad_aplicada`
    - **Mensaje UI:** "Se aplicó penalidad del 30% ($[monto]) por no completar pago del vehículo. Tiene $[70%] disponible para solicitar reembolso."
    - **Correo:** Envío automático vía EmailJS con enlace directo a solicitar reembolso
    - **CTA:** "Solicitar Reembolso" con monto del 70% pre-llenado
    
- **NOT-02:** **Para el admin:**
    - **Tipo:** `penalidad_procesada`
    - **Mensaje:** "Penalidad aplicada a cliente [nombre] - Subasta #[id]. Penalidad: $[30%] | Cliente puede solicitar reembolso de: $[70%]"

---

### **Campos de Base de Datos Actualizados:**

```sql
-- La penalidad se aplica vía HU-PEN-01 (automático)
-- Solo actualizar estado de subasta aquí:
UPDATE Auction SET
    estado = 'penalizada',
    fecha_resultado_general = NOW()
WHERE id = [auction_id]

-- El Movement de penalidad se crea en HU-PEN-01
-- El reembolso del 70% se procesa cuando cliente haga solicitud vía HU-REEM-01
```

---

### **Ejemplo Práctico de Cálculo:**

```
Oferta ganadora: $12,000
Garantía pagada: $960 (8%)

BOB gana pero cliente no paga vehículo completo:
- Penalidad: $960 × 30% = $288 (BOB retiene)
- Reembolso: $960 × 70% = $672 (se devuelve al cliente)

Impacto en saldos del cliente:
Antes: Saldo Total $2000, Retenido $960, Disponible $1040
Después de penalidad: Saldo Total $1712 ($2000-$288), Retenido $0, Disponible $1712
Cliente puede solicitar reembolso de hasta $672 (los $960-$288)
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Automatización:**
- Cálculo automático de porcentajes (30% penalidad, 70% reembolso)
- Creación simultánea de ambos Movement
- Actualización inmediata de cache de saldos

### **Auditoría:**
- Doble registro para trazabilidad (penalidad + reembolso)
- Referencias cruzadas a subasta original
- Log detallado de cálculos aplicados

### **Integridad:**
- Verificación de que penalidad + reembolso = 100% del monto original
- Validación de consistencia en saldos
- Prevención de duplicación de penalidades

---