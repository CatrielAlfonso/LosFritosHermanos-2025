const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Configurar API Key de SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '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';
sgMail.setApiKey(SENDGRID_API_KEY);

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'losfritoshermanos@gmail.com',
        name: 'Los Fritos Hermanos' // Este nombre aparecerá en los emails
      },
      subject,
      text,
      html,
      tracking_settings: {
        click_tracking: {
          enable: true
        },
        open_tracking: {
          enable: true
        }
      }
    };
    
    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Función de utilidad para enviar email de bienvenida
const sendWelcomeEmail = async (userEmail, userName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>¡Bienvenido a Los Fritos Hermanos, ${userName}!</h2>
      <p>Gracias por registrarte en nuestra aplicación. Estamos emocionados de tenerte como cliente.</p>
      <p>Con nuestra app podrás:</p>
      <ul>
        <li>Reservar mesas fácilmente</li>
        <li>Ver nuestro menú actualizado</li>
        <li>Recibir notificaciones sobre tu pedido</li>
        <li>¡Y mucho más!</li>
      </ul>
      <p>¡Esperamos verte pronto!</p>
      <p>El equipo de Los Fritos Hermanos</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: '¡Bienvenido a Los Fritos Hermanos!',
    text: `¡Bienvenido a Los Fritos Hermanos, ${userName}! Gracias por registrarte en nuestra aplicación.`,
    html
  });
};

// Función para enviar confirmación de reserva
const sendReservationConfirmation = async (userEmail, reservationDetails) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Confirmación de Reserva - Los Fritos Hermanos</h2>
      <p>Tu reserva ha sido confirmada con los siguientes detalles:</p>
      <ul>
        <li>Fecha: ${reservationDetails.date}</li>
        <li>Hora: ${reservationDetails.time}</li>
        <li>Número de personas: ${reservationDetails.guests}</li>
        ${reservationDetails.tableNumber ? `<li>Número de mesa: ${reservationDetails.tableNumber}</li>` : ''}
      </ul>
      <p>Si necesitas modificar tu reserva, por favor contáctanos.</p>
      <p>¡Gracias por elegirnos!</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: 'Confirmación de Reserva - Los Fritos Hermanos',
    text: `Tu reserva en Los Fritos Hermanos ha sido confirmada para ${reservationDetails.date} a las ${reservationDetails.time}.`,
    html
  });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendReservationConfirmation
};
