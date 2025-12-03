/**
 * Script para probar el envío de email de aceptación de cliente
 * Ejecutar con: node test-email-aceptacion.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';
const TEST_EMAIL = 'tomasbehrens0@gmail.com';

async function testEnvioEmailAceptacion() {
  console.log('🧪 Iniciando prueba de envío de email de aceptación...');
  console.log('📧 Email destino:', TEST_EMAIL);
  
  try {
    const response = await fetch(`${BACKEND_URL}/enviar-correo-aceptacion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        correo: TEST_EMAIL,
        nombre: 'Tomas',
        apellido: 'Behrens'
      })
    });
    
    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Email enviado exitosamente!');
      console.log('Revisa tu bandeja de entrada en:', TEST_EMAIL);
    } else {
      console.log('\n❌ Error al enviar el email:');
      console.log(data.error || 'Error desconocido');
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testEnvioEmailAceptacion();

