# HU- Gestión de Subastas (ADMIN)

## **HU-SUB-01 — Crear Nueva Subasta**

### **Historia:**

Como **administrador**, quiero registrar una nueva subasta y el activo asociado en un solo paso, para agilizar la publicación de nuevos vehículos en el sistema.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** Debe mostrar formulario dividido en secciones:
    - **Datos de la Subasta:**
        - `fecha_inicio` (datetime) *obligatorio*
        - `fecha_fin` (datetime) *obligatorio*
    - **Datos del Activo:**
        - `placa` (texto) *obligatorio*
        - `empresa_propietaria` (texto) *obligatorio*
        - `marca` (texto) *obligatorio*
        - `modelo` (texto) *obligatorio*
        - `año` (numérico) *obligatorio*
        - `descripcion` (texto largo, opcional)
- **CA-02:** Al guardar exitosamente:
    - Crear registro en `Asset` con `estado = disponible`
    - Crear registro en `Auction` vinculado al `Asset`, con `estado = activa`
- **CA-03:** Mostrar preview dinámico: "`Subasta: {marca} {modelo} {año}`"
- **CA-04:** Redirigir a la **pantalla de detalle de subasta** recién creada (no a la lista)

---

### **Validaciones de Negocio**

- **CA-05:** `fecha_inicio` debe ser mayor a fecha/hora actual
- **CA-06:** `fecha_fin` debe ser mayor a `fecha_inicio`
- **CA-07:** `placa` debe ser única en la BD
- **CA-08:** `placa` debe ser unica y cumplir formato válido (ej. `ABC-123`)
- **CA-09:** Año debe ser numérico de 4 dígitos y mayor a 1990
- **CA-10:** Mostrar advertencia si `año > año_actual + 1`
- **CA-11:** `marca`, `modelo` y `empresa_propietaria` deben contener al menos 2 caracteres y no incluir caracteres no permitidos
- **CA-12:** `descripcion` opcional y no debe exceder 500 caracteres
- **CA-13:** No permitir crear subasta si ya existe una subasta activa para esa placa

---

### **UI/UX**

- **CA-14:** Separar visualmente secciones "Datos de la Subasta" y "Datos del Activo"
- **CA-15:** Mostrar mensajes de error bajo cada campo
- **CA-16:** Botón principal: **"Registrar Subasta"**
- **CA-17:** Incluir un link o botón secundario "**Volver a lista**" (opcional) para regresar sin guardar
- **CA-18:** Toast de éxito:
    
    > "Subasta de {marca} {modelo} {año} creada exitosamente"
    > 

---

### **Estados y Flujo**

- **CA-19:** Si hay error, no crear ni activo ni subasta
- **CA-20:** Activo creado debe quedar en estado `disponible` hasta que la subasta finalice y se registre ganador
- **CA-21:** Tras crear subasta, mostrar detalle con botón **"Registrar Ganador"** (deshabilitado si subasta sigue activa)

---

## **HU-SUB-02 — Listar Subastas**

### **Historia:**

Como **administrador**, quiero ver una lista general de todas las subastas para tener un panorama completo del pipeline de ventas y acceder rápidamente a los detalles de cada una.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Debe mostrar tabla con columnas:
    - **Vehículo** → `marca + modelo + año` (desde `Asset`)
    - **Placa** (desde `Asset`)
    - **Estado** (`activa`, `pendiente`, `finalizada`, `cancelada`, `vencida`, `en_validacion`, `ganada`, `perdida`, `penalizada`)
    - **Fecha Inicio** – **Fecha Fin**
    - **Ganador** (nombre del cliente, solo si `id_offerWin` existe, badge descriptivo "no definido" si no tiene)
    - **Resultado BOB** (solo para estados `ganada/perdida/penalizada`)
    - Al **hacer clic en una fila** de la tabla (o tarjeta en mobile), el sistema debe mandar a Pagina de Detalle de la Subasta
- **CA-02:** Máximo **20 registros por página** con paginación
- **CA-03:** Filtro por estado de subasta (multi-select: activa, pendiente, finalizada, etc.)
- **CA-04:** Búsqueda rápida por **placa**, **marca**, **modelo**

### **Validaciones de Negocio**

- **CA-05:** Solo mostrar subastas no eliminadas (`deleted_at IS NULL`)
- **CA-06:** Ordenar por defecto:
    1. Subastas con estado `pendiente` (prioritarias)
    2. Subastas con estado `activa`
    3. Resto por fecha de creación descendente

### **UI/UX**

- **CA-07:** Estados deben tener colores distintivos:
    - `activa`: verde
    - `pendiente`: amarillo
    - `en_validacion`: celeste
    - `finalizada`: azul
    - `vencida`: naranja
    - `cancelada`: rojo
    - `ganada`: verde oscuro
    - `perdida`: gris
    - `penalizada`: rojo oscuro
- **CA-08:** Botón **"Nueva Subasta"** debe estar visible y destacado
- **CA-09:** Si no hay subastas, mostrar mensaje:
    
    > "No hay subastas registradas. Crea la primera."
    > 
- **CA-10:** En mobile: vista de tarjetas apiladas

### **Estados y Flujo**

- **CA-11:** Click en fila → abrir **HU-SUB-04** (Detalle de Subasta)
- **CA-12:** Actualización automática de la lista cada 5 minutos

---

## **HU-SUB-03 — Registrar Ganador Preliminar de Subasta**

### **Historia**

Como administrador, quiero asignar el ganador preliminar de una subasta finalizada para iniciar el proceso de pago de garantía y cálculo automático del 8%.

---

### **Condiciones Funcionales**

- **CA-01:** Mostrar modal con formulario que incluya:
    - Selección de subasta (solo subastas que pasaron `fecha_fin` y están sin ganador asignado)
    - `user_id` (selección de cliente) *obligatorio*
    - `monto_oferta` (decimal) *obligatorio*
    - `fecha_oferta` (datetime) *obligatorio*
    - **Checkbox “Asignar fecha límite de pago” [Campo Opcional]**
        - Si está marcado → mostrar campo `fecha_limite_pago` (datetime) para definir el plazo.
- **CA-02:** Al guardar:
    - Crear registro en `Offer`:
        - `auction_id`, `user_id`, `monto_oferta`, `fecha_oferta`
        - `posicion_ranking = 1`
        - `fecha_asignacion_ganador = now()`
        - `estado = activa` (pendiente de pago)
    - Actualizar `Auction`:
        - `id_offerWin = offer.id`
        - `estado = pendiente`
        - `fecha_limite_pago = valor ingresado` (si se definió)
    - Calcular `monto_garantia = monto_oferta * 0.08`
    - Cache de saldo se actualiza automáticamente cuando el cliente registre su pago de garantía
    - NO crear Movement aquí - se crea cuando cliente registra pago
    - Crear notificación automática al cliente ganador tipo `ganador_subasta`

---

### **Validaciones de Negocio**

- **VN-01:** Solo mostrar subastas que ya pasaron `fecha_fin` y no tengan `id_offerWin`.
- **VN-02:** No registrar si ya existe una Offer en `posicion_ranking=1` y `estado != perdedora`.
- **VN-03:** `monto_oferta > 0` y `<= 999,999.99`
- **VN-04:** `fecha_oferta` dentro del rango de subasta (`fecha_inicio` ≤ fecha ≤ `fecha_fin`)
- **VN-05:** `user_id` debe existir y ser tipo cliente.


---

### **UI/UX**

- **UX-01:** Mostrar datos clave de subasta seleccionada (activo, fechas, estado).
- **UX-02:** Campo `user_id` con autocomplete.
- **UX-03:** Previsualización de monto de garantía:
    
    > "Monto garantía (8%): $X"
    > 
- **UX-04:** Checkbox de “Asignar fecha límite de pago” → despliega selector de fecha/hora.
- **UX-05:** Mensaje de confirmación antes de guardar.
- **UX-06:** Toast de éxito tras registrar.

---

### **Actualización en Página de Detalle de Subasta**

Al asignar ganador, el **detalle de la subasta** debe mostrar sección de **Ganador Actual**:

- **Ganador actual:** nombre y documento
- **Estado del ganador:** (activa = “En proceso de pago”, ganadora = “Pago validado”)
- **Monto de oferta**
- **Monto de garantía (8%)**
- **Fecha límite de pago** (si existe)
- **Tiempo restante** → badge de alerta si quedan <2h
- **Botón “Reasignar ganador”** → visible solo si la subasta está en `vencida` , funcionalidad vista en **HU-SUB-06 — Reasignar Ganador de Subasta**

---

### **Estados y Flujo**

- Estado inicial de `Offer`: `activa`
- Estado de `Auction`: pasa de `activa` → `pendiente`
- Si paga en plazo → Offer → `ganadora`, Auction → `finalizada`
- Si no paga en plazo → Offer → `perdedora`, Auction → `vencida`, habilita **HU-SUB-06 — Reasignar Ganador de Subasta**.

---

## **HU-SUB-04 — Detalle de Subasta**

### **Historia:**

Como administrador, quiero ver el detalle completo de una subasta específica y acceder a las acciones correspondientes según su estado actual para gestionar eficientemente cada caso.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar información completa organizada en secciones:
    
    **Información General:**
    
    - Datos del vehículo (marca, modelo, año, placa, descripción)
    - Fechas de inicio y fin
    - Estado actual de la subasta
    - Fecha de creación
    
    **Información del Ganador** (solo si `id_offerWin` existe):
    
    - Nombre completo y documento del ganador
    - Monto de la oferta ganadora
    - Monto de garantía calculado (8%)
    - Fecha de asignación como ganador
    - Estado de la oferta (`activa`, `ganadora`, `perdedora`)
    
    **Estado del Pago de garantia** (solo si estado = `pendiente` o estado = `en_validacion`)
    
    - Estado del pago: "No registrado" / "Registrado - Pendiente validación"
    - Fecha límite de pago (si está definida) con contador regresivo
    - Días transcurridos desde asignación de ganador

    **Estado del Pago de garantia** (solo si estado = `vencida` y tiene pago rechazado(Movement asociados con estado `rechazado`))
    - Estado del pago: "Pago rechazado"
    - Motivo de Rechazo: Movement.motivo
    - Fecha de Rechazo: Movement.fecha_resolucion

- **CA-02:** Botones de acción contextuales según estado:
    
    **Si estado = `activa`:**
    
    - "Registrar Ganador" → **HU-SUB-03**
    
    **Si estado = `pendiente`:**
    
    - "Marcar como Vencido" → **HU-VAL-06**
    - "Extender Plazo de Pago" → **HU-VAL-07**
    - "Ver Pago Registrado" → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Si estado = `en_validacion`**
    
    - "Ver Pago Registrado" para que haga la validación → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Si estado = `vencida`:**
    
    - "Reasignar Ganador" → **HU-SUB-06**
    - "Cancelar Subasta" → **HU-SUB-05**
    
    **Si estado = `finalizada`:**
    
    - "Gestionar Resultado Competencia" → **HU-COMP-01 (Nueva HU)**
    - "Ver Pago Registrado" → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Si estado = `ganada`:**
    
    - "Ver Factura Generada" → **HU-BILL-01 (Nueva HU)**
    - "Ver Pago Registrado" → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Si estado = `perdida`:**
    
    - "Ver Reembolso Procesado" → **HU-REEM-01 (Nueva HU)**
    - "Ver Pago Registrado" → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Si estado = `penalizada`:**
    
    - "Ver Penalidad y Reembolso" → **HU-REEM-01 (Nueva HU)**
    - "Ver Pago Registrado" → **HU-VAL-02 — Ver Detalle de Pago (Admin)**
    
    **Todos los estados:**
    
    - "Volver a Lista"

### **Validaciones de Negocio**

- **VN-01:** Verificar que la subasta existe y no está eliminada
- **VN-02:** Recalcular estado del pago en tiempo real basado en existencia de `Movement` tipo `pago_garantia` validado
- **VN-03:** Solo mostrar sección de ganador si `id_offerWin` no es nulo

### **UI/UX**

- **UX-01:** Layout de tarjetas organizadas verticalmente
- **UX-02:** Estado del pago con indicadores visuales claros:
    - Rojo → No registrado
    - Amarillo  →  Registrado - Pendiente validación
- **UX-03:** Contador regresivo visual si hay fecha límite
- **UX-04:** Botones de acción agrupados por contexto
- **UX-05:** Breadcrumb: "Lista de Subastas > [Marca Modelo Año]"

### **Estados y Flujo**

- **EF-01:** Los botones de acción redirigen a las HU correspondientes
- **EF-02:** Al regresar de una acción, actualizar la información automáticamente
- **EF-03:** Si el estado cambió mientras se visualizaba, mostrar notification y actualizar

---

## **REGLAS TRANSVERSALES DEL MÓDULO**

### **Validaciones Globales:**

- Todos los formularios deben validar campos obligatorios antes de envío
- Fechas deben estar en formato válido y zona horaria del sistema
- Montos deben aceptar máximo 2 decimales

### **Manejo de Errores:**

- Errores de validación: mostrar en campo específico
- Errores de servidor: mostrar modal con mensaje técnico
- Timeout de red: mostrar mensaje y opción de reintentar

### **Performance:**

- Queries de listado deben incluir paginación
- Búsquedas de usuarios deben tener debounce de 300ms
- Carga de activos debe ser lazy loading si son más de 100 registros

---