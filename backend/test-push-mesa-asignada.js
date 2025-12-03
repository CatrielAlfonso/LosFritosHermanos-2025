/**
 * Script para probar el envío de push notification cuando se asigna una mesa
 * Ejecutar con: node test-push-mesa-asignada.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';

// Configurar aquí los datos del cliente para la prueba
const TEST_DATA = {
  clienteEmail: 'tberens@gmail.com', // Email del cliente registrado
  mesaNumero: '2',
  clienteNombre: 'Tomas',
  clienteApellido: 'Behrens'
};

async function testPushMesaAsignada() {
  console.log('🧪 Iniciando prueba de push notification - Mesa Asignada...\n');
  console.log('📋 Datos de prueba:');
  console.log(`   - Email: ${TEST_DATA.clienteEmail}`);
  console.log(`   - Mesa: ${TEST_DATA.mesaNumero}`);
  console.log(`   - Cliente: ${TEST_DATA.clienteNombre} ${TEST_DATA.clienteApellido}`);
  
  try {
    // Primero verificamos si el cliente tiene token FCM
    console.log('\n🔍 Verificando token FCM del cliente...');
    const tokensResponse = await fetch(`${BACKEND_URL}/test-fcm-tokens?role=cliente`);
    const tokensData = await tokensResponse.json();
    
    const clienteToken = tokensData.tokens?.find(t => t.email === TEST_DATA.clienteEmail);
    if (clienteToken) {
      console.log(`   ✅ Cliente encontrado: ${clienteToken.name}`);
      console.log(`   ✅ Tiene token FCM: ${clienteToken.hasToken ? 'Sí' : 'No'}`);
    } else {
      console.log(`   ⚠️ Cliente no encontrado en la lista de tokens`);
    }
    
    console.log('\n📤 Enviando notificación de mesa asignada...');
    const response = await fetch(`${BACKEND_URL}/notify-client-table-assigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_DATA)
    });

    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Notificación y email enviados!');
      console.log('   - Push notification: Enviada al cliente');
      console.log('   - Email: Enviado a', TEST_DATA.clienteEmail);
    } else {
      console.log('\n❌ Error:', data.error || 'Error desconocido');
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testPushMesaAsignada();

