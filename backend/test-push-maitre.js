/**
 * Script para probar el envío de push notification al maître
 * Ejecutar con: node test-push-maitre.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';

async function testPushMaitre() {
  console.log('🧪 Iniciando prueba de push notification al maître (SOLO maître)...\n');
  
  try {
    // Primero verificamos los tokens de empleados
    console.log('📋 Verificando tokens FCM de empleados...');
    const tokensResponse = await fetch(`${BACKEND_URL}/test-fcm-tokens?role=empleado`);
    const tokensData = await tokensResponse.json();
    
    // Filtrar solo maîtres
    const maitres = tokensData.tokens?.filter(t => t.perfil === 'maitre') || [];
    console.log('Maîtres encontrados:', maitres.length);
    maitres.forEach(m => console.log(`  - ${m.name} (${m.email})`));
    
    console.log('\n📤 Enviando notificación SOLO al maître (nuevo endpoint)...');
    const response = await fetch(`${BACKEND_URL}/notify-maitre-lista-espera`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clienteNombre: 'Cliente Anónimo TEST'
      })
    });

    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Notificación enviada SOLO al maître!');
      if (data.response) {
        console.log(`   - Éxitos: ${data.response.successCount || 0}`);
        console.log(`   - Fallos: ${data.response.failureCount || 0}`);
      }
    } else {
      console.log('\n⚠️ Respuesta:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testPushMaitre();

