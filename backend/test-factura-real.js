/**
 * Script para probar el flujo REAL de facturación
 * Usa el endpoint /api/facturacion/generar-y-enviar con el pedidoId
 * Ejecutar con: node test-factura-real.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';
const PEDIDO_ID = 85; // El ID del pedido que quieres facturar

async function testFacturaReal() {
  console.log('🧪 Iniciando prueba de factura REAL...\n');
  console.log(`📦 Pedido ID: ${PEDIDO_ID}\n`);
  
  try {
    console.log('📤 Enviando solicitud al endpoint real...');
    
    const response = await fetch(`${BACKEND_URL}/api/facturacion/generar-y-enviar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pedidoId: PEDIDO_ID
      })
    });

    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Factura generada y enviada!');
      if (data.pdfUrl) {
        console.log(`📄 URL del PDF: ${data.pdfUrl}`);
      }
    } else {
      console.log('\n⚠️ Error:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testFacturaReal();

