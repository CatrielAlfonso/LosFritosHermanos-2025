/**
 * Script para probar el endpoint real que usa la app de Administración de Usuarios
 * Ejecutar con: node test-endpoint-admin-usuarios.js
 */

const axios = require('axios');

// URL del backend (puede ser local o Render)
const BACKEND_URL = 'https://los-fritos-hermanos-backend.onrender.com'; // Backend en Render

// Datos de prueba del nuevo usuario
const nuevoUsuario = {
  email: 'tomasbehrens.dev@gmail.com', // Email diferente al FROM para evitar problemas
  subject: '¡Bienvenido a Administración de Usuarios!',
  text: 'Hola Juan Pérez,\n\nTu cuenta ha sido creada exitosamente en el sistema de Administración de Usuarios.\n\nYa puedes acceder con tu correo electrónico y la contraseña que configuraste.\n\nSaludos,\nEquipo de Administración',
  html: `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido!</h1>
      </div>
      <div style="background: #2D2640; padding: 30px; border-radius: 0 0 10px 10px; color: #E9E4F5;">
        <p style="font-size: 16px;">Hola <strong>Juan Pérez</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">Tu cuenta ha sido creada exitosamente en el sistema de <strong>Administración de Usuarios</strong>.</p>
        <p style="font-size: 14px; line-height: 1.6;">Ya puedes acceder con tu correo electrónico y la contraseña que configuraste.</p>
        <div style="background: #3D3455; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7C3AED;">
          <p style="margin: 0; font-size: 14px;"><strong>Correo:</strong> tomasbehrens.dev@gmail.com</p>
        </div>
        <p style="font-size: 14px; color: #A5A0B3; margin-top: 30px;">Saludos,<br>Equipo de Administración</p>
      </div>
    </div>
  `
};

async function probarEndpoint() {
  console.log('🧪 Probando endpoint de email para Administración de Usuarios...\n');
  console.log(`🌐 Backend URL: ${BACKEND_URL}/api/email/test`);
  console.log(`📧 Email destino: ${nuevoUsuario.email}\n`);

  try {
    console.log('📤 Enviando petición POST...');
    const response = await axios.post(`${BACKEND_URL}/api/email/test`, nuevoUsuario, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });

    console.log('✅ Respuesta del servidor:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 ¡Email enviado exitosamente desde el endpoint!');
      console.log('📬 Revisa la bandeja de entrada en:', nuevoUsuario.email);
    } else {
      console.log('\n⚠️ El endpoint respondió pero hubo un error:', response.data.error);
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Error: No se pudo conectar al backend.');
      console.error('💡 Asegúrate de que el servidor esté corriendo en:', BACKEND_URL);
      console.error('💡 Ejecuta: cd backend && node index.js');
    } else if (error.response) {
      console.error('\n❌ Error del servidor:', error.response.status);
      console.error('Respuesta:', error.response.data);
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }
}

probarEndpoint();

