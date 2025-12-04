// En /routes/facturacion.routes.js
const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const { sendEmail } = require('../services/email.service');

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.log('--- DEBUG (RUTAS) ---');
    console.log('El req.body que llegó a facturacion.routes.js es:', JSON.stringify(req.body, null, 2));
    console.log('El valor de req.body.pedidoId es:', req.body.pedidoId);
    console.log('-----------------------');
    // ---------------------------------
    const result = await generarYEnviarFactura(pedidoId);
    
    // 3. Devolvemos el resultado
    res.json(result);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * TEST: Generar factura y enviar por EMAIL
 * Para probar el envío de factura a cliente registrado
 */
router.post('/test-email', async (req, res) => {
  try {
    const { pedido, emailDestino } = req.body;
    console.log('🧪 TEST: Generando factura para email:', emailDestino);

    // Formatear items
    const formatearItems = (itemArray) => {
      if (!itemArray) return [];
      return itemArray.map(item => ({
        cantidad: item.cantidad,
        nombre: item.nombre,
        precioUnitario: item.precio || item.precioUnitario || 0
      }));
    };

    const itemsComidas = formatearItems(pedido.comidas);
    const itemsBebidas = formatearItems(pedido.bebidas);
    const itemsPostres = formatearItems(pedido.postres);
    const itemsCombinados = [...itemsComidas, ...itemsBebidas, ...itemsPostres];

    // Calcular totales
    const subtotal = itemsCombinados.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const descuentoPorcentaje = pedido.descuento || 0;
    const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
    const propinaPorcentaje = pedido.propina || 0;
    const baseParaPropina = subtotal - descuentoMonto;
    const propinaMonto = (baseParaPropina * propinaPorcentaje) / 100;
    const totalFinal = subtotal - descuentoMonto + propinaMonto;

    const pedidoFormateado = {
      id: pedido.id,
      fecha: pedido.fecha_pedido || new Date().toISOString(),
      subtotal,
      descuentoPorcentaje,
      descuentoMonto,
      propinaPorcentaje,
      propinaMonto,
      total: totalFinal,
      cliente: pedido.cliente,
      mesa: pedido.mesa,
      items: itemsCombinados
    };

    // Generar PDF
    const pdfBuffer = await generarPDFFacturaTest(pedidoFormateado);

    // Subir a Supabase Storage
    const nombreArchivo = `facturas/test-factura-${pedido.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('facturas')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error al subir PDF: ${uploadError.message}`);
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from('facturas')
      .getPublicUrl(nombreArchivo);
    
    const pdfUrl = publicUrlData.publicUrl;

    // Enviar email
    await enviarFacturaPorEmailTest(emailDestino, pdfUrl, pedidoFormateado);

    res.json({ 
      success: true, 
      message: 'Factura generada y enviada por email',
      pdfUrl 
    });

  } catch (error) {
    console.error('Error en test-email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * TEST: Generar factura y enviar por PUSH
 * Para probar el envío de factura a cliente anónimo
 */
router.post('/test-push', async (req, res) => {
  try {
    const { pedido, fcmToken } = req.body;
    console.log('🧪 TEST: Generando factura para PUSH notification');

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'FCM token requerido' });
    }

    // Formatear items
    const formatearItems = (itemArray) => {
      if (!itemArray) return [];
      return itemArray.map(item => ({
        cantidad: item.cantidad,
        nombre: item.nombre,
        precioUnitario: item.precio || item.precioUnitario || 0
      }));
    };

    const itemsComidas = formatearItems(pedido.comidas);
    const itemsBebidas = formatearItems(pedido.bebidas);
    const itemsPostres = formatearItems(pedido.postres);
    const itemsCombinados = [...itemsComidas, ...itemsBebidas, ...itemsPostres];

    // Calcular totales
    const subtotal = itemsCombinados.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const descuentoPorcentaje = pedido.descuento || 0;
    const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
    const propinaPorcentaje = pedido.propina || 0;
    const baseParaPropina = subtotal - descuentoMonto;
    const propinaMonto = (baseParaPropina * propinaPorcentaje) / 100;
    const totalFinal = subtotal - descuentoMonto + propinaMonto;

    const pedidoFormateado = {
      id: pedido.id,
      fecha: pedido.fecha_pedido || new Date().toISOString(),
      subtotal,
      descuentoPorcentaje,
      descuentoMonto,
      propinaPorcentaje,
      propinaMonto,
      total: totalFinal,
      cliente: pedido.cliente,
      mesa: pedido.mesa,
      items: itemsCombinados
    };

    // Generar PDF
    const pdfBuffer = await generarPDFFacturaTest(pedidoFormateado);

    // Subir a Supabase Storage
    const nombreArchivo = `facturas/test-factura-${pedido.id}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('facturas')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error al subir PDF: ${uploadError.message}`);
    }

    // Obtener URL pública
    const { data: publicUrlData } = supabase.storage
      .from('facturas')
      .getPublicUrl(nombreArchivo);
    
    const pdfUrl = publicUrlData.publicUrl;

    // Enviar push notification
    const message = {
      notification: {
        title: '🧾 ¡Tu factura está lista!',
        body: '¡Gracias por tu visita a Los Fritos Hermanos! Tocá aquí para descargar tu factura en PDF.'
      },
      data: {
        link: pdfUrl,
        pedidoId: pedido.id.toString(),
        tipo: 'factura'
      },
      token: fcmToken
    };

    await admin.messaging().send(message);
    console.log('✅ Push notification enviada');

    res.json({ 
      success: true, 
      message: 'Factura generada y push enviado',
      pdfUrl 
    });

  } catch (error) {
    console.error('Error en test-push:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Función auxiliar para generar PDF de test
function generarPDFFacturaTest(pedido) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      const stream = new PassThrough();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      doc.pipe(stream);

      const pageMargin = 50;
      const pageWidth = doc.page.width - pageMargin * 2;

      // Header
      doc.fontSize(22).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('Los Fritos Hermanos', pageMargin, 40);
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text('Av. Mitre 750, Buenos Aires', pageMargin, 65)
         .text('Tel: (011) 1234-5678', pageMargin, 78);

      // Factura info
      doc.fontSize(12).font('Helvetica-Bold')
         .fillColor('#333')
         .text(`FACTURA TEST`, pageMargin, 40, { align: 'right' });
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text(`N°: 0001-${String(pedido.id).padStart(8, '0')}`, pageMargin, 55, { align: 'right' })
         .text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, pageMargin, 68, { align: 'right' })
         .text(`Mesa: ${pedido.mesa}`, pageMargin, 81, { align: 'right' });

      // Línea
      doc.moveTo(pageMargin, 100).lineTo(pageMargin + pageWidth, 100).stroke('#E53E3E');

      // Cliente
      let y = 115;
      doc.fontSize(11).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('DATOS DEL CLIENTE', pageMargin, y);
      
      y += 18;
      doc.fontSize(10).font('Helvetica')
         .fillColor('#333')
         .text(`Nombre: ${pedido.cliente?.nombre || 'Cliente'} ${pedido.cliente?.apellido || ''}`, pageMargin, y);

      // Items
      y += 35;
      doc.rect(pageMargin, y - 5, pageWidth, 22).fill('#E53E3E');
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#FFF')
         .text('Cant.', pageMargin + 10, y)
         .text('Descripción', pageMargin + 50, y)
         .text('P. Unit.', pageMargin + 320, y, { width: 90, align: 'right' })
         .text('Importe', pageMargin + 420, y, { width: 80, align: 'right' });

      y += 28;
      doc.font('Helvetica').fillColor('#333');
      
      for (const item of pedido.items) {
        doc.text(item.cantidad, pageMargin + 10, y)
           .text(item.nombre, pageMargin + 50, y)
           .text(`$${item.precioUnitario.toFixed(2)}`, pageMargin + 320, y, { width: 90, align: 'right' })
           .text(`$${(item.cantidad * item.precioUnitario).toFixed(2)}`, pageMargin + 420, y, { width: 80, align: 'right' });
        y += 20;
      }

      // Totales
      y += 20;
      doc.fontSize(10).font('Helvetica')
         .text('Subtotal:', pageMargin + 320, y, { width: 90, align: 'right' })
         .text(`$${pedido.subtotal.toFixed(2)}`, pageMargin + 420, y, { width: 80, align: 'right' });
      
      if (pedido.descuentoPorcentaje > 0) {
        y += 18;
        doc.fillColor('#2E7D32')
           .text(`Descuento (${pedido.descuentoPorcentaje}%):`, pageMargin + 290, y, { width: 120, align: 'right' })
           .text(`-$${pedido.descuentoMonto.toFixed(2)}`, pageMargin + 420, y, { width: 80, align: 'right' });
      }

      if (pedido.propinaPorcentaje > 0) {
        y += 18;
        doc.fillColor('#1565C0')
           .text(`Propina (${pedido.propinaPorcentaje}%):`, pageMargin + 320, y, { width: 90, align: 'right' })
           .text(`$${pedido.propinaMonto.toFixed(2)}`, pageMargin + 420, y, { width: 80, align: 'right' });
      }

      y += 25;
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('TOTAL:', pageMargin + 320, y, { width: 90, align: 'right' })
         .text(`$${pedido.total.toFixed(2)}`, pageMargin + 420, y, { width: 80, align: 'right' });

      // Footer
      const footerY = doc.page.height - 80;
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text('¡Gracias por su visita! - FACTURA DE TEST', pageMargin, footerY, { align: 'center', width: pageWidth });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Función auxiliar para enviar email de test
async function enviarFacturaPorEmailTest(clienteEmail, pdfUrl, pedido) {
  const nombreCliente = pedido.cliente?.nombre || 'Cliente';
  const fechaFormateada = new Date(pedido.fecha).toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Factura TEST - Los Fritos Hermanos</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%); padding: 30px; text-align: center;">
          <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/masCrocante.png" 
               alt="Los Fritos Hermanos" 
               style="width: 120px; border-radius: 10px; margin-bottom: 15px;">
          <h1 style="color: #FFD700; margin: 0; font-size: 28px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
            Los Fritos Hermanos
          </h1>
          <p style="color: #fff; margin: 10px 0 0 0; font-size: 14px;">
            Av. Mitre 750, Buenos Aires
          </p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">
            ¡Hola ${nombreCliente}! 🍗 (TEST)
          </h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Este es un email de prueba para verificar el envío de facturas.
          </p>
          
          <!-- Detalles del pedido -->
          <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 25px 0; border-left: 4px solid #E53E3E;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Pedido N°:</td>
                <td style="padding: 8px 0; color: #333; font-weight: bold; text-align: right;">#${pedido.id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Fecha:</td>
                <td style="padding: 8px 0; color: #333; text-align: right;">${fechaFormateada}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Mesa:</td>
                <td style="padding: 8px 0; color: #333; text-align: right;">${pedido.mesa}</td>
              </tr>
              ${pedido.descuentoPorcentaje > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #2E7D32;">🎮 Descuento:</td>
                <td style="padding: 8px 0; color: #2E7D32; font-weight: bold; text-align: right;">-$${pedido.descuentoMonto.toFixed(2)} (${pedido.descuentoPorcentaje}%)</td>
              </tr>
              ` : ''}
              ${pedido.propinaPorcentaje > 0 ? `
              <tr>
                <td style="padding: 8px 0; color: #1565C0;">❤️ Propina:</td>
                <td style="padding: 8px 0; color: #1565C0; font-weight: bold; text-align: right;">$${pedido.propinaMonto.toFixed(2)} (${pedido.propinaPorcentaje}%)</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #E53E3E;">
                <td style="padding: 15px 0 8px 0; color: #E53E3E; font-size: 18px; font-weight: bold;">TOTAL:</td>
                <td style="padding: 15px 0 8px 0; color: #E53E3E; font-size: 22px; font-weight: bold; text-align: right;">$${pedido.total.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          <!-- Botón de descarga -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${pdfUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%); 
                      color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 25px; 
                      font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(229, 62, 62, 0.4);">
              📄 Descargar Factura (PDF)
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #333; padding: 20px; text-align: center;">
          <p style="color: #FFD700; margin: 0 0 10px 0; font-weight: bold;">
            🍗 Los Fritos Hermanos 🍗
          </p>
          <p style="color: #999; font-size: 12px; margin: 0;">
            © 2025 Los Fritos Hermanos - EMAIL DE TEST
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;

  console.log('📧 Intentando enviar email a:', clienteEmail);
  
  const result = await sendEmail({
    to: clienteEmail,
    subject: `🧪 TEST - Factura #${pedido.id} - Los Fritos Hermanos`,
    text: `TEST: Aquí puedes descargar tu factura del pedido #${pedido.id}: ${pdfUrl}. Total: $${pedido.total.toFixed(2)}`,
    html: htmlBody
  });
  
  if (result.success) {
    console.log('✅ Email de test enviado a:', clienteEmail);
  } else {
    console.error('❌ Error al enviar email:', result.error);
    throw new Error(`Error al enviar email: ${result.error}`);
  }
}

module.exports = router;