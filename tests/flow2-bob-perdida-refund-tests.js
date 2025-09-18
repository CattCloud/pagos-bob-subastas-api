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
  const { res, data } = await req('/auth/admin-access', { method: 'POST' });
  if (!res.ok || !data?.success) throw new Error('Login admin falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
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
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // empieza en 5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h
  const placa = uniquePlate();
  const meta = uniqueAssetMeta();
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
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
  return { id: data.data.auction.id, startISO, endISO, placa };
}

async function setWinner(adminHeaders, auctionId, userId, montoOferta, fechaOfertaISO) {
  const payload = {
    user_id: userId,
    monto_oferta: montoOferta,
    fecha_oferta: fechaOfertaISO,
    fecha_limite_pago: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function registerGuaranteePayment(clientHeaders, auctionId, guaranteeAmount, startISO) {
  const waitMs = new Date(startISO).getTime() - Date.now() + 1500;
  if (waitMs > 0) await delay(waitMs);

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

async function createRefund(clientHeaders, auctionId, monto, tipo, motivo) {
  const { res, data } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auctionId, monto_solicitado: approx2(monto), tipo_reembolso: tipo, motivo },
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

  const { id: auctionId, startISO } = await createAuction(adminHeaders);
  const balAfterCreate = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterCreate);
  assertEq2('Total tras crear subasta (sin cambios)', balAfterCreate.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras crear subasta (sin cambios)', balAfterCreate.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras crear subasta (sin cambios)', balAfterCreate.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras crear subasta (sin cambios)', balAfterCreate.saldo_disponible, bal0.saldo_disponible);

  const oferta = 1250.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO);
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambios)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambios)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambios)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambios)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  const garantia = approx2(oferta * 0.08);
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO);
  const balAfterRegister = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRegister);
  assertEq2('Total tras registrar pago (pendiente)', balAfterRegister.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registrar pago (pendiente)', balAfterRegister.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registrar pago (pendiente)', balAfterRegister.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registrar pago (pendiente)', balAfterRegister.saldo_disponible, bal0.saldo_disponible);

  await approvePayment(adminHeaders, movementId);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  assertEq2('Total tras validar pago', balAfterApprove.saldo_total, balAfterRegister.saldo_total + garantia);
  assertEq2('Retenido tras validar pago', balAfterApprove.saldo_retenido, balAfterRegister.saldo_retenido + garantia);
  assertEq2('Aplicado tras validar pago', balAfterApprove.saldo_aplicado, balAfterRegister.saldo_aplicado);
  assertEq2('Disponible tras validar pago (sin cambio)', balAfterApprove.saldo_disponible, balAfterRegister.saldo_disponible);

  await setCompetitionResult(adminHeaders, auctionId, 'perdida', 'BOB perdió la competencia externa');
  const balAfterPerdida = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterPerdida);
  assertEq2('Total tras perdida (sin cambio)', balAfterPerdida.saldo_total, balAfterApprove.saldo_total);
  assertEq2('Retenido tras perdida (sin cambio)', balAfterPerdida.saldo_retenido, balAfterApprove.saldo_retenido);
  assertEq2('Aplicado tras perdida (sin cambio)', balAfterPerdida.saldo_aplicado, balAfterApprove.saldo_aplicado);
  assertEq2('Disponible tras perdida (sin cambio)', balAfterPerdida.saldo_disponible, balAfterApprove.saldo_disponible);

  const refundId = await createRefund(clientHeaders, auctionId, garantia, 'devolver_dinero', 'BOB no ganó la competencia externa');
  const balAfterRefundRequest = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundRequest);
  assertEq2('Total tras solicitar reembolso (sin cambio)', balAfterRefundRequest.saldo_total, balAfterPerdida.saldo_total);
  assertEq2('Retenido tras solicitar reembolso (sin cambio)', balAfterRefundRequest.saldo_retenido, balAfterPerdida.saldo_retenido);
  assertEq2('Disponible tras solicitar reembolso (sin cambio)', balAfterRefundRequest.saldo_disponible, balAfterPerdida.saldo_disponible);

  await manageRefund(adminHeaders, refundId, 'confirmado', 'Confirmado vía llamada');
  const balAfterRefundConfirm = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundConfirm);
  assertEq2('Total tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_total, balAfterRefundRequest.saldo_total);
  assertEq2('Retenido tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_retenido, balAfterRefundRequest.saldo_retenido);
  assertEq2('Disponible tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_disponible, balAfterRefundRequest.saldo_disponible);

  await processRefund(adminHeaders, refundId);
  const balAfterRefundProcess = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundProcess);
  assertEq2('Total tras procesar reembolso', balAfterRefundProcess.saldo_total, balAfterPerdida.saldo_total - garantia);
  assertEq2('Retenido tras procesar reembolso', balAfterRefundProcess.saldo_retenido, balAfterPerdida.saldo_retenido - garantia);
  assertEq2('Aplicado tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_aplicado, balAfterPerdida.saldo_aplicado);
  assertEq2('Disponible tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_disponible, balAfterPerdida.saldo_disponible);

  console.log('\n✅ FLUJO 2 completado. Retención se mantuvo en "perdida" y se liberó al procesar reembolso. Deltas correctos.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 2:', e);
    process.exit(1);
  });
}

module.exports = { run };