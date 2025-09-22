# HU-SALDO-02 — Gestión de Saldos (Admin)

## **Historia:**

Como **administrador**, quiero acceder a una sección "Gestión de Saldos" para visualizar una lista de todos los clientes con sus respectivos saldos, facilitando el monitoreo y supervisión del estado financiero de los usuarios.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Navegación específica** en menú admin llamada "Gestión de Saldos"
- **CA-02:** **Lista de clientes con saldos:**
  - Todos los usuarios tipo 'client'
  - Información por cliente: nombre, documento, saldo_total, saldo_retenido, saldo_disponible
  - Cálculo automático: saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado
- **CA-03:** **Información organizada en tabla:**
  - Columnas: Cliente, Documento, Saldo Total, Saldo Retenido, Saldo Disponible, Última Actualización
  - Ordenamiento por defecto: alfabético por nombre
  - Paginación estándar (20 por página)
- **CA-04:** **Filtros básicos:**
  - Búsqueda por nombre o documento
  - Filtro por rangos de saldo (opcional)

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar usuarios con user_type = 'client'
- **VN-02:** Verificar permisos de admin para acceder a la información
- **VN-03:** Mostrar saldos actualizados (no cache desactualizado)

### **UI/UX:**

- **UX-01:** **Tabla clara** con información financiera bien organizada
- **UX-02:** **Indicadores visuales** para saldos negativos o alertas
- **UX-03:** **Formato de moneda** consistente (USD con 2 decimales)
- **UX-04:** **Búsqueda responsiva** con filtrado en tiempo real

### **Estados y Flujo:**

- **EF-01:** **Carga inicial:** Lista completa de clientes con saldos
- **EF-02:** **Estados vacíos:** Mensaje si no hay clientes registrados
- **EF-03:** **Actualización:** Refresh manual o automático de datos

### **Integración con Sistema:**

- **INT-01:** Consumir endpoint de listado de usuarios con saldos
- **INT-02:** Aplicar cálculos de saldo disponible en frontend o backend
- **INT-03:** Enlaces futuros a detalle de cliente (expansión posterior)

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Solo Visualización:**
- Esta versión inicial es **solo de consulta**
- Sin acciones de edición o ajuste de saldos
- Sin navegación a detalles (se agregará en futuras iteraciones)

### **Datos Mostrados:**
- **Cliente**: Nombre completo (first_name + last_name)
- **Documento**: Tipo + Número (ej: "DNI 12345678")
- **Saldo Total**: Monto total acumulado
- **Saldo Retenido**: Monto bloqueado por garantías/solicitudes
- **Saldo Disponible**: Total - Retenido - Aplicado
- **Última Actualización**: Timestamp de updated_at del usuario

### **Performance:**
- Carga eficiente para listas grandes
- Paginación del lado servidor
- Búsqueda optimizada

---