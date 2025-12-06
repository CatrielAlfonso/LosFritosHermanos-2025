/**
 * Script para probar el envío de factura del pedido 85
 * Ejecutar con: node test-factura-pedido-85.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';
const EMAIL_DESTINO = 'gabriavelardez50@gmail.com';

async function testFacturaEmail() {
  console.log('🧪 Iniciando prueba de factura para pedido 85...\n');
  console.log(`📧 Email destino: ${EMAIL_DESTINO}\n`);
  
  try {
    // Datos del pedido 85 de la base de datos
    const pedidoPrueba = {
      id: 85,
      fecha_pedido: '2025-12-06T03:33:44.737+00:00',
      mesa: '7',
      comidas: [
        { nombre: 'Hamburguesa Crispy', cantidad: 1, precioUnitario: 13500, precioTotal: 13500 },
        { nombre: 'Helado', cantidad: 1, precioUnitario: 7900, precioTotal: 7900 }
      ],
      bebidas: [
        { nombre: 'Champagne con Speed', cantidad: 1, precioUnitario: 5500, precioTotal: 5500 }
      ],
      postres: [],
      precio: 26900,
      descuento: 0,
      propina: 15,
      pagado: 30935,
      cliente: {
        nombre: 'Gabriel',
        apellido: 'Avelardez',
        correo: EMAIL_DESTINO
      }
    };

    console.log('📤 Enviando solicitud de factura...');
    console.log('Pedido:', JSON.stringify(pedidoPrueba, null, 2));
    
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

