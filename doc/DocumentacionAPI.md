# Documentación API - Sistema BOB Subastas

## **DIAGRAMA DE RECURSOS**

```
RECURSOS PRINCIPALES:
├── Users (Clientes y Admin)
├── Auctions (Subastas)
├── Assets (Vehículos)
├── Offers (Ofertas/Ganadores)
├── Movement (Transacciones centrales)
├── Movement_References (Referencias genéricas)
├── Billing (Facturación/Saldo aplicado)
├── Refund (Solicitudes de reembolso)
├── Notifications (Notificaciones del sistema)

RELACIONES:
- User → Movement (1:N)
- User → Billing (1:N)
- User → Refund (1:N)
- User → Notifications (1:N)
- Auction → Asset (1:1)
- Auction → Offer (1:N)
- Movement → Movement_References (1:N)
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

### **TRANSACCIONES (MOVEMENT)**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/movements` | Listar transacciones (admin: todos, cliente: propios) | Ambos |
| `GET` | `/movements/:id` | Detalle de transacción específica | Ambos |
| `POST` | `/movements` | Registrar nuevo pago de garantía | Cliente |
| `PATCH` | `/movements/:id/approve` | Aprobar transacción | Admin |
| `PATCH` | `/movements/:id/reject` | Rechazar transacción | Admin |
| `GET` | `/movements/:id/voucher` | Descargar comprobante | Ambos |

### **COMPETENCIA EXTERNA**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `PATCH` | `/auctions/:id/competition-result` | Registrar resultado competencia BOB | Admin |

### **FACTURACIÓN**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `POST` | `/billing` | Completar datos de facturación para subasta ganada | Cliente |

#### POST /billing

Request (JSON):
```json
{
  "auction_id": "cmxxxx...",
  "billing_document_type": "DNI",
  "billing_document_number": "12345678",
  "billing_name": "Juan Carlos"
}
```

Response Success (201):
```json
{
  "success": true,
  "data": {
    "billing": {
      "id": "cmxxxx...",
      "monto": 960.0,
      "moneda": "USD",
      "concepto": "Compra vehículo Toyota Yaris 2020 - Subasta #123",
      "created_at": "2024-01-21T12:00:00Z"
    },
    "auction_updated": {
      "id": "cmxxxx...",
      "estado": "facturada"
    }
  },
  "message": "Facturación completada exitosamente"
}
```

Notas:
- Reglas: subasta debe estar en estado ganada; cliente debe ser el ganador.
- Efecto: cambia Auction.estado a facturada y recalcula cache de saldo_retenido (pasa a 0).
- Notificaciones: se generan para cliente (facturacion_completada) y admin (billing_generado).

### **REEMBOLSOS**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `POST` | `/refunds` | Crear solicitud de reembolso | Cliente |
| `PATCH` | `/refunds/:id/manage` | Confirmar o rechazar solicitud | Admin |
| `PATCH` | `/refunds/:id/process` | Procesar reembolso confirmado | Admin |

#### POST /refunds
Request (JSON):
```json
{
  "auction_id": "cmxxxx...",
  "monto_solicitado": 150.0,
  "tipo_reembolso": "devolver_dinero",
  "motivo": "No se ganó la competencia externa"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "cmxxxx...",
      "user_id": "cmuser...",
      "monto_solicitado": "150",
      "tipo_reembolso": "devolver_dinero",
      "estado": "solicitado",
      "fecha_solicitud": "2024-01-21T12:00:00Z"
    }
  },
  "message": "Solicitud de reembolso creada exitosamente"
}
```

#### PATCH /refunds/:id/manage
Request (JSON):
```json
{ "estado": "confirmado", "motivo": "Llamada ok" }
```
- estado: "confirmado" | "rechazado"

Response (200):
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "cmxxxx...",
      "estado": "confirmado",
      "fecha_respuesta_empresa": "2024-01-21T12:10:00Z"
    }
  },
  "message": "Solicitud de reembolso confirmado"
}
```

#### PATCH /refunds/:id/process
- Caso mantener_saldo (JSON, sin archivo):
```json
{}
```

- Caso devolver_dinero (multipart/form-data):
```
tipo_transferencia=transferencia
numero_operacion=OP-ABC12345
voucher=(file opcional: JPG/PNG/PDF)
```

Response (200):
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "cmxxxx...",
      "estado": "procesado",
      "fecha_procesamiento": "2024-01-21T12:20:00Z"
    },
    "movement": {
      "id": "cmov...",
      "tipo_movimiento_general": "salida",
      "tipo_movimiento_especifico": "reembolso",
      "monto": "150",
      "estado": "validado",
      "created_at": "2024-01-21T12:19:00Z"
    }
  },
  "message": "Reembolso procesado correctamente"
}
```

Notas:
- El Movement se crea al procesar, no al solicitar.
- Se recalculan automáticamente los caches de saldo_total y saldo_retenido.

### **NOTIFICACIONES**

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| `GET` | `/notifications` | Listar notificaciones (admin: global con filtros; cliente: propias) | Ambos |
| `PATCH` | `/notifications/mark-all-read` | Marcar todas las notificaciones del usuario como leídas | Ambos |
| `PATCH` | `/notifications/:id/read` | Marcar una notificación específica como leída | Ambos |

#### GET /notifications
Query params:
- estado, tipo, fecha_desde, fecha_hasta, page, limit
- admin: user_id (opcional), search (titulo/mensaje)

Response (200):
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "cmnotif...",
        "user_id": "cmuser...",
        "tipo": "pago_validado",
        "titulo": "Pago de garantía aprobado",
        "mensaje": "Tu pago de garantía fue validado...",
        "estado": "pendiente",
        "email_status": "enviado",
        "reference_type": "movement",
        "reference_id": "cmov...",
        "created_at": "2024-01-21T12:00:00Z",
        "email_sent_at": "2024-01-21T12:01:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 35, "total_pages": 2 }
  }
}
```

#### PATCH /notifications/mark-all-read
Response (200):
```json
{ "success": true, "data": { "updated": 7 }, "message": "Notificaciones marcadas como leídas" }
```

#### PATCH /notifications/:id/read
Response (200):
```json
{
  "success": true,
  "data": { "notification": { "id": "cmnotif...", "estado": "vista", "fecha_vista": "2024-01-21T12:05:00Z" } },
  "message": "Notificación marcada como leída"
}
```

Notas:
- Envío de email es best-effort y no bloquea la transacción.
- Campo email_status: pendiente | enviado | fallido.

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

#### **POST /api/movements**

**Request (Multipart Form Data):**
```json
{
  "auction_id": 1, // ID de subasta, obligatorio
  "monto": 960.00, // Decimal, obligatorio (monto exacto transferido)
  "tipo_pago": "transferencia", // "deposito" | "transferencia"
  "numero_cuenta_origen": "1234567890123456", // String, obligatorio
  "numero_operacion": "OP123456789", // String, obligatorio
  "fecha_pago": "2024-01-21T09:30:00Z", // ISO 8601, obligatorio
  "moneda": "USD", // String, por defecto USD
  "concepto": "Pago garantía subasta Toyota Corolla", // String, opcional
  "voucher": "file" // File upload, obligatorio (PDF/JPG/PNG, max 5MB)
}
```

**Response Success (201):**
```json
{
  "success": true,
  "data": {
    "movement": {
      "id": 1,
      "auction_id": 1,
      "user_id": 5,
      "tipo_movimiento_general": "entrada",
      "tipo_movimiento_especifico": "pago_garantia",
      "monto": 960.00,
      "estado": "pendiente",
      "voucher_url": "https://res.cloudinary.com/bob/image/upload/v123/voucher_1.pdf",
      "created_at": "2024-01-21T09:45:00Z"
    },
    "user_cache_updated": {
      "saldo_total": 960.00,
      "saldo_retenido": 960.00,
      "saldo_disponible": 0.00
    },
    "auction_updated": {
      "estado": "en_validacion"
    },
    "notification_sent": {
      "client": "pago_registrado",
      "admin": "pago_registrado"
    }
  },
  "message": "Transacción registrada exitosamente"
}
```

#### **PATCH /api/movements/:id/approve**

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
    "movement": {
      "id": 1,
      "estado": "validado",
      "fecha_resolucion": "2024-01-21T11:00:00Z"
    },
    "user_cache_updated": {
      "saldo_total": 2000.00,
      "saldo_retenido": 0.00
    },
    "auction_updated": {
      "estado": "finalizada"
    }
  },
  "message": "Transacción aprobada exitosamente"
}
```

#### **PATCH /api/movements/:id/reject**

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
    "movement": {
      "id": 1,
      "estado": "rechazado",
      "motivo_rechazo": "Monto incorrecto, El monto no coincide con el 8%",
      "fecha_resolucion": "2024-01-21T11:30:00Z"
    },
    "user_cache_updated": {
      "saldo_retenido": 0.00
    },
    "auction_updated": {
      "estado": "pendiente"
    }
  },
  "message": "Transacción rechazada"
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
      "saldo_total": 2400.00, // Cache desde Movement
      "saldo_retenido": 960.00, // Cache desde estados subasta
      "saldo_aplicado": 1200.00, // Calculado desde Billing
      "saldo_disponible": 240.00, // Total - Retenido - Aplicado
      "updated_at": "2024-01-21T12:00:00Z"
    }
  }
}
```

#### **GET /api/users/:id/movements**

**Query Parameters:**
```
?tipo_especifico=pago_garantia,reembolso,penalidad    // Filtrar por tipos específicos
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
        "tipo_movimiento_general": "entrada",
        "tipo_movimiento_especifico": "pago_garantia",
        "monto": 960.00,
        "concepto": "Pago de garantía - Subasta Toyota Corolla 2020",
        "estado": "pendiente",
        "numero_operacion": "OP123456789",
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
5. **Estados válidos**: `activa` → `pendiente` → `en_validacion` → `finalizada` → `ganada/perdida/penalizada` → `facturada`
6. **Eliminación**: Solo si no tiene ofertas asociadas

### **GANADORES**

1. **Asignación**: Solo en subastas con estado `activa`
2. **Usuario válido**: Debe existir y ser tipo `client`
3. **Monto oferta**: Debe ser > 0 y <= 999,999.99
4. **Fecha oferta**: Debe estar entre `fecha_inicio` y `fecha_fin` de subasta
5. **Garantía**: Se calcula automáticamente como 8% de monto_oferta

### **TRANSACCIONES (MOVEMENT)**

1. **Registro**: Solo ganadores actuales de subastas en estado `pendiente`
2. **Monto exacto**: Debe coincidir exactamente con el 8% calculado
3. **Fecha pago**: No puede ser futura ni anterior a fecha inicio de subasta
4. **Archivo**: PDF/JPG/PNG, máximo 5MB
5. **Actualización inmediata**: Al registrar → cache saldo recalculado vía lógica aplicación
6. **Estado subasta**: `pendiente` → `en_validacion`

### **VALIDACIÓN DE TRANSACCIONES**

1. **Solo admin**: Puede aprobar o rechazar transacciones
2. **Estado válido**: Solo Movement en estado `pendiente`
3. **Aprobación**: Cache saldo recalculado, subasta → `finalizada`
4. **Rechazo**: Cache saldo recalculado, subasta → `pendiente`
5. **Archivo**: Se mantiene para auditoría incluso si se rechaza

### **COMPETENCIA EXTERNA**

1. **Gestión resultado**: Solo admin puede registrar resultado competencia BOB
2. **Estados finales**: `ganada`, `perdida`, `penalizada` según resultado
3. **Irreversible**: Una vez registrado resultado no se puede cambiar
4. **Notificaciones automáticas**: Se envían al cliente según resultado
5. **Procesos automáticos**: Facturación, reembolsos y penalidades se activan automáticamente

### **REEMBOLSOS**

1. **Solicitud**: Cliente puede solicitar reembolso con auction_id obligatorio
2. **Tipos**: `mantener_saldo` (entrada) o `devolver_dinero` (salida)
3. **Flujo**: solicitado → confirmado (llamada) → procesado
4. **Validación**: Admin confirma telefónicamente antes de procesar
5. **Movement**: Se crea al procesar, no al solicitar
6. **Restricciones**: Monto ≤ saldo_disponible; sin solicitudes pendientes; máximo 2 decimales
7. **RN07**: Solo subastas en estado perdida/penalizada permiten reembolso

### **VENCIMIENTOS**

1. **Manual**: Admin puede marcar como vencido en cualquier momento
2. **Automático**: Si existe `fecha_limite_pago` y se supera
3. **Penalidad**: Máximo 30% del saldo disponible
4. **Reasignación**: Automática al siguiente postor si existe

### **SALDOS (NUEVA ARQUITECTURA)**

1. **Cálculo disponible**: `Saldo Total - Saldo Retenido - Saldo Aplicado`
2. **Cache automático**: User.saldo_total y User.saldo_retenido via lógica de aplicación
3. **Saldo aplicado**: Calculado desde tabla Billing
4. **No negativos**: El saldo disponible nunca puede ser negativo
5. **Movement central**: Todas las transacciones registradas en Movement
6. **RN07 Estados retenidos**: finalizada, ganada, perdida (penalizada NO retiene)
7. **Reembolsos liberan retención**: cualquier Movement reembolso reduce saldo_retenido


---

## **MANEJO DE ERRORES Y CÓDIGOS DE ESTADO**

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
- `NOT_CURRENT_WINNER` - Usuario no es el ganador actual de la subasta
- `DUPLICATE_OPERATION_NUMBER` - Número de operación ya registrado

#### **Saldos:**
- `INSUFFICIENT_BALANCE` - Saldo insuficiente para operación
- `INSUFFICIENT_AVAILABLE_BALANCE` - Monto excede saldo disponible específico
- `BALANCE_CALCULATION_ERROR` - Error en cálculo de saldos

#### **Reembolsos:**
- `INVALID_REFUND_AMOUNT` - Monto de reembolso inválido (≤ 0)
- `REFUND_PENDING_EXISTS` - Ya existe solicitud de reembolso pendiente
- `INVALID_AUCTION_FOR_REFUND` - Subasta no válida para reembolso
- `AUCTION_STATE_NOT_REFUNDABLE` - Estado de subasta no permite reembolso
- `REFUND_AMOUNT_EXCEEDS_RETAINED` - Monto excede saldo retenido por subasta
- `INVALID_REFUND_STATE` - Estado de refund no válido para operación

#### **Billing:**
- `AUCTION_NOT_WON` - Solo se puede facturar subastas ganadas
- `INVALID_OPERATION_NUMBER` - Número de operación requerido para devolver dinero

#### **Archivos:**
- `UPLOAD_ERROR` - Error al subir archivo a Cloudinary
- `LIMIT_UNEXPECTED_FILE` - Archivo no esperado o campo incorrecto


---
