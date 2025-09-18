/**
 * Pruebas HU nuevas: Billing, Notificaciones y Reembolsos (end-to-end)
 * Requiere servidor en http://localhost:3000 y Node 18+ (fetch/FormData/Blob nativos)
 * NOTA: Actualiza el email del cliente a uno real para probar EmailJS
 */
const API_BASE = 'http://localhost:3000';

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
  try {
    data = await res.json();
  } catch (_) {}
  console.log(`\n${method} ${endpoint}`);
  console.log(`Status: ${res.status} ${res.statusText}`);
  if (data) console.log('Response:', JSON.stringify(data, null, 2));
  return { res, data };
}

async function loginAdmin() {
  const { res, data } = await req('/auth/admin-access', { method: 'POST' });
  if (!res.ok || !data?.success) throw new Error('Login admin falló');
  return { sessionId: data.data.session.session_id, userId: data.data.user.id };
}

async function loginClient(docType = 'DNI', docNumber = '12345678') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, user: data.data.user };
}

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function updateClientEmail(userId, newEmail) {
  // Actualiza email del cliente para probar envío real (EmailJS)
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: newEmail },
      select: { id: true, email: true }
    });
    console.log('\n[DB] Cliente actualizado:', updated);
  } finally {
    await prisma.$disconnect();
  }
}

async function createAuction(adminHeaders, placa) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();     // +5s (cumple "mayor a now")
  const endISO = new Date(now + 3600000).toISOString();    // +1 hora
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa,
      empresa_propietaria: 'EMPRESA HU S.A.',
      marca: 'Toyota',
      modelo: 'Yaris',
      año: 2020,
      descripcion: 'HU Test',
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
    fecha_limite_pago: new Date(Date.now() + 600000).toISOString(),
  };
  const { res } = await req(`/auctions/${auctionId}/winner`, { method: 'POST', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Registrar ganador falló');
}

async function registerGuaranteePayment(clientHeaders, auctionId, offerAmount, startISO) {
  const garantia = Number((offerAmount * 0.08).toFixed(2));
  const form = new FormData();
  form.append('auction_id', auctionId);
  form.append('monto', String(garantia));
  form.append('tipo_pago', 'transferencia');
  form.append('numero_cuenta_origen', '1234567890');
  form.append('numero_operacion', `OP-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  // fecha_pago = now (ya esperamos al inicio)
  form.append('fecha_pago', new Date().toISOString());
  form.append('moneda', 'USD');
  form.append('concepto', 'Pago garantía HU test');

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
    body: { comentarios: 'Verificado banco HU' },
  });
  if (!res.ok) throw new Error('Aprobación de pago falló');
}

async function setCompetitionResult(adminHeaders, auctionId, resultado, observaciones) {
  const { res } = await req(`/auctions/${auctionId}/competition-result`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { resultado, observaciones },
  });
  if (!res.ok) throw new Error('Competencia externa falló');
}

async function createBilling(clientHeaders, auctionId) {
  // Usar un número de documento único por ejecución para evitar DUPLICATE_BILLING_DOCUMENT
  const uniqueDoc = String(10000000 + Math.floor(Math.random() * 90000000));
  const payload = {
    auction_id: auctionId,
    billing_document_type: 'DNI',
    billing_document_number: uniqueDoc,
    billing_name: 'Juan Carlos',
  };
  const { res } = await req('/billing', { method: 'POST', headers: clientHeaders, body: payload });
  if (!res.ok) throw new Error('Crear Billing falló');
}

async function getBalance(headers, userId, label='') {
  const { res } = await req(`/users/${userId}/balance`, { headers });
  if (!res.ok) throw new Error(`Balance ${label} falló`);
}

async function listNotifications(headers, label='') {
  const { res } = await req('/notifications?limit=10', { headers });
  if (!res.ok) throw new Error(`Listar notificaciones ${label} falló`);
}

async function createRefund(clientHeaders, auctionId, monto, tipo, motivo) {
  const payload = { auction_id: auctionId, monto_solicitado: monto, tipo_reembolso: tipo, motivo };
  const { res, data } = await req('/refunds', { method: 'POST', headers: clientHeaders, body: payload });
  if (!res.ok || !data?.data?.refund?.id) throw new Error('Crear refund falló');
  return data.data.refund.id;
}

async function manageRefund(adminHeaders, refundId, estado, motivo) {
  const payload = { estado, motivo };
  const { res } = await req(`/refunds/${refundId}/manage`, { method: 'PATCH', headers: adminHeaders, body: payload });
  if (!res.ok) throw new Error('Gestionar refund falló');
}

async function processRefund(adminHeaders, refundId, devolverDinero = false) {
  if (!devolverDinero) {
    // mantener_saldo: sin voucher/operación
    const { res } = await req(`/refunds/${refundId}/process`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: {},
    });
    if (!res.ok) throw new Error('Procesar refund (mantener_saldo) falló');
    return;
  }
  // devolver_dinero: enviar numero_operacion + voucher opcional
  const form = new FormData();
  form.append('tipo_transferencia', 'transferencia');
  form.append('numero_operacion', `OP-RF-${Math.random().toString(36).slice(2,8).toUpperCase()}`);
  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  const bin = Buffer.from(b64Png1x1, 'base64');
  form.append('voucher', new Blob([bin], { type: 'image/png' }), 'refund_voucher.png');
  const { res } = await req(`/refunds/${refundId}/process`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: form,
  });
  if (!res.ok) throw new Error('Procesar refund (devolver_dinero) falló');
}

async function run() {
  console.log('🚀 Iniciando pruebas HU Billing/Notificaciones/Reembolsos');

  // Health
  await req('/');

  // Login
  const adminLogin = await loginAdmin();
  const clientLoginRes = await loginClient();
  const adminHeaders = { 'X-Session-ID': adminLogin.sessionId };
  const clientHeaders = { 'X-Session-ID': clientLoginRes.sessionId };
  const clientId = clientLoginRes.user.id;

  // Actualizar email real del cliente para probar EmailJS
  const REAL_EMAIL = process.env.TEST_EMAIL || 'studiodreyk@gmail.com';
  await updateClientEmail(clientId, REAL_EMAIL);

  // Flujo 1: Billing (competencia ganada) → notificaciones y liberación de retenido (facturada)
  const placa1 = `HU-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const { id: auctionId1, startISO: startISO1 } = await createAuction(adminHeaders, placa1);
  const oferta1 = 12000.00;
  const fechaOferta1 = new Date(new Date(startISO1).getTime() + 5000).toISOString(); // +5s tras inicio
  await setWinner(adminHeaders, auctionId1, clientId, oferta1, fechaOferta1);

  // Esperar inicio subasta
  const waitMs1 = new Date(startISO1).getTime() - Date.now() + 1500;
  if (waitMs1 > 0) await delay(waitMs1);

  const movementId1 = await registerGuaranteePayment(clientHeaders, auctionId1, oferta1, startISO1);
  await approvePayment(adminHeaders, movementId1);

  // Competencia: ganada
  await setCompetitionResult(adminHeaders, auctionId1, 'ganada', 'HU test ganada');
  // Billing (aplica garantía, estado facturada, libera retenido)
  await createBilling(clientHeaders, auctionId1);
  await delay(300);
  await getBalance(clientHeaders, clientId, 'post-billing');
  await listNotifications(clientHeaders, 'post-billing');

  // Flujo 2: Refunds (competencia perdida) → saldo disponible → refund mantener_saldo y devolver_dinero
  const placa2 = `HU-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  const { id: auctionId2, startISO: startISO2 } = await createAuction(adminHeaders, placa2);
  const oferta2 = 8000.00;
  const fechaOferta2 = new Date(new Date(startISO2).getTime() + 5000).toISOString();
  await setWinner(adminHeaders, auctionId2, clientId, oferta2, fechaOferta2);
  const waitMs2 = new Date(startISO2).getTime() - Date.now() + 1500;
  if (waitMs2 > 0) await delay(waitMs2);
  const movementId2 = await registerGuaranteePayment(clientHeaders, auctionId2, oferta2, startISO2);
  await approvePayment(adminHeaders, movementId2);

  // Competencia: perdida → libera retenido (garantía disponible)
  await setCompetitionResult(adminHeaders, auctionId2, 'perdida', 'HU test perdida');
  await delay(300);
  await getBalance(clientHeaders, clientId, 'post-perdida');
  await listNotifications(clientHeaders, 'post-perdida');

  // Crear refund mantener_saldo (parcial)
  const refundId1 = await createRefund(clientHeaders, auctionId2, 100, 'mantener_saldo', 'Probar refund como saldo');
  await manageRefund(adminHeaders, refundId1, 'confirmado', 'Llamada OK');
  await processRefund(adminHeaders, refundId1, false);
  await delay(300);
  await listNotifications(clientHeaders, 'post-refund-mantener');

  // Crear refund devolver_dinero (otra parte)
  const refundId2 = await createRefund(clientHeaders, auctionId2, 150, 'devolver_dinero', 'Probar refund como transferencia');
  await manageRefund(adminHeaders, refundId2, 'confirmado', 'Llamada OK');
  await processRefund(adminHeaders, refundId2, true);
  await delay(300);
  await listNotifications(clientHeaders, 'post-refund-devolver');

  console.log('\n✅ Pruebas HU Billing/Notificaciones/Reembolsos ejecutadas correctamente (verifica el correo y notifications.email_status=enviado)');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error HU:', e);
    process.exit(1);
  });
}

module.exports = { run };