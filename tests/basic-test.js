/**
 * Script de pruebas básicas para la API de BOB Subastas
 * Ejecutar después de configurar la base de datos y variables de entorno
 */

const API_BASE = 'http://localhost:3000';

// Función helper para hacer requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  try {
    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();
    
    console.log(`\n${options.method || 'GET'} ${endpoint}`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    return { response, data };
  } catch (error) {
    console.error(`❌ Error en ${endpoint}:`, error.message);
    return { error };
  }
}

// Función helper para hacer login y obtener session
async function loginAsAdmin() {
  console.log('\n🔐 === AUTENTICACIÓN ===');
  
  const { response, data } = await makeRequest('/auth/admin-access', {
    method: 'POST',
  });
  
  if (response?.ok && data?.success) {
    console.log('✅ Login de admin exitoso');
    return data.data.session.session_id;
  } else {
    console.log('❌ Error en login de admin');
    return null;
  }
}

async function loginAsClient() {
  console.log('\n🔐 Intentando login de cliente de prueba...');
  
  const { response, data } = await makeRequest('/auth/client-login', {
    method: 'POST',
    body: JSON.stringify({
      document_type: 'DNI',
      document_number: '12345678'
    }),
  });
  
  if (response?.ok && data?.success) {
    console.log('✅ Login de cliente exitoso');
    return { sessionId: data.data.session.session_id, userId: data.data.user.id };
  } else {
    console.log('❌ Error en login de cliente (esperado si no hay seed)');
    return null;
  }
}

// Función principal de pruebas
async function runBasicTests() {
  console.log('🚀 === INICIANDO PRUEBAS BÁSICAS DE LA API BOB SUBASTAS ===\n');
  
  // 1. Health Check
  console.log('1️⃣ === HEALTH CHECK ===');
  await makeRequest('/health');
  
  // 2. Autenticación
  const adminSession = await loginAsAdmin();
  const clientData = await loginAsClient();
  
  if (!adminSession) {
    console.log('\n❌ No se pudo obtener sesión de admin. Verifica que:');
    console.log('   • La base de datos esté configurada');
    console.log('   • Se haya ejecutado el seed (npm run db:seed)');
    console.log('   • El servidor esté corriendo');
    return;
  }
  
  // Headers con sesión de admin
  const adminHeaders = {
    'X-Session-ID': adminSession,
    'Content-Type': 'application/json',
  };
  
  // 3. Validar sesión
  console.log('\n🔍 === VALIDACIÓN DE SESIÓN ===');
  await makeRequest('/auth/session', {
    headers: adminHeaders,
  });
  
  // 4. Estadísticas generales
  console.log('\n📊 === ESTADÍSTICAS ===');
  await makeRequest('/auctions/stats', {
    headers: adminHeaders,
  });
  
  await makeRequest('/balances/stats', {
    headers: adminHeaders,
  });
  
  // 5. Prueba de creación de subasta
  console.log('\n🏗️ === CREAR SUBASTA DE PRUEBA ===');
  const auctionData = {
    fecha_inicio: new Date(Date.now() + 60000).toISOString(), // 1 minuto en el futuro
    fecha_fin: new Date(Date.now() + 3600000).toISOString(), // 1 hora en el futuro
    asset: {
      placa: 'TEST-123',
      empresa_propietaria: 'Empresa de Prueba S.A.',
      marca: 'Toyota',
      modelo: 'Corolla',
      año: 2020,
      descripcion: 'Vehículo de prueba para testing de API'
    }
  };
  
  const { data: auctionResponse } = await makeRequest('/auctions', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify(auctionData),
  });
  
  let createdAuctionId = null;
  if (auctionResponse?.success) {
    createdAuctionId = auctionResponse.data.auction.id;
    console.log(`✅ Subasta creada con ID: ${createdAuctionId}`);
  }
  
  // 6. Listar subastas
  console.log('\n📋 === LISTAR SUBASTAS ===');
  await makeRequest('/auctions?limit=5', {
    headers: adminHeaders,
  });
  
  // 7. Si tenemos cliente, mostrar sus datos
  if (clientData) {
    console.log('\n👤 === DATOS DE CLIENTE ===');
    const clientHeaders = {
      'X-Session-ID': clientData.sessionId,
      'Content-Type': 'application/json',
    };
    
    await makeRequest(`/users/${clientData.userId}/balance`, {
      headers: clientHeaders,
    });
    
    await makeRequest(`/users/${clientData.userId}/movements`, {
      headers: clientHeaders,
    });
  }
  
  // 8. Jobs disponibles
  console.log('\n⚙️ === JOBS DISPONIBLES ===');
  await makeRequest('/jobs/list', {
    headers: adminHeaders,
  });
  
  await makeRequest('/jobs/status', {
    headers: adminHeaders,
  });
  
  // 9. Limpiar datos de prueba
  if (createdAuctionId) {
    console.log('\n🧹 === LIMPIEZA ===');
    console.log(`Eliminando subasta de prueba: ${createdAuctionId}`);
    
    await makeRequest(`/auctions/${createdAuctionId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
  }
  
  console.log('\n✅ === PRUEBAS COMPLETADAS ===');
  console.log('\nPróximos pasos recomendados:');
  console.log('1. Configurar tu base de datos PostgreSQL real');
  console.log('2. Actualizar .env con credenciales reales');
  console.log('3. Ejecutar migraciones: npm run db:push');
  console.log('4. Ejecutar seed: npm run db:seed');
  console.log('5. Iniciar servidor: npm run dev');
  console.log('6. Probar con herramientas como Postman o Insomnia');
}

// Verificar si Node.js tiene fetch (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ Este script requiere Node.js 18+ o instalar node-fetch');
  console.log('💡 Para probar manualmente, usa Postman/Insomnia con los endpoints documentados');
  process.exit(1);
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
  console.log('⚠️  NOTA: Este script asume que el servidor está corriendo en localhost:3000');
  console.log('⚠️  Asegúrate de tener configurada la base de datos antes de ejecutar\n');
  
  runBasicTests().catch(error => {
    console.error('❌ Error en pruebas:', error);
    process.exit(1);
  });
}

module.exports = {
  runBasicTests,
  makeRequest,
  loginAsAdmin,
  loginAsClient,
};