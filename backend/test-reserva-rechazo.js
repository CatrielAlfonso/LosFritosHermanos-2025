/**
 * Script para probar el envío de email de RECHAZO de reserva
 * Usa el endpoint real del backend
 * Ejecutar con: node test-reserva-rechazo.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = 'http://localhost:8080';

// Datos de la reserva rechazada (ID 34)
const RESERVA = {
  id: 40,
  correo: 'gabriavelardez50@gmail.com',
  nombre: 'ga',
  apellido: 'vel',
  fechaReserva: '2025-12-06',
  horaReserva: '11:00',
  motivo: 'no hay mesas'
};

async function enviarRechazoReserva() {
  console.log('❌ ========================================');
  console.log('❌ TEST: EMAIL DE RECHAZO DE RESERVA');
  console.log('❌ ========================================\n');
  
  console.log('📧 Reserva ID:', RESERVA.id);
  console.log('📧 Email destino:', RESERVA.correo);
  console.log('👤 Cliente:', RESERVA.nombre, RESERVA.apellido);
  console.log('📅 Fecha:', RESERVA.fechaReserva);
  console.log('🕐 Hora:', RESERVA.horaReserva);
  console.log('📝 Motivo:', RESERVA.motivo);
  console.log('\n📤 Enviando...\n');

  try {
    const response = await fetch(`${BACKEND_URL}/enviar-correo-reserva-rechazada`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        correo: RESERVA.correo,
        nombre: RESERVA.nombre,
        apellido: RESERVA.apellido,
        fechaReserva: RESERVA.fechaReserva,
        horaReserva: RESERVA.horaReserva,
        motivo: RESERVA.motivo
      })
    });

    const data = await response.json();
    
    console.log('📬 Respuesta del servidor:');
    console.log('Status:', response.status);
    
    if (response.ok && data.success) {
      console.log('\n✅ Email de RECHAZO enviado exitosamente!');
      console.log('📧 Revisa la bandeja de entrada de:', RESERVA.correo);
    } else {
      console.log('\n⚠️ Error:', data.error || data.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
    console.log('⚠️ Asegúrate de que el backend esté corriendo en', BACKEND_URL);
  }
}

enviarRechazoReserva();

