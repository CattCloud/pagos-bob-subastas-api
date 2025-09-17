# HU-COMP-01 — Gestionar Resultado de Competencia Externa (Admin)

## **Historia:**

Como **administrador**, quiero registrar el resultado final de BOB en la competencia externa (ganada/perdida/penalizada) para subastas que ya tienen pago de garantía validado, para actualizar el estado de la subasta y activar los procesos correspondientes según el resultado obtenido.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** Acceso desde **HU-SUB-07** (Detalle de Subasta) → botón **"Gestionar Resultado Competencia"** disponible únicamente para subastas con estado `finalizada`.
- **CA-02:** Mostrar modal/formulario con:
    - **Información de la subasta:** vehículo, placa, cliente ganador, monto garantía
    - **Selector de resultado** (radio buttons): 
        - 🏆 **"BOB GANÓ"** - BOB ganó la competencia externa
        - ❌ **"BOB PERDIÓ"** - BOB perdió contra otros competidores
        - ⚠️ **"CLIENTE NO PAGÓ VEHÍCULO"** - BOB ganó pero cliente no completó pago del vehículo completo
    - **Campo opcional:** `observaciones` (texto, máximo 500 caracteres)
    - **Información importante:** Explicar qué ocurre con cada resultado
- **CA-03:** Al confirmar resultado:
    - Actualizar `Auction.estado` según selección:
        - **BOB GANÓ** → `estado = ganada`
        - **BOB PERDIÓ** → `estado = perdida`
        - **CLIENTE NO PAGÓ VEHÍCULO** → `estado = penalizada`
    - Registrar `Auction.fecha_resultado_general = now()`
    - Ejecutar lógica específica según resultado (ver HU-COMP-02/03/04)

---

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar subastas con estado `finalizada` (pago de garantía validado)
- **VN-02:** Verificar que existe cliente ganador (`id_offerWin` no es nulo)
- **VN-03:** No permitir cambiar resultado una vez guardado (operación irreversible)
- **VN-04:** Verificar que existe Movement tipo `pago_garantia` validado para la subasta
- **VN-05:** `observaciones` no debe exceder 500 caracteres

---

### **UI/UX:**

- **UX-01:** Modal de confirmación con diseño claro mostrando:
    - **Header:** "Resultado Competencia Externa - Subasta #{id}"
    - **Sección de información:** datos clave de la subasta
    - **Sección de selección:** radio buttons con iconos distintivos
    - **Sección de ayuda:** explicación breve de cada opción
- **UX-02:** **Información contextual** para cada opción:
    - **BOB GANÓ:** "Se solicitará al cliente completar datos de facturación"
    - **BOB PERDIÓ:** "Se procesará reembolso completo al cliente"
    - **CLIENTE NO PAGÓ VEHÍCULO:** "Se aplicará penalidad del 30% + reembolso del 70%"
- **UX-03:** **Botones de acción:**
    - **"Confirmar Resultado"** (deshabilitado hasta seleccionar opción)
    - **"Cancelar"** (cierra sin guardar)
- **UX-04:** **Confirmación adicional** antes de guardar:
    > "¿Está seguro del resultado seleccionado? Esta acción no se puede deshacer y activará automáticamente los procesos correspondientes."

---

### **Estados y Flujo:**

- **EF-01:** **Éxito:** Mostrar toast de confirmación y redirigir a detalle de subasta actualizado
- **EF-02:** **Error:** Mostrar mensaje específico sin cerrar modal
- **EF-03:** **Después de guardar:** 
    - El botón "Gestionar Resultado Competencia" desaparece
    - Aparecen botones contextuales según nuevo estado (ver HU-SUB-07)
- **EF-04:** **Logging:** Registrar en logs la acción del admin y resultado seleccionado

---

### **Integración con Procesos Automáticos:**

- **INT-01:** **Si resultado = "BOB GANÓ":**
    - Ejecutar **HU-COMP-02** automáticamente
    - Cambiar estado a `ganada`
    - Notificar cliente: `competencia_ganada` + solicitud completar datos facturación
    
- **INT-02:** **Si resultado = "BOB PERDIÓ":**  
    - Ejecutar **HU-COMP-03** automáticamente
    - Iniciar proceso de reembolso completo
    - Notificar cliente: `competencia_perdida`
    
- **INT-03:** **Si resultado = "CLIENTE NO PAGÓ VEHÍCULO":**
    - Ejecutar **HU-COMP-04** automáticamente
    - Aplicar penalidad 30% + reembolso 70%
    - Notificar cliente: `penalidad_aplicada`

---

### **Campos de Base de Datos Actualizados:**

```sql
-- Tabla Auction
UPDATE Auction SET
    estado = [ganada|perdida|penalizada],
    fecha_resultado_general = NOW(),
    observaciones_resultado = [observaciones ingresadas]
WHERE id = [auction_id]
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Seguridad:**
- Solo admins pueden acceder a esta funcionalidad
- Operación irreversible - requiere confirmación adicional
- Log completo de todas las acciones realizadas

### **Performance:**
- Modal se carga con datos pre-cargados de la subasta
- Validaciones en tiempo real del formulario
- Procesos posteriores se ejecutan en background

### **Auditoría:**
- Registrar quien realizó el cambio y cuándo
- Mantener historial de observaciones ingresadas
- Trazabilidad completa del proceso de competencia externa

---