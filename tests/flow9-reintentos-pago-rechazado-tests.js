/**
 * FLUJO 9: Pago Rechazado con Múltiples Reintentos (cliente limpio)
 * Requiere API en http://localhost:3000 y Node 18+ (fetch/FormData/Blob nativos)
 *
 * Escenario:
 * - Admin crea subasta Ford Explorer 2020
 * - Admin registra a Patricia como ganadora (oferta 22000, garantía 1760)
 * - Intento 1: cliente registra pago con monto correcto (1760) → Admin RECHAZA manualmente (ej: "Monto incorrecto")
 * - Intento 2: cliente registra pago con monto correcto (1760) pero comprobante ilegible → Admin RECHAZA manualmente (ej: "Comprobante ilegible")
 * - Intento 3: cliente registra pago con monto correcto (1760) y legible → Admin APRUEBA
 * - Solo el pago aprobado actualiza saldos (rechazos anteriores no afectan balances)
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

async function ensureCleanClientPatricia() {
  // Crea cliente limpio "Patricia" para garantizar saldos iniciales en 0
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9); // 11 dígitos válidos
  const email = `flow9.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Patricia',
        last_name: 'Reintentos',
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
  if (!res.ok || !data?.success) throw new Error('Login cliente (Patricia) falló');

  return {
    headers: { 'X-Session-ID': data.data.session.session_id },
    user: data.data.user,
  };
}

function uniquePlateRJT() {
  // Prefijo "RJT-" para caso de REJecT, evitar duplicados con sufijo aleatorio
  return `RJT-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
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
    fecha_limite_pago: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function registerGuaranteePayment(clientHeaders, auctionId, amount, startISO, concepto) {
  // esperar al inicio de la subasta para fecha_pago válida
  const waitMs = new Date(startISO).getTime() - Date.now() + 1500;
  if (waitMs > 0) await delay(waitMs);

  const form = new FormData();
  form.append('auction_id', auctionId);
  form.append('monto', String(approx2(amount)));
  form.append('tipo_pago', 'transferencia');
  form.append('numero_cuenta_origen', '1234567890');
  form.append('numero_operacion', `OP-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  form.append('fecha_pago', new Date().toISOString());
  form.append('moneda', 'USD');
  form.append('concepto', concepto || 'Pago garantía FLUJO9');

  // PNG 1x1 válido
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
    body: { comentarios: 'Verificado FLUJO9' },
  });
  if (!res.ok) throw new Error('Aprobación de pago falló');
}

async function rejectPayment(adminHeaders, movementId, motivos, otros = '', comentarios = '') {
  const payload = {
    motivos, // Array<String> entre: 'Monto incorrecto', 'Comprobante ilegible', 'Datos bancarios incorrectos', 'Fecha de pago inválida', 'Documento de facturación incorrecto'
    otros_motivos: otros || undefined,
    comentarios: comentarios || undefined,
  };
  const { res } = await req(`/movements/${movementId}/reject`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: payload,
  });
  if (!res.ok) throw new Error('Rechazo de pago falló');
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
  console.log('🚀 Iniciando FLUJO 9 - Pago rechazado con múltiples reintentos (cliente limpio)');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };

  const clientCtx = await ensureCleanClientPatricia();
  const clientHeaders = clientCtx.headers;
  const clientId = clientCtx.user.id;

  // Estado inicial: 0 en todo
  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  assertEq2('Inicial Total', bal0.saldo_total, 0);
  assertEq2('Inicial Retenido', bal0.saldo_retenido, 0);
  assertEq2('Inicial Aplicado', bal0.saldo_aplicado, 0);
  assertEq2('Inicial Disponible', bal0.saldo_disponible, 0);

  // Paso 1-2: Crear subasta y asignar ganadora
  const placa = uniquePlateRJT();
  const { id: auctionId, startISO } = await createAuction(adminHeaders, {
    placa,
    empresa_propietaria: 'EMPRESA RJT S.A.',
    marca: 'Ford',
    modelo: 'Explorer',
    año: 2020,
    descripcion: 'FLUJO9 - Ford Explorer 2020',
  });

  const oferta = 22000.00;
  const garantia = approx2(oferta * 0.08); // 1760
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO);

  // Verificar saldos sin cambios
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambio)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambio)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambio)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambio)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  // Paso 3: Intento 1 - monto incorrecto (1700)
  const intento1Monto = garantia;
  const mov1 = await registerGuaranteePayment(clientHeaders, auctionId, intento1Monto, startISO, 'Garantía intento 1');
  const balAfterReg1 = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterReg1);
  assertEq2('Total tras registro 1 (pendiente)', balAfterReg1.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registro 1 (pendiente)', balAfterReg1.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registro 1 (pendiente)', balAfterReg1.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registro 1 (pendiente)', balAfterReg1.saldo_disponible, bal0.saldo_disponible);

  // Paso 4: Rechazar intento 1
  await rejectPayment(adminHeaders, mov1, ['Monto incorrecto'], 'Debe ser exactamente 1760', 'Monto no coincide con garantía');
  const balAfterRej1 = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRej1);
  assertEq2('Total tras rechazo 1', balAfterRej1.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras rechazo 1', balAfterRej1.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras rechazo 1', balAfterRej1.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras rechazo 1', balAfterRej1.saldo_disponible, bal0.saldo_disponible);

  // Paso 5: Intento 2 - monto correcto (1760) pero "comprobante ilegible"
  const mov2 = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO, 'Garantía intento 2 (voucher ilegible)');
  const balAfterReg2 = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterReg2);
  assertEq2('Total tras registro 2 (pendiente)', balAfterReg2.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registro 2 (pendiente)', balAfterReg2.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registro 2 (pendiente)', balAfterReg2.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registro 2 (pendiente)', balAfterReg2.saldo_disponible, bal0.saldo_disponible);

  // Paso 6: Rechazar intento 2
  await rejectPayment(adminHeaders, mov2, ['Comprobante ilegible'], 'Imagen borrosa', 'Reenviar fotografía nítida');
  const balAfterRej2 = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRej2);
  assertEq2('Total tras rechazo 2', balAfterRej2.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras rechazo 2', balAfterRej2.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras rechazo 2', balAfterRej2.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras rechazo 2', balAfterRej2.saldo_disponible, bal0.saldo_disponible);

  // Paso 7: Intento 3 - monto correcto (1760) y legible
  const mov3 = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO, 'Garantía intento 3 (correcto)');
  const balAfterReg3 = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterReg3);
  assertEq2('Total tras registro 3 (pendiente)', balAfterReg3.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registro 3 (pendiente)', balAfterReg3.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registro 3 (pendiente)', balAfterReg3.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registro 3 (pendiente)', balAfterReg3.saldo_disponible, bal0.saldo_disponible);

  // Paso 8: Aprobar intento 3
  await approvePayment(adminHeaders, mov3);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  assertEq2('Total tras aprobar intento 3', balAfterApprove.saldo_total, bal0.saldo_total + garantia);
  assertEq2('Retenido tras aprobar intento 3', balAfterApprove.saldo_retenido, bal0.saldo_retenido + garantia);
  assertEq2('Aplicado tras aprobar intento 3 (sin cambio)', balAfterApprove.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras aprobar intento 3 (sin cambio)', balAfterApprove.saldo_disponible, bal0.saldo_disponible);

  console.log('\n✅ FLUJO 9 completado. Solo el intento aprobado afectó saldos; rechazos previos no alteraron el balance.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 9:', e);
    process.exit(1);
  });
}

module.exports = { run };