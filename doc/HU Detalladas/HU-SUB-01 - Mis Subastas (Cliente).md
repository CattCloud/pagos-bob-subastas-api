# HU-SUB-01 — Mis Subastas (Cliente)

## **Historia:**

Como **cliente**, quiero acceder a una sección "Subastas" para visualizar únicamente las subastas donde soy ganador, con acceso rápido a los detalles de pago de garantía y facturación según el estado de cada subasta.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Navegación específica** en menú cliente llamada "Subastas"
- **CA-02:** **Visualización filtrada:**
  - Mostrar solo subastas donde el usuario es ganador (posicion_ranking = 1)
  - Lista con información básica: placa, marca, modelo, año, estado, fecha límite de pago
- **CA-03:** **Acciones contextuales por estado:**
  - **Estados finalizada+** (finalizada, ganada, perdida, penalizada, facturada): Botón "Detalle de Pago de Garantía"
  - **Estado ganada**: Botón "Detalle de Facturación" 
- **CA-04:** **Navegación a detalles:**
  - Detalle de Pago → Conecta con Movement de pago_garantia de esa subasta
  - Detalle de Facturación → Conecta con Billing de esa subasta

### **Validaciones de Negocio:**

- **VN-01:** Solo mostrar subastas donde el usuario tiene Guarantee con posicion_ranking = 1
- **VN-02:** Botones contextuales según estado de subasta
- **VN-03:** Verificar permisos de acceso a detalles correspondientes

### **UI/UX:**

- **UX-01:** **Cards de subasta** con información clara del vehículo
- **UX-02:** **Indicadores de estado** visual (badges de color)
- **UX-03:** **Acciones rápidas** prominentes según contexto
- **UX-04:** **Estados vacíos** si no hay subastas ganadas

### **Integración con Sistema:**

- **INT-01:** Usar endpoint existente GET `/users/:userId/won-auctions`
- **INT-02:** Conectar con Movement detail para pago de garantía
- **INT-03:** Conectar con Billing para detalles de facturación

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Estados y Botones:**
- **Todas las subastas finalizadas+**: Botón "Ver Pago de Garantía"
- **Solo estado 'ganada'**: Botón adicional "Ver Facturación"
- **Estados activa/pendiente/en_validacion**: Solo información, sin botones especiales

### **Navegación:**
- Desde "Ver Pago de Garantía" → Modal/página con detalle del Movement
- Desde "Ver Facturación" → Modal/página con detalle del Billing

---