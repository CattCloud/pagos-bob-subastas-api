/**
 * FLUJO 3: BOB Gana pero Cliente No Paga el Vehículo - Penalidad del 30%
 * Requiere API corriendo en http://localhost:3000
 * Node 18+ (fetch nativo, Blob/FormData disponibles)
 *
 * Escenario:
 * - Cliente "Carlos" (usamos cliente CE seeded: 987654321) gana con oferta 15,000 (garantía 1,200)
 * - Registra pago de garantía, Admin valida (finalizada)
 * - Admin registra resultado "penalizada" (cliente no pagó) -> se aplica penalidad 30% (= 360)
 * - Cliente solicita reembolso de 840 (70%), Admin confirma y procesa
 * - Verificaciones de saldos en cada paso (usamos DELTAS respecto estados previos)
 *
 * Expectativas de saldos:
 *   - Tras aprobar pago: total +1200, retenido +1200, disponible 0
 *   - Tras penalizar: total -360 (queda 840), retenido 0, disponible 840
 *   - Tras reembolso: total -840 (queda 0), retenido 0, disponible 0
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
function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function loginAdmin() {
  const { res, data } = await req('/auth/admin-access', { method: 'POST' });
  if (!res.ok || !data?.success) throw new Error('Login admin falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

async function loginClient(docType = 'RUC', docNumber = '20123456789') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

function plateXYZ() {
  // Asegurar unicidad para evitar DUPLICATE_PLATE entre ejecuciones
  const suffix = Math.random().toString(36).slice(2,5).toUpperCase();
  return `XYZ-${suffix}`;
}

async function createAuction(adminHeaders) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // empieza en 5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h
  const placa = plateXYZ();
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA PENALIZADA S.A.',
      marca: 'Honda',
      modelo: 'Civic',
      año: 2021,
      descripcion: 'FLUJO3 - Honda Civic 2021',
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
  form.append('concepto', 'Pago garantía FLUJO3');

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
    body: { comentarios: 'Verificado FLUJO3' },
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
  const payload = { monto_solicitado: approx2(monto), motivo, auction_id: auctionId };
  const { res, data } = await req('/refunds', { method: 'POST', headers: clientHeaders, body: payload });
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

async function run() {
  console.log('🚀 Iniciando FLUJO 3 - BOB gana, cliente no paga (penalidad 30% + reembolso 70%)');

  await req('/');

  const adminLogin = await loginAdmin();
  const clientLogin = await loginClient();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': clientLogin.sessionId };
  const clientId = clientLogin.user.id;

  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  console.log('Estado Inicial Cliente:', bal0);

  // Paso 1: Crear subasta
  const { id: auctionId, startISO } = await createAuction(adminHeaders);
  const balAfterCreate = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterCreate);
  assertEq2('Total tras crear subasta (sin cambios)', balAfterCreate.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras crear subasta (sin cambios)', balAfterCreate.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras crear subasta (sin cambios)', balAfterCreate.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras crear subasta (sin cambios)', balAfterCreate.saldo_disponible, bal0.saldo_disponible);

  // Paso 2: Registrar ganador
  const oferta = 15000.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO);
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambios)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambios)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambios)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambios)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  // Paso 3: Registrar pago de garantía (pendiente)
  const garantia = 1200.00; // 8% de 15000
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO);
  const balAfterRegister = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRegister);
  assertEq2('Total tras registrar pago (pendiente)', balAfterRegister.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registrar pago (pendiente)', balAfterRegister.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registrar pago (pendiente)', balAfterRegister.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registrar pago (pendiente)', balAfterRegister.saldo_disponible, bal0.saldo_disponible);

  // Paso 4: Admin valida el pago
  await approvePayment(adminHeaders, movementId);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  assertEq2('Total tras validar pago', balAfterApprove.saldo_total, balAfterRegister.saldo_total + garantia);
  assertEq2('Retenido tras validar pago', balAfterApprove.saldo_retenido, balAfterRegister.saldo_retenido + garantia);
  assertEq2('Aplicado tras validar pago', balAfterApprove.saldo_aplicado, balAfterRegister.saldo_aplicado);
  assertEq2('Disponible tras validar pago', balAfterApprove.saldo_disponible, balAfterRegister.saldo_disponible);

  // Paso 5: Registrar resultado "penalizada" (cliente no pagó)
  await setCompetitionResult(adminHeaders, auctionId, 'penalizada', 'Cliente no pagó vehículo');
  const balAfterPenal = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterPenal);

  const penalidad = approx2(garantia * 0.30); // 360.00
  const esperadoTotalTrasPenal = approx2(balAfterApprove.saldo_total - penalidad); // 840
  // Expectativas: total disminuye 360, retenido libera a 0, disponible = total (840)
  assertEq2('Total tras penalizar', balAfterPenal.saldo_total, esperadoTotalTrasPenal);
  assertEq2('Retenido tras penalizar (liberado)', balAfterPenal.saldo_retenido, 0);
  assertEq2('Aplicado tras penalizar (sin cambio)', balAfterPenal.saldo_aplicado, balAfterApprove.saldo_aplicado);
  assertEq2('Disponible tras penalizar (70% disponible)', balAfterPenal.saldo_disponible, esperadoTotalTrasPenal);

  // Paso 6: Cliente solicita reembolso del 70% (840)
  const refundId = await createRefund(clientHeaders, auctionId, garantia - penalidad, 'Solicitar devolución tras penalidad');
  const balAfterRefundReq = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundReq);
  // Nuevo: retención al solicitar (previene doble gasto)
  assertEq2('Total tras solicitar reembolso (sin cambio)', balAfterRefundReq.saldo_total, balAfterPenal.saldo_total);
  assertEq2('Retenido tras solicitar reembolso (+70%)', balAfterRefundReq.saldo_retenido, approx2(balAfterPenal.saldo_retenido + (garantia - penalidad)));
  assertEq2('Disponible tras solicitar reembolso (-70%)', balAfterRefundReq.saldo_disponible, approx2(balAfterPenal.saldo_disponible - (garantia - penalidad)));

  // Paso 7: Admin confirma (mantiene retención)
  await manageRefund(adminHeaders, refundId, 'confirmado', 'Confirmado devolución 70%');
  const balAfterRefundConfirm = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundConfirm);
  assertEq2('Total tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_total, balAfterRefundReq.saldo_total);
  assertEq2('Retenido tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_retenido, balAfterRefundReq.saldo_retenido);
  assertEq2('Disponible tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_disponible, balAfterRefundReq.saldo_disponible);

  // Paso 8: Admin procesa reembolso (salida 840)
  await processRefund(adminHeaders, refundId);
  const balAfterRefundProcess = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundProcess);

  assertEq2('Total tras procesar reembolso (queda 0)', balAfterRefundProcess.saldo_total, 0);
  assertEq2('Retenido tras procesar reembolso', balAfterRefundProcess.saldo_retenido, 0);
  assertEq2('Aplicado tras procesar reembolso (sin cambio)', balAfterRefundProcess.saldo_aplicado, balAfterRefundConfirm.saldo_aplicado);
  assertEq2('Disponible tras procesar reembolso (queda 0)', balAfterRefundProcess.saldo_disponible, 0);

  console.log('\n✅ FLUJO 3 completado. Penalidad 30% aplicada, 70% reembolsado. Saldos finales en 0.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 3:', e);
    process.exit(1);
  });
}

module.exports = { run };