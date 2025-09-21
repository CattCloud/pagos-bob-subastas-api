# Briefing Frontend — Eliminación de Movement_Reference (impacto en contratos)

Qué cambió (interno backend)
- Se eliminó la tabla Movement_Reference. Ahora Movement posee FKs directas:
  - auction_id_ref, guarantee_id_ref, refund_id_ref.
- Implementado en servicios/queries: ver [movementService.js](services/movementService.js:1), [balanceService.js](services/balanceService.js:1), [refundService.js](services/refundService.js:1).
- La documentación de la API describe cómo se exponen estas referencias en respuestas: ver [DocumentacionAPI.md](doc/DocumentacionAPI.md:1).

Impacto en el Frontend
- No hay cambios en los contratos ya consumidos por el frontend. Mantener el mismo consumo.
- Las listas/detalles de movimientos continúan exponiendo las referencias de forma compatible:
  - GET /movements (admin/cliente): devuelve un arreglo references con pares { type, id } (compatibilidad).
  - GET /users/:userId/movements: devuelve un objeto references con llaves directas { auction_id, guarantee_id, refund_id }.
- No hay cambios en payloads de entrada ni en rutas. No se requiere trabajo adicional para UI.
- Nota: La fecha límite de pago (deadline) sigue viniendo en responses de Auction como campo computado (fecha_limite_pago), sin cambios para el frontend.

Guía de uso (recordatorio de formatos vigentes)
- Listado general de movimientos (GET /movements):
  - Campo references como arreglo (compatible con el consumo actual):
    [
      { "type": "auction", "id": "cau_..." },
      { "type": "refund",  "id": "crf_..." }
    ]

- Movimientos por usuario (GET /users/:userId/movements):
  - Campo references como objeto con IDs directos:
    {
      "auction_id": "cau_..." | null,
      "guarantee_id": "cgu_..." | null,
      "refund_id": "crf_..." | null
    }

Checklist Frontend (acciones)
- No modificar contratos ni mapeos existentes.
- Verificar que los componentes que consumen:
  - GET /movements sigan leyendo el arreglo references (type/id).
  - GET /users/:userId/movements sigan leyendo el objeto references (auction_id/guarantee_id/refund_id).
- No hay cambios en formularios de registro de pagos ni flujos de reembolso/facturación por este ajuste interno.

Referencias técnicas (para contexto)
- Entidad Movement y nuevos cambios: [Prerequisitos.js](Prerequisitos.js:1)
- Descripción de endpoints y campos: [DocumentacionAPI.md](doc/DocumentacionAPI.md:1).