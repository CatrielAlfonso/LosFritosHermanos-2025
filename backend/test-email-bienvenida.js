/**
 * Script para probar el envío de email de bienvenida
 * Ejecutar con: node test-email-bienvenida.js
 */

const { sendEmail } = require('./services/email.service');

// Cambia este email por el tuyo para recibir la prueba
const EMAIL_DESTINO = 'tomasbehrens.dev@gmail.com';
const NOMBRE = 'Tomás';
const APELLIDO = 'Behrens';

async function enviarEmailBienvenida() {
  console.log('📧 Enviando email de bienvenida...\n');
  console.log(`📧 Email destino: ${EMAIL_DESTINO}`);
  console.log(`👤 Nombre: ${NOMBRE} ${APELLIDO}\n`);

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">¡Bienvenido!</h1>
      </div>
      <div style="background: #2D2640; padding: 30px; border-radius: 0 0 10px 10px; color: #E9E4F5;">
        <p style="font-size: 16px;">Hola <strong>${NOMBRE} ${APELLIDO}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">Tu cuenta ha sido creada exitosamente en el sistema de <strong>Administración de Usuarios</strong>.</p>
        <p style="font-size: 14px; line-height: 1.6;">Ya puedes acceder con tu correo electrónico y la contraseña que configuraste.</p>
        <div style="background: #3D3455; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7C3AED;">
          <p style="margin: 0; font-size: 14px;"><strong>Correo:</strong> ${EMAIL_DESTINO}</p>
        </div>
        <p style="font-size: 14px; color: #A5A0B3; margin-top: 30px;">Saludos,<br>Equipo de Administración</p>
      </div>
    </div>
  `;

  try {
    const result = await sendEmail({
      to: EMAIL_DESTINO,
      subject: '¡Bienvenido a Administración de Usuarios!',
      text: `Hola ${NOMBRE} ${APELLIDO},\n\nTu cuenta ha sido creada exitosamente en el sistema de Administración de Usuarios.\n\nYa puedes acceder con tu correo electrónico y la contraseña que configuraste.\n\nSaludos,\nEquipo de Administración`,
      html: htmlBody
    });

    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log('📬 Revisa tu bandeja de entrada (y spam) en:', EMAIL_DESTINO);
    } else {
      console.log('❌ Error al enviar email:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

enviarEmailBienvenida();

