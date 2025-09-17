# HU-TRANS-01 — Historial de Transacciones (Cliente)

## **Historia:**

Como **cliente**, quiero ver el historial completo de todas mis transacciones (pagos de garantía, reembolsos, penalidades, ajustes) para tener transparencia total sobre los movimientos de dinero en mi cuenta.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú cliente:** "Historial de Transacciones"
- **CA-02:** **Mostrar listado en tabla (desktop) o tarjetas (mobile)** con columnas:
    - **Fecha** (created_at)
    - **Tipo** (Pago Garantía / Reembolso / Penalidad / Ajuste Manual)
    - **Concepto** (descripción de la transacción)
    - **Monto** (+$XXX.XX para entradas, -$XXX.XX para salidas)
    - **Estado** (Pendiente / Validado / Rechazado)
    - **Comprobante** (icono si tiene voucher_url)
- **CA-03:** **Orden por defecto:** fecha descendente (transacciones más recientes primero)
- **CA-04:** **Filtros disponibles:**
    - Por tipo de transacción (Todas / Pago Garantía / Reembolso / Penalidad / Ajuste)
    - Por estado (Todas / Pendiente / Validado / Rechazado)
    - Por rango de fechas (último mes, últimos 3 meses, personalizado)
    - Por rango de montos (min-max)

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar Movement del cliente autenticado (`user_id = session.user_id`)
- **VN-02:** Incluir todas las transacciones independientemente del estado
- **VN-03:** Ordenar cronológicamente para trazabilidad completa
- **VN-04:** Validar que cliente tiene sesión activa
- **VN-05:** Máximo 50 registros por página con paginación

---

### **UI/UX:**

- **UX-01:** **Header con resumen:**
    - "Total de transacciones: X"
    - "Último movimiento: hace X días"
    - Filtros rápidos (botones: "Este mes", "Últimos 3 meses", "Todo")
- **UX-02:** **Transacciones con colores distintivos:**
    - **Entradas (+):** verde - "Pago Garantía", "Reembolso (mantener saldo)"
    - **Salidas (-):** rojo - "Reembolso (devolver dinero)", "Penalidad"
    - **Pendientes:** amarillo - "En validación"
    - **Rechazadas:** gris - "No procesada"
- **UX-03:** **Información adicional por tipo:**
    - **Pago Garantía:** mostrar vehículo relacionado
    - **Reembolso:** mostrar tipo (mantener/devolver)
    - **Penalidad:** mostrar motivo
    - **Ajuste Manual:** mostrar quién lo realizó
- **UX-04:** **Click en transacción:**
    - Si tiene voucher: abrir/descargar comprobante
    - Si es pago garantía: link a seguimiento de pago
    - Si es reembolso: link a detalle de reembolso
- **UX-05:** **Si no hay transacciones:**
    > "No tiene transacciones registradas."
    > 
    > "Su primera transacción aparecerá aquí cuando registre un pago de garantía."

---

### **Estados y Flujo:**

- **EF-01:** **Carga inicial:** mostrar todas las transacciones
- **EF-02:** **Filtros dinámicos:** actualización en tiempo real
- **EF-03:** **Paginación:** carga eficiente de grandes volúmenes
- **EF-04:** **Búsqueda:** filtro de texto por concepto

---

### **Información Detallada por Tipo:**

### **Tipo `pago_garantia`:**
- **Mostrar:** Vehículo (marca modelo año), estado del pago, monto
- **Link:** A seguimiento del pago específico

### **Tipo `reembolso`:**
- **Mostrar:** Tipo de reembolso, estado del proceso
- **Link:** A detalle del reembolso (HU-REEM-05)

### **Tipo `penalidad`:**
- **Mostrar:** Motivo de la penalidad, subasta relacionada
- **Información:** Contexto del por qué se aplicó

### **Tipo `ajuste_manual`:**
- **Mostrar:** Motivo del ajuste, admin que lo realizó
- **Información:** Fecha y justificación

---

### **Consulta de Base de Datos:**

```sql
-- Query principal para el historial
SELECT 
    m.*,
    CASE m.tipo_movimiento_especifico
        WHEN 'pago_garantia' THEN CONCAT(a.marca, ' ', a.modelo, ' ', a.año)
        WHEN 'reembolso' THEN r.tipo_reembolso
        WHEN 'penalidad' THEN 'Penalidad aplicada'
        ELSE 'Ajuste administrativo'
    END as info_adicional
FROM Movement m
LEFT JOIN Movement_References mr ON m.id = mr.movement_id
LEFT JOIN Auction au ON (mr.reference_type = 'auction' AND mr.reference_id = au.id)
LEFT JOIN Asset a ON au.asset_id = a.id
LEFT JOIN Refund r ON (mr.reference_type = 'refund' AND mr.reference_id = r.id)
WHERE m.user_id = [client_user_id]
ORDER BY m.created_at DESC
LIMIT 50 OFFSET [page * 50]
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Transparencia Total:**
- Mostrar todas las transacciones sin filtros ocultos
- Información clara sobre el origen de cada movimiento
- Enlaces directos a contexto relacionado

### **Performance Optimizada:**
- Paginación para grandes volúmenes
- Filtros eficientes en base de datos
- Carga lazy de información adicional

### **Experiencia Intuitiva:**
- Similar a extracto bancario familiar
- Estados y tipos claramente diferenciados
- Navegación directa a detalles relevantes

---