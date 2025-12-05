require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit'); 
const { PassThrough } = require('stream'); 
// Inicializa Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);
const admin = require('firebase-admin'); 
const { sendEmail } = require('./email.service');
const path = require('path');
const logoPath = path.join(__dirname, '..', 'assets', 'crispy2.png');


async function generarYEnviarFactura(pedidoId) {
  try {
    // --- 1. Obtener Datos del Pedido ---
    console.log('en el metodo generarYEnviarFactura del facturacion.service, pedidoId: ', pedidoId)
    const pedido = await obtenerDatosDelPedido(pedidoId);

    // Determinar si es cliente anónimo (no tiene email o es cliente anónimo)
    const esAnonimo = !pedido.cliente?.correo || pedido.cliente?.correo?.includes('anonimo');
    const clienteEmail = pedido.cliente?.correo;
    
    // --- 2. Generar el PDF en memoria ---
    console.log('Generando PDF...');
    const pdfBuffer = await generarPDFFactura(pedido);
    console.log('PDF generado en memoria.');

    // --- 3. Subir el PDF a Supabase Storage ---
    const nombreArchivo = `facturas/factura-${pedido.id}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('facturas') 
      .upload(nombreArchivo, pdfBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Error al subir PDF a Storage: ${uploadError.message}`);
    }
    console.log('PDF subido a Supabase Storage.');

    // --- 4. Obtener la URL pública del PDF ---
    const { data: publicUrlData } = supabase.storage
      .from('facturas')
      .getPublicUrl(nombreArchivo);
    
    const pdfUrl = publicUrlData.publicUrl;

    const { error: mesaError } = await supabase
      .from('mesas')
      .update({ ocupada: false, clienteAsignadoId: null, pedido_id: null })
      .eq('id', parseInt(pedido.mesa)); 

    if (mesaError) console.error("Error al liberar la mesa:", mesaError.message);

    const { error: pedidoError } = await supabase
      .from('pedidos')
      .update({ estado: 'finalizado', pagado: pedido.total })
      .eq('id', pedidoId);

    if (pedidoError) console.error("Error al actualizar el pedido:", pedidoError.message);


    if (esAnonimo) {
      await notificarClienteAnonimo(pedido.cliente.fcm_token, pdfUrl, pedido.id);
    } else {
      await enviarFacturaPorEmail(clienteEmail, pdfUrl, pedido);
    }

    // --- 7. Responder con éxito ---
    return { 
      success: true, 
      message: 'Factura generada y subida con éxito.', 
      pdfUrl: pdfUrl 
    };

  } catch (error) {
    console.error('Error en el servicio de facturación:', error);
    throw error;
  }
}

/**
 * Dibuja la factura usando PDFKit con todos los datos requeridos.
 * @param {object} pedido - El objeto del pedido con los items, cliente, descuento, propina, etc.
 * @returns {Promise<Buffer>} Un Buffer del PDF generado.
 */
/**
 * Genera una Factura estilo "C" (Fiscal Argentina) basada en la plantilla HTML.
 */
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
      const boxWidth = 35;
      const boxHeight = 60;
      const boxX = centerX - (boxWidth / 2);
      
      // Borramos la línea vertical en el centro para poner la caja
      doc.rect(boxX, y, boxWidth, boxHeight).fillAndStroke('white', 'black'); 
      
     doc.fillColor('black').fontSize(20).font('Helvetica-Bold').text('C', boxX, y + 10, { width: boxWidth, align: 'center' });
      doc.fontSize(8).font('Helvetica-Bold').text('COD. 011', boxX, y + 35, { width: boxWidth, align: 'center' });

      // --- LADO IZQUIERDO (Empresa) ---
      // Logo (si existe)
      const logoPath = path.join(__dirname, '..', 'assets', 'crispy2.png');
      console.log('DEBUG: Buscando logo en:', logoPath);
      try {
        doc.image(logoPath, x + 10, y + 10, { width: 45 });
      } catch (e) { /* Si falla no pasa nada */ }

      doc.fontSize(18).font('Helvetica-Bold').text('Los Fritos Hermanos', x + 60, y + 20);
      
      doc.fontSize(9).font('Helvetica')
         .text('Razón Social: Los Fritos Hermanos', x + 10, y + 60)
         .text('Domicilio Comercial: Av. Mitre 750 - Avellaneda', x + 10, y + 75)
         .text('Condición frente al IVA: Responsable Inscripto', x + 10, y + 90);

      // --- LADO DERECHO (Datos Factura) ---
      const rightColX = centerX + 25;
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
      doc.text(`Fecha de Vto. para el pago: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, x + 350, periodY);
      
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
      doc.fontSize(10).font('Helvetica-Bold-Oblique')
         .text('Comprobante Autorizado', x + 80, footerY + 20);
      
      doc.fontSize(7).font('Helvetica-Oblique')
         .text('Esta Administración Federal no se responsabiliza por los datos ingresados en el detalle de la operación', x + 80, footerY + 32);

      // CAE y Vencimiento
      doc.fontSize(9).font('Helvetica-Bold')
         .text('CAE N°:', x + 350, footerY + 20, { width: 50, align: 'right' })
         .font('Helvetica').text('12345678901234', x + 410, footerY + 20);

      doc.font('Helvetica-Bold')
         .text('Fecha de Vto. de CAE:', x + 300, footerY + 41, { width: 100, align: 'right' })
         .font('Helvetica').text('01/01/2030', x + 410, footerY + 41);

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}
// function generarPDFFactura(pedido) {
//   return new Promise((resolve, reject) => {
//     try {
//       const doc = new PDFDocument({ size: 'A4', margin: 50 });

//       const chunks = [];
//       const stream = new PassThrough();
//       stream.on('data', (chunk) => chunks.push(chunk));
//       stream.on('end', () => resolve(Buffer.concat(chunks)));
//       doc.pipe(stream);

//       // --- Constantes de Posición ---
//       const pageMargin = 50;
//       const pageWidth = doc.page.width - pageMargin * 2;
      
//       // ============================================
//       // 1. ENCABEZADO - Logo, Nombre y Dirección
//       // ============================================
//       const logoPath = path.join(__dirname, '..', 'assets', 'crispy2.png');
//       try {
//         doc.image(logoPath, pageMargin, 35, { width: 70 }); 
//       } catch (e) {
//         console.log('Logo no encontrado, continuando sin logo');
//       }
      
//       doc.fontSize(22).font('Helvetica-Bold')
//          .fillColor('#E53E3E')
//          .text('Los Fritos Hermanos', 130, 40);
      
//       doc.fontSize(10).font('Helvetica')
//          .fillColor('#666')
//          .text('Av. Mitre 750, Buenos Aires', 130, 65)
//          .text('Tel: (011) 1234-5678', 130, 78)
//          .text('www.fritoshermanos.com', 130, 91);
      
//       // ============================================
//       // 2. DATOS DE FACTURA (derecha)
//       // ============================================
//       doc.fontSize(12).font('Helvetica-Bold')
//          .fillColor('#333')
//          .text(`FACTURA`, pageMargin, 40, { align: 'right' });
      
//       doc.fontSize(10).font('Helvetica')
//          .fillColor('#666')
//          .text(`N°: 0001-${String(pedido.id).padStart(8, '0')}`, pageMargin, 55, { align: 'right' })
//          .text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString('es-AR')}`, pageMargin, 68, { align: 'right' })
//          .text(`Pedido #: ${pedido.id}`, pageMargin, 81, { align: 'right' })
//          .text(`Mesa: ${pedido.mesa}`, pageMargin, 94, { align: 'right' });
      
//       // Línea separadora
//       doc.moveTo(pageMargin, 115).lineTo(pageMargin + pageWidth, 115).stroke('#E53E3E');
      
//       // ============================================
//       // 3. DATOS DEL CLIENTE
//       // ============================================
//       let y_cliente = 130;
//       doc.fontSize(11).font('Helvetica-Bold')
//          .fillColor('#E53E3E')
//          .text('DATOS DEL CLIENTE', pageMargin, y_cliente);
      
//       y_cliente += 18;
//       doc.fontSize(10).font('Helvetica')
//          .fillColor('#333')
//          .text(`Nombre: ${pedido.cliente?.nombre || 'Cliente'} ${pedido.cliente?.apellido || ''}`, pageMargin, y_cliente);
      
//       if (pedido.cliente?.correo && !pedido.cliente.correo.includes('anonimo')) {
//         y_cliente += 15;
//         doc.text(`Email: ${pedido.cliente.correo}`, pageMargin, y_cliente);
//       }
      
//       // ============================================
//       // 4. TABLA DE PRODUCTOS
//       // ============================================
//       const tableTop = y_cliente + 35;
      
//       // Cabecera de tabla
//       doc.rect(pageMargin, tableTop - 5, pageWidth, 22).fill('#E53E3E');
      
//       const col1_x = pageMargin + 10;      // Cant.
//       const col2_x = pageMargin + 50;      // Descripción
//       const col3_x = pageMargin + 320;     // P. Unitario
//       const col4_x = pageMargin + 420;     // Importe
      
//       doc.fontSize(10).font('Helvetica-Bold')
//          .fillColor('#FFF')
//          .text('Cant.', col1_x, tableTop, { width: 35 })
//          .text('Descripción', col2_x, tableTop, { width: 260 })
//          .text('P. Unit.', col3_x, tableTop, { width: 90, align: 'right' })
//          .text('Importe', col4_x, tableTop, { width: 80, align: 'right' });
      
//       // Items del Pedido
//       let y = tableTop + 28;
//       doc.font('Helvetica').fillColor('#333');
      
//       for (const item of pedido.items) {
//         // Alternar color de fondo
//         if ((pedido.items.indexOf(item) % 2) === 0) {
//           doc.rect(pageMargin, y - 5, pageWidth, 20).fill('#f9f9f9');
//         }
        
//         doc.fillColor('#333')
//            .fontSize(10)
//            .text(item.cantidad, col1_x, y, { width: 35 })
//            .text(item.nombre, col2_x, y, { width: 260 })
//            .text(`$${item.precioUnitario.toFixed(2)}`, col3_x, y, { width: 90, align: 'right' })
//            .text(`$${(item.cantidad * item.precioUnitario).toFixed(2)}`, col4_x, y, { width: 80, align: 'right' });
//         y += 20;
//       }
      
//       // Línea separadora
//       y += 10;
//       doc.moveTo(pageMargin + 250, y).lineTo(pageMargin + pageWidth, y).stroke('#ccc');
//       y += 15;
      
//       // ============================================
//       // 5. SUBTOTAL, DESCUENTO, PROPINA Y TOTAL
//       // ============================================
//       const labelX = pageMargin + 320;
//       const valueX = pageMargin + 420;
      
//       // Subtotal
//       doc.fontSize(10).font('Helvetica')
//          .fillColor('#666')
//          .text('Subtotal:', labelX, y, { width: 90, align: 'right' })
//          .text(`$${pedido.subtotal.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
//       y += 18;
      
//       // Descuento por juegos (si aplica)
//       if (pedido.descuentoPorcentaje > 0) {
//         doc.fillColor('#2E7D32')
//            .text(`Descuento Juegos (${pedido.descuentoPorcentaje}%):`, labelX - 30, y, { width: 120, align: 'right' })
//            .text(`-$${pedido.descuentoMonto.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
//         y += 18;
//       }
      
//       // Propina (grado de satisfacción)
//       if (pedido.propinaPorcentaje > 0) {
//         doc.fillColor('#1565C0')
//            .text(`Propina (${pedido.propinaPorcentaje}%):`, labelX, y, { width: 90, align: 'right' })
//            .text(`$${pedido.propinaMonto.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
//         y += 18;
//       }
      
//       // Línea antes del total
//       y += 5;
//       doc.moveTo(pageMargin + 320, y).lineTo(pageMargin + pageWidth, y).stroke('#E53E3E');
//       y += 12;
      
//       // TOTAL GRANDE
//       doc.fontSize(14).font('Helvetica-Bold')
//          .fillColor('#E53E3E')
//          .text('TOTAL:', labelX, y, { width: 90, align: 'right' })
//          .text(`$${pedido.total.toFixed(2)}`, valueX, y, { width: 80, align: 'right' });
      
//       // ============================================
//       // 6. PIE DE PÁGINA
//       // ============================================
//       const footerY = doc.page.height - 80;
      
//       doc.fontSize(10).font('Helvetica')
//          .fillColor('#666')
//          .text('¡Gracias por su visita!', pageMargin, footerY, { align: 'center', width: pageWidth });
      
//       doc.fontSize(8)
//          .fillColor('#999')
//          .text('Los Fritos Hermanos - Documento no válido como factura fiscal', pageMargin, footerY + 15, { align: 'center', width: pageWidth })
//          .text(`Generado el ${new Date().toLocaleString('es-AR')}`, pageMargin, footerY + 28, { align: 'center', width: pageWidth });

//       // --- Fin del Dibujo ---
//       doc.end();

//     } catch (error) {
//       reject(error);
//     }
//   });
// }

async function enviarFacturaPorEmail(clienteEmail, pdfUrl, pedido) {
  console.log(`Enviando factura por email a: ${clienteEmail}`);
  try {
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
              ¡Gracias por tu visita, ${nombreCliente}! 🍗
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
            
            <!-- Botón de descarga -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${pdfUrl}" target="_blank"
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
              🍗 Los Fritos Hermanos 🍗
            </p>
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2025 Los Fritos Hermanos. Todos los derechos reservados.
            </p>
            <p style="color: #777; font-size: 11px; margin: 10px 0 0 0;">
              Este es un correo automático. Por favor no responder directamente.
            </p>
          </div>
          
        </div>
      </body>
      </html>
    `;

    await sendEmail({
        to: clienteEmail,
        subject: `📋 Tu factura del pedido #${pedido.id} - Los Fritos Hermanos`,
        text: `¡Gracias por tu visita, ${nombreCliente}! Aquí puedes descargar tu factura del pedido #${pedido.id}: ${pdfUrl}. Total: $${pedido.total.toFixed(2)}`,
        html: htmlBody
    });
    console.log('Email de factura enviado.');

  } catch (error) {
    console.error('Error al enviar el email de la factura:', error);
  }
}

async function notificarClienteAnonimo(fcmToken, pdfUrl, pedidoId) {
  console.log(`Enviando notificación push con factura al token: ${fcmToken}`);
  if (!fcmToken) {
    console.warn('No se encontró fcm_token para el cliente del pedido, no se puede notificar.');
    return;
  }

  try {
    const message = {
      notification: {
        title: '🧾 ¡Tu factura está lista!',
        body: '¡Gracias por tu visita a Los Fritos Hermanos! Tocá aquí para descargar tu factura en PDF.'
      },
      data: {
        link: pdfUrl,
        pedidoId: pedidoId.toString(),
        tipo: 'factura'
      },
      token: fcmToken
    };

    await admin.messaging().send(message);
    console.log('Notificación push con factura enviada al cliente anónimo.');

  } catch (error) {
    console.error('Error al enviar la notificación push de la factura:', error);
  }
}


async function obtenerDatosDelPedido(pedidoId) {
  console.log(`Buscando datos reales para el pedido ID: ${pedidoId}`);

  // Primero obtenemos el pedido sin el join de cliente
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
      cliente_id
    `)
    .eq('id', pedidoId)
    .single(); 

  if (pedidoError) {
    console.error('Error al buscar el pedido:', pedidoError);
    throw new Error(`Error al buscar el pedido: ${pedidoError.message}`);
  }
  if (!pedidoData) {
    throw new Error(`No se encontró ningún pedido con el ID: ${pedidoId}`);
  }

  // Ahora buscamos el cliente por su UID (cliente_id es el uid de auth)
  let clienteData = null;
  if (pedidoData.cliente_id) {
    console.log(`Buscando cliente con uid: ${pedidoData.cliente_id}`);
    
    // Primero intentamos buscar por uid
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, correo, fcm_token')
      .eq('uid', pedidoData.cliente_id)
      .maybeSingle();
    
    if (cliente) {
      clienteData = cliente;
      console.log('✅ Cliente encontrado por uid:', clienteData.nombre);
    } else {
      // Si no encontramos por uid, intentamos por id numérico (para clientes anónimos)
      const clienteIdNumerico = parseInt(pedidoData.cliente_id);
      if (!isNaN(clienteIdNumerico)) {
        const { data: clienteById } = await supabase
          .from('clientes')
          .select('id, nombre, apellido, correo, fcm_token')
          .eq('id', clienteIdNumerico)
          .maybeSingle();
        
        if (clienteById) {
          clienteData = clienteById;
          console.log('✅ Cliente encontrado por id numérico:', clienteData.nombre);
        }
      }
    }
    
    if (!clienteData) {
      console.log('⚠️ No se encontró cliente, usando datos por defecto');
      clienteData = {
        id: null,
        nombre: 'Cliente',
        apellido: '',
        correo: null,
        fcm_token: null
      };
    }
  }

  // Agregamos el cliente al pedido
  pedidoData.cliente = clienteData;

  
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

  // Calcular subtotal
  const subtotal = itemsCombinados.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
  
  // Calcular descuento
  const descuentoPorcentaje = pedidoData.descuento || 0;
  const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
  
  // Calcular propina
  const propinaPorcentaje = pedidoData.propina || 0;
  const baseParaPropina = subtotal - descuentoMonto;
  const propinaMonto = (baseParaPropina * propinaPorcentaje) / 100;
  
  // Total final
  const totalFinal = subtotal - descuentoMonto + propinaMonto;

  const resultado = {
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

  console.log('Datos del pedido encontrados y formateados (con descuento y propina).');
  return resultado;
}

// Exportamos la función principal
module.exports = {
  generarYEnviarFactura
};