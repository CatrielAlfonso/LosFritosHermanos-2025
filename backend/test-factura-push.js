/**
 * Script para probar el envío de factura por PUSH a cliente anónimo
 * Ejecutar con: node test-factura-push.js
 * 
 * Este test busca un cliente anónimo REAL en la base de datos (como lo hace el backend)
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_URL = 'http://localhost:8080';

// Supabase client (igual que en el backend)
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testFacturaPush() {
  console.log('🧪 Iniciando prueba de factura por PUSH (cliente anónimo)...\n');
  
  try {
    // 1. Buscar cliente anónimo con FCM token en la base de datos (igual que el backend)
    console.log('📋 Buscando clientes anónimos con FCM token en la base de datos...');
    
    const { data: clientesAnonimos, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, correo, fcm_token, anonimo')
      .eq('anonimo', true)
      .not('fcm_token', 'is', null)
      .limit(5);

    if (error) {
      console.error('❌ Error al buscar clientes:', error.message);
      return;
    }

    console.log(`\n📊 Clientes anónimos con FCM token encontrados: ${clientesAnonimos?.length || 0}`);
    
    if (!clientesAnonimos || clientesAnonimos.length === 0) {
      console.log('\n⚠️ No hay clientes anónimos con FCM token registrado.');
      console.log('Para probar:');
      console.log('  1. Abre la app en un dispositivo móvil');
      console.log('  2. Ingresa como cliente anónimo');
      console.log('  3. El FCM token se guardará automáticamente');
      console.log('  4. Vuelve a ejecutar este test');
      
      // Mostrar clientes anónimos sin token para debug
      const { data: sinToken } = await supabase
        .from('clientes')
        .select('id, nombre, correo, anonimo')
        .eq('anonimo', true)
        .is('fcm_token', null)
        .limit(5);
      
      if (sinToken && sinToken.length > 0) {
        console.log('\n📝 Clientes anónimos SIN FCM token:');
        sinToken.forEach(c => console.log(`   - ID: ${c.id}, Nombre: ${c.nombre}`));
      }
      return;
    }

    // Mostrar clientes encontrados
    clientesAnonimos.forEach(c => {
      console.log(`   - ID: ${c.id}, Nombre: ${c.nombre}, Token: ${c.fcm_token?.substring(0, 30)}...`);
    });

    // Usar el primer cliente anónimo encontrado
    const clienteAnonimo = clientesAnonimos[0];
    console.log(`\n🎯 Usando cliente: ${clienteAnonimo.nombre} (ID: ${clienteAnonimo.id})`);

    // 2. Crear pedido de prueba con este cliente
    const pedidoPrueba = {
      id: 8888,
      fecha_pedido: new Date().toISOString(),
      mesa: '3',
      comidas: [
        { nombre: 'Pollo Frito Crispy', cantidad: 1, precio: 3500 },
        { nombre: 'Alitas BBQ', cantidad: 6, precio: 2800 }
      ],
      bebidas: [
        { nombre: 'Cerveza Artesanal', cantidad: 2, precio: 1200 }
      ],
      postres: [],
      descuento: 5,
      propina: 10,
      cliente: {
        id: clienteAnonimo.id,
        nombre: clienteAnonimo.nombre,
        apellido: clienteAnonimo.apellido || '',
        correo: clienteAnonimo.correo || `anonimo-${clienteAnonimo.id}@fritos.com`,
        fcm_token: clienteAnonimo.fcm_token
      }
    };

    console.log('\n📤 Enviando solicitud de factura con PUSH...');
    console.log('FCM Token:', clienteAnonimo.fcm_token?.substring(0, 50) + '...');
    
    const response = await fetch(`${BACKEND_URL}/api/facturacion/test-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pedido: pedidoPrueba,
        fcmToken: clienteAnonimo.fcm_token
      })
    });

    const data = await response.json();
    
    console.log('\n📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ ¡Factura generada y push enviado!');
      console.log(`📄 URL del PDF: ${data.pdfUrl}`);
      console.log(`\n📱 El cliente "${clienteAnonimo.nombre}" debería recibir la notificación push.`);
    } else {
      console.log('\n⚠️ Error:', data.message || data.error);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('\n⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

testFacturaPush();
