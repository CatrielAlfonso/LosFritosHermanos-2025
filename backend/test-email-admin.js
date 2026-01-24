// Script para probar el envío de emails personalizados
// Ejecutar: node test-email-admin.js

const API_URL = 'https://los-fritos-hermanos-backend.onrender.com';

async function testEmail() {
  console.log('🧪 Probando endpoint /api/email/send...\n');
  
  const body = {
    to: 'tomasbehrens0@gmail.com', // Cambiá este email si querés
    fromName: 'Administración de Usuarios',
    subject: '🧪 Test - Email de Administración de Usuarios',
    text: 'Este es un email de prueba del sistema de Administración de Usuarios.',
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🧪 Email de Prueba</h1>
        </div>
        <div style="background: #2D2640; padding: 30px; border-radius: 0 0 10px 10px; color: #E9E4F5;">
          <p>Este es un email de prueba del sistema de <strong>Administración de Usuarios</strong>.</p>
          <p>Si ves este mensaje, el endpoint <code>/api/email/send</code> está funcionando correctamente.</p>
          <p style="color: #A5A0B3; margin-top: 30px;">Fecha: ${new Date().toLocaleString('es-AR')}</p>
        </div>
      </div>
    `
  };

  try {
    console.log('📤 Enviando request a:', `${API_URL}/api/email/send`);
    console.log('📧 Destinatario:', body.to);
    console.log('📧 Asunto:', body.subject);
    console.log('📧 From Name:', body.fromName);
    console.log('');

    const response = await fetch(`${API_URL}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    console.log('📥 Status:', response.status);
    console.log('📥 Respuesta:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ ¡Email enviado correctamente! Revisá tu bandeja de entrada (y spam).');
    } else {
      console.log('\n❌ Error al enviar el email:', data.error);
    }
  } catch (error) {
    console.error('\n❌ Error de conexión:', error.message);
  }
}

testEmail();

