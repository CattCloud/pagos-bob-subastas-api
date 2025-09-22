const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Asegura el usuario requerido por FLUJO 3 (RUC: 20123456789)
    const user = await prisma.user.upsert({
      where: { document_number: '20123456789' },
      update: {},
      create: {
        first_name: 'Empresa',
        last_name: 'Transportes SAC',
        email: 'transportes@example.com',
        phone_number: '+51765432109',
        document_type: 'RUC',
        document_number: '20123456789',
        user_type: 'client',
      },
      select: { id: true, document_type: true, document_number: true },
    });

    console.log(
      `✅ Usuario asegurado para FLUJO 3: ${user.document_type} ${user.document_number} (id=${user.id})`
    );
  } catch (e) {
    console.error('❌ Error creando usuario FLUJO 3:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();