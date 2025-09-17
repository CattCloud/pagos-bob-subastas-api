# HU - Identificación de Cliente

## **HU-ID-01 — Pantalla de Acceso Cliente**

### **Historia**

Como cliente, quiero acceder al sistema de pagos ingresando mis datos de identificación para consultar y gestionar mis pagos de garantía y saldos.

---

### **Criterios de Aceptación**

### **Condiciones Funcionales**

- **CA-01:** Mostrar formulario con campos:
    - `document_type` (selector: DNI, CE, RUC, Pasaporte) *obligatorio*
    - `document_number` (texto) *obligatorio*
    - Botón **"Acceder al Sistema"**
- **CA-02:** Botón deshabilitado hasta completar ambos campos y validar formato.
- **CA-03:** Al enviar formulario válido:
    - Buscar usuario en BD donde `document_type` y `document_number` coincidan
    - Si existe:
        - Crear sesión temporal (LocalStorage, expira luego de 1 hora)
        - Redirigir a pantalla de **Pago de Garantía**
    - Si no existe: mostrar mensaje de error específico
- **CA-04:** Mostrar texto explicativo:
    
    > "Ingrese sus datos para acceder a la gestión de pagos de garantía y consulta de saldos"
    > 

---

### **Validaciones de Negocio**

- **VN-01:** `document_number` debe cumplir formato según tipo:
    - DNI: 8 dígitos exactos
    - CE: 9 dígitos exactos
    - RUC: 11 dígitos exactos
    - Pasaporte: alfanumérico, 6–12 caracteres
- **VN-02:** Solo permitir acceso a usuarios con `user_type = client`
- **VN-03:** Registrar en logs cada intento de acceso (fecha/hora, documento, resultado)

---

### **UI/UX**

- **UX-01:** Diseño limpio y centrado con logo de BOB Subastas
- **UX-02:** Placeholder específicos por tipo de documento
- **UX-03:** Loading state (splash o spinner) mientras se valida
- **UX-04:** Auto-focus en el primer campo al cargar
- **UX-05:** Permitir envío con tecla **Enter**
- **UX-06:** Diseño responsive (mobile-first)

---

### **Estados y Flujo**

- **EF-01:** Error por usuario no encontrado:
    
    > "No se encontró ningún cliente registrado con estos datos. Verifique la información o contacte a BOB Subastas."
    > 
- **EF-02:** Error por formato inválido: marcar campo en rojo y mostrar mensaje inline.
- **EF-03:** Éxito: redirigir automáticamente a pantalla de pago.

---

## **HU-ID-02 — Validación y Carga de Datos Cliente**

### **Historia**

Como sistema, quiero validar la identidad del cliente y cargar la información mínima necesaria para que pueda proceder con el pago de garantía.

### **Criterios de Aceptación**

- **CA-01:** Si validación es exitosa, guardar en sesión:
    - `id`, `first_name`, `last_name`, `document_type`, `document_number`,`phone_number`
    - Información de saldo desde campos cache `User.saldo_total` y `User.saldo_retenido`
- **CA-02:** Si los campos cache están en NULL, inicializarlos mediante función del backend
- **CA-03:** Calcular `saldo_disponible` en tiempo real usando la nueva fórmula:

```
Saldo Disponible = SALDO TOTAL - SALDO RETENIDO - SALDO APLICADO

Donde:
- SALDO TOTAL = User.saldo_total (cache desde Movement validados)
- SALDO RETENIDO = User.saldo_retenido (cache desde estados de subasta)
- SALDO APLICADO = Suma de registros en Billing del cliente
```

- **CA-04:** No cargar Movement ni subastas completas en esta fase - solo campos cache
- **CA-05:** Si hay inconsistencias en cache vs cálculo real, mostrar advertencia pero permitir continuar
- **CA-06:** Los campos cache se actualizan INMEDIATAMENTE vía lógica de aplicación cuando ocurren transacciones

### **UI/UX**

- Mostrar spinner con: **"Validando identidad..."**
- Si demora >3s: **"Verificando información de su cuenta..."**
- Si falla (>10s): **"Error al cargar datos. Intente nuevamente."**

### **Flujo**

- **Exitoso:** Redirigir directamente a pantalla de **Pago de Garantía**
- **Error crítico:** Volver a identificación con mensaje:
    
    > "No fue posible validar su identidad. Intente nuevamente."
    > 

---

## **HU-ID-03 — Gestión de Sesión Cliente**

### **Historia:**

Como sistema, quiero mantener la sesión del cliente de forma segura y permitir que navegue entre módulos sin re-identificarse, pero con límites de tiempo apropiados.

### **Criterios de Aceptación:**

### **Condiciones Funcionales:**

- **CA-01:** Sesión debe durar 1 hora desde última actividad
- **CA-02:** Cada acción del usuario debe renovar el timer de sesión
- **CA-03:** Debe mostrar warning 5 minutos antes de expiración:
    
    > "Su sesión expirará en 5 minutos. ¿Desea continuar?"
    > 
- **CA-04:** Incluir botón "Cerrar Sesión" visible en todas las pantallas cliente
- **CA-05:** Al cerrar sesión, limpiar todos los datos almacenados localmente

### **Validaciones de Negocio:**

- **CA-06:** No almacenar datos financieros sensibles en localStorage
- **CA-07:** Solo mantener en sesión: `user_id`, `document_number`, `timestamp`, `saldo_disponible_cache`
- **CA-08:** Validar sesión en cada navegación entre módulos
- **CA-09:** Si sesión inválida, redirigir automáticamente a identificación
- **CA-10:** Refrescar saldo_disponible_cache cada vez que se carga una página crítica

### **UI/UX:**

- **CA-10:** Header con información básica: "Bienvenido, [nombre] ([documento])"
- **CA-11:** Warning de expiración debe ser modal no intrusivo
- **CA-12:** Botón "Cerrar Sesión" estilo secundario, ubicado en esquina superior
- **CA-13:** Confirmación de cierre: "¿Está seguro que desea cerrar sesión?"

### **Estados y Flujo:**

- **CA-14:** Expiración automática: limpiar sesión y redirigir con mensaje:
    
    > "Su sesión ha expirado por seguridad. Por favor, ingrese nuevamente."
    > 
- **CA-15:** Cierre manual: redirigir a identificación con mensaje:
    
    > "Sesión cerrada exitosamente."
    >