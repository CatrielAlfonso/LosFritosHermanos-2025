// En /routes/facturacion.routes.js
const express = require('express');
const router = express.Router();

// 1. Importamos el futuro "servicio" que hará el trabajo
const { generarYEnviarFactura } = require('../services/facturacion.service');

/**
 * Endpoint principal para generar una factura
 * Recibe el ID del pedido y los datos del cliente
 */
router.post('/generar-y-enviar', async (req, res) => {
  try {
    // 2. Solo pasamos la información al servicio
    const { pedidoId } = req.body;
    const result = await generarYEnviarFactura(pedidoId);
    
    // 3. Devolvemos el resultado
    res.json(result);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;