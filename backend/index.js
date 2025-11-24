const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");
const path = require('path');
const cron = require('node-cron');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const { initializeApp, applicationDefault } = require('firebase-admin/app');

// Middleware de logging para ver todas las peticiones
app.use((req, res, next) => {
  console.log('=== INCOMING REQUEST ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Origin:', req.headers.origin);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// CORS configurado manualmente con logs
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  console.log('Setting CORS headers for origin:', origin);
  
  //res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.status(200).end();
  }
  
  next();
});

app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// CRON JOB PARA LIBERAR MESAS VENCIDAS
// ============================================

/**
 * Cron job que se ejecuta cada 5 minutos para liberar mesas vencidas
 * Formato cron: cada 5 minutos
 */
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('🔄 Ejecutando liberación de mesas vencidas...', new Date().toISOString());
    
    const { data, error } = await supabase.rpc('liberar_mesas_vencidas');
    
    if (error) {
      console.error('❌ Error al liberar mesas vencidas:', error);
    } else {
      if (data && data.reservas_liberadas > 0) {
        console.log(`✅ Liberadas ${data.reservas_liberadas} reservas vencidas`);
        console.log(`📋 Mesas liberadas: ${data.mesas_liberadas?.join(', ') || 'ninguna'}`);
      } else {
        console.log('ℹ️  No hay mesas vencidas para liberar');
      }
    }
  } catch (cronError) {
    console.error('💥 Error crítico en cron job de liberación de mesas:', cronError);
  }
});

console.log('⏰ Cron job de liberación de mesas configurado: cada 5 minutos');

try {
  console.log('Iniciando configuración de Firebase...');
  
  let serviceAccount;
  

  try {
    const fs = require('fs');
    const configPath = path.join(__dirname, 'config', 'firebase-config.json');
    
    if (fs.existsSync(configPath)) {
      console.log('Usando archivo de configuración local');
      serviceAccount = require('./config/firebase-config.json');
    } 
  } catch (parseError) {
    console.error('Error al cargar configuración:', parseError);
    throw parseError;
  }
  

  console.log('Intentando inicializar Firebase Admin...');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'fritos-hermanos',
      clientEmail: 'firebase-adminsdk-fbsvc@fritos-hermanos.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2tXhJXd8cgPxM\nC3u3f3awfy8Ep8IKO2vPVl/+SqXU+YQU+4i2BoWvEDQC4VrIJP5ykKDBb3oVdfUd\ncmJZWYEbWX7p3lRPXhDWlNOD2KKHXDb8x+fmozSbU0MtJbEyjgrwtBZZ7ISh22Q4\nYjpgaAzYpzhXIz4gue/59dA50FnU96Fux0nIflmAF+HuklmPjB7NGxhPY2BDnWuR\nhGmmdn86gmcAww6tB6mlesoe9LdV58EQ6EwxWMK8805ZSS5JTIjnGSWBt4w9Ijak\ntmPS1I6ugkt+55LO2QsuzGMpHS5qyut7PCC2tnDHyo2+Wt/V6aOuBdWAVTpi8RMG\nr7IYYxRTAgMBAAECggEAPvRRUYpIRaSGClfMlaIUTeVM2KBLIkZuM99RrSegcz1U\nTvyKkxm1N2hwW2u14Y+pouUFlxEnsjxWLILMs3e9HiTcr42dZEmHqMBYDy52dgiG\no9vnolcq2bg7RdOedkpuJ5kNuIdf/fs/0ZO7BJvljUM1DQVGM3WN5AVYbYtGYLQr\nULusrn+Mpkys7kUrypfku9sm8KVY8JuS/nheq4Xhw/41whldU5YeDYoqEfXk2uDC\n8UnaeNzlY5x5tZAQFfwS7W3Wcn01jZDbSXPpQcHxaR5KcylrWpEStm8U5w1bX2tx\ne7GL5QnaWk1hyQ7mbJYFLzu5QhYlpleDrUVoJg5Y5QKBgQDjTJom4aSUU2UGJBog\nmXYIhEJf66M9gFHUPPXPZj4GqgO1Wn2dvQmAvL1/mTnDJgMQbnALNATN3RNIT3aI\nli/CjnwUgAmPg0h/9TWrcptiKMffRhiKlwffWIUFJ7n5juhPazzgnMscEyX4Nc1r\npJhVzTDNw4ReUK9pp1Txhnj/xQKBgQDNx356bMY5Wt6SADdASCOqK03r6WD4Ach4\nNHERncgqi+0tv75TTFYuoHFW7F+QpcyrZYJFxuEUKewgqBMZuBN5WN8MKX4OG5Lt\nyL3kCBnNpoAYNjPn79jGZtXmX4wdqS8PUkEQj01tvyY9ub8BwRz0MM1oCKR9oYW4\nqwsJ/hytNwKBgH3aSTQkFdtmvXYEAU9xiRA4IwQ3VYBVD3njcvsuEkPgWQNOImV3\naM6WMpp2/auW3XV4oKMjX1GZCfcswGXqOnGQMRWsux5yQ29OFzRh1bUo/Vob1rTN\n4TcCLUzobSnHvctThjabuj5GP+zJ5X6neQ1w+ofDrQQHyshGNVsx6Mc9AoGAYiWW\nY5nh6ZU3tvc3YweFSzKgVbbYMzHWhc6tZzOUNwbKNxnPEzfDmzWXGVhgNEOAHPer\nbNBwpgdgwiqoAYpUb3o92DUqFFx+db9bIpnihL23NtUTaLpy8B44Q0qrL7Jz6aDX\nu6g9y+xxttsTCSksQCPOtKH6opkZiHy8JSX4U30CgYEAvZOGGKB1/hqZoSpUJzus\n9hdSaX95mkBUjBUu1lb46w6SuZcKlulq3aLUzDjeBoSf0n1IpRkXSkobxdC1xnDH\nJs+VElmzUSj0BNwJcd6sPyba9i+q55n14j3q7GECd7anCw+JM93fRn45uPwH+ChE\nrINin1iK/M2sgckI8nT18iA=\n-----END PRIVATE KEY-----\n'
  })
  });
  console.log('Firebase Admin inicializado correctamente');
} catch (error) {
  console.error('Error completo inicializando Firebase Admin:', error);
  console.error('Stack trace:', error.stack);
}

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// ============================================
// ENDPOINT PARA LIBERAR MESAS MANUALMENTE
// ============================================

/**
 * Endpoint para ejecutar manualmente la liberación de mesas vencidas
 * GET /liberar-mesas-vencidas
 */
app.get("/liberar-mesas-vencidas", async (req, res) => {
  try {
    console.log('🔄 Liberación manual de mesas vencidas solicitada...', new Date().toISOString());
    
    const { data, error } = await supabase.rpc('liberar_mesas_vencidas');
    
    if (error) {
      console.error('❌ Error al liberar mesas vencidas:', error);
      return res.status(500).send({ 
        error: `Error al liberar mesas: ${error.message}`,
        success: false
      });
    }
    
    const response = {
      success: true,
      message: "Liberación de mesas ejecutada correctamente",
      timestamp: new Date().toISOString(),
      reservas_liberadas: data?.reservas_liberadas || 0,
      mesas_liberadas: data?.mesas_liberadas || [],
      detalles: data?.detalles || []
    };
    
    if (data && data.reservas_liberadas > 0) {
      console.log(`✅ Liberadas ${data.reservas_liberadas} reservas vencidas`);
      console.log(`📋 Mesas liberadas: ${data.mesas_liberadas?.join(', ') || 'ninguna'}`);
      response.message = `Se liberaron ${data.reservas_liberadas} reservas vencidas`;
    } else {
      console.log('ℹ️  No hay mesas vencidas para liberar');
      response.message = "No hay mesas vencidas para liberar en este momento";
    }
    
    res.status(200).send(response);
  } catch (error) {
    console.error('💥 Error en endpoint de liberación manual:', error);
    res.status(500).send({ 
      error: `Error interno: ${error.message}`,
      success: false
    });
  }
});



const emailRoutes = require('./routes/email.routes');
const facturacionRoutes = require('./routes/facturacion.routes');

app.use('/api/email', emailRoutes);
app.use('/api/facturacion', facturacionRoutes);

async function sendNotificationToRole(role, title, body) {
  try {
    const { data: users, error } = await supabase
      .from(role === 'cliente' ? 'clientes' : role === 'supervisor' ? 'supervisores' : 'empleados')
      .select("fcm_token")
      .not("fcm_token", "is", null);

    if (error) {
      throw new Error(`Error fetching ${role}: ${error.message}`);
    }

    if (!users || users.length === 0) {
      console.log(`No ${role} found to notify.`);
      return { success: true, message: `No ${role} to notify.` };
    }

    const tokens = users.map(u => u.fcm_token).filter(t => t);

    if (tokens.length === 0) {
      console.log(`No valid FCM tokens found for ${role}.`);
      return { success: true, message: "No valid FCM tokens found." };
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Successfully sent message:", response);

    return { success: true, message: "Notification sent successfully.", response };
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
}

app.post("/notify-maitre-new-client", async (req, res) => {
  const { clienteNombre, clienteApellido } = req.body;
  
  try {
    const title = "Nuevo cliente registrado";
    const body = `${clienteNombre} ${clienteApellido || ''} se ha registrado y espera aprobación`;
    
    const result = await sendNotificationToRole('empleados', title, body);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-client-table-assigned", async (req, res) => {
  const { clienteEmail, mesaNumero, clienteNombre, clienteApellido } = req.body;
  
  try {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token")
      .eq("correo", clienteEmail)
      .single();

    if (cliente?.fcm_token) {
      const message = {
        notification: {
          title: "Mesa asignada",
          body: `Hola ${clienteNombre}, te hemos asignado la mesa ${mesaNumero}. ¡Disfruta tu experiencia!`
        },
        token: cliente.fcm_token,
      };

      await admin.messaging().send(message);
    }

    const { sendEmail } = require('./services/email.service');
    const emailResult = await sendEmail({
      to: clienteEmail,
      subject: "Mesa Asignada - Los Fritos Hermanos",
      text: `Hola ${clienteNombre}, te hemos asignado la mesa ${mesaNumero}. ¡Disfruta tu experiencia!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Tu mesa está lista!</h2>
          <p>Hola ${clienteNombre},</p>
          <p>Te confirmamos que te hemos asignado la <strong>mesa ${mesaNumero}</strong>.</p>
          <p>Detalles de tu asignación:</p>
          <ul>
            <li>Mesa: ${mesaNumero}</li>
            <li>Nombre: ${clienteNombre} ${clienteApellido}</li>
          </ul>
          <p>¡Esperamos que disfrutes tu experiencia en Los Fritos Hermanos!</p>
          <p>Si necesitas algo, no dudes en consultarnos.</p>
          <br>
          <p>Saludos,</p>
          <p>El equipo de Los Fritos Hermanos</p>
        </div>
      `
    });

    res.status(200).send({ 
      message: "Notification and email sent successfully.",
      emailResult
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: `Failed to send notifications: ${error.message}` });
  }
});

app.post("/notify-mozos-client-query", async (req, res) => {
  const { clienteNombre, clienteApellido, mesaNumero, consulta } = req.body;
  
  try {
    const title = "Consulta de cliente";
    const body = `${clienteNombre} ${clienteApellido} (Mesa ${mesaNumero}): ${consulta}`;
    
    const result = await sendNotificationToRole('empleados', title, body);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-bartender-new-order", async (req, res) => {
  const { mesaNumero, bebidas } = req.body;
  
  try {
    const title = "Nuevo pedido de bebidas";
    const body = `Mesa ${mesaNumero}: ${bebidas.join(', ')}`;
    
    const { data: bartenders, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "bartender")
      .not("fcm_token", "is", null);

    if (error || !bartenders?.length) {
      return res.status(200).send({ message: "No bartenders found" });
    }

    const tokens = bartenders.map(b => b.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-cocinero-new-order", async (req, res) => {
  const { mesaNumero, comidas, postres } = req.body;
  
  try {
    const items = [...(comidas || []), ...(postres || [])];
    const title = "Nuevo pedido de cocina";
    const body = `Mesa ${mesaNumero}: ${items.join(', ')}`;
    
    const { data: cocineros, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "cocinero")
      .not("fcm_token", "is", null);

    if (error || !cocineros?.length) {
      return res.status(200).send({ message: "No cocineros found" });
    }

    const tokens = cocineros.map(c => c.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-mozo-order-ready", async (req, res) => {
  const { mesaNumero, tipoProducto, productos, pedidoId } = req.body;
  
  try {
    const title = "Pedido listo para servir";
    const body = `Mesa ${mesaNumero}: ${tipoProducto} - ${productos.join(', ')}`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "mozo")
      .not("fcm_token", "is", null);

    if (error || !mozos?.length) {
      return res.status(200).send({ message: "No mozos found" });
    }

    const tokens = mozos.map(m => m.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-mozo-request-bill", async (req, res) => {
  const { mesaNumero, clienteNombre, clienteApellido } = req.body;
  
  try {
    const title = "Solicitud de cuenta";
    const body = `${clienteNombre} ${clienteApellido} (Mesa ${mesaNumero}) solicita la cuenta`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "mozo")
      .not("fcm_token", "is", null);

    if (error || !mozos?.length) {
      return res.status(200).send({ message: "No mozos found" });
    }

    const tokens = mozos.map(m => m.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
      data : {
        link : `/pedidos-mozo`
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-supervisors-new-client", async (req, res) => {
  const { clienteNombre, clienteApellido } = req.body;
  
  try {
    const title = "Nuevo cliente registrado";
    const body = `${clienteNombre} ${clienteApellido || ''} se ha registrado`;
    
    const result = await sendNotificationToRole('supervisor', title, body);
    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/clear-fcm-token", async (req, res) => {
  const { email } = req.body;
  
  try {
    // Intentar borrar el token de todas las tablas posibles
    const tables = ['clientes', 'empleados', 'supervisores'];
    
    for (const table of tables) {
      await supabase
        .from(table)
        .update({ fcm_token: null })
        .eq('correo', email);
    }
    
    res.status(200).send({ message: "FCM token cleared successfully" });
  } catch (error) {
    res.status(500).send({ error: `Failed to clear FCM token: ${error.message}` });
  }
});

app.post("/enviar-correo-rechazo", async (req, res) => {
  const { correo, nombre, apellido } = req.body;
  
  if (!correo || !nombre) {
    return res.status(400).send({ error: "Correo y nombre son requeridos." });
  }
  
  try {
    const { sendEmail } = require('./services/email.service');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Registro Rechazado - Los Fritos Hermanos</title>
          <style>
              body {
                  font-family: 'Arial', sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f4f4f4;
              }
              .container {
                  background-color: #ffffff;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                  text-align: center;
                  padding: 30px 20px;
                  background: linear-gradient(135deg, #B22222 0%, #8B0000 100%);
              }
              .logo {
                  width: 180px;
                  height: auto;
                  margin-bottom: 15px;
              }
              .header-title {
                  color: #FFD700;
                  font-size: 28px;
                  font-family: 'Georgia', serif;
                  margin: 0;
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
              }
              .content {
                  padding: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #B22222;
                  font-weight: bold;
                  margin-bottom: 20px;
              }
              .message {
                  font-size: 16px;
                  color: #333;
                  line-height: 1.8;
                  margin-bottom: 15px;
              }
              .reason-box {
                  background-color: #fff8dc;
                  border-left: 4px solid #B22222;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 5px;
              }
              .reason-title {
                  font-size: 17px;
                  color: #B22222;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .reason-list {
                  margin: 10px 0;
                  padding-left: 20px;
              }
              .reason-list li {
                  margin: 8px 0;
                  color: #555;
              }
              .contact-button {
                  display: inline-block;
                  padding: 12px 30px;
                  background: linear-gradient(135deg, #B22222 0%, #8B0000 100%);
                  color: #ffffff !important;
                  text-decoration: none;
                  border-radius: 25px;
                  margin-top: 20px;
                  font-weight: bold;
                  font-size: 16px;
                  box-shadow: 0 4px 8px rgba(178, 34, 34, 0.3);
                  transition: all 0.3s ease;
              }
              .contact-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 12px rgba(178, 34, 34, 0.4);
              }
              .button-container {
                  text-align: center;
                  margin-top: 25px;
              }
              .footer {
                  text-align: center;
                  font-size: 14px;
                  color: #666;
                  margin-top: 30px;
                  padding: 20px;
                  background-color: #f9f9f9;
                  border-top: 2px solid #B22222;
              }
              .footer-note {
                  font-size: 13px;
                  color: #999;
                  margin-top: 10px;
              }
              .logo-footer {
                  font-family: 'Georgia', serif;
                  color: #B22222;
                  font-weight: bold;
                  font-size: 16px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" alt="Los Fritos Hermanos Logo" class="logo">
                  <h1 class="header-title">Los Fritos Hermanos</h1>
              </div>
              
              <div class="content">
                  <p class="greeting">Estimado/a ${nombre} ${apellido || ''},</p>
                  
                  <p class="message">
                      Gracias por tu interés en registrarte en <strong>Los Fritos Hermanos</strong>. 
                      Lamentamos informarte que tu solicitud de registro ha sido <strong>rechazada</strong> en este momento.
                  </p>
                  
                  <div class="reason-box">
                      <p class="reason-title">📋 Motivos comunes de rechazo:</p>
                      <ul class="reason-list">
                          <li>Información incompleta o incorrecta en el formulario</li>
                          <li>Problemas con la documentación o fotografía proporcionada</li>
                          <li>Duplicidad de registro con una cuenta existente</li>
                          <li>No cumplimiento de los requisitos establecidos</li>
                      </ul>
                  </div>
                  
                  <p class="message">
                      Si deseas obtener más información sobre esta decisión o intentar registrarte nuevamente 
                      con la información correcta, no dudes en contactarnos a través de nuestros canales de atención al cliente.
                  </p>
                  
                  <div class="button-container">
                      <a href="mailto:soporte@fritoshermanos.com" class="contact-button">
                          📧 Contactar Soporte
                      </a>
                  </div>
              </div>
              
              <div class="footer">
                  <p class="logo-footer">🌮 Los Fritos Hermanos 🌮</p>
                  <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
                  <p class="footer-note">Este es un correo automático, por favor no responder directamente.</p>
              </div>
          </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail({
      to: correo,
      subject: '❌ Estado de tu Registro - Los Fritos Hermanos',
      text: `Estimado/a ${nombre} ${apellido || ''}, lamentamos informarte que tu solicitud de registro ha sido rechazada. Para más información, contacta con soporte@fritoshermanos.com`,
      html: htmlContent
    });
    
    res.status(200).send({ 
      success: true, 
      message: "Correo de rechazo enviado exitosamente",
      result 
    });
  } catch (error) {
    console.error("Error al enviar correo de rechazo:", error);
    res.status(500).send({ 
      error: `Error al enviar correo: ${error.message}` 
    });
  }
});

app.post("/enviar-correo-aceptacion", async (req, res) => {
  const { correo, nombre, apellido } = req.body;
  
  if (!correo || !nombre) {
    return res.status(400).send({ error: "Correo y nombre son requeridos." });
  }
  
  try {
    const { sendEmail } = require('./services/email.service');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Registro Aceptado - Los Fritos Hermanos</title>
          <style>
              body {
                  font-family: 'Arial', sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f4f4f4;
              }
              .container {
                  background-color: #ffffff;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                  text-align: center;
                  padding: 30px 20px;
                  background: linear-gradient(135deg, #228B22 0%, #006400 100%);
              }
              .logo {
                  width: 180px;
                  height: auto;
                  margin-bottom: 15px;
              }
              .header-title {
                  color: #FFD700;
                  font-size: 28px;
                  font-family: 'Georgia', serif;
                  margin: 0;
                  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
              }
              .content {
                  padding: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #228B22;
                  font-weight: bold;
                  margin-bottom: 20px;
              }
              .message {
                  font-size: 16px;
                  color: #333;
                  line-height: 1.8;
                  margin-bottom: 15px;
              }
              .success-box {
                  background-color: #f0fff0;
                  border-left: 4px solid #228B22;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 5px;
              }
              .success-title {
                  font-size: 17px;
                  color: #228B22;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .benefit-list {
                  margin: 10px 0;
                  padding-left: 20px;
              }
              .benefit-list li {
                  margin: 8px 0;
                  color: #555;
              }
              .access-button {
                  display: inline-block;
                  padding: 12px 30px;
                  background: linear-gradient(135deg, #228B22 0%, #006400 100%);
                  color: #ffffff !important;
                  text-decoration: none;
                  border-radius: 25px;
                  margin-top: 20px;
                  font-weight: bold;
                  font-size: 16px;
                  box-shadow: 0 4px 8px rgba(34, 139, 34, 0.3);
                  transition: all 0.3s ease;
              }
              .access-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 12px rgba(34, 139, 34, 0.4);
              }
              .button-container {
                  text-align: center;
                  margin-top: 25px;
              }
              .footer {
                  text-align: center;
                  font-size: 14px;
                  color: #666;
                  margin-top: 30px;
                  padding: 20px;
                  background-color: #f9f9f9;
                  border-top: 2px solid #228B22;
              }
              .footer-note {
                  font-size: 13px;
                  color: #999;
                  margin-top: 10px;
              }
              .logo-footer {
                  font-family: 'Georgia', serif;
                  color: #B22222;
                  font-weight: bold;
                  font-size: 16px;
              }
              .celebration {
                  font-size: 48px;
                  text-align: center;
                  margin: 20px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" alt="Los Fritos Hermanos Logo" class="logo">
                  <h1 class="header-title">Los Fritos Hermanos</h1>
              </div>
              
              <div class="content">
                  <div class="celebration">🎉</div>
                  <p class="greeting">¡Felicitaciones ${nombre} ${apellido || ''}!</p>
                  
                  <p class="message">
                      Nos complace informarte que tu solicitud de registro en <strong>Los Fritos Hermanos</strong> 
                      ha sido <strong>ACEPTADA</strong> exitosamente.
                  </p>
                  
                  <div class="success-box">
                      <p class="success-title">✅ Ahora puedes disfrutar de:</p>
                      <ul class="benefit-list">
                          <li>Acceso completo a nuestra aplicación</li>
                          <li>Reservar mesas en cualquier momento</li>
                          <li>Ver nuestro menú completo y hacer pedidos</li>
                          <li>Recibir notificaciones sobre tus reservas</li>
                          <li>Disfrutar de la mejor experiencia gastronómica</li>
                      </ul>
                  </div>
                  
                  <p class="message">
                      Ya puedes iniciar sesión en la aplicación con tu correo electrónico y comenzar a disfrutar 
                      de todos los servicios que <strong>Los Fritos Hermanos</strong> tiene para ofrecerte.
                  </p>
                  
                  <p class="message">
                      ¡Te esperamos pronto en nuestro restaurante! 🌮
                  </p>
                  
                  <div class="button-container">
                      <a href="#" class="access-button">
                          🍽️ Iniciar Sesión Ahora
                      </a>
                  </div>
              </div>
              
              <div class="footer">
                  <p class="logo-footer">🌮 Los Fritos Hermanos 🌮</p>
                  <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
                  <p class="footer-note">Este es un correo automático, por favor no responder directamente.</p>
              </div>
          </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail({
      to: correo,
      subject: '✅ ¡Bienvenido a Los Fritos Hermanos! Registro Aceptado',
      text: `¡Felicitaciones ${nombre} ${apellido || ''}! Tu solicitud de registro en Los Fritos Hermanos ha sido aceptada. Ya puedes iniciar sesión en la aplicación y disfrutar de todos nuestros servicios.`,
      html: htmlContent
    });
    
    res.status(200).send({ 
      success: true, 
      message: "Correo de aceptación enviado exitosamente",
      result 
    });
  } catch (error) {
    console.error("Error al enviar correo de aceptación:", error);
    res.status(500).send({ 
      error: `Error al enviar correo: ${error.message}` 
    });
  }
});


app.post("/notify-payment-success", async (req, res) => {
  // Recibimos el número de mesa y el monto del body de la petición
  const { mesaNumero, montoTotal } = req.body;

  if (!mesaNumero || !montoTotal) {
    return res.status(400).send({ error: "El número de mesa y el monto son requeridos." });
  }

  try {
    const title = '💵 Pago Recibido';
    const body = `Se registró un pago de $${montoTotal} para la Mesa #${mesaNumero}.`;

    // 1. Obtener tokens de Supervisores y Dueños
    const { data: staffSuperior, error: staffError } = await supabase
      .from("supervisores")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    // 2. Obtener tokens de Mozos
    const { data: mozos, error: mozosError } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "mozo")
      .not("fcm_token", "is", null);

    if (staffError || mozosError) {
      console.error("Error al buscar tokens:", staffError || mozosError);
      throw new Error("Error en la base de datos al buscar destinatarios.");
    }
    
    // 3. Juntar todos los tokens en una sola lista, evitando duplicados
    const tokensSuperiores = staffSuperior?.map(s => s.fcm_token) || [];
    const tokensMozos = mozos?.map(m => m.fcm_token) || [];
    const allTokens = [...new Set([...tokensSuperiores, ...tokensMozos])];

    if (allTokens.length === 0) {
      console.log("No se encontraron tokens válidos para notificar el pago.");
      return res.status(200).send({ message: "No se encontraron usuarios para notificar." });
    }

    // 4. Preparar y enviar la notificación
    const message = {
      notification: { title, body },
      tokens: allTokens,
      data : {
        link : `/pedidos-mozo`
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Notificación de pago enviada con éxito:", response);

    res.status(200).send({ message: "Notificación de pago enviada con éxito.", response });

  } catch (error) {
    console.error("Error en /notify-payment-success:", error);
    res.status(500).send({ error: `Falló el envío de la notificación de pago: ${error.message}` });
  }
});

// ============================================
// ENDPOINTS DE PRUEBA Y VERIFICACIÓN
// ============================================

/**
 * Endpoint para verificar tokens FCM en la base de datos
 * GET /test-fcm-tokens?role=cliente|empleado|supervisor
 */
app.get("/test-fcm-tokens", async (req, res) => {
  try {
    const { role } = req.query;
    
    let tableName = 'clientes';
    let selectFields = "correo, nombre, apellido, fcm_token";
    
    if (role === 'empleado') {
      tableName = 'empleados';
      selectFields = "correo, nombre, apellido, fcm_token, perfil";
    } else if (role === 'supervisor') {
      tableName = 'supervisores';
      selectFields = "correo, nombre, apellido, fcm_token";
    }
    
    const { data, error } = await supabase
      .from(tableName)
      .select(selectFields)
      .not("fcm_token", "is", null);
    
    if (error) {
      throw error;
    }
    
    res.status(200).send({
      role: role || 'cliente',
      table: tableName,
      count: data?.length || 0,
      tokens: data?.map(u => ({
        email: u.correo,
        name: `${u.nombre || ''} ${u.apellido || ''}`.trim(),
        perfil: u.perfil || (role === 'cliente' ? 'cliente' : 'N/A'),
        hasToken: !!u.fcm_token,
        tokenLength: u.fcm_token?.length || 0,
        tokenPreview: u.fcm_token ? `${u.fcm_token.substring(0, 20)}...` : 'N/A'
      })) || []
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

/**
 * Endpoint para probar notificación a un token FCM específico
 * POST /test-notification
 * Body: { token: "FCM_TOKEN", title: "Título", body: "Mensaje" }
 */
app.post("/test-notification", async (req, res) => {
  try {
    const { token, title, body } = req.body;
    
    if (!token || !title || !body) {
      return res.status(400).send({ 
        error: "token, title y body son requeridos",
        example: {
          token: "TU_TOKEN_FCM_AQUI",
          title: "Prueba de Notificación",
          body: "Esta es una notificación de prueba"
        }
      });
    }
    
    const message = {
      notification: { title, body },
      token: token,
    };
    
    const response = await admin.messaging().send(message);
    
    res.status(200).send({ 
      success: true, 
      message: "Notification sent successfully.",
      messageId: response
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).send({ 
      error: `Failed to send notification: ${error.message}`,
      details: error.code || 'Unknown error'
    });
  }
});

/**
 * Endpoint para probar notificación a un email específico
 * POST /test-notification-by-email
 * Body: { email: "user@example.com", title: "Título", body: "Mensaje", role: "cliente|empleado|supervisor" }
 */
app.post("/test-notification-by-email", async (req, res) => {
  try {
    const { email, title, body, role } = req.body;
    
    if (!email || !title || !body) {
      return res.status(400).send({ 
        error: "email, title y body son requeridos",
        optional: "role (cliente|empleado|supervisor)"
      });
    }
    
    let tableName = 'clientes';
    if (role === 'empleado') tableName = 'empleados';
    else if (role === 'supervisor') tableName = 'supervisores';
    
    // Buscar el usuario por email
    const { data: user, error } = await supabase
      .from(tableName)
      .select("correo, nombre, apellido, fcm_token")
      .eq("correo", email)
      .single();
    
    if (error || !user) {
      return res.status(404).send({ 
        error: `Usuario no encontrado en la tabla ${tableName}`,
        email: email
      });
    }
    
    if (!user.fcm_token) {
      return res.status(400).send({ 
        error: "El usuario no tiene un token FCM registrado",
        email: email,
        suggestion: "Inicia sesión en la app móvil para registrar el token FCM"
      });
    }
    
    const message = {
      notification: { title, body },
      token: user.fcm_token,
    };
    
    const response = await admin.messaging().send(message);
    
    res.status(200).send({ 
      success: true, 
      message: "Notification sent successfully.",
      user: {
        email: user.correo,
        name: `${user.nombre || ''} ${user.apellido || ''}`.trim()
      },
      messageId: response
    });
  } catch (error) {
    console.error("Error sending test notification by email:", error);
    res.status(500).send({ 
      error: `Failed to send notification: ${error.message}`,
      details: error.code || 'Unknown error'
    });
  }
});

// ============================================
// ENDPOINTS DE RESERVAS
// ============================================

/**
 * Notifica a dueños y supervisores sobre una nueva reserva
 * POST /notify-new-reservation
 */
app.post("/notify-new-reservation", async (req, res) => {
  try {
    const { reservaId, clienteNombre, clienteApellido, fechaReserva, horaReserva, cantidadComensales } = req.body;
    
    if (!reservaId || !clienteNombre || !fechaReserva || !horaReserva) {
      return res.status(400).send({ 
        error: "reservaId, clienteNombre, fechaReserva y horaReserva son requeridos" 
      });
    }

    const title = "📅 Nueva Reserva Solicitada";
    const body = `${clienteNombre} ${clienteApellido || ''} - ${fechaReserva} a las ${horaReserva} (${cantidadComensales} comensales)`;

    // Obtener tokens de supervisores y dueños
    const { data: staffSuperior, error: staffError } = await supabase
      .from("supervisores")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    if (staffError) {
      console.error("Error al buscar tokens de supervisores y dueños:", staffError);
      throw new Error("Error en la base de datos al buscar destinatarios.");
    }
    
    const tokensSuperiores = staffSuperior?.map(s => s.fcm_token) || [];

    if (tokensSuperiores.length === 0) {
      console.log("No se encontraron tokens válidos para notificar la reserva.");
      return res.status(200).send({ message: "No se encontraron usuarios para notificar." });
    }

    // Preparar y enviar la notificación
    const message = {
      notification: { title, body },
      tokens: tokensSuperiores,
      data: {
        link: '/gestionar-reservas',
        reservaId: reservaId.toString()
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Notificación de nueva reserva enviada con éxito:", response);

    res.status(200).send({ 
      message: "Notificación de nueva reserva enviada con éxito.", 
      response 
    });

  } catch (error) {
    console.error("Error en /notify-new-reservation:", error);
    res.status(500).send({ 
      error: `Falló el envío de la notificación: ${error.message}` 
    });
  }
});

/**
 * Notifica a dueños y supervisores sobre un nuevo pedido delivery
 * POST /notify-new-delivery
 */
app.post("/notify-new-delivery", async (req, res) => {
  try {
    const { pedidoId, clienteNombre, direccion, precioTotal } = req.body;
    
    if (!pedidoId || !clienteNombre || !direccion) {
      return res.status(400).send({ 
        error: "pedidoId, clienteNombre y direccion son requeridos" 
      });
    }

    const title = "🚴 Nuevo Pedido Delivery";
    const precioFormateado = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precioTotal || 0);
    const body = `${clienteNombre} - ${direccion} - Total: ${precioFormateado}`;

    // Obtener tokens de supervisores y dueños
    const { data: staffSuperior, error: staffError } = await supabase
      .from("supervisores")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    if (staffError) {
      console.error("Error al buscar tokens de supervisores y dueños:", staffError);
      throw new Error("Error en la base de datos al buscar destinatarios.");
    }
    
    const tokensSuperiores = staffSuperior?.map(s => s.fcm_token) || [];

    if (tokensSuperiores.length === 0) {
      console.log("No se encontraron tokens válidos para notificar el pedido delivery.");
      return res.status(200).send({ message: "No se encontraron usuarios para notificar." });
    }

    // Preparar y enviar la notificación
    const message = {
      notification: { title, body },
      tokens: tokensSuperiores,
      data: {
        link: '/gestionar-delivery',
        pedidoId: pedidoId.toString()
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Notificación de nuevo pedido delivery enviada con éxito:", response);

    res.status(200).send({ 
      message: "Notificación de nuevo pedido delivery enviada con éxito.", 
      response 
    });

  } catch (error) {
    console.error("Error en /notify-new-delivery:", error);
    res.status(500).send({ 
      error: `Falló el envío de la notificación: ${error.message}` 
    });
  }
});

/**
 * Notifica al cliente sobre el cambio de estado de su pedido delivery
 * POST /notify-client-delivery-status
 */
app.post("/notify-client-delivery-status", async (req, res) => {
  try {
    const { clienteEmail, pedidoId, estado, tiempoEstimado, motivo } = req.body;
    
    if (!clienteEmail || !pedidoId || !estado) {
      return res.status(400).send({ 
        error: "clienteEmail, pedidoId y estado son requeridos" 
      });
    }

    // Obtener token FCM del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("fcm_token, nombre, apellido")
      .eq("correo", clienteEmail)
      .single();

    if (clienteError || !cliente) {
      console.error("Error al buscar cliente:", clienteError);
      return res.status(404).send({ error: "Cliente no encontrado" });
    }

    if (!cliente.fcm_token) {
      console.log("Cliente no tiene token FCM registrado");
      return res.status(200).send({ message: "Cliente no tiene notificaciones habilitadas" });
    }

    // Construir mensaje según el estado
    let title = "";
    let body = "";

    if (estado === 'confirmado') {
      title = "✅ Pedido Confirmado";
      body = `Tu pedido #${pedidoId} ha sido confirmado. Tiempo estimado: ${tiempoEstimado} minutos.`;
    } else if (estado === 'rechazado') {
      title = "❌ Pedido Rechazado";
      body = `Lo sentimos, tu pedido #${pedidoId} ha sido rechazado. Motivo: ${motivo || 'No especificado'}`;
    } else if (estado === 'preparando') {
      title = "🍳 Pedido en Preparación";
      body = `Tu pedido #${pedidoId} está siendo preparado. ¡Pronto estará listo!`;
    } else if (estado === 'en_camino') {
      title = "🚴 Pedido en Camino";
      body = `Tu pedido #${pedidoId} está en camino. ¡Llegará pronto!`;
    } else if (estado === 'entregado') {
      title = "✅ Pedido Entregado";
      body = `Tu pedido #${pedidoId} ha sido entregado. ¡Que lo disfrutes!`;
    }

    // Enviar notificación
    const message = {
      notification: { title, body },
      token: cliente.fcm_token,
      data: {
        link: '/home',
        pedidoId: pedidoId.toString(),
        estado: estado
      }
    };

    const response = await admin.messaging().send(message);
    console.log("Notificación de estado de pedido enviada al cliente:", response);

    res.status(200).send({ 
      message: "Notificación enviada al cliente exitosamente", 
      response 
    });

  } catch (error) {
    console.error("Error en /notify-client-delivery-status:", error);
    res.status(500).send({ 
      error: `Falló el envío de la notificación: ${error.message}` 
    });
  }
});

/**
 * Envía correo de confirmación cuando se aprueba una reserva
 * POST /enviar-correo-reserva-aprobada
 */
app.post("/enviar-correo-reserva-aprobada", async (req, res) => {
  const { correo, nombre, apellido, fechaReserva, horaReserva, cantidadComensales, mesaNumero } = req.body;
  
  if (!correo || !nombre || !fechaReserva || !horaReserva) {
    return res.status(400).send({ error: "Correo, nombre, fechaReserva y horaReserva son requeridos." });
  }
  
  try {
    const { sendEmail } = require('./services/email.service');
    
    // Formatear fecha
    const fechaFormateada = new Date(fechaReserva).toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Reserva Confirmada - Los Fritos Hermanos</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
              
              body {
                  font-family: 'Poppins', sans-serif;
                  line-height: 1.8;
                  color: #2c3e50;
                  max-width: 650px;
                  margin: 0 auto;
                  padding: 20px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                  background-color: #ffffff;
                  border-radius: 20px;
                  overflow: hidden;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              }
              .header {
                  text-align: center;
                  padding: 40px 20px;
                  background: linear-gradient(135deg, #228B22 0%, #32CD32 100%);
                  position: relative;
              }
              .logo {
                  width: 200px;
                  height: auto;
                  margin-bottom: 20px;
                  border-radius: 15px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
              }
              .header-title {
                  color: #FFD700;
                  font-size: 32px;
                  font-family: 'Playfair Display', serif;
                  margin: 0;
                  text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
                  font-weight: 700;
                  letter-spacing: 1px;
              }
              .celebration {
                  font-size: 60px;
                  margin: 20px 0;
              }
              .content {
                  padding: 40px 30px;
              }
              .greeting {
                  font-size: 22px;
                  color: #228B22;
                  font-weight: 700;
                  margin-bottom: 25px;
                  font-family: 'Playfair Display', serif;
              }
              .message {
                  font-size: 16px;
                  color: #34495e;
                  line-height: 2;
                  margin-bottom: 20px;
              }
              .success-box {
                  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
                  border-left: 6px solid #228B22;
                  padding: 25px;
                  margin: 30px 0;
                  border-radius: 12px;
                  box-shadow: 0 4px 10px rgba(34, 139, 34, 0.2);
              }
              .reservation-details {
                  background-color: #f8f9fa;
                  border-radius: 12px;
                  padding: 25px;
                  margin: 25px 0;
                  border: 2px solid #228B22;
              }
              .detail-item {
                  display: flex;
                  align-items: center;
                  margin: 15px 0;
                  font-size: 17px;
                  color: #2c3e50;
              }
              .detail-icon {
                  font-size: 24px;
                  margin-right: 15px;
                  color: #228B22;
                  width: 30px;
                  text-align: center;
              }
              .detail-label {
                  font-weight: 700;
                  color: #228B22;
                  margin-right: 10px;
                  min-width: 140px;
              }
              .detail-value {
                  color: #2c3e50;
                  font-weight: 600;
              }
              .footer {
                  text-align: center;
                  font-size: 14px;
                  color: #7f8c8d;
                  margin-top: 40px;
                  padding: 30px;
                  background-color: #ecf0f1;
                  border-top: 3px solid #228B22;
              }
              .footer-note {
                  font-size: 13px;
                  color: #95a5a6;
                  margin-top: 15px;
                  font-style: italic;
              }
              .logo-footer {
                  font-family: 'Playfair Display', serif;
                  color: #228B22;
                  font-weight: 700;
                  font-size: 20px;
                  margin-bottom: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" alt="Los Fritos Hermanos Logo" class="logo">
                  <h1 class="header-title">Los Fritos Hermanos</h1>
                  <div class="celebration">✅</div>
              </div>
              
              <div class="content">
                  <p class="greeting">¡Reserva Confirmada, ${nombre} ${apellido || ''}!</p>
                  
                  <p class="message">
                      Nos complace informarte que tu reserva ha sido <strong style="color: #228B22; font-size: 18px;">CONFIRMADA</strong> exitosamente.
                  </p>
                  
                  <div class="success-box">
                      <p style="font-size: 19px; color: #228B22; font-weight: 700; margin: 0; text-align: center;">
                          🎉 ¡Tu mesa está reservada! 🎉
                      </p>
                  </div>
                  
                  <div class="reservation-details">
                      <h3 style="color: #228B22; font-family: 'Playfair Display', serif; font-size: 24px; margin-top: 0; margin-bottom: 20px; text-align: center;">
                          Detalles de tu Reserva
                      </h3>
                      
                      <div class="detail-item">
                          <span class="detail-icon">📅</span>
                          <span class="detail-label">Fecha:</span>
                          <span class="detail-value">${fechaFormateada}</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="detail-icon">🕐</span>
                          <span class="detail-label">Hora:</span>
                          <span class="detail-value">${horaReserva}</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="detail-icon">👥</span>
                          <span class="detail-label">Comensales:</span>
                          <span class="detail-value">${cantidadComensales} ${cantidadComensales === 1 ? 'persona' : 'personas'}</span>
                      </div>
                      
                      ${mesaNumero ? `
                      <div class="detail-item">
                          <span class="detail-icon">🪑</span>
                          <span class="detail-label">Mesa Asignada:</span>
                          <span class="detail-value" style="color: #228B22; font-size: 20px; font-weight: 700;">Mesa #${mesaNumero}</span>
                      </div>
                      ` : ''}
                  </div>
                  
                  <p class="message" style="text-align: center; font-size: 18px; color: #228B22; font-weight: 600;">
                      ¡Te esperamos en Los Fritos Hermanos!
                  </p>
                  
                  <p class="message">
                      Si necesitas modificar o cancelar tu reserva, por favor contáctanos con al menos 24 horas de anticipación.
                  </p>
              </div>
              
              <div class="footer">
                  <p class="logo-footer">🌮 Los Fritos Hermanos 🌮</p>
                  <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
                  <p class="footer-note">Este es un correo automático, por favor no responder directamente.</p>
              </div>
          </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail({
      to: correo,
      subject: '✅ Reserva Confirmada - Los Fritos Hermanos',
      text: `¡Hola ${nombre}! Tu reserva para el ${fechaFormateada} a las ${horaReserva} ha sido confirmada. ${mesaNumero ? `Mesa asignada: #${mesaNumero}` : ''} ¡Te esperamos!`,
      html: htmlContent
    });
    
    res.status(200).send({ 
      success: true, 
      message: "Correo de confirmación de reserva enviado exitosamente",
      result 
    });
  } catch (error) {
    console.error("Error al enviar correo de confirmación de reserva:", error);
    res.status(500).send({ 
      error: `Error al enviar correo: ${error.message}` 
    });
  }
});

/**
 * Envía correo de rechazo cuando se rechaza una reserva
 * POST /enviar-correo-reserva-rechazada
 */
app.post("/enviar-correo-reserva-rechazada", async (req, res) => {
  const { correo, nombre, apellido, fechaReserva, horaReserva, motivo } = req.body;
  
  if (!correo || !nombre || !fechaReserva || !horaReserva || !motivo) {
    return res.status(400).send({ error: "Correo, nombre, fechaReserva, horaReserva y motivo son requeridos." });
  }
  
  try {
    const { sendEmail } = require('./services/email.service');
    
    // Formatear fecha
    const fechaFormateada = new Date(fechaReserva).toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Reserva Rechazada - Los Fritos Hermanos</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Playfair+Display:wght@700&display=swap');
              
              body {
                  font-family: 'Poppins', sans-serif;
                  line-height: 1.8;
                  color: #2c3e50;
                  max-width: 650px;
                  margin: 0 auto;
                  padding: 20px;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              }
              .container {
                  background-color: #ffffff;
                  border-radius: 20px;
                  overflow: hidden;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              }
              .header {
                  text-align: center;
                  padding: 40px 20px;
                  background: linear-gradient(135deg, #B22222 0%, #8B0000 100%);
                  position: relative;
              }
              .logo {
                  width: 200px;
                  height: auto;
                  margin-bottom: 20px;
                  border-radius: 15px;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
              }
              .header-title {
                  color: #FFD700;
                  font-size: 32px;
                  font-family: 'Playfair Display', serif;
                  margin: 0;
                  text-shadow: 3px 3px 6px rgba(0,0,0,0.4);
                  font-weight: 700;
                  letter-spacing: 1px;
              }
              .content {
                  padding: 40px 30px;
              }
              .greeting {
                  font-size: 22px;
                  color: #B22222;
                  font-weight: 700;
                  margin-bottom: 25px;
                  font-family: 'Playfair Display', serif;
              }
              .message {
                  font-size: 16px;
                  color: #34495e;
                  line-height: 2;
                  margin-bottom: 20px;
              }
              .rejection-box {
                  background: linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%);
                  border-left: 6px solid #B22222;
                  padding: 25px;
                  margin: 30px 0;
                  border-radius: 12px;
                  box-shadow: 0 4px 10px rgba(178, 34, 34, 0.2);
              }
              .reservation-details {
                  background-color: #f8f9fa;
                  border-radius: 12px;
                  padding: 25px;
                  margin: 25px 0;
                  border: 2px solid #B22222;
              }
              .detail-item {
                  display: flex;
                  align-items: center;
                  margin: 15px 0;
                  font-size: 17px;
                  color: #2c3e50;
              }
              .detail-icon {
                  font-size: 24px;
                  margin-right: 15px;
                  color: #B22222;
                  width: 30px;
                  text-align: center;
              }
              .detail-label {
                  font-weight: 700;
                  color: #B22222;
                  margin-right: 10px;
                  min-width: 140px;
              }
              .detail-value {
                  color: #2c3e50;
                  font-weight: 600;
              }
              .motivo-box {
                  background-color: #fff8dc;
                  border: 2px solid #B22222;
                  border-radius: 12px;
                  padding: 20px;
                  margin: 25px 0;
              }
              .motivo-title {
                  font-size: 18px;
                  color: #B22222;
                  font-weight: 700;
                  margin-bottom: 15px;
                  font-family: 'Playfair Display', serif;
              }
              .motivo-text {
                  font-size: 16px;
                  color: #555;
                  line-height: 1.8;
                  font-style: italic;
              }
              .footer {
                  text-align: center;
                  font-size: 14px;
                  color: #7f8c8d;
                  margin-top: 40px;
                  padding: 30px;
                  background-color: #ecf0f1;
                  border-top: 3px solid #B22222;
              }
              .footer-note {
                  font-size: 13px;
                  color: #95a5a6;
                  margin-top: 15px;
                  font-style: italic;
              }
              .logo-footer {
                  font-family: 'Playfair Display', serif;
                  color: #B22222;
                  font-weight: 700;
                  font-size: 20px;
                  margin-bottom: 10px;
              }
              .contact-button {
                  display: inline-block;
                  padding: 15px 35px;
                  background: linear-gradient(135deg, #B22222 0%, #8B0000 100%);
                  color: #ffffff !important;
                  text-decoration: none;
                  border-radius: 25px;
                  margin-top: 20px;
                  font-weight: 700;
                  font-size: 16px;
                  box-shadow: 0 4px 15px rgba(178, 34, 34, 0.4);
                  transition: all 0.3s ease;
              }
              .contact-button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 6px 20px rgba(178, 34, 34, 0.5);
              }
              .button-container {
                  text-align: center;
                  margin-top: 30px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <img src="https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/FritosHermanos.jpg" alt="Los Fritos Hermanos Logo" class="logo">
                  <h1 class="header-title">Los Fritos Hermanos</h1>
              </div>
              
              <div class="content">
                  <p class="greeting">Estimado/a ${nombre} ${apellido || ''},</p>
                  
                  <p class="message">
                      Lamentamos informarte que tu solicitud de reserva para el <strong>${fechaFormateada} a las ${horaReserva}</strong> 
                      ha sido <strong style="color: #B22222; font-size: 18px;">RECHAZADA</strong>.
                  </p>
                  
                  <div class="rejection-box">
                      <p style="font-size: 19px; color: #B22222; font-weight: 700; margin: 0; text-align: center;">
                          ❌ Reserva No Disponible
                      </p>
                  </div>
                  
                  <div class="reservation-details">
                      <h3 style="color: #B22222; font-family: 'Playfair Display', serif; font-size: 24px; margin-top: 0; margin-bottom: 20px; text-align: center;">
                          Detalles de la Reserva Solicitada
                      </h3>
                      
                      <div class="detail-item">
                          <span class="detail-icon">📅</span>
                          <span class="detail-label">Fecha:</span>
                          <span class="detail-value">${fechaFormateada}</span>
                      </div>
                      
                      <div class="detail-item">
                          <span class="detail-icon">🕐</span>
                          <span class="detail-label">Hora:</span>
                          <span class="detail-value">${horaReserva}</span>
                      </div>
                  </div>
                  
                  <div class="motivo-box">
                      <p class="motivo-title">📋 Motivo del Rechazo:</p>
                      <p class="motivo-text">"${motivo}"</p>
                  </div>
                  
                  <p class="message">
                      Si deseas realizar una nueva reserva o tienes alguna consulta, no dudes en contactarnos. 
                      Estaremos encantados de ayudarte a encontrar una fecha y hora alternativa.
                  </p>
                  
                  <div class="button-container">
                      <a href="mailto:reservas@fritoshermanos.com" class="contact-button">
                          📧 Contactar para Nueva Reserva
                      </a>
                  </div>
                  
                  <p class="message" style="text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 14px;">
                      Esperamos poder atenderte en otra ocasión.
                  </p>
              </div>
              
              <div class="footer">
                  <p class="logo-footer">🌮 Los Fritos Hermanos 🌮</p>
                  <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
                  <p class="footer-note">Este es un correo automático, por favor no responder directamente.</p>
              </div>
          </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail({
      to: correo,
      subject: '❌ Reserva Rechazada - Los Fritos Hermanos',
      text: `Estimado/a ${nombre}, lamentamos informarte que tu reserva para el ${fechaFormateada} a las ${horaReserva} ha sido rechazada. Motivo: ${motivo}. Si deseas realizar una nueva reserva, contáctanos.`,
      html: htmlContent
    });
    
    res.status(200).send({ 
      success: true, 
      message: "Correo de rechazo de reserva enviado exitosamente",
      result 
    });
  } catch (error) {
    console.error("Error al enviar correo de rechazo de reserva:", error);
    res.status(500).send({ 
      error: `Error al enviar correo: ${error.message}` 
    });
  }
});





// Endpoint para notificar al repartidor de un nuevo pedido asignado
app.post("/notify-repartidor-pedido", async (req, res) => {
  try {
    const { repartidorEmail, pedidoId, clienteNombre, direccion } = req.body;
    
    if (!repartidorEmail || !pedidoId) {
      return res.status(400).send({ 
        error: "repartidorEmail y pedidoId son requeridos" 
      });
    }

    // Obtener token FCM del repartidor
    const { data: repartidor, error: repartidorError } = await supabase
      .from("repartidores")
      .select("fcm_token, nombre, apellido")
      .eq("correo", repartidorEmail)
      .single();

    if (repartidorError || !repartidor) {
      console.error("Error al buscar repartidor:", repartidorError);
      return res.status(404).send({ error: "Repartidor no encontrado" });
    }

    if (!repartidor.fcm_token) {
      console.log("Repartidor no tiene token FCM registrado");
      return res.status(200).send({ message: "Repartidor no tiene notificaciones habilitadas" });
    }

    // Construir mensaje de notificación
    const title = "🚴 Nuevo Pedido Asignado";
    const body = `Tienes un nuevo pedido #${pedidoId} para entregar a ${clienteNombre || 'cliente'}. Dirección: ${direccion || 'Ver en app'}`;

    // Enviar notificación
    const message = {
      notification: { title, body },
      token: repartidor.fcm_token,
      data: {
        link: '/panel-repartidor',
        pedidoId: pedidoId.toString(),
        tipo: 'nuevo_pedido'
      }
    };

    const response = await admin.messaging().send(message);
    console.log("Notificación enviada al repartidor:", response);

    res.status(200).send({ 
      message: "Notificación enviada al repartidor exitosamente", 
      response 
    });

  } catch (error) {
    console.error("Error en /notify-repartidor-pedido:", error);
    res.status(500).send({ 
      error: `Falló el envío de la notificación: ${error.message}` 
    });
  }
});

// Endpoint para generar y enviar boleta de delivery en PDF
app.post("/generar-boleta-delivery", async (req, res) => {
  try {
    const { pedidoId, propina } = req.body;
    
    if (!pedidoId) {
      return res.status(400).send({ error: "pedidoId es requerido" });
    }

    // Obtener información del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_delivery")
      .select("*")
      .eq("id", pedidoId)
      .single();

    if (pedidoError || !pedido) {
      console.error("Error al obtener pedido:", pedidoError);
      return res.status(404).send({ error: "Pedido no encontrado" });
    }

    // Crear PDF
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    // Buffer para almacenar el PDF
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    
    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);

      // Header
      doc.fontSize(20)
         .fillColor('#E53E3E')
         .text('🌮 LOS FRITOS HERMANOS 🌮', { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(16)
         .fillColor('#333')
         .text('BOLETA DE DELIVERY', { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(10)
         .fillColor('#666')
         .text(`Fecha: ${new Date(pedido.created_at).toLocaleString('es-AR')}`, { align: 'center' });
      doc.text(`Pedido N°: ${pedido.id}`, { align: 'center' });
      
      // Línea separadora
      doc.moveDown();
      doc.strokeColor('#E53E3E')
         .lineWidth(2)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown();

      // Datos del cliente
      doc.fontSize(12)
         .fillColor('#333')
         .text('DATOS DEL CLIENTE', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10)
         .fillColor('#666')
         .text(`Nombre: ${pedido.cliente_nombre}`);
      doc.text(`Teléfono: ${pedido.cliente_telefono || 'No especificado'}`);
      doc.text(`Dirección: ${pedido.direccion_completa}`);
      
      doc.moveDown();

      // Detalles del pedido
      doc.fontSize(12)
         .fillColor('#333')
         .text('DETALLE DEL PEDIDO', { underline: true });
      doc.moveDown(0.5);

      // Función para formatear precio
      const formatearPrecio = (precio) => {
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'ARS'
        }).format(precio);
      };

      // Productos
      const productos = [
        ...(pedido.comidas || []),
        ...(pedido.bebidas || []),
        ...(pedido.postres || [])
      ];

      doc.fontSize(10).fillColor('#666');
      productos.forEach(producto => {
        doc.text(
          `${producto.cantidad}x ${producto.nombre} - ${formatearPrecio(producto.precio * producto.cantidad)}`
        );
      });

      doc.moveDown();

      // Resumen de costos
      doc.strokeColor('#ccc')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown(0.5);

      const subtotal = pedido.precio_productos;
      const costoEnvio = pedido.precio_envio || 0;
      const propinaFinal = propina || 0;
      const total = subtotal + costoEnvio + propinaFinal;

      doc.fontSize(11).fillColor('#333');
      doc.text(`Subtotal: ${formatearPrecio(subtotal)}`, { align: 'right' });
      doc.text(`Costo de Envío: ${formatearPrecio(costoEnvio)}`, { align: 'right' });
      
      if (propinaFinal > 0) {
        doc.fillColor('#38A169')
           .text(`Propina: ${formatearPrecio(propinaFinal)}`, { align: 'right' });
      }

      doc.moveDown(0.5);
      doc.strokeColor('#E53E3E')
         .lineWidth(2)
         .moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown(0.5);

      doc.fontSize(14)
         .fillColor('#E53E3E')
         .text(`TOTAL: ${formatearPrecio(total)}`, { align: 'right' });

      doc.moveDown(2);

      // Footer
      doc.fontSize(10)
         .fillColor('#666')
         .text('¡Gracias por tu compra!', { align: 'center' });
      doc.text('Los Fritos Hermanos - Tu comida favorita', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8)
         .fillColor('#999')
         .text('www.fritoshermanos.com | Tel: (011) 1234-5678', { align: 'center' });

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    // Enviar por correo
    const { sendEmail } = require('./services/email.service');
    
    await sendEmail({
      to: pedido.cliente_email,
      subject: `📋 Boleta de Delivery - Pedido #${pedido.id} - Los Fritos Hermanos`,
      text: `Adjunto encontrarás la boleta de tu pedido #${pedido.id}. Total: ${formatearPrecio(total)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #E53E3E 0%, #F4C451 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🌮 Los Fritos Hermanos 🌮</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">¡Gracias por tu pedido!</h2>
            
            <p style="color: #666; font-size: 16px;">
              Estimado/a <strong>${pedido.cliente_nombre}</strong>,
            </p>
            
            <p style="color: #666; font-size: 16px;">
              Adjunto encontrarás la boleta de tu pedido #${pedido.id}.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #E53E3E;">
              <p style="margin: 5px 0; color: #333;"><strong>Pedido:</strong> #${pedido.id}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Dirección:</strong> ${pedido.direccion_completa}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Total:</strong> ${formatearPrecio(total)}</p>
            </div>
            
            ${propinaFinal > 0 ? `
              <p style="color: #38A169; font-weight: bold; text-align: center; font-size: 18px;">
                ¡Gracias por dejar ${formatearPrecio(propinaFinal)} de propina! 🙏
              </p>
            ` : ''}
            
            <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
              Esperamos que hayas disfrutado tu comida.<br>
              ¡Hasta la próxima!
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
            <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
            <p>Este es un correo automático, por favor no responder.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          content: pdfBuffer.toString('base64'),
          filename: `boleta-pedido-${pedido.id}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    });

    res.status(200).send({ 
      success: true, 
      message: "Boleta generada y enviada por correo exitosamente" 
    });

  } catch (error) {
    console.error("Error en /generar-boleta-delivery:", error);
    res.status(500).send({ 
      error: `Error al generar boleta: ${error.message}` 
    });
  }
});

// Notificar a TODOS los mozos sobre un nuevo pedido del cliente
app.post("/notify-mozo-new-order", async (req, res) => {
  const { mozoEmail, mesa, clienteNombre, productos, total } = req.body;
  
  try {
    const title = "Nuevo pedido";
    const productosTexto = productos.slice(0, 2).join(', ');
    const masProductos = productos.length > 2 ? `... +${productos.length - 2}` : '';
    const body = `Mesa ${mesa}: ${clienteNombre} - ${productosTexto}${masProductos} ($${total})`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "mozo")
      .not("fcm_token", "is", null);

    if (error || !mozos?.length) {
      return res.status(200).send({ message: "No mozos found" });
    }

    const tokens = mozos.map(m => m.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

// Notificar al cliente cuando el mozo confirma su pedido
app.post("/notify-client-order-confirmed", async (req, res) => {
  const { clienteEmail, mesa, tiempoEstimado } = req.body;
  
  try {
    const title = "Pedido confirmado";
    const body = `Tu pedido de Mesa ${mesa} fue confirmado. Tiempo estimado: ${tiempoEstimado} min`;
    
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token")
      .eq("correo", clienteEmail)
      .not("fcm_token", "is", null)
      .single();

    if (error || !cliente?.fcm_token) {
      return res.status(200).send({ message: "Cliente not found or no FCM token" });
    }

    const message = {
      notification: { title, body },
      token: cliente.fcm_token
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

// Notificar al cliente cuando el mozo rechaza su pedido
app.post("/notify-client-order-rejected", async (req, res) => {
  const { clienteEmail, mesa, motivo } = req.body;
  
  try {
    const title = "Pedido rechazado";
    const body = `Tu pedido de Mesa ${mesa} fue rechazado. Motivo: ${motivo}`;
    
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token")
      .eq("correo", clienteEmail)
      .not("fcm_token", "is", null)
      .single();

    if (error || !cliente?.fcm_token) {
      return res.status(200).send({ message: "Cliente not found or no FCM token" });
    }

    const message = {
      notification: { title, body },
      token: cliente.fcm_token
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

// Notificar a dueños y supervisores cuando el mozo confirma un pago
app.post("/notify-payment-confirmed", async (req, res) => {
  const { mesa, montoTotal, mozoNombre } = req.body;
  
  try {
    const title = "Pago confirmado";
    const body = `${mozoNombre} confirmó el pago de Mesa ${mesa} por $${montoTotal}. Mesa liberada.`;
    
    // Obtener tokens de dueños y supervisores
    const { data: supervisores, error } = await supabase
      .from("supervisores")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    if (error || !supervisores?.length) {
      return res.status(200).send({ message: "No supervisors found" });
    }

    const tokens = supervisores.map(s => s.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});