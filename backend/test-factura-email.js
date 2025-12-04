/**
 * Script para probar el envío de factura por EMAIL a cliente registrado
 * Ejecutar con: node test-factura-email.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';
const EMAIL_DESTINO = 'tomasbehrens0@gmail.com';

async function testFacturaEmail() {
  console.log('🧪 Iniciando prueba de factura por EMAIL...\n');
  console.log(`📧 Email destino: ${EMAIL_DESTINO}\n`);
  
  try {
    // Datos de prueba para el pedido
    const pedidoPrueba = {
      id: 9999,
      fecha_pedido: new Date().toISOString(),
      mesa: '5',
      comidas: [
        { nombre: 'Hamburguesa Clásica', cantidad: 2, precio: 2500 },
        { nombre: 'Papas Fritas', cantidad: 1, precio: 1200 }
      ],
      bebidas: [
        { nombre: 'Coca Cola', cantidad: 2, precio: 800 }
      ],
      postres: [
        { nombre: 'Helado', cantidad: 1, precio: 1500 }
      ],
      descuento: 10, // 10% de descuento por juegos
      propina: 15,   // 15% de propina
      cliente: {
        nombre: 'Tomas',
        apellido: 'Behrens',
        correo: EMAIL_DESTINO
      }
    };

    console.log('📤 Enviando solicitud de factura...');
    console.log('Pedido de prueba:', JSON.stringify(pedidoPrueba, null, 2));
    
    const response = await fetch(`${BACKEND_URL}/api/facturacion/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pedido: pedidoPrueba,
        emailDestino: EMAIL_DESTINO
      })
    });

    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ Factura generada y enviada por email!');
      console.log(`📄 URL del PDF: ${data.pdfUrl}`);
    } else {
      console.log('\n⚠️ Error:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testFacturaEmail();

