/**
 * FLUJO 7: Subasta Vencida por No Pago (Cliente limpio)
 * Requiere API en http://localhost:3000 y Node 18+ (fetch/FormData/Blob nativos)
 *
 * Escenario:
 * - Admin crea subasta Mazda CX-5 2022 (VEN-***)
 * - Admin registra a Ana como ganadora con fecha límite de pago (24h)
 * - Ana NO registra pago de garantía
 * - Admin marca subasta como "vencida" manualmente
 * - No hay impacto financiero (nunca hubo Movement)
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

async function ensureCleanClientAna() {
  // Crea cliente limpio "Ana" para garantizar saldos iniciales en 0
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9); // 11 dígitos válidos
  const email = `flow7.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Ana',
        last_name: 'Vencida',
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
  if (!res.ok || !data?.success) throw new Error('Login cliente (Ana) falló');

  return {
    headers: { 'X-Session-ID': data.data.session.session_id },
    user: data.data.user,
  };
}

function uniquePlateVEN() {
  // Prefijo "VEN-" para reflejar caso, evitar duplicados con sufijo aleatorio
  return `VEN-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
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

async function setWinner(adminHeaders, auctionId, userId, montoOferta, fechaOfertaISO, fechaLimitePagoISO) {
  const payload = {
    user_id: userId,
    monto_oferta: montoOferta,
    fecha_oferta: fechaOfertaISO,
    fecha_limite_pago: fechaLimitePagoISO, // 24h
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function updateAuctionStatus(adminHeaders, auctionId, estado, motivo) {
  const { res } = await req(`/auctions/${auctionId}/status`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { estado, motivo },
  });
  if (!res.ok) throw new Error('Actualizar estado de subasta falló');
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

async function run() {
  console.log('🚀 Iniciando FLUJO 7 - Subasta Vencida por No Pago (cliente limpio)');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };

  const clientCtx = await ensureCleanClientAna();
  const clientHeaders = { 'X-Session-ID': clientCtx.headers['X-Session-ID'] };
  const clientId = clientCtx.user.id;

  // Estado inicial: 0 en todo
  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  assertEq2('Inicial Total', bal0.saldo_total, 0);
  assertEq2('Inicial Retenido', bal0.saldo_retenido, 0);
  assertEq2('Inicial Aplicado', bal0.saldo_aplicado, 0);
  assertEq2('Inicial Disponible', bal0.saldo_disponible, 0);

  // Paso 1: Crear subasta Mazda CX-5 2022 (VEN-***)
  const placa = uniquePlateVEN();
  const { id: auctionId, startISO } = await createAuction(adminHeaders, {
    placa,
    empresa_propietaria: 'EMPRESA VEN S.A.',
    marca: 'Mazda',
    modelo: 'CX-5',
    año: 2022,
    descripcion: 'FLUJO7 - Mazda CX-5 2022',
  });

  // Paso 2: Registrar ganadora (Ana) con oferta 8000 y fecha límite de pago 24h
  const oferta = 8000.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  const fechaLimitePagoISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO, fechaLimitePagoISO);

  // Paso 3: Cliente NO registra pago (no hacer nada). Verificar saldos siguen en 0
  const balSinPago = await getBalance(clientHeaders, clientId);
  assertFormula(balSinPago);
  assertEq2('Total sin pago', balSinPago.saldo_total, 0);
  assertEq2('Retenido sin pago', balSinPago.saldo_retenido, 0);
  assertEq2('Aplicado sin pago', balSinPago.saldo_aplicado, 0);
  assertEq2('Disponible sin pago', balSinPago.saldo_disponible, 0);

  // Paso 4: Admin marca subasta como vencida (HU-VAL-06) - sin esperar realmente 24h (manual)
  await updateAuctionStatus(adminHeaders, auctionId, 'vencida', 'No registró pago en el plazo');

  // Verificar saldos siguen inmutables
  const balFinal = await getBalance(clientHeaders, clientId);
  assertFormula(balFinal);
  assertEq2('Final Total', balFinal.saldo_total, 0);
  assertEq2('Final Retenido', balFinal.saldo_retenido, 0);
  assertEq2('Final Aplicado', balFinal.saldo_aplicado, 0);
  assertEq2('Final Disponible', balFinal.saldo_disponible, 0);

  console.log('\n✅ FLUJO 7 completado. Subasta marcada vencida sin impacto financiero (sin pagos registrados).');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 7:', e);
    process.exit(1);
  });
}

module.exports = { run };