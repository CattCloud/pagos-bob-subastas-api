/**
 * FLUJO 4: BOB Pierde la Competencia Externa - Reembolso "mantener_saldo"
 * Requiere API corriendo en http://localhost:3000
 * Node 18+ (fetch nativo, Blob/FormData disponibles)
 *
 * Escenario (cliente limpio):
 * - Cliente "Ana" (DNI 12345678 seeded) gana con oferta 8,500 (garantía 680)
 * - Registra pago de garantía, Admin valida (finalizada)
 * - Admin registra resultado "perdida" (dinero retenido hasta reembolso)
 * - Cliente solicita reembolso TIPO "mantener_saldo" por 680, Admin confirma y procesa
 * - Verificaciones de saldos en cada paso
 *
 * Expectativas de saldos:
 *   - Tras aprobar pago: total +680, retenido +680, disponible 0
 *   - Tras registrar "perdida": TODO sin cambios (retenido se mantiene +680)
 *   - Tras reembolso mantener_saldo procesado:
 *       total = 680 (se mantiene, no sale del sistema)
 *       retenido = 0 (liberado)
 *       disponible = 680 (liberado para uso futuro)
 */

const API_BASE = 'http://localhost:3000';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randDigits(len) { return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join(''); }

async function ensureCleanClient() {
  const docType = 'RUC';
  const docNumber = '20' + randDigits(9); // 11 dígitos iniciando con 20
  const email = `flow4+${Date.now()}@example.com`;
  const first_name = 'Cliente';
  const last_name = 'FLUJO4';
  const phone_number = '+51' + randDigits(9);

  try {
    await prisma.user.create({
      data: {
        first_name,
        last_name,
        email,
        phone_number,
        document_type: docType,
        document_number: docNumber,
        user_type: 'client',
      },
    });
  } catch (e) {
    // Si hay colisión de documento/email, reintentar con otros valores aleatorios
    return ensureCleanClient();
  }
  return { docType, docNumber };
}

function uniqueDefPlate() {
  const suffix = Math.random().toString(36).slice(2,5).toUpperCase();
  return `DEF-${suffix}`;
}

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

// Cliente limpio: Ana (DNI 12345678) del seed
async function loginClient(docType = 'DNI', docNumber = '12345678') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

async function createAuction(adminHeaders) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // empieza en 5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h

  // Escenario indica Nissan Versa 2021; usamos placa base DEF-*** con sufijo único para evitar colisiones
  const placa = uniqueDefPlate();
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA PERDIDA S.A.',
      marca: 'Nissan',
      modelo: 'Versa',
      año: 2021,
      descripcion: 'FLUJO4 - Nissan Versa 2021',
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
  form.append('concepto', 'Pago garantía FLUJO4');

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
    body: { comentarios: 'Verificado FLUJO4' },
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

async function createRefundMantenerSaldo(clientHeaders, auctionId, monto, motivo) {
  // Forzamos auction_id para consistencia per-auction en RN07
  const payload = { monto_solicitado: approx2(monto), tipo_reembolso: 'mantener_saldo', motivo, auction_id: auctionId };
  const { res, data } = await req('/refunds', { method: 'POST', headers: clientHeaders, body: payload });
  if (!res.ok) throw new Error('Crear refund (mantener_saldo) falló');
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
  // Para mantener_saldo usamos 'transferencia' para cumplir validación, aunque internamente se maneje como entrada
  const form = new FormData();
  form.append('tipo_transferencia', 'transferencia'); // validación requiere 'transferencia' o 'deposito'
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
  console.log('🚀 Iniciando FLUJO 4 - BOB pierde (reembolso mantener_saldo)');

  await req('/');

  const adminLogin = await loginAdmin();
  // Crear cliente limpio en DB y luego autenticarnos con ese documento
  const { docType, docNumber } = await ensureCleanClient();
  const clientLogin = await loginClient(docType, docNumber);
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': clientLogin.sessionId };
  const clientId = clientLogin.user.id;

  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  // Estado limpio esperado 0s, pero validamos fórmula solamente
  console.log('Estado Inicial Cliente:', bal0);

  // Paso 1: Crear subasta (Nissan Versa 2021 - DEF-789)
  const { id: auctionId, startISO } = await createAuction(adminHeaders);
  const balAfterCreate = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterCreate);
  assertEq2('Total tras crear subasta (sin cambios)', balAfterCreate.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras crear subasta (sin cambios)', balAfterCreate.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras crear subasta (sin cambios)', balAfterCreate.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras crear subasta (sin cambios)', balAfterCreate.saldo_disponible, bal0.saldo_disponible);

  // Paso 2: Registrar ganador (oferta 8,500 => garantía 680)
  const oferta = 8500.00;
  const garantia = approx2(oferta * 0.08); // 680.00
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO);
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambios)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambios)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambios)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambios)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  // Paso 3: Cliente registra pago de garantía (pendiente)
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

  // Paso 5: Admin registra "perdida" (dinero sigue retenido)
  await setCompetitionResult(adminHeaders, auctionId, 'perdida', 'BOB perdió la competencia externa');
  const balAfterPerdida = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterPerdida);
  assertEq2('Total tras perdida (sin cambio)', balAfterPerdida.saldo_total, balAfterApprove.saldo_total);
  assertEq2('Retenido tras perdida (sin cambio)', balAfterPerdida.saldo_retenido, balAfterApprove.saldo_retenido);
  assertEq2('Aplicado tras perdida (sin cambio)', balAfterPerdida.saldo_aplicado, balAfterApprove.saldo_aplicado);
  assertEq2('Disponible tras perdida (sin cambio)', balAfterPerdida.saldo_disponible, balAfterApprove.saldo_disponible);

  // Paso 6: Cliente solicita reembolso mantener_saldo
  const refundId = await createRefundMantenerSaldo(clientHeaders, auctionId, garantia, 'Prefiero mantener el dinero para próximas subastas de BOB');
  const balAfterRefundReq = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundReq);
  // No cambios aún
  assertEq2('Total tras solicitar reembolso (sin cambio)', balAfterRefundReq.saldo_total, balAfterPerdida.saldo_total);
  assertEq2('Retenido tras solicitar reembolso (sin cambio)', balAfterRefundReq.saldo_retenido, balAfterPerdida.saldo_retenido);
  assertEq2('Disponible tras solicitar reembolso (sin cambio)', balAfterRefundReq.saldo_disponible, balAfterPerdida.saldo_disponible);

  // Paso 7: Admin confirma la solicitud
  await manageRefund(adminHeaders, refundId, 'confirmado', 'Confirmado mantener_saldo');
  const balAfterRefundConfirm = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundConfirm);
  assertEq2('Total tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_total, balAfterRefundReq.saldo_total);
  assertEq2('Retenido tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_retenido, balAfterRefundReq.saldo_retenido);
  assertEq2('Disponible tras confirmar reembolso (sin cambio)', balAfterRefundConfirm.saldo_disponible, balAfterRefundReq.saldo_disponible);

  // Paso 8: Admin procesa reembolso mantener_saldo
  await processRefund(adminHeaders, refundId);
  const balAfterRefundProcess = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundProcess);

  // Validaciones finales:
  assertEq2('Total tras procesar mantener_saldo (se mantiene)', balAfterRefundProcess.saldo_total, balAfterPerdida.saldo_total);
  assertEq2('Retenido tras procesar mantener_saldo (liberado)', balAfterRefundProcess.saldo_retenido, 0);
  assertEq2('Aplicado tras procesar mantener_saldo (sin cambio)', balAfterRefundProcess.saldo_aplicado, balAfterRefundConfirm.saldo_aplicado);
  assertEq2('Disponible tras procesar mantener_saldo (liberado)', balAfterRefundProcess.saldo_disponible, balAfterRefundProcess.saldo_total);

  console.log('\n✅ FLUJO 4 completado. Reembolso "mantener_saldo" procesado: retenido=0, disponible=saldo_total.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 4:', e);
    process.exit(1);
  });
}

module.exports = { run };