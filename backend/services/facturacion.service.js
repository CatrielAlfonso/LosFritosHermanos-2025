// En /services/facturacion.service.js

const { createClient } = require('@supabase/supabase-js');
const PDFDocument = require('pdfkit'); 
const { PassThrough } = require('stream'); 
// Inicializa Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const admin = require('firebase-admin'); 
const { sendEmail } = require('./email.service');


async function generarYEnviarFactura({ pedidoId, clienteEmail, esAnonimo }) {
  try {
    // --- 1. Obtener Datos (Simulado por ahora) ---
    // En un caso real, harías las consultas a Supabase
    const pedido = await obtenerDatosDelPedido(pedidoId);

    const esAnonimo = false; // O la lógica que uses para anónimos (falta esta logica)
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
 * Dibuja la factura usando PDFKit.
 * @param {object} pedido - El objeto del pedido con los items, cliente, etc.
 * @returns {Promise<Buffer>} Un Buffer del PDF generado.
 */
function generarPDFFactura(pedido) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50 
      });

      // Stream para capturar el PDF en memoria
      const chunks = [];
      const stream = new PassThrough();
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      doc.pipe(stream);


      // 1. Encabezado: Logo y Datos
      doc.image('https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png', 50, 45, { width: 100 });
      doc.fontSize(20).text('Los Pollos Hermanos', 160, 50);
      doc.fontSize(10).text('Av. Mitre 750', 160, 75);
      
      doc.fontSize(10).text(`Factura #: 001-${pedido.id}`, { align: 'right' })
         .text(`Fecha: ${new Date(pedido.fecha).toLocaleDateString()}`, { align: 'right' });
      
      doc.moveDown(2);

      // 2. Información del Cliente
      doc.fontSize(12).text('Facturado a:', 50);
      doc.fontSize(10).text(pedido.cliente.nombre);
      doc.moveDown(2);

      // 3. Tabla de Items (Cabecera)
      let tableTop = 200;
      doc.fontSize(10)
         .text('Cant.', 50, tableTop, { width: 50 })
         .text('Descripción', 100, tableTop, { width: 250 })
         .text('P. Unitario', 350, tableTop, { width: 100, align: 'right' })
         .text('Total', 450, tableTop, { width: 100, align: 'right' });

      // Dibuja la línea de la cabecera
      doc.rect(50, tableTop - 5, 500, 20).stroke();
      
      // 4. Items del Pedido (Bucle)
      let y = tableTop + 25;
      for (const item of pedido.items) {
        doc.fontSize(10)
           .text(item.cantidad, 50, y, { width: 50 })
           .text(item.nombre, 100, y, { width: 250 })
           .text(`$${item.precioUnitario.toFixed(2)}`, 350, y, { width: 100, align: 'right' })
           .text(`$${(item.cantidad * item.precioUnitario).toFixed(2)}`, 450, y, { width: 100, align: 'right' });
        y += 20;
      }

      // 5. Total
      doc.moveDown(2);
      doc.fontSize(14).font('Helvetica-Bold')
         .text(`Total: $${pedido.total.toFixed(2)}`, 50, y, { align: 'right' });

     
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

async function enviarFacturaPorEmail(clienteEmail, pdfUrl, pedido) {
  console.log(`Enviando factura por email a: ${clienteEmail}`);
  try {
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" alt="Los Pollos Hermanos" style="width: 150px; margin: 20px auto; display: block;">
        <h2>¡Gracias por tu visita, ${pedido.cliente.nombre}!</h2>
        <p>Adjuntamos el enlace para descargar tu factura correspondiente al pedido #${pedido.id}.</p>
        <p>Total pagado: <strong>$${pedido.total.toFixed(2)}</strong></p>
        <div style="text-align: center; margin: 30px;">
          <a href="${pdfUrl}" style="background-color: #ffc107; color: #333; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Descargar Factura (PDF)
          </a>
        </div>
        <p style="color: #777; font-size: 12px; text-align: center;">
          Los Pollos Hermanos - Av. Ficticia 1234
        </p>
      </div>
    `;

    await sendEmail({
      to: clienteEmail,
      subject: `Tu factura del pedido #${pedido.id} de Los Pollos Hermanos`,
      text: `¡Gracias por tu visita! Aquí puedes descargar tu factura: ${pdfUrl}`,
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
        title: '¡Tu factura está lista!',
        body: 'El pago se completó. Toca aquí para descargar tu factura.'
      },
      data: {
        link: pdfUrl,
      },
      token: fcmToken
    };

    await admin.messaging().send(message);
    console.log('Notificación push con factura enviada.');

  } catch (error) {
    console.error('Error al enviar la notificación push de la factura:', error);
  }
}


async function obtenerDatosDelPedido(pedidoId) {
  console.log(`Buscando datos reales para el pedido ID: ${pedidoId}`);

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
      cliente:clientes (
        id,
        nombre,
        apellido,
        correo,
        fcm_token
      )
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

  const resultado = {
    id: pedidoData.id,
    fecha: pedidoData.fecha_pedido, 
    total: pedidoData.precio,        
    cliente: pedidoData.cliente,     
    items: itemsCombinados           
  };

  console.log('Datos del pedido encontrados y formateados (nueva estructura).');
  return resultado;
}

// Exportamos la función principal
module.exports = {
  generarYEnviarFactura
};