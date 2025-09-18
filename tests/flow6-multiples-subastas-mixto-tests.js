/**
 * FLUJO 6: Cliente con Múltiples Subastas Simultáneas (Escenario Mixto)
 * Requiere API en http://localhost:3000 y Node 18+ (fetch/FormData/Blob nativos)
 *
 * Escenario:
 * - Cliente "Roberto" participa en 4 subastas (A,B,C,D) con resultados mixtos
 * - A: ganada → facturación (aplica garantía)
 * - B: perdida → reembolso devolver_dinero (sale del sistema)
 * - C: penalizada (cliente no pagó) → penalidad 30% + reembolso 70% devolver_dinero
 * - D: perdida → reembolso mantener_saldo (permanece en sistema como saldo)
 *
 * Validaciones de saldos por etapa, manteniendo trazabilidad por subasta (auction_id requerido en refunds).
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

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function ensureCleanClient() {
  // Crea un cliente completamente nuevo para garantizar saldos iniciales en 0
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9); // 11 dígitos válidos para RUC
  const email = `flow6.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Roberto',
        last_name: 'Mixto',
        email,
        phone_number: '+519' + randDigits(8),
        document_type: 'RUC',
        document_number: ruc,
        user_type: 'client',
        // saldos deberían defaultear a 0 por schema; si no, establecer explícitamente:
        saldo_total: 0,
        saldo_retenido: 0,
      },
      select: { id: true, document_type: true, document_number: true },
    });
  } finally {
    await prisma.$disconnect();
  }

  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: user.document_type, document_number: user.document_number },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente (Roberto) falló');

  return {
    headers: { 'X-Session-ID': data.data.session.session_id },
    user: data.data.user,
  };
}

function uniquePlate(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

async function createAuction(adminHeaders, asset) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // inicia en ~5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset,
  };
  const { res, data } = await req('/auctions', { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Crear subasta falló');
  return { id: data.data.auction.id, startISO, endISO };
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

async function registerGuaranteePayment(clientHeaders, auctionId, guaranteeAmount, startISO, concepto) {
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
  form.append('concepto', concepto || 'Pago garantía FLUJO6');

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
    body: { comentarios: 'Verificado FLUJO6' },
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

async function createBilling(clientHeaders, auctionId, billingName = 'Roberto Mixto') {
  const uniqueDoc = String(10000000 + Math.floor(Math.random() * 90000000));
  const payload = {
    auction_id: auctionId,
    billing_document_type: 'DNI',
    billing_document_number: uniqueDoc,
    billing_name: billingName,
  };
  const { res } = await req('/billing', { method: 'POST', headers: clientHeaders, body: payload });
  if (!res.ok) throw new Error('Crear Billing falló');
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

async function manageRefund(adminHeaders, refundId, estado = 'confirmado', motivo = 'OK') {
  const { res } = await req(`/refunds/${refundId}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado, motivo },
  });
  if (!res.ok) throw new Error('Manage refund falló');
}

async function processRefund(adminHeaders, refundId, devolverDinero = false) {
  if (!devolverDinero) {
    const { res } = await req(`/refunds/${refundId}/process`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: {},
    });
    if (!res.ok) throw new Error('Process refund (mantener_saldo) falló');
    return;
  }
  const form = new FormData();
  form.append('tipo_transferencia', 'transferencia');
  form.append('numero_operacion', `OP-RF-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  form.append('voucher', new Blob([Buffer.from(b64Png1x1, 'base64')], { type: 'image/png' }), 'refund_voucher.png');

  const { res } = await req(`/refunds/${refundId}/process`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: form,
  });
  if (!res.ok) throw new Error('Process refund (devolver_dinero) falló');
}

function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function run() {
  console.log('🚀 Iniciando FLUJO 6 - Cliente con múltiples subastas (escenario mixto)');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };

  const clientCtx = await ensureCleanClient();
  const clientHeaders = clientCtx.headers;
  const clientId = clientCtx.user.id;

  // Estado inicial: 0 en todo
  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  assertEq2('Inicial Total', bal0.saldo_total, 0);
  assertEq2('Inicial Retenido', bal0.saldo_retenido, 0);
  assertEq2('Inicial Aplicado', bal0.saldo_aplicado, 0);
  assertEq2('Inicial Disponible', bal0.saldo_disponible, 0);

  // Ofertas y garantías (8%):
  const ofertaA = 10000.00, garantiaA = approx2(ofertaA * 0.08); // 800
  const ofertaB = 12500.00, garantiaB = approx2(ofertaB * 0.08); // 1000
  const ofertaC = 9000.00,  garantiaC = approx2(ofertaC * 0.08); // 720
  const ofertaD = 11200.00, garantiaD = approx2(ofertaD * 0.08); // 896
  const totalGarantias = approx2(garantiaA + garantiaB + garantiaC + garantiaD); // 3416

  // Crear 4 subastas
  const placaA = uniquePlate('A6');
  const placaB = uniquePlate('B6');
  const placaC = uniquePlate('C6');
  const placaD = uniquePlate('D6');

  const { id: auctionA, startISO: startA } = await createAuction(adminHeaders, {
    placa: placaA, empresa_propietaria: 'EMPRESA A S.A.',
    marca: 'Honda', modelo: 'Civic', año: 2020, descripcion: 'Subasta A - Honda Civic 2020'
  });
  const { id: auctionB, startISO: startB } = await createAuction(adminHeaders, {
    placa: placaB, empresa_propietaria: 'EMPRESA B S.A.',
    marca: 'Toyota', modelo: 'Corolla', año: 2021, descripcion: 'Subasta B - Toyota Corolla 2021'
  });
  const { id: auctionC, startISO: startC } = await createAuction(adminHeaders, {
    placa: placaC, empresa_propietaria: 'EMPRESA C S.A.',
    marca: 'Nissan', modelo: 'Sentra', año: 2019, descripcion: 'Subasta C - Nissan Sentra 2019'
  });
  const { id: auctionD, startISO: startD } = await createAuction(adminHeaders, {
    placa: placaD, empresa_propietaria: 'EMPRESA D S.A.',
    marca: 'Hyundai', modelo: 'Elantra', año: 2022, descripcion: 'Subasta D - Hyundai Elantra 2022'
  });

  // Registrar ganador en las 4
  await setWinner(adminHeaders, auctionA, clientId, ofertaA, new Date(new Date(startA).getTime() + 5000).toISOString());
  await setWinner(adminHeaders, auctionB, clientId, ofertaB, new Date(new Date(startB).getTime() + 5000).toISOString());
  await setWinner(adminHeaders, auctionC, clientId, ofertaC, new Date(new Date(startC).getTime() + 5000).toISOString());
  await setWinner(adminHeaders, auctionD, clientId, ofertaD, new Date(new Date(startD).getTime() + 5000).toISOString());

  // Registrar pagos de garantía (pendientes)
  const movA = await registerGuaranteePayment(clientHeaders, auctionA, garantiaA, startA, 'Garantía A');
  const movB = await registerGuaranteePayment(clientHeaders, auctionB, garantiaB, startB, 'Garantía B');
  const movC = await registerGuaranteePayment(clientHeaders, auctionC, garantiaC, startC, 'Garantía C');
  const movD = await registerGuaranteePayment(clientHeaders, auctionD, garantiaD, startD, 'Garantía D');

  // Aprobaciones admin
  await approvePayment(adminHeaders, movA);
  await approvePayment(adminHeaders, movB);
  await approvePayment(adminHeaders, movC);
  await approvePayment(adminHeaders, movD);

  // Verificación tras validar 4 pagos
  const balAfterApprovals = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprovals);
  assertEq2('Total tras validar 4 pagos', balAfterApprovals.saldo_total, totalGarantias);
  assertEq2('Retenido tras validar 4 pagos', balAfterApprovals.saldo_retenido, totalGarantias);
  assertEq2('Aplicado tras validar 4 pagos', balAfterApprovals.saldo_aplicado, 0);
  assertEq2('Disponible tras validar 4 pagos', balAfterApprovals.saldo_disponible, 0);

  // Resultados mixtos
  // 5A) A: ganada
  await setCompetitionResult(adminHeaders, auctionA, 'ganada', 'BOB ganó A');
  const balAfterA = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterA);
  assertEq2('Total tras A ganada (sin cambio)', balAfterA.saldo_total, balAfterApprovals.saldo_total);
  assertEq2('Retenido tras A ganada (sin cambio)', balAfterA.saldo_retenido, balAfterApprovals.saldo_retenido);
  assertEq2('Disponible tras A ganada (sin cambio)', balAfterA.saldo_disponible, balAfterApprovals.saldo_disponible);

  // 5B) B: perdida
  await setCompetitionResult(adminHeaders, auctionB, 'perdida', 'BOB perdió B');
  const balAfterB = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterB);
  assertEq2('Total tras B perdida (sin cambio)', balAfterB.saldo_total, balAfterA.saldo_total);
  assertEq2('Retenido tras B perdida (sin cambio)', balAfterB.saldo_retenido, balAfterA.saldo_retenido);
  assertEq2('Disponible tras B perdida (sin cambio)', balAfterB.saldo_disponible, balAfterA.saldo_disponible);

  // 5C) C: penalizada (cliente no pagó) → penalidad 30%
  await setCompetitionResult(adminHeaders, auctionC, 'penalizada', 'Cliente no pagó C');
  const balAfterC = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterC);
  const expectedPenaltyC = approx2(garantiaC * 0.30); // 216
  assertEq2('Total tras penalidad C', balAfterC.saldo_total, balAfterB.saldo_total - expectedPenaltyC);
  // retenido libera garantía C completa (ya no retiene en penalizada)
  assertEq2('Retenido tras penalidad C', balAfterC.saldo_retenido, balAfterB.saldo_retenido - garantiaC);
  // disponible: + (garantiaC - penalidad)
  const dispExpectedAfterC = approx2(balAfterB.saldo_disponible + (garantiaC - expectedPenaltyC));
  assertEq2('Disponible tras penalidad C', balAfterC.saldo_disponible, dispExpectedAfterC);

  // 5D) D: perdida
  await setCompetitionResult(adminHeaders, auctionD, 'perdida', 'BOB perdió D');
  const balAfterD = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterD);
  assertEq2('Total tras D perdida (sin cambio)', balAfterD.saldo_total, balAfterC.saldo_total);
  assertEq2('Retenido tras D perdida (sin cambio)', balAfterD.saldo_retenido, balAfterC.saldo_retenido);
  assertEq2('Disponible tras D perdida (sin cambio)', balAfterD.saldo_disponible, balAfterC.saldo_disponible);

  // 6A) Facturación de A (aplica garantía A)
  await createBilling(clientHeaders, auctionA, 'Roberto Mixto');
  const balAfterBillA = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterBillA);
  assertEq2('Retenido tras billing A', balAfterBillA.saldo_retenido, balAfterD.saldo_retenido - garantiaA);
  assertEq2('Aplicado tras billing A', balAfterBillA.saldo_aplicado, balAfterD.saldo_aplicado + garantiaA);
  assertEq2('Total tras billing A (sin cambio)', balAfterBillA.saldo_total, balAfterD.saldo_total);
  // disponible = total - retenido - aplicado
  assertFormula(balAfterBillA);

  // 6B) Refund B devolver_dinero (1000)
  // Crear
  let { res: resRB, data: dataRB } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auctionB, monto_solicitado: garantiaB, tipo_reembolso: 'devolver_dinero', motivo: 'Refund B' },
  });
  if (!resRB.ok) throw new Error('Crear refund B falló');
  const refundIdB = dataRB.data.refund.id;
  // Confirmar
  await manageRefund(adminHeaders, refundIdB, 'confirmado', 'OK B');
  // Procesar (transferencia)
  await processRefund(adminHeaders, refundIdB, true);

  const balAfterRefundB = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundB);
  // total -1000, retenido -1000, disponible sin cambio
  assertEq2('Total tras refund B (devolver)', balAfterRefundB.saldo_total, balAfterBillA.saldo_total - garantiaB);
  assertEq2('Retenido tras refund B (devolver)', balAfterRefundB.saldo_retenido, balAfterBillA.saldo_retenido - garantiaB);
  assertEq2('Aplicado tras refund B (devolver)', balAfterRefundB.saldo_aplicado, balAfterBillA.saldo_aplicado);
  assertEq2('Disponible tras refund B (sin cambio)', balAfterRefundB.saldo_disponible, balAfterBillA.saldo_disponible);

  // 6C) Refund C devolver_dinero (504 = 70% restante ya disponible)
  const montoC70 = approx2(garantiaC * 0.70); // 504
  let { res: resRC, data: dataRC } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auctionC, monto_solicitado: montoC70, tipo_reembolso: 'devolver_dinero', motivo: 'Refund C 70%' },
  });
  if (!resRC.ok) throw new Error('Crear refund C falló');
  const refundIdC = dataRC.data.refund.id;
  await manageRefund(adminHeaders, refundIdC, 'confirmado', 'OK C');
  await processRefund(adminHeaders, refundIdC, true);

  const balAfterRefundC = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRefundC);
  // total -504, retenido sin cambio (C ya no retiene), disponible -504
  assertEq2('Total tras refund C (devolver 70%)', balAfterRefundC.saldo_total, balAfterRefundB.saldo_total - montoC70);
  assertEq2('Retenido tras refund C (sin cambio)', balAfterRefundC.saldo_retenido, balAfterRefundB.saldo_retenido);
  assertEq2('Aplicado tras refund C (sin cambio)', balAfterRefundC.saldo_aplicado, balAfterRefundB.saldo_aplicado);
  assertEq2('Disponible tras refund C', balAfterRefundC.saldo_disponible, balAfterRefundB.saldo_disponible - montoC70);

  // 6D) Refund D mantener_saldo (896)
  let { res: resRD, data: dataRD } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auctionD, monto_solicitado: garantiaD, tipo_reembolso: 'mantener_saldo', motivo: 'Refund D mantener' },
  });
  if (!resRD.ok) throw new Error('Crear refund D falló');
  const refundIdD = dataRD.data.refund.id;
  await manageRefund(adminHeaders, refundIdD, 'confirmado', 'OK D');
  await processRefund(adminHeaders, refundIdD, false); // mantener_saldo

  const balFinal = await getBalance(clientHeaders, clientId);
  assertFormula(balFinal);
  // Efectos esperados finales según escenario
  // Después de C devolver: total = 1696, retenido = 896, aplicado = 800, disponible = 0
  // Después de D mantener: total igual (entrada/reembolso excluida del total), retenido 0, aplicado 800, disponible +896
  assertEq2('Final Total', balFinal.saldo_total, 1696.00);
  assertEq2('Final Retenido', balFinal.saldo_retenido, 0.00);
  assertEq2('Final Aplicado', balFinal.saldo_aplicado, 800.00);
  assertEq2('Final Disponible', balFinal.saldo_disponible, 896.00);

  console.log('\n✅ FLUJO 6 completado. Escenario mixto con 4 subastas verificado y saldos finales correctos.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 6:', e);
    process.exit(1);
  });
}

module.exports = { run };