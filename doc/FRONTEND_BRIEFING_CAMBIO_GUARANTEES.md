# Briefing Frontend: Cambio de Offers → Guarantees y eliminación de fecha_inicio/fecha_fin

Este documento resume los cambios recientes en el backend que afectan directamente al frontend. El objetivo es que el equipo de UI/UX y desarrollo cliente actualice vistas, validaciones y flujos sin fricción.

Fuentes de referencia oficiales:
- Documentación API actualizada: [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md)
- Guía de contexto Frontend-Backend: [`doc/CONTEXTO_FRONTEND_BACKEND.md`](doc/CONTEXTO_FRONTEND_BACKEND.md)
- Reglas y dominio funcional: [`doc/Prerequisitos.md`](doc/Prerequisitos.md)
- HU detalladas (impactadas): 
  - [`doc/HU Detalladas/HU- Gestión de Subastas (ADMIN).md`](doc/HU%20Detalladas/HU-%20Gestión%20de%20Subastas%20(ADMIN).md)
  - [`doc/HU Detalladas/HU - Registro de Pago de Garantía (Cliente).md`](doc/HU%20Detalladas/HU%20-%20Registro%20de%20Pago%20de%20Garantía%20(Cliente).md)

---

## 1) Resumen Ejecutivo del Cambio

- Eliminado del modelo Auction: campos fecha_inicio y fecha_fin.
- Renombrado conceptual y técnico: Offer → Guarantee (Garantía/Ganador).
- Movement_References cambia el tipo de referencia de 'offer' a 'guarantee'.
- Se movió fecha_limite_pago de Auction a Guarantee (por ganador). El backend mantiene auction.fecha_limite_pago en respuestas como campo calculado desde la Guarantee ganadora (compatibilidad).
- Se eliminaron de Guarantee los campos fecha_oferta y fecha_asignacion_ganador (no se envían ni se muestran en UI).
- Regla de fecha de pago: únicamente “no futura” (ya no depende del inicio de la subasta).
- La base de datos fue vaciada (excepto la tabla de usuarios) para facilitar la migración de esquema sin conflictos.

Impacto general:
- No se deben enviar ni mostrar fecha_inicio/fecha_fin en pantallas.
- Se debe ajustar cualquier texto de UI, filtros y validaciones que dependían de rangos de fecha de subasta.
- Cambios mínimos en endpoints; el único cambio de ruta publicado para frontend es un endpoint de “stats” (ver sección 4.3).

---

## 2) Impactos UI/UX concretos

2.1. Listado y detalle de subastas (Admin)
- Quitar columnas/campos “Fecha Inicio” y “Fecha Fin”.
- Mantener/mostrar:
  - created_at (si requieren orden por creación)
  - fecha_limite_pago (cuando exista; expuesto por backend como campo calculado desde la Guarantee ganadora)
  - estado de la subasta
  - datos del activo (placa, marca, modelo, año)
- Filtros por fecha en la UI (si existían) deben aplicar sobre created_at (no sobre inicio/fin).

2.2. Crear subasta (Admin)
- Ya no se piden fechas de inicio/fin. El payload de creación es únicamente el asset (placa, empresa_propietaria, marca, modelo, año, descripcion).
- Ver ejemplo actualizado en: [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md).

2.3. Registrar/Ver ganador (Admin)
- La entidad “ganador” ahora es Guarantee (no Offer). Los labels de UI deben decir “Garantía/Ganador”.
- El modal/form incluye:
  - user_id
  - monto_oferta
  - fecha_limite_pago (opcional)
- Validaciones:
  - monto_oferta > 0 y ≤ 999,999.99
- La subasta pasa a estado “pendiente” y opcionalmente con fecha_limite_pago.

2.4. Registro de pago de garantía (Cliente)
- Validación de la fecha de pago: sólo “no futura”.
- Monto a pagar: exactamente 8% de monto_oferta.
- UI no debe intentar validar contra fecha de inicio de subasta (esa regla ya no existe).

2.5. Reembolsos (Cliente/Admin)
- Solicitud requiere auction_id.
- El frontend puede permitir la solicitud aun cuando “saldo disponible” = 0, porque la validación financiera se realiza al procesar, contra el monto retenido por subasta (Regla RN07).
- Estados de subasta relevantes para retención: finalizada, ganada, perdida. Penalizada retiene hasta resolverse (ver docs de negocio).
- Mantener textos y ayudas que aclaren que el reembolso se procesa contra lo retenido por la subasta.

2.6. Terminología y copys de UI
- Reemplazar “Ofertas” por “Garantías” donde corresponda (ej: “Mis Garantías”, “Pagos de Garantía”, “Ganador (Garantía)”).

---

## 3) Endpoints y contratos relevantes

3.1. Subastas
- Nota: En responses, auction.fecha_limite_pago es un campo calculado desde guarantee.fecha_limite_pago del ganador vigente (id_offerWin); la fuente de verdad vive en Guarantee.
- GET /auctions (listado): ya no hay campos fecha_inicio/fecha_fin, los filtros de fechas en backend se aplican sobre created_at (opcional).
- POST /auctions (crear): enviar sólo “asset” (placa, etc.). Ver payload actualizado en: [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md).

3.2. Ganadores (Garantías)
- POST /auctions/:id/winner (registrar ganador preliminar)
  Request body:
  {
    "user_id": "cmuser...",
    "monto_oferta": 12000.00,
    "fecha_limite_pago": "2025-09-19T18:00:00Z" // opcional
  }
- POST /auctions/:id/reassign-winner (reasignar ganador)
- GET /users/:id/won-auctions (subastas ganadas del usuario)

3.3. Movements (pagos de garantía)
- POST /movements (multipart/form-data)
  Campos: auction_id, monto, tipo_pago, numero_cuenta_origen, numero_operacion, fecha_pago (no futura), voucher (archivo), moneda (USD), concepto (opcional).
- PATCH /movements/:id/approve | /reject

3.4. Reembolsos
- POST /refunds (crear solicitud) con auction_id obligatorio.
- PATCH /refunds/:id/manage (confirmar/rechazar) y /process (procesar).
- Notas de UX: se permite solicitar aunque saldo disponible sea 0; ver reglas en [`doc/CONTEXTO_FRONTEND_BACKEND.md`](doc/CONTEXTO_FRONTEND_BACKEND.md).

3.5. Saldo del usuario
- GET /users/:id/balance y GET /users/:id/movements.

---

## 4) Cambios de rutas y validaciones a revisar en Frontend

4.1. Eliminadas dependencias de inicio/fin
- No usar fecha_inicio/fecha_fin en formularios ni validaciones.
- No mostrar ni filtrar por esas fechas.
- Si había lógica con contadores/cronómetros basada en fecha_inicio/fin, reevaluar y, de ser necesario, usar created_at únicamente con fines de display, y fecha_limite_pago (cuando aplique) para vencimientos.

4.2. Validaciones de fechas
- Pago: fecha_pago “no futura”.

4.3. Ruta de “stats” de usuarios
- Si el frontend usaba /users/offers/stats, debe migrar a /users/guarantees/stats (Admin).
  - El backend ya expone la ruta en [`routes/users.js`](routes/users.js) vía [`controllers/guaranteeController.js`](controllers/guaranteeController.js).
  - Ver también el resumen: [`tests/endpoints-summary.md`](tests/endpoints-summary.md).

---

## 5) Cambios en textos y componentes UI

- Menús:
  - Cliente:
    - “Mis Garantías”
    - “Pagar Garantía”
    - “Mi Saldo”
    - “Historial de Transacciones”
    - “Solicitar Reembolso”
  - Admin:
    - “Pagos de Garantía”
    - “Gestión de Subastas”
    - “Nueva Subasta”
    - “Resultados de Competencia”
    - “Gestión de Saldos”
    - “Gestión de Facturación”
    - “Gestión de Reembolsos”
- Formularios:
  - Crear subasta: sólo datos del activo.
  - Registrarse como ganador: campos mencionados en 3.2.
  - Registrar pago: verificar 8%, archivo voucher, y fecha no futura.

---

## 6) Casos de prueba de referencia (contratos reales)

Usar los tests actualizados como “documentación ejecutable”:
- Flujo BOB gana: [`tests/flow1-bob-ganada-tests.js`](tests/flow1-bob-ganada-tests.js)
- Flujo BOB pierde + refund: [`tests/flow2-bob-perdida-refund-tests.js`](tests/flow2-bob-perdida-refund-tests.js)
- Otros flujos (vencidos, reintentos, etc.): 
  - [`tests/flow3-bob-penalidad-tests.js`](tests/flow3-bob-penalidad-tests.js)
  - [`tests/flow4-bob-perdida-mantener-saldo-tests.js`](tests/flow4-bob-perdida-mantener-saldo-tests.js)
  - [`tests/flow6-multiples-subastas-mixto-tests.js`](tests/flow6-multiples-subastas-mixto-tests.js)
  - [`tests/flow7-subasta-vencida-tests.js`](tests/flow7-subasta-vencida-tests.js)
  - [`tests/flow8-extiende-plazo-pago-tests.js`](tests/flow8-extiende-plazo-pago-tests.js)
  - [`tests/flow9-reintentos-pago-rechazado-tests.js`](tests/flow9-reintentos-pago-rechazado-tests.js)

Nota: Algunos tests anteriores pueden aún enviar fecha_inicio/fecha_fin; deben actualizarse en el frontend (payloads) ya que el backend las ignora y/o no las espera.

---

## 7) Checklist de tareas para el Frontend

- [ ] Remover referencias a fecha_inicio/fecha_fin en formularios, pantallas y validaciones.
- [ ] Ajustar listados: columnas de fechas; ordenar por created_at si se requiere.
- [ ] Actualizar textos Ofertas → Garantías (labels, headings, tooltips).
- [ ] Ajustar formulario de alta de subasta (sólo asset).
- [ ] Ajustar formulario de ganador (Guarantee): sin fecha_oferta ni fecha_asignacion_ganador; opcional fecha_limite_pago.
- [ ] Ajustar formulario de pago: validar fecha_pago “no futura”.
- [ ] Migrar cualquier uso de /users/offers/stats → /users/guarantees/stats.
- [ ] Revisar flujos de reembolso: permitir solicitud aunque saldo disponible sea 0; explicitar que el cálculo y validación real es contra retenido por subasta al procesar.
- [ ] QA manual guiado apoyándose en los tests listados (como contratos de referencia).

---

## 8) Riesgos y mitigaciones

- Inercia del frontend a validar contra fecha_inicio/fecha_fin:
  - Mitigación: centralizar validaciones de fechas en helpers de UI y eliminar reglas obsoletas.
- Copys con “ofertas” residuales:
  - Mitigación: búsqueda global y repaso en UX.
- Asunciones de “disponible” para reembolso:
  - Mitigación: usar copy y tooltips que aclaren que la solicitud se procesa contra retenido por subasta.

---

## 9) Notas técnicas

- El backend cambió Movement_References a reference_type 'guarantee'. Ver esquema: [`prisma/schema.prisma`](prisma/schema.prisma).
- La lógica de cálculo de garantía (8%) se mantiene; revisar helper de cálculo en [`utils/helpers.js`](utils/helpers.js) si desean replicar el cálculo para previsualización.
- El endpoint de ganador expone garantía creada y subasta en estado 'pendiente' (y fecha_limite_pago si se envía). Ya no existe fecha_oferta ni fecha_asignacion_ganador.

---

## 10) Conclusión

Eliminamos complejidad de fechas de subasta (inicio/fin) y consolidamos el modelo de “ganador” como Guarantee. El frontend debe:
- Depender menos de reglas temporales de subasta,
- Mantener validaciones simples de “fecha no futura”,
- Adoptar la terminología “Garantía”,
- Migrar un endpoint de stats,
- Y actualizar copys/labels en las vistas impactadas.

Cualquier duda de integración, favor contrastar con los ejemplos actualizados en [`doc/DocumentacionAPI.md`](doc/DocumentacionAPI.md) y la guía de contexto [`doc/CONTEXTO_FRONTEND_BACKEND.md`](doc/CONTEXTO_FRONTEND_BACKEND.md).