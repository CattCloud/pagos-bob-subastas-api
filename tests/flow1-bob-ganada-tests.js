/**
 * FLUJO 1: Proceso Exitoso Completo - BOB Gana la Competencia Externa
 * Requiere API corriendo en http://localhost:3000
 * Node 18+ (fetch nativo, Blob/FormData disponibles)
 *
 * Escenario descrito:
 * - Cliente "María" gana con oferta 1250 (garantía 100)
 * - Registra pago de garantía, Admin valida, subasta finaliza
 * - Admin registra resultado "ganada"
 * - Cliente completa datos de facturación (billing 100)
 * - Verificaciones de saldos en cada paso (en términos de deltas)
 *
 * Nota importante:
 * En el ambiente actual puede que el cliente de prueba ya tenga saldos previos.
 * Para cumplir el caso funcional sin depender de un seed vacío:
 *   - Se verifica que los DELTAS de saldo coincidan con el flujo:
 *     Paso 4 (validación pago):
 *       total += 100, retenido += 100, aplicado igual, disponible sin cambio
 *     Paso 6 (billing):
 *       total igual, retenido -= 100, aplicado += 100, disponible sin cambio
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

async function loginClient(docType = 'DNI', docNumber = '12345678') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

async function createAuction(adminHeaders, placa, descripcion = 'Toyota Corolla 2020') {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();   // empieza en 5s
  const endISO = new Date(now + 3600000).toISOString();  // +1h
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA DEMO',
      marca: 'Toyota',
      modelo: 'Corolla',
      año: 2020,
      descripcion,
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

async function registerGuaranteePayment(clientHeaders, auctionId, guaranteeAmount, startISO) {
  // delay pequeño hasta el inicio
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
  form.append('concepto', 'Pago garantía FLUJO1');

  // PNG 1x1 base64 como voucher
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
    body: { comentarios: 'Verificado FLUJO1' },
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

async function createBilling(clientHeaders, auctionId, docNumber, billingName = 'María Cliente') {
  const payload = {
    auction_id: auctionId,
    billing_document_type: 'DNI',
    billing_document_number: docNumber,
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

function assertFormula(bal) {
  const expected = approx2(bal.saldo_total - bal.saldo_retenido - bal.saldo_aplicado);
  assertEq2('Formula saldo_disponible', bal.saldo_disponible, expected);
}

async function run() {
  console.log('🚀 Iniciando FLUJO 1 - BOB gana competencia externa');

  // Health
  await req('/');

  // Logins
  const adminLogin = await loginAdmin();
  const clientLogin = await loginClient(); // Cliente de pruebas (usado como "María" en el flujo)
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': clientLogin.sessionId };
  const clientId = clientLogin.user.id;

  // Estado inicial
  const bal0 = await getBalance(clientHeaders, clientId);
  assertFormula(bal0);
  console.log('Estado Inicial Cliente:', bal0);

  // Paso 1: Admin crea nueva subasta (placa ABC-123)
  const { id: auctionId, startISO } = await createAuction(adminHeaders, 'ABC-123', 'Toyota Corolla 2020');
  // Saldos sin cambios
  const balAfterCreate = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterCreate);
  assertEq2('Total tras crear subasta (sin cambios)', balAfterCreate.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras crear subasta (sin cambios)', balAfterCreate.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras crear subasta (sin cambios)', balAfterCreate.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras crear subasta (sin cambios)', balAfterCreate.saldo_disponible, bal0.saldo_disponible);

  // Paso 2: Admin registra a "María" como ganadora con oferta 1250
  const oferta = 1250.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId, clientId, oferta, fechaOfertaISO);
  // Saldos sin cambios (no ha pagado)
  const balAfterWinner = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterWinner);
  assertEq2('Total tras winner (sin cambios)', balAfterWinner.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras winner (sin cambios)', balAfterWinner.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras winner (sin cambios)', balAfterWinner.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras winner (sin cambios)', balAfterWinner.saldo_disponible, bal0.saldo_disponible);

  // Paso 3: Cliente registra su pago de garantía (100)
  const garantia = approx2(oferta * 0.08); // 100.00
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, garantia, startISO);
  // Aún pendiente, no afecta saldos
  const balAfterRegister = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterRegister);
  assertEq2('Total tras registrar pago (pendiente)', balAfterRegister.saldo_total, bal0.saldo_total);
  assertEq2('Retenido tras registrar pago (pendiente)', balAfterRegister.saldo_retenido, bal0.saldo_retenido);
  assertEq2('Aplicado tras registrar pago (pendiente)', balAfterRegister.saldo_aplicado, bal0.saldo_aplicado);
  assertEq2('Disponible tras registrar pago (pendiente)', balAfterRegister.saldo_disponible, bal0.saldo_disponible);

  // Paso 4: Admin valida el pago (movement validado, subasta finalizada)
  await approvePayment(adminHeaders, movementId);
  const balAfterApprove = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterApprove);
  // Efecto esperado: total +garantia, retenido +garantia, aplicado igual, disponible sin cambio
  assertEq2('Total tras validar pago', balAfterApprove.saldo_total, balAfterRegister.saldo_total + garantia);
  assertEq2('Retenido tras validar pago', balAfterApprove.saldo_retenido, balAfterRegister.saldo_retenido + garantia);
  assertEq2('Aplicado tras validar pago', balAfterApprove.saldo_aplicado, balAfterRegister.saldo_aplicado);
  assertEq2('Disponible tras validar pago (sin cambio)', balAfterApprove.saldo_disponible, balAfterRegister.saldo_disponible);

  // Paso 5: Admin registra que BOB ganó la competencia externa (estado 'ganada')
  await setCompetitionResult(adminHeaders, auctionId, 'ganada', 'BOB ganó la competencia externa');
  const balAfterGanada = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterGanada);
  // Saldos sin cambios (sigue retenido a la espera de facturación)
  assertEq2('Total tras ganada (sin cambio)', balAfterGanada.saldo_total, balAfterApprove.saldo_total);
  assertEq2('Retenido tras ganada (sin cambio)', balAfterGanada.saldo_retenido, balAfterApprove.saldo_retenido);
  assertEq2('Aplicado tras ganada (sin cambio)', balAfterGanada.saldo_aplicado, balAfterApprove.saldo_aplicado);
  assertEq2('Disponible tras ganada (sin cambio)', balAfterGanada.saldo_disponible, balAfterApprove.saldo_disponible);

  // Paso 6: Cliente completa datos de facturación (crea Billing = garantia, subasta 'facturada')
  const uniqueDoc = String(10000000 + Math.floor(Math.random() * 90000000));
  await createBilling(clientHeaders, auctionId, uniqueDoc, 'María Cliente');
  const balAfterBilling = await getBalance(clientHeaders, clientId);
  assertFormula(balAfterBilling);
  // Efecto esperado: retenido -garantia, aplicado +garantia, total igual, disponible sin cambio
  assertEq2('Total tras billing (igual)', balAfterBilling.saldo_total, balAfterGanada.saldo_total);
  assertEq2('Retenido tras billing (-garantia)', balAfterBilling.saldo_retenido, balAfterGanada.saldo_retenido - garantia);
  assertEq2('Aplicado tras billing (+garantia)', balAfterBilling.saldo_aplicado, balAfterGanada.saldo_aplicado + garantia);
  assertEq2('Disponible tras billing (sin cambio)', balAfterBilling.saldo_disponible, balAfterGanada.saldo_disponible);

  console.log('\n✅ FLUJO 1 completado correctamente. Deltas de saldo coinciden con el caso esperado.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error FLUJO 1:', e);
    process.exit(1);
  });
}

module.exports = { run };