/**
 * Script para enviar la factura por EMAIL usando el flujo real
 * Ejecutar con: node test-enviar-factura-email.js
 */

const { sendEmail } = require('./services/email.service');

const EMAIL_DESTINO = 'gabriavelardez50@gmail.com';
const PDF_URL = 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/facturas/facturas/factura-85-1764995176778.pdf';

async function enviarFacturaPorEmail() {
  console.log('📧 Enviando factura por email...\n');
  console.log(`📧 Email destino: ${EMAIL_DESTINO}`);
  console.log(`📄 PDF URL: ${PDF_URL}\n`);

  const pedido = {
    id: 85,
    fecha: new Date('2025-12-06T03:33:44.737+00:00').toLocaleString('es-AR'),
    mesa: '7',
    subtotal: 26900,
    descuento: 0,
    propina: 15,
    total: 30935
  };

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #D32F2F, #B71C1C); padding: 30px; text-align: center;">
          <h1 style="color: #FFD700; margin: 0; font-size: 28px;">🍗 Los Fritos Hermanos 🍗</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">¡Gracias por tu visita!</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-top: 0;">Factura #${pedido.id}</h2>
          
          <div style="background: #f9f9f9; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>📅 Fecha:</strong> ${pedido.fecha}</p>
            <p style="margin: 5px 0;"><strong>🪑 Mesa:</strong> ${pedido.mesa}</p>
          </div>
          
          <div style="background: #fff3e0; border-left: 4px solid #FF9800; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Subtotal:</strong> $${pedido.subtotal.toLocaleString('es-AR')}</p>
            ${pedido.descuento > 0 ? `<p style="margin: 5px 0; color: #4CAF50;"><strong>Descuento (${pedido.descuento}%):</strong> -$${(pedido.subtotal * pedido.descuento / 100).toLocaleString('es-AR')}</p>` : ''}
            ${pedido.propina > 0 ? `<p style="margin: 5px 0;"><strong>Propina (${pedido.propina}%):</strong> $${(pedido.subtotal * pedido.propina / 100).toLocaleString('es-AR')}</p>` : ''}
            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
            <p style="margin: 5px 0; font-size: 20px; color: #D32F2F;"><strong>TOTAL: $${pedido.total.toLocaleString('es-AR')}</strong></p>
          </div>
          
          <!-- Download Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${PDF_URL}" 
               style="display: inline-block; background: linear-gradient(135deg, #4CAF50, #388E3C); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              📥 Descargar Factura PDF
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="${PDF_URL}" style="color: #1976D2; word-break: break-all;">${PDF_URL}</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #333; padding: 20px; text-align: center;">
          <p style="color: #FFD700; margin: 0 0 10px 0; font-weight: bold;">
            🍗 Los Fritos Hermanos 🍗
          </p>
          <p style="color: #999; font-size: 12px; margin: 0;">
            © 2025 Los Fritos Hermanos - Gracias por elegirnos
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      to: EMAIL_DESTINO,
      subject: `🧾 Factura #${pedido.id} - Los Fritos Hermanos`,
      text: `Gracias por tu visita a Los Fritos Hermanos. Aquí está tu factura del pedido #${pedido.id}. Total: $${pedido.total}. Descarga tu factura: ${PDF_URL}`,
      html: htmlBody
    });

    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
    } else {
      console.log('❌ Error al enviar email:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

enviarFacturaPorEmail();

