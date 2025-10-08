const express = require('express');
const router = express.Router();
const { sendEmail, sendWelcomeEmail, sendReservationConfirmation } = require('../services/email.service');

// Ruta de prueba para enviar email
router.post('/test', async (req, res) => {
  try {
    const result = await sendEmail({
      to: req.body.email,
      subject: 'Prueba de Email - Los Fritos Hermanos',
      text: '¡Este es un email de prueba!',
      html: '<h1>¡Email de Prueba!</h1><p>Si ves este mensaje, el servicio de email está funcionando correctamente.</p>'
    });
    res.json(result);
  } catch (error) {
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

module.exports = router;
