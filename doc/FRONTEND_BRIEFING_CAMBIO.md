# Briefing de cambios para Frontend — Reembolsos y Resultado de Competencia

Objetivo
- Alinear la UI al nuevo flujo de reembolsos y movimientos automáticos tras “perdida” y “penalizada”.
- Simplificar reembolsos: solo existe “Devolver Dinero”. Ya no existe “Mantener Saldo”.

Resumen del cambio de negocio
- Caso BOB pierde (competencia externa):
  - Automático: se crea Movement ENTRADA/reembolso por el 100% de la garantía validada.
  - Efecto en UI cliente: el saldo retenido baja a 0 y el saldo disponible sube; el cliente puede usar ese dinero de inmediato en otras subastas.
- Caso Cliente no paga vehículo (penalizada):
  - Automático: se crea Movement SALIDA/penalidad 30% y Movement ENTRADA/reembolso 70%.
  - Efecto: el 70% queda disponible de inmediato para el cliente; el 30% reduce el saldo total.
- Solicitar reembolso (Cliente):
  - Únicamente “Devolver Dinero” del saldo disponible. Se elimina “Mantener Saldo”.
  - Retención al solicitar: al enviar la solicitud, la UI debe reflejar inmediatamente:
    - saldo_retenido += monto_solicitado
    - saldo_disponible -= monto_solicitado
    - saldo_total sin cambio
  - Si el admin rechaza: revertir retención en UI (retenido disminuye y disponible aumenta por el mismo monto).
  - Si el admin procesa: no cambia el disponible (ya fue descontado en la solicitud); baja saldo_total y se libera el retenido.
  - El admin procesa reembolso (salida) con número de operación obligatorio; voucher opcional.
- Entidad Refund (contrato que consume FE):
  - Eliminados: tipo_reembolso, fecha_solicitud.
  - Agregado: motivo_rechazo (solo cuando estado = rechazado).
  - Persisten: estado, monto_solicitado, motivo, fechas de respuesta/procesamiento.

Impacto en UI Cliente

1) Pantalla “Mi Saldo”
- Cambios esperados:
  - Cuando la subasta pasa a “perdida” o “penalizada”, la UI debe reflejar inmediatamente:
    - perdida: retenido → 0; disponible → +100% garantía
    - penalizada: retenido → 0; disponible → +70% garantía; total → -30% (penalidad)
  - No se requiere acción del cliente para “liberar” saldo; se libera automáticamente por movimientos de entrada de tipo “reembolso”.
- Fórmula visible (no cambió): saldo_disponible = saldo_total - saldo_retenido - saldo_aplicado

2) Pantalla “Solicitar Reembolso”
- Eliminar el selector/radio “tipo de reembolso” (ya no existe “mantener_saldo”).
- Nuevo formulario mínimo:
  - monto_solicitado (numérico, 2 decimales)
  - motivo (texto; requerido 10-500 caracteres)
  - auction_id (opcional, solo para trazabilidad si se selecciona desde una subasta específica)
  - Botón: “Solicitar Devolución de Dinero”
- Comportamiento tras enviar:
  - Actualizar UI de saldos: retenido += monto, disponible -= monto, total sin cambio.
  - Refrescar “Mi Saldo” y “Historial de Transacciones” para evitar doble uso del dinero.
- Validaciones de UI:
  - El monto no puede exceder el saldo_disponible actual; mostrar error amigable si API retorna REFUND_AMOUNT_EXCEEDS_AVAILABLE.
  - Monto positivo y con máximo 2 decimales (el backend valida y devuelve 422 si excede precisión).
  - motivo requerido (10-500).
- Mensajería:
  - Éxito: “Solicitud registrada. El monto queda retenido hasta su aprobación.”
  - Error típico: “El monto excede su saldo disponible” (código: REFUND_AMOUNT_EXCEEDS_AVAILABLE).

3) Pantalla “Historial de Transacciones”
- Tipos relevantes:
  - entrada/reembolso (automático por perdida o por 70% de penalizada)
  - salida/reembolso (transferencia efectuada al cliente)
  - salida/penalidad (30% en penalizada)
- Recomendación de UI para labels y chips:
  - entrada/reembolso: “Liberación por competencia perdida” o “Reembolso automático 70% (penalidad)”
  - salida/reembolso: “Devolución de dinero”
  - salida/penalidad: “Penalidad 30%”
- No mostrar ni depender de Refund.tipo_reembolso (ya no existe).

4) Notificaciones (panel cliente)
- Tipos que ya usa backend:
  - reembolso_solicitado (confirma registro de solicitud)
  - reembolso_procesado (cuando se completa la transferencia)
  - competencia_perdida (informativa; ahora implica liberación automática)
  - penalidad_aplicada (informativa; se aplicó 30% y se reembolsó 70%)

Impacto en UI Admin

1) Pantalla “Resultados de Competencia”
- Cambios al aplicar resultado:
  - perdida: al registrarlo, el sistema crea ENTRADA/reembolso (100%); la UI de saldos debe reflejar liberación automática sin pasos adicionales.
  - penalizada: al registrarlo, el sistema crea SALIDA/penalidad (30%) + ENTRADA/reembolso (70%).
- Sugerencia de UI:
  - Mostrar info de “Movimientos automáticos generados” (monto penalidad y monto devuelto) en el toast/summary de confirmación.

2) “Gestionar Solicitudes de Reembolso” (Admin)
- Listado/Detalle:
  - Eliminar columna/tags de tipo_reembolso.
  - Agregar visualización de motivo_rechazo cuando estado = rechazado.
  - Mantener: id, cliente, monto_solicitado, estado, motivo (del cliente), fecha_respuesta_empresa, fecha_procesamiento.
- Confirmar/Rechazar:
  - Si “rechazado”, capturar un “motivo” y mostrar al cliente en detalle/notifications (se guarda como motivo_rechazo).
- Procesar reembolso (único camino):
  - Formulario:
    - numero_operacion (obligatorio)
    - tipo_transferencia (opcional: transferencia|deposito)
    - banco_destino / numero_cuenta_destino (opcionales si están en UI)
    - voucher (archivo opcional)
  - Resultado: se crea un Movement salida/reembolso validado y se recalculan saldos.

Contratos API relevantes para Frontend (solo puntos que cambian y retención)

Autenticación
- Igual. Header: X-Session-ID.

POST /refunds
- Cuerpo (JSON):
  {
    "monto_solicitado": number,
    "motivo": "string (10-500)",
    "auction_id": "string (opcional)"
  }
- Notas:
  - Valida contra saldo_disponible actual.
  - Retención inmediata: el backend sube saldo_retenido y baja saldo_disponible por el monto solicitado (UI debe reflejarlo).
  - No enviar ni mostrar “tipo_reembolso”.

PATCH /refunds/:id/manage
- Cuerpo (JSON):
  {
    "estado": "confirmado" | "rechazado",
    "motivo": "string (opcional)" // requerido si rechazo desde la UX
  }
- Efecto:
  - En rechazo, backend persiste Refund.motivo_rechazo.

PATCH /refunds/:id/process (multipart/form-data)
- Formularios (multipart):
  - numero_operacion: string (obligatorio)
  - tipo_transferencia: 'transferencia'|'deposito' (opcional)
  - banco_destino, numero_cuenta_destino (opcionales, si el flujo de negocio los requiere)
  - voucher: file (opcional)
- Efecto:
  - Movement salida/reembolso validado; saldo_total baja por el monto; saldo_disponible no cambia (ya se descontó al solicitar); se libera el retenido.

Movements (GET /movements y GET /users/:id/movements)
- include=refund ya no devuelve tipo_reembolso.
- UI debe identificar por:
  - tipo_movimiento_general: 'entrada'|'salida'
  - tipo_movimiento_especifico: 'reembolso'|'penalidad'|'pago_garantia'
- Mapeos UI sugeridos:
  - entrada/reembolso → “Liberación de garantía”
  - salida/reembolso → “Devolución de dinero”
  - salida/penalidad → “Penalidad 30%”

Validaciones y mensajes en FE
- Solicitud:
  - monto_solicitado > 0, máximo 2 decimales.
  - No exceder saldo_disponible (código posible: REFUND_AMOUNT_EXCEEDS_AVAILABLE).
- Proceso (admin):
  - numero_operacion obligatorio (si falta, backend responde conflicto).

Migraciones en el código del Frontend
- Eliminar:
  - Constantes y enums de tipo_reembolso (mantener_saldo, devolver_dinero).
  - Radios/combos en formularios que permitan elegir el tipo.
  - Textos/i18n relacionados a “mantener_saldo”.
- Actualizar:
  - DTOs/Types de Refund: remover tipo_reembolso, agregar motivo_rechazo en vista/tabla/detalle.
  - Formularios:
    - Cliente: POST /refunds sin tipo_reembolso; auction_id opcional; validación contra saldo_disponible en tiempo real (recomendado).
    - Admin: proceso de reembolso requiere numero_operacion; permitir adjuntar voucher.
  - Listas y Detalles:
    - Movements: etiquetar “entrada/reembolso” como liberación y “salida/reembolso” como devolución.
    - Refunds: mostrar motivo_rechazo si estado = rechazado.
  - Tests E2E/UI:
    - Remover flujos de “mantener_saldo”; asegurar que tras “perdida” el saldo disponible sube automáticamente.
- Copys UI:
  - “Mantener saldo” → eliminar.
  - “Devolver dinero” → dejar como única opción/acción.
  - “Liberación automática de garantía” → nuevo copy en movimientos relacionados a competencia perdida/penalizada.

Riesgos y consideraciones UX
- Concurrencia: la liberación automática tras “perdida/penalizada” podría reflejarse con un pequeño delay (depende de notificación). Gestionar estados de refresco en la UI.
- Revisar paginaciones y filtros: el usuario puede ver cambios rápidos en saldos; ofrecer feedback visual (skeleton/auto-refresh).
- Accesibilidad: mensajes claros cuando el monto excede el saldo disponible; resaltar nuevo estado “rechazado” con motivo.

Checklist para el equipo de Frontend
- [ ] Eliminar selector de tipo de reembolso y referencias a “mantener_saldo”.
- [ ] Actualizar DTOs/Types de Refund: -tipo_reembolso, +motivo_rechazo.
- [ ] Ajustar formulario de solicitud de reembolso (cliente) al nuevo contrato.
- [ ] Ajustar formulario de procesamiento (admin): numero_operacion obligatorio; voucher opcional.
- [ ] Actualizar “Mi Saldo” para reflejar liberación automática tras “perdida/penalizada”.
- [ ] Etiquetar movimientos: entrada/reembolso (liberación) y salida/reembolso (devolución).
- [ ] Actualizar textos/i18n (remover “mantener_saldo”).
- [ ] Ajustar notificaciones mostradas y sus descripciones.
- [ ] Actualizar pruebas de UI/E2E que dependían de “mantener_saldo”.

Referencias internas (para revisar contratos):
- Documentación de API actualizada en backend.
- Prerrequisitos/Reglas de negocio actualizados (retención y automatismos).