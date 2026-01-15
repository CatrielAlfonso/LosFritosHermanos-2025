const express = require('express');
const router = express.Router();
const { sendEmail, sendWelcomeEmail, sendReservationConfirmation } = require('../services/email.service');

// Ruta de prueba para enviar email
router.post('/test', async (req, res) => {
  try {
    console.log('📧 [/api/email/test] Recibida petición');
    console.log('📧 [/api/email/test] SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL);
    console.log('📧 [/api/email/test] Destinatario:', req.body.email);
    
    const result = await sendEmail({
      to: req.body.email,
      subject: req.body.subject || 'Prueba de Email - Los Fritos Hermanos',
      text: req.body.text || '¡Este es un email de prueba!',
      html: req.body.html || '<h1>¡Email de Prueba!</h1><p>Si ves este mensaje, el servicio de email está funcionando correctamente.</p>'
    });
    res.json(result);
  } catch (error) {
    console.error('❌ [/api/email/test] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para enviar email de bienvenida
router.post('/welcome', async (req, res) => {
  try {
    const { email, name } = req.body;
    const result = await sendWelcomeEmail(email, name);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta para enviar confirmación de reserva
router.post('/reservation-confirmation', async (req, res) => {
  try {
    const { email, reservationDetails } = req.body;
    const result = await sendReservationConfirmation(email, reservationDetails);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta genérica para enviar emails personalizados (sin valores por defecto)
router.post('/send', async (req, res) => {
  try {
    const { to, subject, text, html, fromName } = req.body;
    
    console.log('📧 [/api/email/send] Email personalizado');
    console.log('📧 [/api/email/send] To:', to);
    console.log('📧 [/api/email/send] Subject:', subject);
    console.log('📧 [/api/email/send] From Name:', fromName);
    
    if (!to || !subject) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren los campos: to, subject' 
      });
    }
    
    const result = await sendEmail({ to, subject, text, html, fromName });
    res.json(result);
  } catch (error) {
    console.error('❌ [/api/email/send] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
