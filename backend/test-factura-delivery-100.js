/**
 * Script para probar el envío de factura del pedido DELIVERY #100
 * Ejecutar con: node test-factura-delivery-100.js
 * 
 * PRIMERO ejecutar en Supabase:
 * 
 * INSERT INTO "public"."pedidos" (
 *   "id", "comidas", "bebidas", "postres", "precio", "tiempo_estimado", 
 *   "confirmado", "mesa", "estado", "estado_comida", "estado_bebida", 
 *   "estado_postre", "recepcion", "cuenta", "pagado", "cliente_id", 
 *   "fecha_pedido", "motivo_rechazo", "observaciones_generales", 
 *   "solicita_cuenta", "cuenta_habilitada", "descuento", "propina", 
 *   "encuesta_respondida", "repartidor_id", "latitud", "longitud", 
 *   "direccion_completa", "cliente_nombre", "cliente_telefono", "direccion_referencia"
 * ) VALUES (
 *   '100', 
 *   '[{"id":5,"nombre":"Hamburguesa Crispy","precio":13500,"cantidad":1}]', 
 *   '[{"id":13,"nombre":"Sprite","precio":2000,"cantidad":1}]', 
 *   '[]', 
 *   '15500', 
 *   '45', 
 *   'true', 
 *   'DELIVERY', 
 *   'entregado', 
 *   'listo', 
 *   'listo', 
 *   'pendiente', 
 *   'false', 
 *   '15500', 
 *   '0', 
 *   '17098ff0-949a-4143-afb9-e97e71e61024', 
 *   '2025-12-06 10:58:29.929+00', 
 *   null, 
 *   'DELIVERY - CLIENTE #16: ramiro perez - DIR: Avenida Bartolomé Mitre 1023 - OBS: ', 
 *   'false', 
 *   'false', 
 *   '0', 
 *   null, 
 *   'false', 
 *   '1', 
 *   '-34.66443266', 
 *   '-58.36240332', 
 *   'Avenida Bartolomé Mitre 1023', 
 *   'ramiro perez', 
 *   '1152536963', 
 *   'facultad '
 * );
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';
const EMAIL_DESTINO = 'gabriavelardez50@gmail.com'; // Cambiar por el email deseado

async function testFacturaDelivery() {
  console.log('🧪 Iniciando prueba de factura para pedido DELIVERY #100...\n');
  console.log(`📧 Email destino: ${EMAIL_DESTINO}\n`);
  
  try {
    // Datos del pedido DELIVERY 100
    const pedidoPrueba = {
      id: 100,
      fecha_pedido: '2025-12-06T10:58:29.929+00:00',
      mesa: 'DELIVERY',
      comidas: [
        { nombre: 'Hamburguesa Crispy', cantidad: 1, precioUnitario: 13500, precioTotal: 13500 }
      ],
      bebidas: [
        { nombre: 'Sprite', cantidad: 1, precioUnitario: 2000, precioTotal: 2000 }
      ],
      postres: [],
      precio: 15500,
      descuento: 0,
      propina: 0, // Sin propina por ahora
      pagado: 15500,
      // Datos del cliente de delivery
      cliente: {
        nombre: 'Ramiro',
        apellido: 'Perez',
        correo: EMAIL_DESTINO
      },
      // Datos específicos de delivery
      direccion_completa: 'Avenida Bartolomé Mitre 1023',
      direccion_referencia: 'facultad',
      cliente_nombre: 'ramiro perez',
      cliente_telefono: '1152536963'
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
      console.log('\n✅ Factura DELIVERY generada y enviada por email!');
      console.log(`📄 URL del PDF: ${data.pdfUrl}`);
    } else {
      console.log('\n⚠️ Error:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testFacturaDelivery();

