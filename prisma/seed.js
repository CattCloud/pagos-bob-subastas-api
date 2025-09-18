const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Crear usuario admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bobsubastas.com' },
    update: {},
    create: {
      first_name: 'Administrador',
      last_name: 'BOB Subastas',
      email: 'admin@bobsubastas.com',
      phone_number: '+51999999999',
      document_type: null, // Admin no tiene documento
      document_number: 'ADMIN001', // Identificador único para admin
      user_type: 'admin',
    },
  });

  // Cache de saldos ahora vive en User (saldo_total, saldo_retenido). No se usa tabla legacy de balances.
  // No es necesario crear registros adicionales para admin.

  // Crear algunos usuarios de prueba para desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('Creando usuarios de prueba...');
    
    const testUsers = [
      {
        first_name: 'Juan Carlos',
        last_name: 'Pérez López',
        email: 'juan.perez@example.com',
        phone_number: '+51987654321',
        document_type: 'DNI',
        document_number: '12345678',
        user_type: 'client',
      },
      {
        first_name: 'María Elena',
        last_name: 'González Ríos',
        email: 'maria.gonzalez@example.com',
        phone_number: '+51876543210',
        document_type: 'CE',
        document_number: '987654321',
        user_type: 'client',
      },
      {
        first_name: 'Empresa Transportes',
        last_name: 'SAC',
        email: 'transportes@example.com',
        phone_number: '+51765432109',
        document_type: 'RUC',
        document_number: '20123456789',
        user_type: 'client',
      }
    ];

    for (const userData of testUsers) {
      const user = await prisma.user.upsert({
        where: { document_number: userData.document_number },
        update: {},
        create: userData,
      });

      // Los campos de cache (saldo_total, saldo_retenido) se mantienen en User con default 0.

      console.log(`✅ Usuario creado: ${user.first_name} ${user.last_name} (${user.document_type}: ${user.document_number})`);
    }
  }

  console.log('✅ Seed completado exitosamente');
  console.log(`👨‍💼 Admin creado: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });