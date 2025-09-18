/**
 * VALIDACIONES DE NEGOCIO Y CASOS DE ERROR
 * Prueba casos de validación y límites según HU detalladas
 * Requiere API en http://localhost:3000 y Node 18+
 * 
 * Casos cubiertos:
 * - Validaciones de reembolsos (HU-REEM-01 VN-01 a VN-07)
 * - Validaciones de pagos (HU-Registro Pago)
 * - Validaciones de subastas (HU-Gestión Subastas)
 * - Autorización y sesiones
 * - Integridad de datos y estados
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
  if (data && !res.ok) console.log('Error:', JSON.stringify(data, null, 2));
  return { res, data };
}

function approx2(n) { return Number(Number(n).toFixed(2)); }

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
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const ruc = '20' + randDigits(9);
  const email = `vn.${Math.random().toString(36).slice(2,8)}@test.local`;
  let user;
  try {
    user = await prisma.user.create({
      data: {
        first_name: 'Validación',
        last_name: 'Negocio',
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
    headers: { 'X-Session-ID': data.data.session.session_id },
    user: data.data.user,
  };
}

function uniquePlateVN() {
  return `VN-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

async function createAuction(adminHeaders, asset) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();
  const endISO = new Date(now + 3600000).toISOString();
  const payload = { fecha_inicio: startISO, fecha_fin: endISO, asset };
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

async function run() {
  console.log('🚀 Iniciando VALIDACIONES DE NEGOCIO - Casos de error y límites');

  await req('/');

  const adminLogin = await loginAdmin();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  
  const clientCtx = await ensureCleanClient();
  const clientHeaders = clientCtx.headers;
  const clientId = clientCtx.user.id;

  console.log('\n=== 1. VALIDACIONES DE AUTENTICACIÓN ===');

  // 1.1 Intento sin sesión
  const { res: noAuth } = await req('/users/fake-id/balance');
  if (noAuth.status !== 401) throw new Error('Debería fallar sin autenticación');
  console.log('✅ Sin sesión → 401 Unauthorized');

  // 1.2 Sesión inválida
  const { res: badSession } = await req('/users/fake-id/balance', {
    headers: { 'X-Session-ID': 'session-inexistente' }
  });
  if (badSession.status !== 401) throw new Error('Debería fallar con sesión inválida');
  console.log('✅ Sesión inválida → 401 Unauthorized');

  console.log('\n=== 2. VALIDACIONES DE REEMBOLSOS (HU-REEM-01) ===');

  // 2.1 VN-01: Monto <= 0 (validación de esquema → 422)
  const { res: montoNeg } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: 'c123456789012345678901234', monto_solicitado: -10, tipo_reembolso: 'devolver_dinero', motivo: 'Test' }
  });
  if (montoNeg.status !== 422) throw new Error('Debería fallar validación con monto negativo (422)');
  console.log('✅ Monto negativo → 422 Validation Error');

  // 2.2 VN-01: Monto = 0 (validación de esquema → 422)
  const { res: montoCero } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: 'c123456789012345678901234', monto_solicitado: 0, tipo_reembolso: 'devolver_dinero', motivo: 'Test' }
  });
  if (montoCero.status !== 422) throw new Error('Debería fallar validación con monto cero (422)');
  console.log('✅ Monto cero → 422 Validation Error');

  // 2.3 VN-01: Exceder saldo disponible (regla de negocio → 409)
  const { res: excesoSaldo } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: 'c123456789012345678901234', monto_solicitado: 1000, tipo_reembolso: 'devolver_dinero', motivo: 'Test' }
  });
  if (excesoSaldo.status !== 409) throw new Error('Debería fallar al exceder saldo disponible (409)');
  console.log('✅ Exceder saldo disponible → 409 Conflict');

  console.log('\n=== 3. VALIDACIONES DE SUBASTAS ===');

  // 3.1 Crear subasta con fechas inválidas (fin < inicio)
  const now = Date.now();
  const { res: fechasInv } = await req('/auctions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      fecha_inicio: new Date(now + 10000).toISOString(),
      fecha_fin: new Date(now + 5000).toISOString(), // fin antes que inicio
      asset: {
        placa: uniquePlateVN(),
        empresa_propietaria: 'TEST',
        marca: 'Test',
        modelo: 'Test',
        año: 2020
      }
    }
  });
  if (fechasInv.status !== 422) throw new Error('Debería fallar con fecha_fin < fecha_inicio');
  console.log('✅ Fechas inválidas → 422 Validation Error');

  // 3.2 Placa duplicada
  const placa = uniquePlateVN();
  const { id: auction1 } = await createAuction(adminHeaders, {
    placa, empresa_propietaria: 'TEST1', marca: 'Test', modelo: 'Test1', año: 2020
  });
  
  const { res: placaDup } = await req('/auctions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      fecha_inicio: new Date(now + 5000).toISOString(),
      fecha_fin: new Date(now + 10000).toISOString(),
      asset: {
        placa, // misma placa
        empresa_propietaria: 'TEST2',
        marca: 'Test',
        modelo: 'Test2',
        año: 2021
      }
    }
  });
  if (placaDup.status !== 409) throw new Error('Debería fallar con placa duplicada');
  console.log('✅ Placa duplicada → 409 Conflict');

  console.log('\n=== 4. VALIDACIONES DE PAGOS ===');

  const oferta = 10000.00;
  const garantia = approx2(oferta * 0.08);
  await setWinner(adminHeaders, auction1, clientId, oferta, new Date(now + 10000).toISOString());

  // 4.1 Usuario incorrecto intenta pagar subasta
  const otherClientCtx = await ensureCleanClient();
  const form1 = new FormData();
  form1.append('auction_id', auction1);
  form1.append('monto', String(garantia));
  form1.append('tipo_pago', 'transferencia');
  form1.append('numero_cuenta_origen', '1234567890');
  form1.append('numero_operacion', 'OP-FAKE');
  form1.append('fecha_pago', new Date().toISOString());
  form1.append('voucher', new Blob([Buffer.from('test', 'utf8')], { type: 'image/png' }), 'test.png');

  const { res: wrongUser } = await req('/movements', {
    method: 'POST',
    headers: otherClientCtx.headers,
    body: form1
  });
  // Regla de negocio: NOT_CURRENT_WINNER → 409 Conflict
  if (wrongUser.status !== 409) throw new Error('Debería fallar si no es el ganador (409)');
  console.log('✅ Usuario incorrecto paga → 409 Conflict');

  console.log('\n=== 5. VALIDACIONES DE GESTIÓN DE REEMBOLSOS ===');

  // Preparar subasta con garantía validada y resultado 'penalizada' para tener saldo disponible (70%)
  const { id: auction2 } = await createAuction(adminHeaders, {
    placa: uniquePlateVN(),
    empresa_propietaria: 'TEST REFUND',
    marca: 'Test',
    modelo: 'Refund',
    año: 2020
  });
  await setWinner(adminHeaders, auction2, clientId, 5000, new Date(now + 15000).toISOString());

  // Esperar inicio de subasta para poder registrar pago dentro de la ventana válida
  await delay(6000);
  const garantia2 = approx2(5000 * 0.08); // 8% = 400.00
  const form2 = new FormData();
  form2.append('auction_id', auction2);
  form2.append('monto', String(garantia2));
  form2.append('tipo_pago', 'transferencia');
  form2.append('numero_cuenta_origen', '1234567890');
  form2.append('numero_operacion', 'OP-' + randDigits(6));
  form2.append('fecha_pago', new Date().toISOString());
  form2.append('voucher', new Blob([Buffer.from('test', 'utf8')], { type: 'image/png' }), 'test.png');

  const { res: pay2Res, data: pay2Data } = await req('/movements', {
    method: 'POST',
    headers: clientHeaders,
    body: form2
  });
  if (pay2Res.status !== 201) throw new Error('No se pudo registrar pago de garantía para auction2');

  const movement2Id = pay2Data.data.movement.id;
  const { res: approve2 } = await req(`/movements/${movement2Id}/approve`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { comentarios: 'OK test' }
  });
  if (approve2.status !== 200) throw new Error('No se pudo aprobar pago de garantía para auction2');

  // Registrar resultado penalizada (aplica 30% penalidad y libera retención → saldo disponible > 0)
  const { res: resultPen } = await req(`/auctions/${auction2}/competition-result`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { resultado: 'penalizada', observaciones: 'Test penalizada' }
  });
  if (resultPen.status !== 200) throw new Error('No se pudo registrar resultado penalizada');

  // Crear reembolso válido luego de penalidad (saldo disponible = garantía - penalidad)
  const { res: refundRes, data: refundData } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auction2, monto_solicitado: 50, tipo_reembolso: 'devolver_dinero', motivo: 'Test refund' }
  });
  if (!refundRes.ok) throw new Error('No se pudo crear refund de prueba');
  const refundId = refundData.data.refund.id;

  // 5.1 Admin intenta gestionar refund con estado inválido
  const { res: badState } = await req(`/refunds/${refundId}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado: 'invalid_state', motivo: 'Test' }
  });
  if (badState.status !== 422) throw new Error('Debería fallar validación con estado inválido (422)');
  console.log('✅ Estado inválido en manage → 422 Validation Error');

  // 5.2 Doble solicitud de reembolso
  await req(`/refunds/${refundId}/manage`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { estado: 'confirmado', motivo: 'OK para test' }
  });

  const { res: doubleRefund } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: auction2, monto_solicitado: 30, tipo_reembolso: 'devolver_dinero', motivo: 'Segunda solicitud' }
  });
  if (doubleRefund.status !== 409) throw new Error('Debería fallar con solicitud pendiente');
  console.log('✅ Doble solicitud de reembolso → 409 Conflict');

  console.log('\n=== 6. VALIDACIONES DE ESTADOS DE SUBASTA ===');

  // 6.1 Intento de resultado en subasta con estado incorrecto
  const { res: badAuctionState } = await req(`/auctions/${auction1}/competition-result`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { resultado: 'ganada', observaciones: 'Test estado incorrecto' }
  });
  if (badAuctionState.status !== 409) throw new Error('Debería fallar con estado incorrecto');
  console.log('✅ Resultado en estado incorrecto → 409 Conflict');

  console.log('\n=== 7. VALIDACIONES DE BILLING ===');

  // Crear subasta ganada válida para billing
  const { id: auction3, startISO: start3 } = await createAuction(adminHeaders, {
    placa: uniquePlateVN(),
    empresa_propietaria: 'TEST BILLING',
    marca: 'Test',
    modelo: 'Billing',
    año: 2020
  });
  // Usar fecha de oferta dentro de la ventana de la subasta para evitar INVALID_OFFER_DATE
  const fechaOferta3 = new Date(new Date(start3).getTime() + 1000).toISOString();
  await setWinner(adminHeaders, auction3, clientId, 8000, fechaOferta3);

  // 7.1 Intentar billing en subasta no ganada
  const { res: billingWrongState } = await req('/billing', {
    method: 'POST',
    headers: clientHeaders,
    body: {
      auction_id: auction3,
      billing_document_type: 'DNI',
      billing_document_number: '12345678',
      billing_name: 'Test Cliente'
    }
  });
  if (billingWrongState.status !== 409) throw new Error('Debería fallar billing en subasta no ganada');
  console.log('✅ Billing en estado incorrecto → 409 Conflict');

  console.log('\n=== 8. VALIDACIONES DE NOTIFICACIONES ===');

  // 8.1 Marcar notificación inexistente como leída
  const { res: notifNotFound } = await req('/notifications/fake-notif-id/read', {
    method: 'PATCH',
    headers: clientHeaders
  });
  if (notifNotFound.status !== 404) throw new Error('Debería fallar con notificación inexistente');
  console.log('✅ Notificación inexistente → 404 Not Found');

  console.log('\n=== 9. VALIDACIONES DE MOVIMIENTOS ===');

  // 9.1 Aprobar movement inexistente
  const { res: movNotFound } = await req('/movements/fake-mov-id/approve', {
    method: 'PATCH',
    headers: adminHeaders,
    body: { comentarios: 'Test' }
  });
  if (movNotFound.status !== 404) throw new Error('Debería fallar con movement inexistente');
  console.log('✅ Movement inexistente → 404 Not Found');

  console.log('\n=== 10. VALIDACIONES DE DATOS ===');

  // 10.1 Documento inválido para login
  const { res: badDoc } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: 'DNI', document_number: '123' } // DNI debe tener 8 dígitos
  });
  if (badDoc.status !== 422) throw new Error('Debería fallar con documento inválido');
  console.log('✅ Documento inválido → 422 Validation Error');

  // 10.2 Usuario inexistente
  const { res: userNotFound } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: 'DNI', document_number: '99999999' }
  });
  if (userNotFound.status !== 404) throw new Error('Debería fallar con usuario inexistente');
  console.log('✅ Usuario inexistente → 404 Not Found');

  console.log('\n=== 11. VALIDACIONES DE ARCHIVOS ===');

  // 11.1 Archivo con tipo MIME incorrecto
  await delay(6000); // Esperar inicio de subasta
  const formBadFile = new FormData();
  formBadFile.append('auction_id', auction1);
  formBadFile.append('monto', String(garantia));
  formBadFile.append('tipo_pago', 'transferencia');
  formBadFile.append('numero_cuenta_origen', '1234567890');
  formBadFile.append('numero_operacion', 'OP-TEST');
  formBadFile.append('fecha_pago', new Date().toISOString());
  formBadFile.append('voucher', new Blob([Buffer.from('test content')], { type: 'text/plain' }), 'test.txt');

  const { res: badFile } = await req('/movements', {
    method: 'POST',
    headers: clientHeaders,
    body: formBadFile
  });
  if (badFile.status !== 422) throw new Error('Debería fallar con tipo de archivo incorrecto');
  console.log('✅ Tipo de archivo incorrecto → 422 Validation Error');

  console.log('\n=== 12. VALIDACIONES DE MONTOS ===');

  // 12.1 Monto con más de 2 decimales (validación de esquema independiente del estado de refund)
  const { res: decExcess } = await req('/refunds', {
    method: 'POST',
    headers: clientHeaders,
    body: { auction_id: 'c123456789012345678901234', monto_solicitado: 10.123, tipo_reembolso: 'devolver_dinero', motivo: 'Test decimales' }
  });
  if (decExcess.status !== 422) throw new Error('Debería fallar con exceso de decimales');
  console.log('✅ Exceso de decimales → 422 Validation Error');

  console.log('\n=== 13. VALIDACIONES DE RECURSO NO ENCONTRADO ===');

  // 13.1 Subasta inexistente (autenticado para evitar 401 del middleware)
  const { res: auctionNotFound } = await req('/auctions/fake-auction-id', { headers: adminHeaders });
  if (auctionNotFound.status !== 404) throw new Error('Debería fallar con subasta inexistente');
  console.log('✅ Subasta inexistente → 404 Not Found');

  // 13.2 Usuario inexistente para balance
  const { res: userBalNotFound } = await req('/users/fake-user-id/balance', { headers: adminHeaders });
  if (userBalNotFound.status !== 404) throw new Error('Debería fallar con usuario inexistente');
  console.log('✅ Usuario inexistente para balance → 404 Not Found');

  console.log('\n=== 14. VALIDACIONES DE AUTORIZACIÓN POR ROL ===');

  // 14.1 Cliente intenta crear subasta (solo admin)
  const { res: clientCreateAuction } = await req('/auctions', {
    method: 'POST',
    headers: clientHeaders,
    body: {
      fecha_inicio: new Date(now + 25000).toISOString(),
      fecha_fin: new Date(now + 30000).toISOString(),
      asset: {
        placa: uniquePlateVN(),
        empresa_propietaria: 'UNAUTHORIZED',
        marca: 'Test',
        modelo: 'Test',
        año: 2020
      }
    }
  });
  if (clientCreateAuction.status !== 403) throw new Error('Cliente no debería poder crear subastas');
  console.log('✅ Cliente crea subasta → 403 Forbidden');

  // 14.2 Cliente intenta aprobar movement (solo admin)
  const { res: clientApprove } = await req('/movements/fake-mov-id/approve', {
    method: 'PATCH',
    headers: clientHeaders,
    body: { comentarios: 'Unauthorized' }
  });
  if (clientApprove.status !== 403) throw new Error('Cliente no debería poder aprobar movements');
  console.log('✅ Cliente aprueba movement → 403 Forbidden');

  console.log('\n✅ VALIDACIONES DE NEGOCIO completadas. Sistema responde correctamente a casos de error.');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error Validaciones:', e);
    process.exit(1);
  });
}

module.exports = { run };