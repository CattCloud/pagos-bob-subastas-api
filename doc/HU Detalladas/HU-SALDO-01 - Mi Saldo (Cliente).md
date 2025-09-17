# HU-SALDO-01 — Mi Saldo (Cliente)

## **Historia:**

Como **cliente**, quiero consultar mi saldo actual calculado en tiempo real desde mis transacciones para saber cuánto dinero tengo disponible en el sistema y entender cómo se compone.

---

## **Criterios de Aceptación**

### **Condiciones Funcionales:**

- **CA-01:** **Acceso desde menú cliente:** "Mi Saldo" (pantalla dedicada)
- **CA-02:** **Mostrar saldo disponible destacado:**
    - Monto principal grande y visible: "$X,XXX.XX USD"
    - Estado: "Disponible para nuevas garantías"
    - Fecha de última actualización
- **CA-03:** **Desglose del cálculo mostrado claramente:**
    ```
    SALDO DISPONIBLE = SALDO TOTAL - SALDO RETENIDO - SALDO APLICADO
    
    🔵 Saldo Total: $X,XXX.XX
        (Todo el dinero que ha ingresado menos las salidas)
    
    🟡 Saldo Retenido: $XXX.XX  
        (Dinero temporalmente congelado en procesos)
    
    🟢 Saldo Aplicado: $XXX.XX
        (Dinero ya utilizado en compras de vehículos)
    
    = Saldo Disponible: $X,XXX.XX
    ```
- **CA-04:** **Información adicional:**
    - Número total de transacciones realizadas
    - Última transacción (fecha y tipo)
    - Enlaces rápidos a "Historial" y "Solicitar Reembolso"

---

### **Validaciones de Negocio:**

- **VN-01:** Calcular saldo en tiempo real usando cache de `User.saldo_total` y `User.saldo_retenido`
- **VN-02:** Calcular saldo aplicado sumando registros `Billing` del cliente
- **VN-03:** Validar que cliente tiene sesión activa
- **VN-04:** Verificar consistencia entre cache y cálculo real - mostrar advertencia si hay diferencias

---

### **UI/UX:**

- **UX-01:** **Diseño tipo dashboard financiero:**
    - Saldo disponible como elemento principal
    - Desglose en tarjetas visuales con colores distintivos
    - Gráfico simple (dona/barras) mostrando distribución
- **UX-02:** **Información contextual:**
    - Tooltip explicando cada componente del saldo
    - Mensaje si saldo es 0: "No tiene saldo disponible actualmente"
    - Advertencia si hay saldo retenido: "Tiene $XXX en procesos pendientes"
- **UX-03:** **Acciones rápidas:**
    - "Ver Historial Completo" → **HU-TRANS-01**
    - "Solicitar Reembolso" → **HU-REEM-01** (si saldo > 0)
    - "Pagar Nueva Garantía" → **HU-PAG-01**
- **UX-04:** **Responsive:**
    - Desktop: layout horizontal con desglose al lado
    - Mobile: stack vertical con saldo principal arriba

---

### **Estados y Flujo:**

- **EF-01:** **Actualización automática:** Datos se refrescan cada vez que se carga
- **EF-02:** **Navegación directa:** Enlaces a módulos relacionados
- **EF-03:** **Estado persistente:** Mantener información mientras navega

---

### **Información Calculada en Tiempo Real:**

```sql
-- Consulta para calcular saldo completo
SELECT 
    u.saldo_total,
    u.saldo_retenido,
    COALESCE(SUM(b.monto), 0) as saldo_aplicado,
    (u.saldo_total - u.saldo_retenido - COALESCE(SUM(b.monto), 0)) as saldo_disponible,
    COUNT(m.id) as total_transacciones,
    MAX(m.created_at) as ultima_transaccion
FROM User u
LEFT JOIN Billing b ON u.id = b.user_id
LEFT JOIN Movement m ON u.id = m.user_id AND m.estado = 'validado'
WHERE u.id = [client_user_id]
GROUP BY u.id
```

---

### **Casos de Visualización:**

### **Cliente con saldo positivo:**
```
💰 SALDO DISPONIBLE: $1,240.00 USD

📊 DESGLOSE:
🔵 Total ingresado: $2,000.00
🟡 En procesos: $0.00  
🟢 Ya utilizado: $760.00
= Disponible: $1,240.00

📈 RESUMEN:
• 5 transacciones realizadas
• Última actividad: hace 2 días
```

### **Cliente sin saldo:**
```
💰 SALDO DISPONIBLE: $0.00 USD

📊 Su cuenta no tiene fondos disponibles

💡 ACCIONES:
• Ver historial de transacciones
• Participar en nuevas subastas
```

---

## **REGLAS ESPECÍFICAS DEL MÓDULO**

### **Performance:**
- Uso de campos cache para cálculos rápidos
- Consulta optimizada con JOINs mínimos
- Actualización en tiempo real sin retrasos

### **Transparencia:**
- Desglose completo y comprensible
- Explicación clara de cada componente
- Acceso directo a información detallada

### **Usabilidad:**
- Dashboard simple e intuitivo
- Información más relevante destacada
- Navegación fluida a módulos relacionados

---