# Documentación de API — BOB Subastas (Backend)

Estado actual compatible con:
- Esquema Prisma y servicios: [schema.prisma](prisma/schema.prisma), [index.js](index.js:50), [routes](routes/auctions.js:1)
- Cambios clave:
  - Sin fecha_inicio/fecha_fin en Subasta
  - Offers reemplazado por Guarantees
  - Fecha límite de pago vive en Guarantee; Auction expone campo computado fecha_limite_pago para compatibilidad
  - Movement ya no usa tabla Movement_Reference; usa FKs directas auction_id_ref, guarantee_id_ref, refund_id_ref

Base URL (local): http://localhost:3000

Autenticación y Sesiones:
- La API usa sesiones de corta duración. Obtén un session_id con:
  - Cliente: [POST /auth/client-login](routes/auth.js:17)
  - Admin: [POST /auth/admin-access](routes/auth.js:24)
- Envía el header en cada request:
  - X-Session-ID: <session_id>
- Middlewares: [middleware/auth.js](middleware/auth.js:1)
- Renovación automática: [index.js](index.js:47)

Formato de errores:
- Status HTTP apropiado (4xx/5xx)
- Cuerpo:
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Descripción técnica legible"
    }
  }

Paginación:
- Query: page (default 1), limit (default 20)
- Respuesta:
  {
    data: { items... },
    pagination: { page, limit, total, total_pages }
  }

Convenciones de tipos:
- IDs son CUID (string)
- Fechas ISO 8601
- Monto decimal con 2 decimales, moneda USD
- Estados controlados (ver enums en [schema.prisma](prisma/schema.prisma:192))

Estructuras de entidades (resumen):
- Auction: { id, estado, asset, id_offerWin, fecha_resultado_general, finished_at, created_at, updated_at, fecha_limite_pago? (computado) }
- Guarantee: { id, auction_id, user_id, monto_oferta, posicion_ranking, estado, fecha_limite_pago, created_at, updated_at }
- Movement: { id, user_id, tipo_movimiento_general, tipo_movimiento_especifico, monto, moneda, tipo_pago?, numero_cuenta_origen?, voucher_url?, concepto, estado, fecha_pago?, fecha_resolucion?, motivo_rechazo?, numero_operacion?, auction_id_ref?, guarantee_id_ref?, refund_id_ref?, created_at, updated_at }
- Refund: { id, user_id, auction_id?, monto_solicitado, estado, fecha_respuesta_empresa?, fecha_procesamiento?, motivo?, motivo_rechazo?, created_at, updated_at }
- Billing: { id, user_id, billing_document_type, billing_document_number, billing_name, monto, moneda, concepto, auction_id, created_at, updated_at }
- Notification: { id, user_id, tipo, titulo, mensaje, estado, email_status, reference_type?, reference_id?, ... }
- User: { id, first_name, last_name, email, document_type?, document_number, user_type, saldo_total, saldo_retenido, created_at, updated_at }
- Asset: { id, placa, empresa_propietaria, marca?, modelo?, año?, estado, descripcion?, created_at, updated_at }

Notas importantes:
- Deadline de pago:
  - Vive en Guarantee.fecha_limite_pago
  - Auction.expose fecha_limite_pago de forma computada en respuestas (ganador vigente). Ver [services/auctionService.js](services/auctionService.js:90)
- Movements “references”:
  - Internamente se usan FKs directas en Movement
  - Algunas respuestas exponen un arreglo “references” por compatibilidad (tipo/id) y otras un objeto con ids (según ruta), ver movimientos y movimientos por usuario

--------------------------------------------------------------------------------

1) Salud del servidor
GET /
- Descripción: Verifica estado del servidor
- Autenticación: No
- Controlador: [index.js](index.js:50)
- Respuesta 200:
{
  "success": true,
  "message": "BOB Subastas API esta corriendo",
  "timestamp": "2025-09-19T00:00:00.000Z",
  "version": "1.0.0"
}

--------------------------------------------------------------------------------

2) Autenticación y Sesiones [routes/auth.js](routes/auth.js:1)

POST /auth/client-login
- Descripción: Login simple de cliente por documento
- Body (JSON):
  {
    "document_type": "DNI | CE | RUC | Pasaporte",
    "document_number": "string"
  }
- Respuesta 200:
{
  "success": true,
  "data": {
    "user": { ...User },
    "session": { "session_id": "uuid", "expires_at": "ISO" }
  }
}

POST /auth/admin-access
- Descripción: Acceso directo Admin (uso de pruebas/desarrollo)
- Body: vacío
- Respuesta 200: Igual estructura a client-login

POST /auth/logout
- Header X-Session-ID requerido
- Respuesta 200: { "success": true }

GET /auth/session
- Descripción: Valida sesión activa y renueva si corresponde
- Header X-Session-ID requerido
- Respuesta 200: { "success": true, "data": { "session": {...} } }

GET /auth/sessions/stats
- Requiere Admin
- Respuesta: estadísticas de sesiones activas

--------------------------------------------------------------------------------

3) Subastas [routes/auctions.js](routes/auctions.js:1)

GET /auctions
- Descripción: Listar subastas con filtros
- Auth: Cliente/Admin
- Query:
  - estado: "activa,pendiente,en_validacion,finalizada,ganada,facturada,perdida,penalizada,vencida,cancelada"
  - search: placa/marca/modelo/empresa
  - fecha_desde, fecha_hasta: ISO (filtra por created_at)
  - page, limit
  - include (opcional, CSV):
    - validated_payments → adjunta movements de pago de garantía con estado "validado" de esa subasta
    - winner → adjunta winner_guarantee con datos de la Guarantee ganadora (id_offerWin) y usuario
- Respuesta 200:
{
  "success": true,
  "data": {
    "auctions": [
      {
        "id": "cauc...",
        "asset": { "placa":"ABC-123", "marca":"Toyota", "modelo":"Corolla", "año":2020, "empresa_propietaria":"EMPRESA S.A." },
        "estado": "activa|pendiente|...",
        "fecha_limite_pago": "ISO|null", // computado desde Guarantee ganadora
        "winner": {
          "name": "string",
          "document": "string",
          "monto_oferta": 1250.00
        } | null,
        "created_at": "ISO",
        "winner_guarantee": {              // presente solo si include=winner
          "id": "cgua...",
          "user": {
            "id": "cusr...",
            "first_name": "Juan",
            "last_name": "Pérez",
            "document_type": "DNI",
            "document_number": "12345678"
          },
          "monto_oferta": 1250.00,
          "posicion_ranking": 1,
          "estado": "activa|ganadora|perdedora",
          "fecha_limite_pago": "ISO|null"
        },
        "validated_payments": [            // presente solo si include=validated_payments
          {
            "id": "cmov...",
            "user_id": "cusr...",
            "monto": 100.00,
            "moneda": "USD",
            "concepto": "Pago de garantía",
            "numero_operacion": "OP-123",
            "fecha_pago": "ISO",
            "fecha_resolucion": "ISO|null",
            "created_at": "ISO"
          }
        ]
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 10, "total_pages": 1 }
  }
}

POST /auctions
- Descripción: Crear subasta con activo (Admin)
- Body:
  {
    "asset": {
      "placa": "ABC-123",
      "empresa_propietaria": "string",
      "marca": "string?",
      "modelo": "string?",
      "año": 2020?,
      "descripcion": "string?"
    }
  }
- Respuesta 201: { "success": true, "data": { "auction": { ... } } }

GET /auctions/:id
- Descripción: Detalle de subasta
- Query:
  - include (opcional, CSV):
    - validated_payments → adjunta movements de pago de garantía con estado "validado" de esa subasta
    - winner → adjunta winner_guarantee con datos de la Guarantee ganadora (id_offerWin) y usuario
- Respuesta 200:
{
  "success": true,
  "data": {
    "auction": {
      "id": "cauc...",
      "asset": { "placa":"ABC-123", "marca":"Toyota", "modelo":"Corolla", "año":2020, "empresa_propietaria":"EMPRESA S.A.", "descripcion":"..." },
      "estado": "activa|pendiente|...",
      "id_offerWin": "cgua...",
      "fecha_resultado_general": "ISO|null",
      "finished_at": "ISO|null",
      "created_at": "ISO",
      "updated_at": "ISO",
      "guarantees": [ { ... incluye user con {id, first_name, last_name, document_type, document_number, phone_number} ... } ],
      "fecha_limite_pago": "ISO|null", // computado desde Guarantee ganadora
      "winner_guarantee": {            // presente solo si include=winner
        "id": "cgua...",
        "user": {
          "id": "cusr...",
          "first_name": "Juan",
          "last_name": "Pérez",
          "document_type": "DNI",
          "document_number": "12345678"
        },
        "monto_oferta": 1250.00,
        "posicion_ranking": 1,
        "estado": "activa|ganadora|perdedora",
        "fecha_limite_pago": "ISO|null"
      },
      "validated_payments": [          // presente solo si include=validated_payments
        {
          "id": "cmov...",
          "user_id": "cusr...",
          "monto": 100.00,
          "moneda": "USD",
          "concepto": "Pago de garantía",
          "numero_operacion": "OP-123",
          "fecha_pago": "ISO",
          "fecha_resolucion": "ISO|null",
          "created_at": "ISO"
        }
      ]
    }
  }
}

PATCH /auctions/:id/status (Admin)
- Body: { "estado": "activa|pendiente|...|penalizada", "motivo": "string (10-500)" }
- Respuesta 200: { "success": true, "data": { "auction": {...} } }

PATCH /auctions/:id/extend-deadline (Admin)
- Body: { "fecha_limite_pago": "ISO futura", "motivo": "string (10-500)" }
- Efecto: Actualiza Guarantee ganadora; auction devuelve fecha_limite_pago computado
- Respuesta 200: { "success": true, "data": { "auction": {..., fecha_limite_pago} } }

PATCH /auctions/:id/competition-result (Admin)
- Body: { "resultado": "ganada|perdida|penalizada", "observaciones?": "string" }
- Reglas:
  - ganada: se mantiene retenido hasta facturación (sin movimientos automáticos)
  - perdida: crea Movement ENTRADA/reembolso automático (100% de la garantía validada), libera retenido y aumenta saldo_disponible; saldo_total no cambia
  - penalizada: crea Movement SALIDA/penalidad (30%) y Movement ENTRADA/reembolso (70%) automáticos; libera retenido y ajusta saldo_total/saldo_disponible
- Respuesta 200: { "success": true, "data": { "auction": {...} } }

POST /auctions/:id/winner (Admin)
- Body:
  {
    "user_id": "string",
    "monto_oferta": 1250.00,
    "fecha_limite_pago?": "ISO"
  }
- Efecto: Crea Guarantee ganadora activa (posicion_ranking=1) y setea auction.id_offerWin
- Respuesta 201:
{
  "success": true,
  "data": {
    "guarantee": {..., "monto_garantia": 100.00},
    "auction": {..., "fecha_limite_pago": "ISO"},
    "user": { id, name, document }
  }
}

POST /auctions/:id/reassign-winner (Admin)
- Body: { "user_id": "...", "monto_oferta": 1000, "motivo_reasignacion?": "..." }
- Efecto: guarantee anterior -> perdedora; nueva guarantee activa
- Respuesta 201: { "success": true, "data": { "new_guarantee": {...}, "auction": {...} } }

DELETE /auctions/:id (Admin)
- Restricción: Sin movements de pago_garantia asociados
- Respuesta 200: { "success": true }

GET /auctions/stats (Admin), GET /auctions/expired (Admin)
- Descripción: estadísticas de subastas y subastas vencidas

--------------------------------------------------------------------------------

4) Movimientos (Transacciones) [routes/movements.js](routes/movements.js:1)

GET /movements
- Descripción: Listar movements (Admin: todos; Client: propios)
- Query:
  - tipo_especifico, estado, fecha_desde, fecha_hasta, page, limit
  - include (opcional, CSV): auction,user,refund,guarantee
    - Opt-in para enriquecer respuesta con datos mínimos relacionados
- Respuesta 200:
{
  "success": true,
  "data": {
    "movements": [
      {
        "id": "cmov...",
        "tipo_movimiento_general": "entrada|salida",
        "tipo_movimiento_especifico": "pago_garantia|reembolso|penalidad|ajuste_manual",
        "monto": 100.00,
        "estado": "pendiente|validado|rechazado",
        "concepto": "...",
        "numero_operacion": "OP-...",
        "created_at": "ISO",
        "references": [
          { "type": "auction", "id": "cau..." },
          { "type": "refund",  "id": "crf..." }
        ],
        "related": {                    // presente solo si se usa include
          "user": {                     // include=user
            "first_name": "Juan Carlos",
            "last_name": "Pérez López",
            "document_type": "DNI",
            "document_number": "12345678"
          },
          "auction": {                  // include=auction
            "id": "cauc...",
            "estado": "finalizada",
            "empresa_propietaria": "EMPRESA DEMO",
            "marca": "Toyota",
            "modelo": "Corolla",
            "año": 2020,
            "placa": "ABC-123"
          },
          "guarantee": {                // include=guarantee
            "id": "cgua...",
            "auction_id": "cauc...",
            "user_id": "cusr...",
            "posicion_ranking": 1
          },
          "refund": {                   // include=refund
            "id": "crf...",
            "estado": "procesado"
          }
        }
      }
    ],
    "pagination": { page, limit, total, total_pages }
  }
}

POST /movements (Client)
- Descripción: Registrar pago de garantía (FormData multipart)
- Campos (form-data):
  - auction_id (string, requerido)
  - monto (number, exacto 8% de monto_oferta)
  - tipo_pago ('deposito'|'transferencia')
  - numero_cuenta_origen (string)
  - numero_operacion (string)
  - fecha_pago (ISO, no futura)
  - moneda (default USD)
  - concepto (default 'Pago de garantía')
  - voucher (file: png/jpg/pdf)
- Respuesta 201: { "success": true, "data": { "movement": {...}, "auction_updated": { id, estado: 'en_validacion' } } }

GET /movements/:id
- Descripción: Detalle de un movement
- Query:
  - include (opcional, CSV): auction,user,refund,guarantee
    - Opt-in para enriquecer respuesta con datos mínimos relacionados
- Respuesta 200:
{
  "success": true,
  "data": {
    "movement": {
      "...": "...",
      "references": [
        { "type": "auction", "id": "cau..." },
        { "type": "guarantee", "id": "cgu..." },
        { "type": "refund", "id": "crf..." }
      ],
      "related": {                    // presente solo si se usa include
        "user": {                     // include=user
          "first_name": "María",
          "last_name": "González",
          "document_type": "CE",
          "document_number": "987654321"
        },
        "auction": {                  // include=auction
          "id": "cauc...",
          "estado": "ganada",
          "empresa_propietaria": "EMPRESA S.A.",
          "marca": "Toyota",
          "modelo": "Corolla",
          "año": 2020,
          "placa": "ABC-123"
        },
        "guarantee": {                // include=guarantee
          "id": "cgua...",
          "auction_id": "cauc...",
          "user_id": "cusr...",
          "posicion_ranking": 1
        },
        "refund": {                   // include=refund
          "id": "crf...",
          "estado": "procesado"
        }
      }
    }
  }
}

PATCH /movements/:id/approve (Admin)
- Body: { "comentarios?": "string" }
- Efecto: movement.estado 'validado', auction.estado 'finalizada', recálculo de saldos
- Respuesta 200: { "success": true, "data": { "movement": {...}, "auction_updated": {...}, "user": {...} } }

PATCH /movements/:id/reject (Admin)
- Body: { "motivos": [ "...", "..." ], "otros_motivos?": "string", "comentarios?": "string" }
- Efecto: movement.estado 'rechazado', auction.estado 'pendiente'
- Respuesta 200: { "success": true, "data": { "movement": {...}, "auction_updated": {...}, "user": {...} } }

GET /movements/:id/voucher
- Descripción: Descarga del comprobante si existe

Notas:
- FKs directas para enlazar movement a entidades:
  - auction_id_ref, guarantee_id_ref, refund_id_ref
- Las respuestas de listado general exponen “references” como arreglo (type/id) por compatibilidad
- Las respuestas de movimientos de un usuario (ver Users) devuelven references como objeto (auction_id, guarantee_id, refund_id)

--------------------------------------------------------------------------------

5) Usuarios y Saldos [routes/users.js](routes/users.js:1), [routes/balances.js](routes/balances.js:1)

GET /users (Admin)
- Query: search, document_type, user_type, page, limit
- Respuesta: listado usuarios

GET /users/:userId/balance
- Descripción: Obtener saldo del usuario
- Respuesta:
{
  "success": true,
  "data": {
    "balance": {
      "user_id": "...",
      "user": { name, document },
      "saldo_total": 0.00,
      "saldo_retenido": 0.00,
      "saldo_aplicado": 0.00,
      "saldo_disponible": 0.00,
      "updated_at": "ISO"
    }
  }
}

GET /users/:userId/movements
- Descripción: Listar movimientos del usuario
- Query:
  - tipo_especifico, estado, page, limit, fecha_desde, fecha_hasta
  - include (opcional, CSV): auction,user,refund,guarantee
    - Opt-in para enriquecer respuesta con datos mínimos relacionados
- Respuesta:
{
  "success": true,
  "data": {
    "movements": [
      {
        "id":"...",
        "tipo_movimiento_general":"entrada",
        "tipo_movimiento_especifico":"pago_garantia",
        "monto":100.00,
        "moneda":"USD",
        "estado":"validado",
        "concepto": "...",
        "numero_operacion":"OP-..",
        "fecha_pago":"ISO",
        "fecha_resolucion":"ISO",
        "motivo_rechazo": null,
        "created_at":"ISO",
        "references": {
          "auction_id":"cau...",
          "guarantee_id":"cgu...",
          "refund_id":"crf..."
        },
        "related": {                    // presente solo si se usa include
          "user": {                     // include=user
            "first_name": "María",
            "last_name": "González",
            "document_type": "CE",
            "document_number": "987654321"
          },
          "auction": {                  // include=auction
            "id": "cauc...",
            "estado": "ganada",
            "empresa_propietaria": "EMPRESA PERDIDA S.A.",
            "marca": "Chevrolet",
            "modelo": "Onix",
            "año": 2023,
            "placa": "XYZ-987"
          },
          "guarantee": {                // include=guarantee
            "id": "cgua...",
            "auction_id": "cauc...",
            "user_id": "cusr...",
            "posicion_ranking": 1
          },
          "refund": {                   // include=refund
            "id": "crf...",
            "estado": "confirmado",
            "tipo_reembolso": "mantener_saldo"
          }
        }
      }
    ],
    "pagination": { ... }
  }
}

GET /users/:userId/won-auctions
- Descripción: Subastas donde el usuario es ganador (Guarantee posicion_ranking = 1)
- Auth: Admin (cualquiera), Cliente (solo propio)
- Query:
  - estado (opcional, CSV): filtra por estado de la Guarantee (activa|ganadora|perdedora)
  - page, limit
- Respuesta 200:
{
  "success": true,
  "data": {
    "won_auctions": [
      {
        "guarantee_id": "cgua...",
        "auction": {
          "id": "cauc...",
          "estado": "pendiente|en_validacion|finalizada|ganada|perdida|penalizada|facturada",
          "fecha_limite_pago": "ISO|null",
          "asset": {
            "placa": "ABC-123",
            "marca": "Toyota",
            "modelo": "Corolla",
            "año": 2020,
            "empresa_propietaria": "EMPRESA S.A."
          }
        },
        "guarantee_details": {
          "monto_oferta": 1250.00,
          "monto_garantia": 100.00,     // 8% calculado
          "estado": "activa|ganadora|perdedora"
        },
        "payment_status": {
          "has_payment": true,
          "movement_id": "cmov...",
          "estado": "pendiente|validado|rechazado",
          "monto_pagado": 100.00,
          "fecha_pago": "ISO"
        } | {
          "has_payment": false,
          "monto_requerido": 100.00
        }
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "total_pages": 1 }
  }
}

GET /users/:userId/can-participate
- Descripción: Indica si el usuario puede participar en nuevas subastas (no tener pagos pendientes)
- Respuesta: { "can_participate": true|false, "pending_payments": 0, "reason": null|string }

POST /users/:userId/movements/manual (Admin)
- Descripción: Crea un movimiento manual validado
- Body:
  {
    "tipo_movimiento": "ajuste_positivo | ajuste_negativo | penalidad_manual",
    "monto": number,
    "descripcion": "string",
    "motivo": "string (10-500)"
  }
- Respuesta 201: { "movement": {...}, "updated_user_cache": { saldo_total, saldo_retenido }, "user": { name, document } }

Resumen de balances (Admin)

GET /balances/summary
- Descripción: Listado paginado de clientes (user_type='client') con sus saldos calculados
- Auth: Admin only
- Implementación: [routes/balances.js](routes/balances.js:32) → [controllers/balanceController.js.getBalancesSummary()](controllers/balanceController.js:84) → [services/balanceService.js.getBalancesSummary()](services/balanceService.js:248)
- Query:
  - search (opcional): nombre, documento o email (insensible a mayúsculas)
  - page (default 1), limit (default 20)
- Respuesta 200:
{
  "success": true,
  "data": {
    "balances": [
      {
        "user": {
          "id": "cusr...",
          "name": "Juan Pérez",
          "document": "DNI: 12345678",
          "email": "juan@demo.com",
          "phone": "+51999999999"
        },
        "balance": {
          "saldo_total": 1500.00,
          "saldo_retenido": 200.00,
          "saldo_aplicado": 100.00,
          "saldo_disponible": 1200.00
        },
        "updated_at": "2025-09-22T12:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "total_pages": 3 }
  }
}

GET /balances/stats
- Descripción: Estadísticas agregadas de saldos en el sistema (solo clientes: user_type='client')
- Auth: Admin only
- Implementación: [routes/balances.js](routes/balances.js:25) → [controllers/balanceController.js.getBalanceStats()](controllers/balanceController.js:108) → [services/balanceService.js.getBalanceStats()](services/balanceService.js:326)
- Respuesta 200:
{
  "success": true,
  "data": {
    "statistics": {
      "saldo_total_sistema": 100000.00,
      "saldo_retenido_total": 8000.00,
      "saldo_aplicado_total": 12000.00,
      "saldo_disponible_total": 80000.00,
      "total_usuarios_con_saldo": 30,
      "total_usuarios": 120,
      "movimientos_mes_actual": 56
    },
    "timestamp": "2025-09-22T12:00:00.000Z"
  }
}

GET /balances/dashboard
- Descripción: Resumen para dashboard admin (estadísticas + top balances de clientes únicamente)
- Auth: Admin only
- Implementación: [routes/balances.js](routes/balances.js:18) → [controllers/balanceController.js.getDashboardSummary()](controllers/balanceController.js:203)
- Respuesta 200 (ejemplo):
{
  "success": true,
  "data": {
    "financial_overview": {
      "total_dinero_en_sistema": 100000.00,
      "dinero_retenido": 8000.00,
      "dinero_aplicado": 12000.00,
      "dinero_disponible": 80000.00,
      "usuarios_con_saldo": 30,
      "movimientos_mes": 56
    },
    "top_balances": [
      {
        "user": { "id": "cusr...", "name": "Juan Pérez", "document": "DNI 12345678", "email": "juan@demo.com", "phone": "+51999999999" },
        "balance": { "saldo_total": 5000.00, "saldo_retenido": 0.00, "saldo_aplicado": 1000.00, "saldo_disponible": 4000.00 },
        "updated_at": "2025-09-22T11:00:00.000Z"
      }
    ],
    "timestamp": "2025-09-22T12:00:00.000Z"
  }
}
--------------------------------------------------------------------------------

6) Reembolsos [routes/refunds.js](routes/refunds.js:1)

GET /refunds
- Descripción: Listado de solicitudes de reembolso
- Auth: Admin (todas), Cliente (propias)
- Query:
  - estado, user_id (admin), auction_id, fecha_desde, fecha_hasta, page, limit
  - include (opcional, CSV): user,auction
    - Opt-in para enriquecer respuesta con datos mínimos relacionados
- Respuesta 200:
{
  "success": true,
  "data": {
    "refunds": [
      {
        "id": "crf...",
        "user_id": "cusr...",
        "auction_id": "cauc... | null",
        "monto_solicitado": 100.00,
        "estado": "solicitado|confirmado|rechazado|procesado|cancelado",
        "fecha_respuesta_empresa": "ISO|null",
        "fecha_procesamiento": "ISO|null",
        "motivo": "string|null",
        "motivo_rechazo": "string|null",
        "created_at": "ISO",
        "updated_at": "ISO",
        "references": { "user_id":"...", "auction_id":"...|null" },
        "related": {                        // presente solo si se usa include
          "user": {                         // include=user
            "id": "cusr...",
            "first_name": "María",
            "last_name": "González",
            "document_type": "DNI|CE|RUC|Pasaporte",
            "document_number": "string"
          },
          "auction": {                      // include=auction (si tiene auction_id)
            "id": "cauc...",
            "placa": "ABC-123",
            "empresa_propietaria": "EMPRESA S.A.",
            "marca": "Toyota",
            "modelo": "Corolla",
            "año": 2020
          }
        }
      }
    ],
    "pagination": { page, limit, total, total_pages }
  }
}

GET /refunds/:id
- Descripción: Detalle de una solicitud de reembolso
- Auth: Admin (cualquiera), Cliente (solo propio)
- Query:
  - include (opcional, CSV): user,auction
    - Devuelve bloques related con los mismos campos mínimos
- Respuesta 200:
{
  "success": true,
  "data": {
    "refund": {
      "id": "crf...",
      "...": "...",
      "references": { "user_id":"...", "auction_id":"...|null" },
      "related": { "user": {...}, "auction": {...} } // si se usa include
    }
  }
}

GET /users/:userId/refunds
- Descripción: Listado de reembolsos por usuario específico
- Auth: Admin (cualquiera), Cliente (solo propio)
- Query:
  - estado, auction_id, fecha_desde, fecha_hasta, page, limit
  - include (opcional, CSV): user,auction
    - Devuelve bloques related con los mismos campos mínimos
- Respuesta 200:
{
  "success": true,
  "data": {
    "refunds": [ { ...igual a GET /refunds... } ],
    "pagination": { ... }
  }
}

POST /refunds (Client)
- Descripción: Crear solicitud de reembolso (Devolver Dinero)
- Body:
  {
    "auction_id?": "string",
    "monto_solicitado": number,
    "motivo": "string (10-500)"
  }
- Reglas:
  - Valida contra saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado
  - Retención inmediata al crear solicitud:
    - saldo_retenido += monto_solicitado
    - saldo_disponible -= monto_solicitado
    - saldo_total SIN CAMBIO
  - Solo se permite 1 solicitud pendiente (solicitado|confirmado) por cliente
  - auction_id es opcional (trazabilidad)
- Respuesta 201: { "refund": {...} }

PATCH /refunds/:id/manage (Admin)
- Descripción: Confirmar o rechazar solicitud
- Body: { "estado":"confirmado|rechazado", "motivo": "string (10-500)" }
- Nota: En rechazo se registra motivo_rechazo en la entidad.
- Respuesta: { "refund": {...} }

PATCH /refunds/:id/process (Admin, multipart)
- Descripción: Procesar reembolso confirmado (únicamente “Devolver Dinero”)
- Form-data:
  - tipo_transferencia? ('transferencia'|'deposito')
  - banco_destino?, numero_cuenta_destino?
  - numero_operacion (obligatorio)
  - voucher? (comprobante del reembolso)
- Efecto:
  - Crea Movement salida/reembolso validado (saldo_total ↓; saldo_retenido ↓; saldo_disponible SIN CAMBIO)
  - Recalcula saldos
- Respuesta 200: { "refund": {...}, "movement": {...} }

Notas de include en Refunds:
- include=user → related.user: { id, first_name, last_name, document_type, document_number }
- include=auction → related.auction: { id, placa, empresa_propietaria, marca, modelo, año }

--------------------------------------------------------------------------------

7) Facturación [routes/billing.js](routes/billing.js:1)

GET /billing (Admin)
- Descripción: Listar facturaciones (solo Admin)
- Query:
  - fecha_desde, fecha_hasta: ISO (filtra por created_at)
  - page, limit
  - include (opcional, CSV): user,auction
    - Opt-in para enriquecer respuesta con datos mínimos relacionados
- Respuesta 200:
{
  "success": true,
  "data": {
    "billings": [
      {
        "id": "cbill...",
        "user_id": "cusr...",
        "auction_id": "cauc...",
        "billing_document_type": "RUC|DNI",
        "billing_document_number": "string",
        "billing_name": "string",
        "monto": 100.00,
        "moneda": "USD",
        "concepto": "Compra vehículo ...",
        "created_at": "ISO",
        "updated_at": "ISO",
        "references": { "user_id":"...", "auction_id":"..." },
        "related": {                       // presente solo si se usa include
          "user": {                        // include=user
            "id": "cusr...",
            "first_name": "María",
            "last_name": "González",
            "document_type": "DNI|CE|RUC|Pasaporte",
            "document_number": "string"
          },
          "auction": {                     // include=auction
            "id": "cauc...",
            "estado": "ganada|facturada|...",
            "fecha_resultado_general": "ISO|null",
            "placa": "ABC-123",
            "empresa_propietaria": "EMPRESA S.A.",
            "marca": "Toyota",
            "modelo": "Corolla",
            "año": 2020,
            "descripcion": "string|null"
          }
        }
      }
    ],
    "pagination": { page, limit, total, total_pages }
  }
}

GET /billing/:id
- Descripción: Detalle de una facturación (Admin: cualquiera; Client: solo su propio billing)
- Query:
  - include (opcional, CSV): user,auction
    - Mismos campos mínimos descritos arriba
- Respuesta 200:
{
  "success": true,
  "data": {
    "billing": {
      "id": "cbill...",
      "...": "...",
      "references": { "user_id":"...", "auction_id":"..." },
      "related": { "user": {...}, "auction": {...} } // si se usa include
    }
  }
}

GET /users/:userId/billings
- Descripción: Listar facturaciones por usuario (Admin: cualquiera; Client: solo propio)
- Query:
  - fecha_desde, fecha_hasta: ISO
  - page, limit
  - include (opcional, CSV): user,auction
- Respuesta 200:
{
  "success": true,
  "data": {
    "billings": [ { ...igual a listado general... } ],
    "pagination": { ... }
  }
}

POST /billing (Client)
- Descripción: Crear Billing para subasta en estado 'ganada' del cliente autenticado
- Body:
  {
    "auction_id":"string",
    "billing_document_type":"RUC|DNI",
    "billing_document_number":"string",
    "billing_name":"string"
  }
- Efecto: auction.estado 'facturada', saldo_aplicado += garantia, libera retenido de esa subasta
- Respuesta 201: { "success": true, "data": { "billing": {...}, "auction_updated": { id, estado } } }

Notas de include en Billing:
- include=user → related.user: { id, first_name, last_name, document_type, document_number }
- include=auction → related.auction: { id, estado, fecha_resultado_general, placa, empresa_propietaria, marca, modelo, año, descripcion }

--------------------------------------------------------------------------------

8) Notificaciones [routes/notifications.js](routes/notifications.js:1)

GET /notifications
- Query: estado, tipo, fecha_desde, fecha_hasta, page, limit, search, user_id? (admin)
- Respuesta: listado

PATCH /notifications/mark-all-read
- Descripción: Marca todas las notificaciones del usuario como leídas

PATCH /notifications/:id/read
- Descripción: Marca notificación específica como leída

--------------------------------------------------------------------------------

9) Jobs (Admin) [routes/jobs.js](routes/jobs.js:1)

GET /jobs/status, GET /jobs/list
POST /jobs/run/:jobName
POST /jobs/process-expired
GET /jobs/check-upcoming
GET /jobs/daily-report

Implementación de jobs: [jobs/auctionJobs.js](jobs/auctionJobs.js:1)

--------------------------------------------------------------------------------

Anexos técnicos

A) Estados y Reglas (RN)
- RN de cálculo de saldos y retención: ver [services/movementService.js](services/movementService.js:480), [services/refundService.js](services/refundService.js:506), [services/balanceService.js](services/balanceService.js:380)
- Penalidad 30%: ver [services/auctionService.js](services/auctionService.js:398)

B) Notas de compatibilidad
- Auction.fecha_limite_pago es computado desde Guarantee; la escritura real se hace en Guarantee (createWinner, extendPaymentDeadline)
- Movement usa FKs directas; algunas rutas devuelven references como arreglo (type/id) por compatibilidad y otras como objeto (ids). Esto no impacta contratos previos si el frontend ya consumía ambas variantes

C) Upload de archivos
- Cloudinary configurado: [config/cloudinary.js](config/cloudinary.js:1)
- Límites: app usa json/urlencoded y multer en controllers

D) Seguridad
- Todas las rutas /api/* protegidas con requireAuth; admin-only señaladas con requireAdmin. Ver [index.js](index.js:60), [middleware/index.js](middleware/index.js:1)

Fin de documento.
