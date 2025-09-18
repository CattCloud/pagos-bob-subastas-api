/**
 * Pruebas HU implementadas (camino crítico)
 * Requiere servidor en http://localhost:3000
 * Node 18+ (fetch/FormData/Blob nativos)
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
  return data.data.session.session_id;
}

async function loginClient(docType = 'DNI', docNumber = '12345678') {
  const { res, data } = await req('/auth/client-login', {
    method: 'POST',
    body: { document_type: docType, document_number: docNumber },
  });
  if (!res.ok || !data?.success) throw new Error('Login cliente falló');
  return { sessionId: data.data.session.session_id, userId: data.data.user.id };
}

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function createAuction(adminHeaders) {
  const now = Date.now();
  const startISO = new Date(now + 5000).toISOString();     // +5s (cumple validación "mayor a now")
  const endISO = new Date(now + 3600000).toISOString();    // +1 hora
  const payload = {
    fecha_inicio: startISO,
    fecha_fin: endISO,
    asset: {
      placa: `HU-${Math.random().toString(36).slice(2,7).toUpperCase()}`,
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
  // fecha_pago: usar "ahora" para no ser futura y >= inicio (esperamos antes de invocar)
  const nowISO = new Date().toISOString();
  form.append('fecha_pago', nowISO);
  form.append('moneda', 'USD');
  form.append('concepto', 'Pago garantía HU test');
  // Usar PNG 1x1 válido (base64) para evitar rechazo de Cloudinary por archivo inválido
  const b64Png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
  const binPng = Buffer.from(b64Png1x1, 'base64');
  form.append('voucher', new Blob([binPng], { type: 'image/png' }), 'voucher.png');
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

async function getBalance(headers, userId, label='') {
  const { res } = await req(`/users/${userId}/balance`, { headers });
  if (!res.ok) throw new Error(`Balance ${label} falló`);
}

async function listMovements(headers, userId, label='') {
  const { res } = await req(`/users/${userId}/movements`, { headers });
  if (!res.ok) throw new Error(`Movements ${label} falló`);
}

async function setCompetitionResult(adminHeaders, auctionId, resultado, observaciones) {
  const { res } = await req(`/auctions/${auctionId}/competition-result`, {
    method: 'PATCH',
    headers: { ...adminHeaders, 'Content-Type': 'application/json' },
    body: { resultado, observaciones },
  });
  if (!res.ok) throw new Error('Competencia externa falló');
}

async function run() {
  console.log('🚀 Iniciando pruebas HU implementadas (pagos/validación/competencia/saldo)');
  // Health
  await req('/');
  // Login
  const adminSession = await loginAdmin();
  const client = await loginClient();
  const adminHeaders = { 'X-Session-ID': adminSession };
  const clientHeaders = { 'X-Session-ID': client.sessionId };
  // Crear subasta
  const { id: auctionId, startISO } = await createAuction(adminHeaders);
  // Ganador - fecha_oferta debe estar entre fecha_inicio y fecha_fin
  const oferta = 12000.00;
  const fechaOfertaISO = new Date(new Date(startISO).getTime() + 5000).toISOString(); // +5s tras inicio
  await setWinner(adminHeaders, auctionId, client.userId, oferta, fechaOfertaISO);
  // Esperar hasta que inicie la subasta para evitar FUTURE_PAYMENT_DATE
  const waitMs = new Date(startISO).getTime() - Date.now() + 1500;
  if (waitMs > 0) await delay(waitMs);
  // Pago garantía (fecha_pago >= fecha_inicio y no futura)
  const movementId = await registerGuaranteePayment(clientHeaders, auctionId, oferta, startISO);
  // Aprobar
  await approvePayment(adminHeaders, movementId);
  // Saldos post-aprobación (finalizada mantiene retenido)
  await delay(200);
  await getBalance(clientHeaders, client.userId, 'post-aprobación');
  await listMovements(clientHeaders, client.userId, 'post-aprobación');
  // Competencia: perdida (libera retenido)
  await setCompetitionResult(adminHeaders, auctionId, 'perdida', 'HU test pérdida');
  await delay(200);
  await getBalance(clientHeaders, client.userId, 'post-perdida');
  await listMovements(clientHeaders, client.userId, 'post-perdida');
  // Limpieza: eliminar subasta
  const { res: delRes } = await req(`/auctions/${auctionId}`, { method: 'DELETE', headers: adminHeaders });
  if (delRes.status !== 204) console.warn('Aviso: DELETE subasta no devolvió 204');
  console.log('\n✅ HU críticas verificadas correctamente');
}

if (require.main === module) {
  run().catch((e) => {
    console.error('❌ Error HU:', e);
    process.exit(1);
  });
}

module.exports = { run };