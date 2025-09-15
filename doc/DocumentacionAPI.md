# Documentación API - Sistema BOB Subastas

## **DIAGRAMA DE RECURSOS**

```
RECURSOS PRINCIPALES:
├── Users (Clientes y Admin)
├── Auctions (Subastas)
├── Assets (Vehículos)
├── Offers (Ofertas/Ganadores)
├── GuaranteePayments (Pagos de Garantía)
├── UserBalances (Saldos)
├── Movements (Movimientos)

RELACIONES:
- User → UserBalance (1:1)
- User → Movements (1:N)
- User → GuaranteePayments (1:N)
- Auction → Asset (1:1)
- Auction → Offer (1:N)
- Offer → GuaranteePayment (1:1)
```

---

## **ENDPOINTS Y MÉTODOS**

### **AUTENTICACIÓN / SESIÓN**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `POST` | `/auth/client-login` | Identificar cliente por documento | Cliente |
| `POST` | `/auth/admin-access` | Acceso automático admin | Admin |
| `POST` | `/api/auth/logout` | Cerrar sesión | Ambos |
| `GET` | `/api/auth/session` | Validar sesión activa | Ambos |

### **USUARIOS**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/users/profile` | Obtener datos del usuario actual | Cliente |
| `GET` | `/users/:id` | Obtener datos de usuario específico | Admin |
| `GET` | `/users` | Listar todos los usuarios | Admin |
| `POST` | `/users` | Crear nuevo usuario | Admin |

### **SUBASTAS**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/auctions` | Listar subastas con filtros | Admin |
| `GET` | `/auctions/:id` | Detalle de subasta específica | Admin |
| `POST` | `/auctions` | Crear nueva subasta + activo | Admin |
| `PATCH` | `/auctions/:id/status` | Cambiar estado de subasta | Admin |
| `PATCH` | `/auctions/:id/extend-deadline` | Extender plazo de pago | Admin |
| `DELETE` | `/auctions/:id` | Eliminar subasta | Admin |

### **OFERTAS/GANADORES**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `POST` | `/auctions/:id/winner` | Registrar ganador de subasta | Admin |
| `POST` | `/auctions/:id/reassign-winner` | Reasignar ganador | Admin |
| `GET` | `/users/:id/won-auctions` | Subastas ganadas por cliente | Cliente |

### **PAGOS DE GARANTÍA**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/guarantee-payments` | Listar pagos (admin: todos, cliente: propios) | Ambos |
| `GET` | `/guarantee-payments/:id` | Detalle de pago específico | Ambos |
| `POST` | `/guarantee-payments` | Registrar nuevo pago de garantía | Cliente |
| `PATCH` | `/guarantee-payments/:id/approve` | Aprobar pago | Admin |
| `PATCH` | `/guarantee-payments/:id/reject` | Rechazar pago | Admin |
| `GET` | `/guarantee-payments/:id/voucher` | Descargar comprobante | Ambos |

### **SALDOS Y MOVIMIENTOS**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/users/:id/balance` | Obtener saldo de usuario | Ambos |
| `GET` | `/users/:id/movements` | Historial de movimientos | Ambos |
| `GET` | `/balances/summary` | Resumen de todos los saldos | Admin |


---

## **REQUEST Y RESPONSE (CONTRATOS)**

### ** AUTENTICACIÓN**

#### **POST /api/auth/client-login**

**Request:**
```json
{
  "document_type": "DNI", // DNI, CE, RUC, Pasaporte
  "document_number": "12345678" // String, obligatorio
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "first_name": "Juan",
      "last_name": "Pérez",
      "document_type": "DNI",
      "document_number": "12345678",
      "phone_number": "+51987654321"
    },
    "session": {
      "expires_at": "2024-01-01T15:00:00Z",
      "session_id": "abc123"
    }
  },
  "message": "Sesión iniciada exitosamente"
}
```

**Response Error (404):**
```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No se encontró ningún cliente registrado con estos datos"
  }
}
```

### **SUBASTAS**

#### **POST /api/auctions**

**Request:**
```json
{
  "fecha_inicio": "2024-01-15T10:00:00Z", 
  "fecha_fin": "2024-01-20T18:00:00Z", 
  "asset": {
    "placa": "ABC-123", // String, obligatorio, único
    "empresa_propietaria": "Empresa S.A.", // String, obligatorio
    "marca": "Toyota", // String, obligatorio
    "modelo": "Corolla", // String, obligatorio
    "año": 2020, // Number, obligatorio, >= 1990
    "descripcion": "Vehículo en excelente estado" // String, opcional
  }
}
```

**Response Success (201):**
```json
{
  "success": true,
  "data": {
    "auction": {
      "id": 1,
      "fecha_inicio": "2024-01-15T10:00:00Z",
      "fecha_fin": "2024-01-20T18:00:00Z",
      "fecha_limite_pago": null,
      "estado": "activa",
      "id_offerWin": null,
      "asset": {
        "id": 1,
        "placa": "ABC-123",
        "marca": "Toyota",
        "modelo": "Corolla",
        "año": 2020,
        "empresa_propietaria": "Empresa S.A."
      },
      "created_at": "2024-01-01T12:00:00Z"
    }
  },
  "message": "Subasta creada exitosamente"
}
```

#### **GET /api/auctions**

**Query Parameters:**
```
?estado=pendiente,activa          // Filtrar por estados
&search=Toyota                    // Buscar por marca/modelo/placa
&page=1                          // Paginación
&limit=20                        // Registros por página
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "auctions": [
      {
        "id": 1,
        "asset": {
          "marca": "Toyota",
          "modelo": "Corolla",
          "año": 2020,
          "placa": "ABC-123"
        },
        "estado": "pendiente",
        "fecha_inicio": "2024-01-15T10:00:00Z",
        "fecha_fin": "2024-01-20T18:00:00Z",
        "winner": {
          "name": "Juan Pérez",
          "document": "DNI 12345678"
        } // Solo si tiene ganador
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3
    }
  }
}
```

### **GANADORES**

#### **POST /api/auctions/:id/winner**

**Request:**
```json
{
  "user_id": 5, // ID del cliente ganador, obligatorio
  "monto_oferta": 12000.00, // Decimal, obligatorio, > 0
  "fecha_oferta": "2024-01-18T14:30:00Z", // ISO 8601, obligatorio
  "fecha_limite_pago": "2024-01-21T10:00:00Z" // ISO 8601, opcional
}
```

**Response Success (201):**
```json
{
  "success": true,
  "data": {
    "offer": {
      "id": 1,
      "user_id": 5,
      "auction_id": 1,
      "monto_oferta": 12000.00,
      "monto_garantia": 960.00, // Calculado automáticamente (8%)
      "posicion_ranking": 1,
      "estado": "activa",
      "fecha_asignacion_ganador": "2024-01-21T12:00:00Z"
    },
    "auction_updated": {
      "id": 1,
      "estado": "pendiente",
      "fecha_limite_pago": "2024-01-21T10:00:00Z"
    }
  },
  "message": "Ganador asignado exitosamente"
}
```

### **PAGOS DE GARANTÍA**

#### **POST /api/guarantee-payments**

**Request (Multipart Form Data):**
```json
{
  "auction_id": 1, // ID de subasta, obligatorio
  "monto_garantia": 960.00, // Decimal, obligatorio
  "tipo_pago": "transferencia", // "deposito" | "transferencia"
  "numero_cuenta_origen": "1234567890123456", // String, obligatorio
  "fecha_pago": "2024-01-21T09:30:00Z", // ISO 8601, obligatorio
  "billing_document_type": "RUC", // String, obligatorio
  "billing_name": "Empresa Cliente S.A.", // String, obligatorio
  "comentarios": "Transferencia realizada desde BCP", // String, opcional
  "voucher": "file" // File upload, obligatorio (PDF/JPG/PNG, max 5MB)
}
```

**Response Success (201):**
```json
{
  "success": true,
  "data": {
    "guarantee_payment": {
      "id": 1,
      "auction_id": 1,
      "user_id": 5,
      "monto_garantia": 960.00,
      "estado": "pendiente",
      "voucher_url": "https://res.cloudinary.com/bob/image/upload/v123/voucher_1.pdf",
      "created_at": "2024-01-21T09:45:00Z"
    },
    "balance_updated": {
      "saldo_total": 960.00,
      "saldo_retenido": 960.00,
      "saldo_disponible": 0.00
    },
    "auction_updated": {
      "estado": "en_validacion"
    }
  },
  "message": "Pago de garantía registrado exitosamente"
}
```

#### **PATCH /api/guarantee-payments/:id/approve**

**Request:**
```json
{
  "comentarios": "Pago verificado en cuenta bancaria" // String, opcional
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "guarantee_payment": {
      "id": 1,
      "estado": "validado",
      "fecha_resolucion": "2024-01-21T11:00:00Z"
    },
    "balance_updated": {
      "saldo_retenido": 0.00,
      "saldo_aplicado": 960.00
    },
    "auction_updated": {
      "estado": "finalizada"
    }
  },
  "message": "Pago de garantía aprobado exitosamente"
}
```

#### **PATCH /api/guarantee-payments/:id/reject**

**Request:**
```json
{
  "motivos": [
    "Monto incorrecto",
    "Comprobante ilegible"
  ], // Array, al menos uno
  "otros_motivos": "El monto no coincide con el 8%", // String, opcional
  "comentarios": "Revisar cálculo" // String, opcional
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "guarantee_payment": {
      "id": 1,
      "estado": "rechazado",
      "motivo_rechazo": "Monto incorrecto, El monto no coincide con el 8%",
      "fecha_resolucion": "2024-01-21T11:30:00Z"
    },
    "balance_updated": {
      "saldo_retenido": 0.00
    },
    "auction_updated": {
      "estado": "pendiente"
    }
  },
  "message": "Pago de garantía rechazado"
}
```

### **SALDOS**

#### **GET /api/users/:id/balance**

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "balance": {
      "user_id": 5,
      "saldo_total": 2400.00,
      "saldo_retenido": 960.00,
      "saldo_aplicado": 1200.00,
      "saldo_en_reembolso": 240.00,
      "saldo_penalizado": 0.00,
      "saldo_disponible": 0.00, // Calculado
      "updated_at": "2024-01-21T12:00:00Z"
    }
  }
}
```

#### **GET /api/users/:id/movements**

**Query Parameters:**
```
?tipo=pago_registrado,garantia_validada    // Filtrar por tipos
&fecha_desde=2024-01-01                    // Filtrar por fecha
&fecha_hasta=2024-01-31
&page=1
&limit=20
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "id": 1,
        "tipo_movimiento": "pago_registrado",
        "monto": 960.00,
        "descripcion": "Pago de garantía de $960 registrado - Pendiente de validación",
        "reference_type": "pago",
        "reference_id": 1,
        "created_at": "2024-01-21T09:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8
    }
  }
}
```

---

## **REGLAS DE NEGOCIO**

### **AUTENTICACIÓN Y SESIONES**

1. **Cliente**: Solo puede acceder con `document_type` + `document_number` válidos en BD
2. **Admin**: Acceso automático sin validación (único admin registrado)
3. **Sesión**: Expira después de 1 hora de inactividad
4. **Renovación**: Cada request válido renueva el timer de sesión

### **SUBASTAS**

1. **Creación**: Solo admin puede crear subastas
2. **Fecha inicio**: Debe ser mayor a fecha/hora actual
3. **Fecha fin**: Debe ser mayor a fecha inicio
4. **Placa única**: No puede existir otra subasta activa con la misma placa
5. **Estados válidos**: `activa` → `pendiente` → `en_validacion` → `finalizada`
6. **Eliminación**: Solo si no tiene ofertas asociadas

### **GANADORES**

1. **Asignación**: Solo en subastas con estado `activa`
2. **Usuario válido**: Debe existir y ser tipo `client`
3. **Monto oferta**: Debe ser > 0 y <= 999,999.99
4. **Fecha oferta**: Debe estar entre `fecha_inicio` y `fecha_fin` de subasta
5. **Garantía**: Se calcula automáticamente como 8% de monto_oferta

### **PAGOS DE GARANTÍA**

1. **Registro**: Solo ganadores actuales de subastas en estado `pendiente`
2. **Monto exacto**: Debe coincidir exactamente con el 8% calculado
3. **Fecha pago**: No puede ser futura ni anterior a fecha inicio de subasta
4. **Archivo**: PDF/JPG/PNG, máximo 5MB
5. **Actualización inmediata**: Al registrar → `saldo_total ↑`, `saldo_retenido ↑`
6. **Estado subasta**: `pendiente` → `en_validacion`

### **VALIDACIÓN DE PAGOS**

1. **Solo admin**: Puede aprobar o rechazar pagos
2. **Estado válido**: Solo pagos en estado `pendiente`
3. **Aprobación**: `saldo_retenido ↓`, `saldo_aplicado ↑`, subasta → `finalizada`
4. **Rechazo**: `saldo_retenido ↓`, subasta → `pendiente`
5. **Archivo**: Se mantiene para auditoría incluso si se rechaza

### **VENCIMIENTOS**

1. **Manual**: Admin puede marcar como vencido en cualquier momento
2. **Automático**: Si existe `fecha_limite_pago` y se supera
3. **Penalidad**: Máximo 30% del saldo disponible
4. **Reasignación**: Automática al siguiente postor si existe

### **SALDOS**

1. **Cálculo disponible**: `total - retenido - aplicado - en_reembolso - penalizado`
2. **No negativos**: El saldo disponible nunca puede ser negativo
3. **Múltiples retenciones**: Cliente puede tener varios pagos retenidos simultáneamente


---

## 🔹 **MANEJO DE ERRORES Y CÓDIGOS DE ESTADO**

### **CÓDIGOS DE ÉXITO**

| Código | Uso | Descripción |
|--------|-----|-------------|
| `200 OK` | GET, PATCH | Operación exitosa |
| `201 Created` | POST | Recurso creado exitosamente |
| `204 No Content` | DELETE | Eliminación exitosa |

### **CÓDIGOS DE ERROR**

| Código | Uso | Descripción |
|--------|-----|-------------|
| `400 Bad Request` | Datos inválidos | Request mal formado o datos incorrectos |
| `401 Unauthorized` | Sin sesión | Usuario no autenticado |
| `403 Forbidden` | Sin permisos | Usuario sin permisos para la acción |
| `404 Not Found` | Recurso inexistente | Recurso no encontrado |
| `409 Conflict` | Conflicto de estado | Estado inválido para la operación |
| `422 Unprocessable Entity` | Validación fallida | Datos correctos pero reglas de negocio no cumplidas |
| `500 Internal Server Error` | Error servidor | Error interno del sistema |

### **ESTRUCTURA DE ERROR ESTÁNDAR**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR", // Código único del error
    "message": "El monto debe coincidir exactamente con el 8%", // Mensaje amigable
    "isOperationa": true //Para validar que sea un error personalizado
    "details": { // Detalles adicionales (opcional)
      "field": "monto_garantia",
      "expected": 960.00,
      "received": 950.00
    },
    "timestamp": "2024-01-21T12:00:00Z"
  }
}
```

### **📋 CÓDIGOS DE ERROR ESPECÍFICOS**

#### **Autenticación:**
- `USER_NOT_FOUND` - Usuario no existe en BD
- `SESSION_EXPIRED` - Sesión expirada
- `INVALID_DOCUMENT` - Formato de documento inválido

#### **Subastas:**
- `AUCTION_NOT_FOUND` - Subasta no existe
- `INVALID_AUCTION_STATE` - Estado de subasta no válido para operación
- `DUPLICATE_PLATE` - Placa ya existe en subasta activa
- `INVALID_DATES` - Fechas de subasta inválidas

#### **Pagos:**
- `PAYMENT_NOT_FOUND` - Pago no existe
- `INVALID_AMOUNT` - Monto no coincide con garantía calculada
- `ALREADY_PROCESSED` - Pago ya fue procesado
- `INVALID_FILE_TYPE` - Tipo de archivo no permitido
- `FILE_TOO_LARGE` - Archivo excede límite de tamaño

#### **Saldos:**
- `INSUFFICIENT_BALANCE` - Saldo insuficiente para operación
- `BALANCE_CALCULATION_ERROR` - Error en cálculo de saldos


---
