/**
 * FLUJO 8: Admin Extiende Plazo de Pago (cliente limpio)
 * Requiere API en http://localhost:3000 y Node 18+ (fetch/FormData/Blob nativos)
 *
 * Escenario:
 * - Admin crea subasta Volkswagen Tiguan 2023
 * - Admin registra a Luis como ganador con fecha límite 14:00 del día siguiente
 * - Admin extiende plazo a 18:00 del mismo día (4 horas adicionales)
 * - Luis registra pago dentro del nuevo plazo
 * - Admin valida el pago → saldos se actualizan correctamente
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

async function ensureCleanClientLuis() {
  // Crea cliente limpio "Luis" para garantizar saldos iniciales en 0
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9); // 11 dígitos válidos
  const email = `flow8.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Luis',
        last_name: 'Plazo',
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
  if (!res.ok || !data?.success) throw new Error('Login cliente (Luis) falló');

  return {
    headers: { 'X-Session-ID': data.data.session.session_id },
    user: data.data.user,
  };
}

function uniquePlateEXT() {
  // Prefijo "EXT-" para el caso de extensión, evitar duplicados con sufijo aleatorio
  return `EXT-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
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
    fecha_limite_pago: fechaLimitePagoISO,
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function extendDeadline(adminHeaders, auctionId, nuevaFechaLimiteISO, motivo = 'Extensión 4h solicitada por cliente') {
  const payload = { fecha_limite_pago: nuevaFechaLimiteISO, motivo };
  const { res } = await req(`/auctions/${auctionId}/extend-deadline`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: payload,
  });
  if (!res.ok) throw new Error('Extender plazo de pago falló');
}

async function registerGuaranteePayment(clientHeaders, auctionId, guaranteeAmount, startISO, concepto) {
  // esperar al inicio de la subasta para fecha_pago válida
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
  form.append('concepto', concepto || 'Pago garantía FLUJO8');

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
    body: { comentarios: 'Verificado FLUJO8' },
  });
  if (!res.ok) throw new Error('Aprobación de pago falló');
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

function setHourNextDay(baseDate, hourLocal, minuteLocal = 0, secondLocal = 0, ms = 0) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + 1);
  d.setHours(hourLocal, minuteLocal, secondLocal, ms);
  return d;
}

function setHourSameDay(baseDate, hourLocal, minuteLocal = 0, secondLocal = 0, ms = 0) {
  const d = new Date(baseDate);
  d.setHours(hourLocal, minuteLocal, secondLocal, ms);
  if (d <= new Date()) {
    // si quedara en pasado, desplazar a siguiente día para cumplir futureDatetime
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function run() {
  console.log('🚀 Iniciando FLUJO 8 - Admin extiende plazo de pago (cliente limpio)');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };

  const clientCtx = await ensureCleanClientLuis();
  const clientHeaders = clientCtx.headers;
  const clientId = clientCtx.user.id;

  // Estado inicial: 0 en todo
  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  assertEq2('Inicial Total', bal0.saldo_total, 0);
  assertEq2('Inicial Retenido', bal0.saldo_retenido, 0);
  assertEq2('Inicial Aplicado', bal0.saldo_aplicado, 0);
  assertEq2('Inicial Disponible', bal0.saldo_disponible, 0);

  // Paso 1: Crear subasta Volkswagen Tiguan 2023
  const placa = uniquePlateEXT();
  const { id: auctionId, startISO } = await createAuction(adminHeaders, {
    placa,
    empresa_propietaria: 'EMPRESA EXT S.A.',
    marca: 'Volkswagen',
    modelo: 'Tiguan',
    año: 2023,
    descripcion: 'FLUJO8 - Volkswagen Tiguan 2023',
  });

  // Paso 2: Registrar ganador (Luis) con oferta 18000 y fecha límite inicial (14:00 del día siguiente)
  const oferta = 18000.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  const now = new Date();
  const fechaLimiteInicial = setHourNextDay(now, 14, 0, 0, 0);
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO, fechaLimiteInicial.toISOString());

  // Saldos aún sin cambios
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambio)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambio)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambio)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambio)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  // Paso 4: Admin extiende plazo a 18:00 (4 horas adicionales)
  const fechaLimiteExtendida = setHourSameDay(fechaLimiteInicial, 18, 0, 0, 0);
  await extendDeadline(adminHeaders, auctionId, fechaLimiteExtendida.toISOString(), 'Extensión solicitada por cliente');

  // Paso 5: Cliente registra pago de garantía (monto garantía 8%)
  const garantia = approx2(oferta * 0.08); // 1440
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO, 'Garantía Tiguan');
  const balAfterRegister = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRegister);
  // pendiente: sin cambios en saldos
  assertEq2('Total tras registro (pendiente)', balAfterRegister.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registro (pendiente)', balAfterRegister.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registro (pendiente)', balAfterRegister.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registro (pendiente)', balAfterRegister.saldo_disponible, bal0.saldo_disponible);

  // Paso 6: Admin valida pago
  await approvePayment(adminHeaders, movementId);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  assertEq2('Total tras validar', balAfterApprove.saldo_total, balAfterRegister.saldo_total + garantia);
  assertEq2('Retenido tras validar', balAfterApprove.saldo_retenido, balAfterRegister.saldo_retenido + garantia);
  assertEq2('Aplicado tras validar (sin cambio)', balAfterApprove.saldo_aplicado, balAfterRegister.saldo_aplicado);
  assertEq2('Disponible tras validar (sin cambio)', balAfterApprove.saldo_disponible, balAfterRegister.saldo_disponible);

  console.log('\n✅ FLUJO 8 completado. Extensión de plazo aplicada y pago validado con saldos correctos.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 8:', e);
    process.exit(1);
  });
}

module.exports = { run };