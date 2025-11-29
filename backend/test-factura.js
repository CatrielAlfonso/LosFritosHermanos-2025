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
const PEDIDO_ID = 55;

// Función para generar el PDF
function generarPDFFactura(pedido) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 20 }); // Márgenes más chicos para aprovechar espacio

      const chunks = [];
      const stream = new PassThrough();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      doc.pipe(stream);

      // --- Variables de Diseño ---
      const x = 30; // Margen izquierdo
      const w = 535; // Ancho útil (A4 width ~595 - márgenes)
      const centerX = x + (w / 2);
      let y = 30; // Cursor vertical inicial

      // ============================================
      // 1. TÍTULO "ORIGINAL"
      // ============================================
      doc.rect(x, y, w, 25).stroke();
      doc.fontSize(14).font('Helvetica-Bold').text('ORIGINAL', x, y + 7, { width: w, align: 'center' });
      y += 25;

      // ============================================
      // 2. ENCABEZADO PRINCIPAL (Caja Grande)
      // ============================================
      const headerHeight = 130;
      doc.rect(x, y, w, headerHeight).stroke(); // Caja contenedora
      
      // Línea vertical divisoria
      doc.moveTo(centerX, y).lineTo(centerX, y + headerHeight).stroke();

      // --- LA "C" FLOTANTE (Cuadrado del medio) ---
      const boxSize = 35;
      const boxX = centerX - (boxSize / 2);
      
      // Borramos la línea vertical en el centro para poner la caja
      doc.rect(boxX, y, boxSize, boxSize).fillAndStroke('white', 'black'); 
      
      doc.fillColor('black').fontSize(20).font('Helvetica-Bold').text('C', boxX, y + 5, { width: boxSize, align: 'center' });
      doc.fontSize(8).font('Helvetica-Bold').text('COD. 011', boxX, y + 23, { width: boxSize, align: 'center' });

      // --- LADO IZQUIERDO (Empresa) ---
      // Logo (si existe)
      const logoPath = path.join(__dirname, '..', 'assets', 'crispy2.png');
      try {
        doc.image(logoPath, x + 10, y + 10, { width: 60 });
      } catch (e) { /* Si falla no pasa nada */ }

      doc.fontSize(18).font('Helvetica-Bold').text('Los Fritos Hermanos', x + 80, y + 15);
      
      doc.fontSize(9).font('Helvetica')
         .text('Razón Social: Los Fritos Hermanos', x + 10, y + 60)
         .text('Domicilio Comercial: Av. Mitre 750 - Avellaneda', x + 10, y + 75)
         .text('Condición frente al IVA: Responsable Inscripto', x + 10, y + 90);

      // --- LADO DERECHO (Datos Factura) ---
      const rightColX = centerX + 20;
      doc.fontSize(18).font('Helvetica-Bold').text('FACTURA', rightColX, y + 15);
      
      doc.fontSize(9).font('Helvetica')
         .text(`Punto de Venta: 00001   Comp. Nro: 0000${String(pedido.id).padStart(4, '0')}`, rightColX, y + 45)
         .text(`Fecha de Emisión: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, rightColX, y + 60)
         .text('CUIT: 30-12345678-9', rightColX, y + 75)
         .text('Ingresos Brutos: Exento', rightColX, y + 90)
         .text('Fecha de Inicio de Actividades: 01/01/2025', rightColX, y + 105);

      y += headerHeight; // Bajamos el cursor

      // ============================================
      // 3. PERÍODO FACTURADO (Fila)
      // ============================================
      doc.rect(x, y, w, 20).stroke();
      const periodY = y + 6;
      doc.fontSize(8).font('Helvetica');
      doc.text(`Período Facturado Desde: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, x + 10, periodY);
      doc.text(`Hasta: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, x + 200, periodY);
      doc.text(`Fecha de Vto. para el pago: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, x + 400, periodY);
      
      y += 25; // Margen para la siguiente caja

      // ============================================
      // 4. DATOS DEL CLIENTE
      // ============================================
      doc.rect(x, y, w, 45).stroke();
      const clientY = y + 8;
      
      doc.fontSize(9).font('Helvetica-Bold').text('CUIT:', x + 10, clientY);
      doc.font('Helvetica').text('20-12345678-9', x + 40, clientY); // Simulado o del cliente si tuvieras

      doc.font('Helvetica-Bold').text('Apellido y Nombre / Razón Social:', x + 150, clientY);
      const nombreCliente = pedido.cliente ? `${pedido.cliente.nombre} ${pedido.cliente.apellido || ''}` : 'Consumidor Final';
      doc.font('Helvetica').text(nombreCliente, x + 330, clientY);

      doc.font('Helvetica-Bold').text('Condición frente al IVA:', x + 10, clientY + 15);
      doc.font('Helvetica').text('Consumidor Final', x + 120, clientY + 15);

      doc.font('Helvetica-Bold').text('Domicilio:', x + 250, clientY + 15);
      doc.font('Helvetica').text('Domicilio del Cliente', x + 300, clientY + 15); // Simulado

      doc.font('Helvetica-Bold').text('Condición de venta:', x + 10, clientY + 30);
      doc.font('Helvetica').text('Contado', x + 100, clientY + 30);

      y += 55; // Margen antes de la tabla

      // ============================================
      // 5. TABLA DE PRODUCTOS
      // ============================================
      const tableHeaders = ['Código', 'Producto / Servicio', 'Cant.', 'U. Medida', 'Precio Unit.', '% Bonif', 'Subtotal', 'IVA', 'Subtotal c/IVA'];
      const colWidths = [40, 180, 40, 50, 60, 40, 50, 30, 45]; // Ajuste de anchos
      let currentX = x;
      
      // Cabecera (Fondo gris)
      doc.rect(x, y, w, 20).fill('#cccccc').stroke();
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
      
      tableHeaders.forEach((header, i) => {
        // Alinear a la derecha si es número
        const align = i >= 4 ? 'right' : 'left'; 
        doc.text(header, currentX + 2, y + 6, { width: colWidths[i] - 4, align: align });
        // Líneas verticales de la grilla (opcional, el diseño HTML no las tiene todas, solo borde)
        currentX += colWidths[i];
      });

      y += 20; // Empezamos a listar items

      // Items
      doc.font('Helvetica').fontSize(8);
      
      pedido.items.forEach((item, index) => {
        currentX = x;
        const subtotal = item.cantidad * item.precioUnitario;
        
        // Simulo filas de tabla
        const rowData = [
          String(index + 1), // Código
          item.nombre,       // Producto
          String(item.cantidad), // Cantidad
          'unidades',        // U. Medida
          item.precioUnitario.toFixed(2), // Precio Unit
          '0.00',            // Bonif
          subtotal.toFixed(2), // Subtotal
          '21%',             // IVA (Simulado para Factura C/B)
          subtotal.toFixed(2)  // Subtotal c/IVA
        ];

        rowData.forEach((text, i) => {
          const align = i >= 4 ? 'right' : 'left';
          doc.text(text, currentX + 2, y + 5, { width: colWidths[i] - 4, align: align });
          currentX += colWidths[i];
        });
        
        y += 15;
      });

      // Dibujar borde alrededor de toda la tabla (desde cabecera hasta final de items)
      // Ojo: Si son muchos items hay que manejar paginación, pero asumo pedido corto
      // doc.rect(x, y - (pedido.items.length * 15) - 20, w, (pedido.items.length * 15) + 20).stroke();


      // ============================================
      // 6. PIE DE PÁGINA (Totales y Tributos)
      // ============================================
      // Mandamos esto al fondo de la página como en el HTML (margin-top: 300px)
      // Usaremos una Y fija cerca del final
      y = 650; 

      // -- OTROS TRIBUTOS (Izquierda) --
      const tributosX = x;
      const tributosW = 300;
      
      doc.font('Helvetica-Bold').text('Otros tributos', tributosX, y);
      y += 15;
      
      // Cabecera tributos
      doc.rect(tributosX, y, tributosW, 15).fill('#cccccc').stroke();
      doc.fillColor('black').text('Descripción', tributosX + 2, y + 4);
      doc.text('Detalle', tributosX + 150, y + 4);
      doc.text('Alíc %', tributosX + 200, y + 4);
      doc.text('Importe', tributosX + 250, y + 4);
      
      y += 15;
      doc.font('Helvetica');
      // Fila vacía simulada
      doc.rect(tributosX, y, tributosW, 15).stroke();
      doc.text('Per./Ret de Impuesto a las Ganancias', tributosX + 2, y + 4);
      doc.text('0,00', tributosX + 250, y + 4);
      
      // -- TOTALES (Derecha) --
      const totalsX = x + 320;
      const totalsW = w - 320;
      let totalsY = 650; // A la misma altura que empieza tributos

      const labels = ['Importe Neto Gravado:', 'IVA 27%:', 'IVA 21%:', 'IVA 10.5%:', 'IVA 0%:', 'Importe Otros Tributos:'];
      const values = [`$ ${pedido.total.toFixed(2)}`, '$ 0,00', '$ 0,00', '$ 0,00', '$ 0,00', '$ 0,00'];

      doc.font('Helvetica-Bold');
      labels.forEach((label, i) => {
        doc.text(label, totalsX, totalsY, { width: 120, align: 'right' });
        doc.text(values[i], totalsX + 130, totalsY, { width: 80, align: 'right' });
        totalsY += 15;
      });

      // TOTAL FINAL
      totalsY += 5;
      doc.fontSize(11).text('Importe Total:', totalsX, totalsY, { width: 120, align: 'right' });
      doc.text(`$ ${pedido.total.toFixed(2)}`, totalsX + 130, totalsY, { width: 80, align: 'right' });


      // ============================================
      // 7. FOOTER (CAE y QR)
      // ============================================
      const footerY = 770;
      
      // QR Simulado
      doc.rect(x, footerY, 70, 70).stroke(); // Placeholder del QR
      doc.fontSize(8).text('QR AFIP', x + 15, footerY + 30);

      // Logo AFIP y Textos
      doc.fontSize(10).font('Helvetica-BoldOblique')
         .text('Comprobante Autorizado', x + 80, footerY + 20);
      
      doc.fontSize(7).font('Helvetica-Oblique')
         .text('Esta Administración Federal no se responsabiliza por los datos ingresados en el detalle de la operación', x + 80, footerY + 35);

      // CAE y Vencimiento
      doc.fontSize(9).font('Helvetica-Bold')
         .text('CAE N°:', x + 350, footerY + 20, { width: 50, align: 'right' })
         .font('Helvetica').text('12345678901234', x + 410, footerY + 20);

      doc.font('Helvetica-Bold')
         .text('Fecha de Vto. de CAE:', x + 300, footerY + 35, { width: 100, align: 'right' })
         .font('Helvetica').text('01/01/2030', x + 410, footerY + 35);

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

