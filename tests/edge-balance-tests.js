/**
 * Pruebas de edge-cases financieras y auditoría final
 * Requiere API corriendo en http://localhost:3000
 * Node 18+ (fetch nativo)
 */
const fs = require('fs');
const path = require('path');

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

async function loginClient(docType = 'DNI', docNumber = '12345678') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

// Cliente limpio dinámico (evitar estado previo que afecta asserts)
function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function ensureCleanClient() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9);
  const email = `edge.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Edge',
        last_name: 'Tester',
        email,
        phone_number: '+519' + randDigits(8),
        document_type: 'RUC',
        document_number: ruc,
        user_type: 'client',
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
  if (!res.ok || !data?.success) throw new Error('Login cliente limpio falló');

  return {
    sessionId: data.data.session.session_id,
    user: data.data.user,
  };
}

async function createAuction(adminHeaders, placa) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // empieza en 5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA EDGE S.A.',
      marca: 'Toyota',
      modelo: 'Yaris',
      año: 2020,
      descripcion: 'Edge Test',
    },
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

async function registerGuaranteePayment(clientHeaders, auctionId, offerAmount, startISO) {
  const garantia = approx2(offerAmount * 0.08);
  // delay pequeño hasta el inicio
  const waitMs = new Date(startISO).getTime() - Date.now() + 1500;
  if (waitMs > 0) await delay(waitMs);

  const form = new FormData();
  form.append('auction_id', auctionId);
  form.append('monto', String(garantia));
  form.append('tipo_pago', 'transferencia');
  form.append('numero_cuenta_origen', '1234567890');
  form.append('numero_operacion', `OP-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  form.append('fecha_pago', new Date().toISOString());
  form.append('moneda', 'USD');
  form.append('concepto', 'Pago garantía EDGE');

  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  const bin = Buffer.from(b64Png1x1, 'base64');
  form.append('voucher', new Blob([bin], { type: 'image/png' }), 'voucher.png');

  const { res, data } = await req('/movements', { method: 'POST', headers: clientHeaders, body: form });
  if (!res.ok) throw new Error('Registro de pago falló');
  return { movementId: data.data.movement.id, garantia };
}

async function approvePayment(adminHeaders, movementId) {
  const { res } = await req(`/movements/${movementId}/approve`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { comentarios: 'Verificado EDGE' },
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

async function createBilling(clientHeaders, auctionId, docNumber) {
  const payload = {
    auction_id: auctionId,
    billing_document_type: 'DNI',
    billing_document_number: docNumber,
    billing_name: 'Cliente EDGE',
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

function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function runAuditLegacy() {
  const roots = ['controllers', 'services', 'routes', 'prisma', 'utils', 'config', 'index.js'];
  const patterns = [/GuaranteePayment/i, /guaranteePayments?/i, /UserBalance/i];
  let hits = [];

  function walk(p) {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (p.includes(path.sep + 'doc') || p.includes(path.sep + 'tests')) return;
      const items = fs.readdirSync(p);
      items.forEach(it => walk(path.join(p, it)));
    } else {
      if (!/\.(js|ts|prisma|json|md)$/.test(p)) return;
      const txt = fs.readFileSync(p, 'utf8');
      for (const rg of patterns) {
        if (rg.test(txt)) {
          hits.push({ file: p, pattern: rg.toString() });
        }
      }
    }
  }

  roots.forEach(r => {
    const abs = path.isAbsolute(r) ? r : path.join(process.cwd(), r);
    if (fs.existsSync(abs)) walk(abs);
  });

  if (hits.length) {
    console.error('❌ Auditoría legacy encontró referencias:', hits);
    throw new Error('Audit legacy FAILED');
  } else {
    console.log('✅ Auditoría legacy: sin referencias obsoletas');
  }
}

async function run() {
  console.log('🚀 Iniciando Edge Balance/Legacy Tests');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  // Usar cliente limpio para evitar contaminación por estados previos
  const cleanClient = await ensureCleanClient();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': cleanClient.sessionId };
  const clientId = cleanClient.user.id;

  // Balance inicial
  let bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);

  // 1) Penalidad y su impacto en saldos
  const placaPen = `EDG-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const { id: aucPenId, startISO: startPenISO } = await createAuction(adminHeaders, placaPen);
  const ofertaPen = 10000.00;
  const fechaOfertaPen = new Date(new Date(startPenISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, aucPenId, clientId, ofertaPen, fechaOfertaPen);
  const { movementId: movPenId, garantia: garantiaPen } = await registerGuaranteePayment(clientHeaders, aucPenId, ofertaPen, startPenISO);
  await approvePayment(adminHeaders, movPenId);

  // Balance después de aprobar (retenido debe ser = garantía)
  let bal1 = await getBalance(clientHeaders, clientId);
  assertFormula(bal1);

  // Aplicar penalidad (30% de garantía)
  await setCompetitionResult(adminHeaders, aucPenId, 'penalizada', 'EDGE penalizada');
  let bal2 = await getBalance(clientHeaders, clientId);
  assertFormula(bal2);

  // Chequeos delta penalidad
  const expectedPenalty = approx2(garantiaPen * 0.30);
  // retenido debe pasar a 0 (ya no retiene en penalizada)
  if (!(bal1.saldo_retenido > 0)) throw new Error('Esperaba saldo_retenido > 0 antes de penalidad');
  assertEq2('Retenido tras penalizada', bal2.saldo_retenido, bal1.saldo_retenido - garantiaPen);
  // saldo_total disminuye por penalidad (salida)
  assertEq2('Total tras penalidad', bal2.saldo_total, bal1.saldo_total - expectedPenalty);
  // disponible: +liberación garantía (garantiaPen) - penalidad
  const dispExpectedAfterPenalty = approx2(bal1.saldo_disponible + garantiaPen - expectedPenalty);
  assertEq2('Disponible tras penalidad', bal2.saldo_disponible, dispExpectedAfterPenalty);

  // 2) Post-facturación (liberación de retenido)
  const placaBill = `EDG-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const { id: aucBillId, startISO: startBillISO } = await createAuction(adminHeaders, placaBill);
  const ofertaBill = 12000.00;
  const fechaOfertaBill = new Date(new Date(startBillISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, aucBillId, clientId, ofertaBill, fechaOfertaBill);
  const { movementId: movBillId, garantia: garantiaBill } = await registerGuaranteePayment(clientHeaders, aucBillId, ofertaBill, startBillISO);
  await approvePayment(adminHeaders, movBillId);
  await setCompetitionResult(adminHeaders, aucBillId, 'ganada', 'EDGE ganada');

  let bal3 = await getBalance(clientHeaders, clientId);
  assertFormula(bal3);
  // retenido debe incluir esta garantía
  if (bal3.saldo_retenido < garantiaBill - 0.01) {
    throw new Error('Retenido no refleja garantía tras ganada');
  }

  // Billing: usar docNumber único random
  const uniqueDoc = String(10000000 + Math.floor(Math.random() * 90000000));
  await createBilling(clientHeaders, aucBillId, uniqueDoc);

  let bal4 = await getBalance(clientHeaders, clientId);
  assertFormula(bal4);

  // Chequeos post-billing:
  // retenido disminuye en -garantiaBill
  assertEq2('Retenido tras billing', bal4.saldo_retenido, bal3.saldo_retenido - garantiaBill);
  // saldo_aplicado aumenta en +garantiaBill
  assertEq2('Aplicado tras billing', bal4.saldo_aplicado, bal3.saldo_aplicado + garantiaBill);
  // saldo_total NO cambia por billing
  assertEq2('Total tras billing', bal4.saldo_total, bal3.saldo_total);
  // disponible = total - retenido - aplicado
  assertFormula(bal4);

  // 3) Múltiples reembolsos y validaciones
  let bal5 = await getBalance(clientHeaders, clientId);
  assertFormula(bal5);
  let available = bal5.saldo_disponible;

  // Montos seguros
  const mantenerMonto = approx2(Math.max(10, Math.min(100, available / 2)));
  const devolverMonto = approx2(Math.max(10, Math.min(150, available / 3)));

  // Crear y procesar mantener_saldo
  let { res: resR1, data: dataR1 } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: aucPenId, monto_solicitado: mantenerMonto, tipo_reembolso: 'mantener_saldo', motivo: 'Edge mantener' },
  });
  if (!resR1.ok) throw new Error('Crear refund mantener_saldo falló');
  const refundId1 = dataR1.data.refund.id;

  let { res: resM1 } = await req(`/refunds/${refundId1}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado: 'confirmado', motivo: 'OK' },
  });
  if (!resM1.ok) throw new Error('Manage refund mantener_saldo falló');

  let { res: resP1 } = await req(`/refunds/${refundId1}/process`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: {},
  });
  if (!resP1.ok) throw new Error('Process refund mantener_saldo falló');

  let bal6 = await getBalance(clientHeaders, clientId);
  assertFormula(bal6);
  // Efecto mantener_saldo en este escenario:
  // - entrada/reembolso EXCLUIDA de saldo_total => total sin cambio
  // - la subasta penalizada ya liberó retenido, por lo que disponible NO cambia aquí
  assertEq2('Total tras mantener_saldo (sin cambio)', bal6.saldo_total, bal5.saldo_total);
  assertEq2('Disponible tras mantener_saldo (sin cambio)', bal6.saldo_disponible, bal5.saldo_disponible);

  // Intento de reembolso excediendo disponible (debe fallar 409)
  const exceso = approx2(bal6.saldo_disponible + 1);
  let { res: resExceso } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: aucPenId, monto_solicitado: exceso, tipo_reembolso: 'devolver_dinero', motivo: 'Debe fallar' },
  });
  if (resExceso.ok) throw new Error('Refund excedido NO debería permitirce');

  // Crear y procesar devolver_dinero
  let { res: resR2, data: dataR2 } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: aucPenId, monto_solicitado: devolverMonto, tipo_reembolso: 'devolver_dinero', motivo: 'Edge devolver' },
  });
  if (!resR2.ok) throw new Error('Crear refund devolver_dinero falló');
  const refundId2 = dataR2.data.refund.id;

  let { res: resM2 } = await req(`/refunds/${refundId2}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado: 'confirmado', motivo: 'OK' },
  });
  if (!resM2.ok) throw new Error('Manage refund devolver_dinero falló');

  // process con FormData (con voucher)
  const formRefund = new FormData();
  formRefund.append('tipo_transferencia', 'transferencia');
  formRefund.append('numero_operacion', `OP-RF-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  formRefund.append('voucher', new Blob([Buffer.from(b64Png1x1, 'base64')], { type: 'image/png' }), 'refund_voucher.png');

  let { res: resP2 } = await req(`/refunds/${refundId2}/process`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: formRefund,
  });
  if (!resP2.ok) throw new Error('Process refund devolver_dinero falló');

  let bal7 = await getBalance(clientHeaders, clientId);
  assertFormula(bal7);
  // Efecto devolver_dinero: total -monto, disponible -monto
  assertEq2('Total tras devolver_dinero', bal7.saldo_total, bal6.saldo_total - devolverMonto);
  assertEq2('Disponible tras devolver_dinero', bal7.saldo_disponible, bal6.saldo_disponible - devolverMonto);

  // Auditoría legacy
  await runAuditLegacy();

  console.log('\n✅ Edge-cases y auditoría ejecutados correctamente. Fórmula de saldo verificada en cada paso sin desfases.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error Edge Tests:', e);
    process.exit(1);
  });
}

module.exports = { run };