require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('./services/email.service');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_EMAIL = 'tomasbehrens0@gmail.com';
const PEDIDO_ID = 53;

// Función para generar el PDF
function generarPDFFactura(pedido) {
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
      
      // ENCABEZADO
      doc.fontSize(22).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('Los Fritos Hermanos', pageMargin, 40);
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text('Av. Mitre 750, Buenos Aires', pageMargin, 65)
         .text('Tel: (011) 1234-5678', pageMargin, 78);
      
      // DATOS DE FACTURA
      doc.fontSize(12).font('Helvetica-Bold')
         .fillColor('#333')
         .text(`FACTURA`, pageMargin, 40, { align: 'right' });
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text(`N°: 0001-${String(pedido.id).padStart(8, '0')}`, pageMargin, 55, { align: 'right' })
         .text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, pageMargin, 68, { align: 'right' })
         .text(`Pedido #: ${pedido.id}`, pageMargin, 81, { align: 'right' })
         .text(`Mesa: ${pedido.mesa}`, pageMargin, 94, { align: 'right' });
      
      // Línea separadora
      doc.moveTo(pageMargin, 115).lineTo(pageMargin + pageWidth, 115).stroke('#E53E3E');
      
      // DATOS DEL CLIENTE
      let y_cliente = 130;
      doc.fontSize(11).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('DATOS DEL CLIENTE', pageMargin, y_cliente);
      
      y_cliente += 18;
      doc.fontSize(10).font('Helvetica')
         .fillColor('#333')
         .text(`Nombre: ${pedido.cliente?.nombre || 'Cliente'} ${pedido.cliente?.apellido || ''}`, pageMargin, y_cliente);
      
      // TABLA DE PRODUCTOS
      const tableTop = y_cliente + 35;
      
      doc.rect(pageMargin, tableTop - 5, pageWidth, 22).fill('#E53E3E');
      
      const col1_x = pageMargin + 10;
      const col2_x = pageMargin + 50;
      const col3_x = pageMargin + 320;
      const col4_x = pageMargin + 420;
      
      doc.fontSize(10).font('Helvetica-Bold')
         .fillColor('#FFF')
         .text('Cant.', col1_x, tableTop, { width: 35 })
         .text('Descripción', col2_x, tableTop, { width: 260 })
         .text('P. Unit.', col3_x, tableTop, { width: 90, align: 'right' })
         .text('Importe', col4_x, tableTop, { width: 80, align: 'right' });
      
      let y = tableTop + 28;
      doc.font('Helvetica').fillColor('#333');
      
      for (const item of pedido.items) {
        if ((pedido.items.indexOf(item) % 2) === 0) {
          doc.rect(pageMargin, y - 5, pageWidth, 20).fill('#f9f9f9');
        }
        
        doc.fillColor('#333')
           .fontSize(10)
           .text(item.cantidad, col1_x, y, { width: 35 })
           .text(item.nombre, col2_x, y, { width: 260 })
           .text(`$${item.precioUnitario.toFixed(2)}`, col3_x, y, { width: 90, align: 'right' })
           .text(`$${(item.cantidad * item.precioUnitario).toFixed(2)}`, col4_x, y, { width: 80, align: 'right' });
        y += 20;
      }
      
      y += 10;
      doc.moveTo(pageMargin + 250, y).lineTo(pageMargin + pageWidth, y).stroke('#ccc');
      y += 15;
      
      // TOTALES
      const labelX = pageMargin + 320;
      const valueX = pageMargin + 420;
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text('Subtotal:', labelX, y, { width: 90, align: 'right' })
         .text(`$${pedido.subtotal.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
      y += 18;
      
      if (pedido.descuentoPorcentaje > 0) {
        doc.fillColor('#2E7D32')
           .text(`Descuento Juegos (${pedido.descuentoPorcentaje}%):`, labelX - 30, y, { width: 120, align: 'right' })
           .text(`-$${pedido.descuentoMonto.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
        y += 18;
      }
      
      if (pedido.propinaPorcentaje > 0) {
        doc.fillColor('#1565C0')
           .text(`Propina (${pedido.propinaPorcentaje}%):`, labelX, y, { width: 90, align: 'right' })
           .text(`$${pedido.propinaMonto.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
        y += 18;
      }
      
      y += 5;
      doc.moveTo(pageMargin + 320, y).lineTo(pageMargin + pageWidth, y).stroke('#E53E3E');
      y += 12;
      
      doc.fontSize(14).font('Helvetica-Bold')
         .fillColor('#E53E3E')
         .text('TOTAL:', labelX, y, { width: 90, align: 'right' })
         .text(`$${pedido.total.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
      
      // PIE DE PÁGINA
      const footerY = doc.page.height - 80;
      
      doc.fontSize(10).font('Helvetica')
         .fillColor('#666')
         .text('¡Gracias por su visita!', pageMargin, footerY, { align: 'center', width: pageWidth });
      
      doc.fontSize(8)
         .fillColor('#999')
         .text('Los Fritos Hermanos - Documento no válido como factura fiscal', pageMargin, footerY + 15, { align: 'center', width: pageWidth })
         .text(`Generado el ${new Date().toLocaleString('es-AR')}`, pageMargin, footerY + 28, { align: 'center', width: pageWidth });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function testEnvioFactura() {
  try {
    console.log('🔍 Obteniendo datos del pedido', PEDIDO_ID, '...');
    
    const { data: pedidoData, error: pedidoError } = await supabase
      .from('pedidos')
      .select(`
        id,
        fecha_pedido,
        precio, 
        comidas,
        bebidas,
        postres,
        mesa,
        descuento,
        propina,
        cliente:clientes (
          id,
          nombre,
          apellido,
          correo,
          fcm_token
        )
      `)
      .eq('id', PEDIDO_ID)
      .single();

    if (pedidoError) {
      console.error('❌ Error al obtener pedido:', pedidoError);
      return;
    }

    console.log('\n=== DATOS DEL PEDIDO ===');
    console.log('ID:', pedidoData.id);
    console.log('Mesa:', pedidoData.mesa);
    console.log('Fecha:', pedidoData.fecha_pedido);
    console.log('Precio original:', pedidoData.precio);
    console.log('Descuento:', pedidoData.descuento, '%');
    console.log('Propina:', pedidoData.propina, '%');
    console.log('Cliente:', pedidoData.cliente?.nombre, pedidoData.cliente?.apellido);
    
    // Formatear items
    const formatearItems = (itemArray) => {
      if (!itemArray) return [];
      return itemArray.map(item => ({
        cantidad: item.cantidad,
        nombre: item.nombre,
        precioUnitario: item.precio || item.precioUnitario || 0
      }));
    };

    const itemsComidas = formatearItems(pedidoData.comidas);
    const itemsBebidas = formatearItems(pedidoData.bebidas);
    const itemsPostres = formatearItems(pedidoData.postres);
    const itemsCombinados = [...itemsComidas, ...itemsBebidas, ...itemsPostres];

    console.log('\n=== ITEMS DEL PEDIDO ===');
    itemsCombinados.forEach(item => {
      console.log(`  ${item.cantidad}x ${item.nombre} - $${item.precioUnitario}`);
    });

    // Calcular totales
    const subtotal = itemsCombinados.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const descuentoPorcentaje = pedidoData.descuento || 0;
    const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
    const propinaPorcentaje = pedidoData.propina || 0;
    const baseParaPropina = subtotal - descuentoMonto;
    const propinaMonto = (baseParaPropina * propinaPorcentaje) / 100;
    const totalFinal = subtotal - descuentoMonto + propinaMonto;

    console.log('\n=== CÁLCULOS ===');
    console.log('Subtotal:', subtotal);
    console.log('Descuento:', descuentoMonto, `(${descuentoPorcentaje}%)`);
    console.log('Propina:', propinaMonto, `(${propinaPorcentaje}%)`);
    console.log('TOTAL:', totalFinal);

    // Preparar objeto pedido para el email
    const pedido = {
      id: pedidoData.id,
      fecha: pedidoData.fecha_pedido,
      subtotal: subtotal,
      descuentoPorcentaje: descuentoPorcentaje,
      descuentoMonto: descuentoMonto,
      propinaPorcentaje: propinaPorcentaje,
      propinaMonto: propinaMonto,
      total: totalFinal,
      cliente: pedidoData.cliente,
      mesa: pedidoData.mesa,
      items: itemsCombinados
    };

    // GENERAR PDF
    console.log('\n📄 Generando PDF de la factura...');
    const pdfBuffer = await generarPDFFactura(pedido);
    console.log('✅ PDF generado en memoria');

    // SUBIR A SUPABASE STORAGE
    console.log('☁️ Subiendo PDF a Supabase Storage...');
    const nombreArchivo = `facturas/factura-${pedido.id}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('facturas')
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Error al subir PDF:', uploadError);
      throw new Error(`Error al subir PDF: ${uploadError.message}`);
    }
    console.log('✅ PDF subido exitosamente');

    // OBTENER URL PÚBLICA
    const { data: publicUrlData } = supabase.storage
      .from('facturas')
      .getPublicUrl(nombreArchivo);
    
    const pdfUrl = publicUrlData.publicUrl;
    console.log('🔗 URL del PDF:', pdfUrl);

    // Generar HTML del email
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
        <title>Factura - Los Fritos Hermanos</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #E53E3E 0%, #C53030 100%); padding: 30px; text-align: center;">
            <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" 
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
              ¡Gracias por tu visita, ${nombreCliente}! 🌮
            </h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Te enviamos la factura correspondiente a tu pedido. Fue un placer atenderte.
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
                <tr>
                  <td style="padding: 8px 0; color: #666;">Subtotal:</td>
                  <td style="padding: 8px 0; color: #333; text-align: right;">$${pedido.subtotal.toFixed(2)}</td>
                </tr>
                ${pedido.descuentoPorcentaje > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #2E7D32;">🎮 Descuento Juegos:</td>
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
            
            <!-- Items del pedido -->
            <div style="background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 15px; margin: 20px 0;">
              <h3 style="color: #E53E3E; margin-top: 0;">Detalle de productos:</h3>
              ${pedido.items.map(item => `
                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #eee;">
                  <span>${item.cantidad}x ${item.nombre}</span>
                  <span style="font-weight: bold;">$${(item.cantidad * item.precioUnitario).toFixed(2)}</span>
                </div>
              `).join('')}
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
            
            <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
              ¿Tenés alguna consulta? Respondé a este correo o contactanos.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #FFD700; margin: 0 0 10px 0; font-weight: bold;">
              🌮 Los Fritos Hermanos 🌮
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2025 Los Fritos Hermanos. Todos los derechos reservados.
            </p>
            <p style="color: #777; font-size: 11px; margin: 10px 0 0 0;">
              Este es un correo automático de PRUEBA.
            </p>
          </div>
          
        </div>
      </body>
      </html>
    `;

    console.log('\n📧 Enviando email de prueba a:', TEST_EMAIL);
    
    await sendEmail({
      to: TEST_EMAIL,
      subject: `🧪 [PRUEBA] Factura del pedido #${pedido.id} - Los Fritos Hermanos`,
      text: `PRUEBA - Factura del pedido #${pedido.id}. Total: $${pedido.total.toFixed(2)}`,
      html: htmlBody
    });

    console.log('\n✅ ¡Email enviado exitosamente!');
    console.log('📬 Revisa tu bandeja de entrada en:', TEST_EMAIL);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEnvioFactura();

