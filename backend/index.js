const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");
const path = require('path');
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const { initializeApp, applicationDefault } = require('firebase-admin/app');
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

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



const emailRoutes = require('./routes/email.routes');
app.use('/api/email', emailRoutes);

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});