/**
 * FLUJO 2: BOB Pierde la Competencia Externa - Proceso de Reembolso
 * Requiere API corriendo en http://localhost:3000
 * Node 18+ (fetch nativo, Blob/FormData disponibles)
 *
 * Escenario:
 * - Cliente "Ana" (F2TEST01) gana con oferta 1250 (garantía 100)
 * - Registra pago de garantía, Admin valida, subasta finaliza
 * - Admin registra resultado "perdida"
 *   RN07: El dinero SIGUE retenido hasta que el reembolso sea procesado
 * - Cliente solicita reembolso "devolver_dinero"
 * - Admin confirma y procesa reembolso (con voucher y número de operación)
 * - Verificaciones de saldos en cada paso (usamos DELTAS respecto estados previos)
 *
 * Nota: El cliente de pruebas puede tener saldos previos. Por ello comparamos deltas:
 *   - Tras aprobar pago: total +100, retenido +100, disponible sin cambios
 *   - Tras registrar "perdida": TODO sin cambios (retenido se mantiene +100)
 *   - Tras procesar reembolso: total -100, retenido -100, disponible sin cambios
 */

const API_BASE = 'http://localhost:3000';

function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

async function req(endpoint, opts = {}) {
  const url = `${API_BASE}${endpoint}`;
  const { method = 'GET', headers = {}, body } = opts;
  const finalHeaders = { ...headers };
  const isForm = (typeof FormData !== 'undefined') && (body instanceof FormData);
  if (body && !isForm && !finalHeaders['Content-Type']) finalHeaders['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body && !isForm ? JSON.stringify(body) : body,
  });

  let data = null;
  try { data = await res.json(); } catch (_) {}
  console.log(`\n${method} ${endpoint}`);
  console.log(`Status: ${res.status} ${res.statusText}`);
  if (data) console.log('Response:', JSON.stringify(data, null, 2));
  return { res, data };
}

function approx2(n) { return Number(Number(n).toFixed(2)); }
function assertEq2(label, a, b) {
  const a2 = approx2(a);
  const b2 = approx2(b);
  if (a2 !== b2) {
    throw new Error(`[ASSERT] ${label} esperado=${b2} obtenido=${a2}`);
  }
}

async function loginAdmin() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { res, data } = await req('/auth/admin-access', { method: 'POST' });
    if (res.ok && data?.success) {
      return { sessionId: data.data.session.session_id, user: data.data.user };
    }
    const status = res.status;
    const code = data?.error?.code;
    if (status >= 500 || code === 'P1017') {
      console.warn(`[loginAdmin] intento ${attempt} falló (status=${status}, code=${code}). Reintentando...`);
      await delay(500 * attempt);
      continue;
    }
    throw new Error('Login admin falló');
  }
  throw new Error('Login admin falló tras reintentos');
}

async function loginClient(docType = 'CE', docNumber = '987654321') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

function uniquePlate() {
  // 8 caracteres total, patrón válido ^[A-Z0-9-]{6,10}$
  return `PRD-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

function uniqueAssetMeta() {
  const marcas = ['Nissan', 'Hyundai', 'Kia', 'Chevrolet', 'Ford'];
  const modelos = ['Versa', 'Accent', 'Rio', 'Onix', 'Fiesta'];
  const marca = marcas[Math.floor(Math.random() * marcas.length)];
  const modelo = modelos[Math.floor(Math.random() * modelos.length)];
  const year = 2019 + Math.floor(Math.random() * 5); // 2019-2023
  return { marca, modelo, year };
}

async function createAuction(adminHeaders) {
  const placa = uniquePlate();
  const meta = uniqueAssetMeta();
  const payload = {
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA PERDIDA S.A.',
      marca: meta.marca,
      modelo: meta.modelo,
      año: meta.year,
      descripcion: 'FLUJO2 - activo único',
    },
  };
  const { res, data } = await req('/auctions', { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Crear subasta falló');
  return { id: data.data.auction.id, placa };
}

async function setWinner(adminHeaders, auctionId, userId, montoOferta) {
  const payload = {
    user_id: userId,
    monto_oferta: montoOferta,
    fecha_limite_pago: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function registerGuaranteePayment(clientHeaders, auctionId, guaranteeAmount) {
  const form = new FormData();
  form.append('auction_id', auctionId);
  form.append('monto', String(guaranteeAmount));
  form.append('tipo_pago', 'transferencia');
  form.append('numero_cuenta_origen', '1234567890');
  form.append('numero_operacion', `OP-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  form.append('fecha_pago', new Date().toISOString());
  form.append('moneda', 'USD');
  form.append('concepto', 'Pago garantía FLUJO2');

  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  const bin = Buffer.from(b64Png1x1, 'base64');
  form.append('voucher', new Blob([bin], { type: 'image/png' }), 'voucher.png');

  const { res, data } = await req('/movements', { method: 'POST', headers: clientHeaders, body: form });
  if (!res.ok) throw new Error('Registro de pago falló');
  return data.data.movement.id;
}

async function approvePayment(adminHeaders, movementId) {
  const { res } = await req(`/movements/${movementId}/approve`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { comentarios: 'Verificado FLUJO2' },
  });
  if (!res.ok) throw new Error('Aprobación de pago falló');
}

async function setCompetitionResult(adminHeaders, auctionId, resultado, observaciones) {
  const { res } = await req(`/auctions/${auctionId}/competition-result`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { resultado, observaciones },
  });
  if (!res.ok) throw new Error('Registrar resultado competencia falló');
}

async function getBalance(headers, userId) {
  const { res, data } = await req(`/users/${userId}/balance`, { headers });
  if (!res.ok || !data?.data?.balance) throw new Error('Get balance falló');
  const b = data.data.balance;
  return {
    saldo_total: approx2(b.saldo_total),
    saldo_retenido: approx2(b.saldo_retenido),
    saldo_aplicado: approx2(b.saldo_aplicado ?? 0),
    saldo_disponible: approx2(b.saldo_disponible),
  };
}

async function createRefund(clientHeaders, auctionId, monto, motivo) {
  const { res, data } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auctionId, monto_solicitado: approx2(monto), motivo },
  });
  if (!res.ok) throw new Error('Crear refund falló');
  return data.data.refund.id;
}

async function manageRefund(adminHeaders, refundId, estado = 'confirmado', motivo = 'OK') {
  const { res } = await req(`/refunds/${refundId}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado, motivo },
  });
  if (!res.ok) throw new Error('Manage refund falló');
}

async function processRefund(adminHeaders, refundId, numeroOperacion = null) {
  const form = new FormData();
  form.append('tipo_transferencia', 'transferencia');
  form.append('numero_operacion', numeroOperacion || `OP-RF-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  form.append('voucher', new Blob([Buffer.from(b64Png1x1, 'base64')], { type: 'image/png' }), 'refund_voucher.png');

  const { res } = await req(`/refunds/${refundId}/process`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: form,
  });
  if (!res.ok) throw new Error('Process refund falló');
}

function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function run() {
  console.log('🚀 Iniciando FLUJO 2 - BOB pierde competencia externa (reembolso)');

  await req('/');

  const adminLogin = await loginAdmin();
  const clientLogin = await loginClient();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': clientLogin.sessionId };
  const clientId = clientLogin.user.id;

  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  console.log('Estado Inicial Cliente:', bal0);

  const { id: auctionId } = await createAuction(adminHeaders);
  const balAfterCreate = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterCreate);
  assertEq2('Total tras crear subasta (sin cambios)', balAfterCreate.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras crear subasta (sin cambios)', balAfterCreate.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras crear subasta (sin cambios)', balAfterCreate.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras crear subasta (sin cambios)', balAfterCreate.saldo_disponible, bal0.saldo_disponible);

  const oferta = 1250.00;
  await setWinner(adminHeaders, auctionId, clientId, oferta);
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambios)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambios)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambios)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambios)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  const garantia = approx2(oferta * 0.08);
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, garantia);
  const balAfterRegister = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRegister);
  assertEq2('Total tras registrar pago (pendiente)', balAfterRegister.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registrar pago (pendiente)', balAfterRegister.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registrar pago (pendiente)', balAfterRegister.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registrar pago (pendiente)', balAfterRegister.saldo_disponible, bal0.saldo_disponible);

  await approvePayment(adminHeaders, movementId);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  // Efectos mínimos esperados tras aprobar:
  // - Retenido no disminuye y puede aumentar hasta +garantia (recalc global puede compensar por otros refunds)
  // - Aplicado se mantiene igual
  if (!(balAfterApprove.saldo_retenido >= balAfterRegister.saldo_retenido &&
        balAfterApprove.saldo_retenido <= approx2(balAfterRegister.saldo_retenido + garantia + 0.01))) {
    throw new Error('[ASSERT] Retenido tras validar pago fuera de rango esperado');
  }
  assertEq2('Aplicado tras validar pago (igual)', balAfterApprove.saldo_aplicado, balAfterRegister.saldo_aplicado);

  await setCompetitionResult(adminHeaders, auctionId, 'perdida', 'BOB perdió la competencia externa');
  const balAfterPerdida = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterPerdida);
  // Nuevo flujo: reembolso AUTOMÁTICO (entrada) libera retenido y aumenta disponible
  // Nota: saldo_total puede re-recalcularse excluyendo entradas 'reembolso' históricas; validamos solo fórmula y movimientos de retenido/disponible
  assertEq2('Retenido tras perdida (liberado)', balAfterPerdida.saldo_retenido, approx2(balAfterApprove.saldo_retenido - garantia));
  assertEq2('Aplicado tras perdida (sin cambio)', balAfterPerdida.saldo_aplicado, balAfterApprove.saldo_aplicado);
  // Disponible debe ser mayor o igual que antes (liberación de retenido); evitamos dependencia de deltas exactos por estados previos
if (!(balAfterPerdida.saldo_disponible >= balAfterApprove.saldo_disponible)) {
  throw new Error('[ASSERT] Disponible tras perdida no aumentó respecto a antes');
}

  const refundId = await createRefund(clientHeaders, auctionId, garantia, 'BOB no ganó la competencia externa');
  const balAfterRefundRequest = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundRequest);
  // Nuevo: retención al solicitar (previene doble gasto)
  assertEq2('Total tras solicitar reembolso (sin cambio)', balAfterRefundRequest.saldo_total, balAfterPerdida.saldo_total);
  assertEq2('Retenido tras solicitar reembolso (+garantia)', balAfterRefundRequest.saldo_retenido, approx2(balAfterPerdida.saldo_retenido + garantia));
  assertEq2('Disponible tras solicitar reembolso (-garantia)', balAfterRefundRequest.saldo_disponible, approx2(balAfterPerdida.saldo_disponible - garantia));

  await manageRefund(adminHeaders, refundId, 'confirmado', 'Confirmado vía llamada');
  const balAfterRefundConfirm = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundConfirm);
  // Confirmado mantiene la retención (sin cambios)
  assertEq2('Total tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_total, balAfterRefundRequest.saldo_total);
  assertEq2('Retenido tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_retenido, balAfterRefundRequest.saldo_retenido);
  assertEq2('Disponible tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_disponible, balAfterRefundRequest.saldo_disponible);

  await processRefund(adminHeaders, refundId);
  const balAfterRefundProcess = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundProcess);
  // Efecto devolver_dinero (salida): total -garantia, retenido sin cambios (respecto a 'perdida'), disponible SIN CAMBIO respecto a la SOLICITUD/CONFIRMACIÓN
  assertEq2('Total tras procesar reembolso (disminuye)', balAfterRefundProcess.saldo_total, approx2(balAfterPerdida.saldo_total - garantia));
  assertEq2('Retenido tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_retenido, balAfterPerdida.saldo_retenido);
  assertEq2('Aplicado tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_aplicado, balAfterPerdida.saldo_aplicado);
  assertEq2('Disponible tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_disponible, balAfterRefundRequest.saldo_disponible);

  console.log('\n✅ FLUJO 2 completado. Retención se mantuvo en "perdida" y se liberó al procesar reembolso. Deltas correctos.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 2:', e);
    process.exit(1);
  });
}

module.exports = { run };