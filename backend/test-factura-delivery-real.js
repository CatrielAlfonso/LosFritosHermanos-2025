/**
 * Script para probar el flujo REAL de facturación para pedido DELIVERY
 * Usa el endpoint /api/facturacion/generar-y-enviar con el pedidoId
 * Ejecutar con: node test-factura-delivery-real.js
 * 
 * IMPORTANTE: Primero debes insertar el pedido en Supabase:
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
const PEDIDO_ID = 100; // El ID del pedido DELIVERY que quieres facturar

async function testFacturaDeliveryReal() {
  console.log('🧪 Iniciando prueba de factura REAL para DELIVERY...\n');
  console.log(`📦 Pedido ID: ${PEDIDO_ID}\n`);
  console.log(`🏠 Tipo: DELIVERY\n`);
  
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
      console.log('\n✅ Factura DELIVERY generada y enviada!');
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

testFacturaDeliveryReal();

