const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function loadEmailTemplate(templateName) {
  const templatePath = path.join(__dirname, 'email-templates', `${templateName}.html`);
  const template = await fs.readFile(templatePath, 'utf-8');
  return handlebars.compile(template);
}

async function enviarCorreoRechazo(clienteData) {
  try {
    const template = await loadEmailTemplate('cliente-rechazado');
    const html = template(clienteData);


    const mailOptions = {
      from: '"Los Fritos Hermanos" <noreply@fritoshermanos.com>',
      to: clienteData.correo,
      subject: 'Estado de tu Registro en Los Fritos Hermanos',
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Correo enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    throw error;
  }
}

module.exports = {
  enviarCorreoRechazo
};
