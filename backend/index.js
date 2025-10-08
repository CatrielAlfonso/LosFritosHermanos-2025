const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://jpwlvaprtxszeimmimlq.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwd2x2YXBydHhzemVpbW1pbWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxODEyMDAsImV4cCI6MjA3Mjc1NzIwMH0.gkhOncDbc192hLHc4KIT3SLRI6aUIlQt13pf2hY1IA8';
const supabase = createClient(supabaseUrl, supabaseKey);

<<<<<<< HEAD
// Initialize Firebase Admin usando el archivo JSON directamente
// Configuración para Fritos Hermanos
const serviceAccount = {
  "type": "service_account",
  "project_id": "fritos-hermanos",
  "private_key_id": "tu_private_key_id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY_AQUI\n-----END PRIVATE KEY-----",
  "client_email": "firebase-adminsdk-xxx@fritos-hermanos.iam.gserviceaccount.com",
  "client_id": "127178815661",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40fritos-hermanos.iam.gserviceaccount.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.get("/", (req, res) => {
  res.send("Backend is running!");
});``

// Función helper para enviar notificaciones
=======

try {
  console.log('Iniciando configuración de Firebase...');
  console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
  console.log('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);

  console.log('Intentando inicializar Firebase Admin...');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
    }),
  });
  console.log('Firebase Admin inicializado correctamente');
} catch (error) {
  console.error('Error completo inicializando Firebase Admin:', error);
  console.error('Stack trace:', error.stack);
}

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

app.get("/debug-env", (req, res) => {
  const envStatus = {
    firebase_credentials_length: process.env.FIREBASE_ADMIN_CREDENTIALS ? process.env.FIREBASE_ADMIN_CREDENTIALS.length : 0,
    firebase_credentials_start: process.env.FIREBASE_ADMIN_CREDENTIALS ? process.env.FIREBASE_ADMIN_CREDENTIALS.substring(0, 50) + '...' : 'no disponible',
    supabase: {
      url: process.env.SUPABASE_URL || 'usando valor por defecto',
      key_length: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.length : 0
    },
    node_env: process.env.NODE_ENV || 'no definido',
    port: process.env.PORT || '3000 (default)'
  };
  res.json(envStatus);
});

app.get("/check-env", (req, res) => {
  const envStatus = {
    supabase: {
      url: !!process.env.SUPABASE_URL,
      key: !!process.env.SUPABASE_KEY
    },
    firebase: {
      credentials: !!process.env.FIREBASE_ADMIN_CREDENTIALS
    },
    sendgrid: {
      api_key: !!process.env.SENDGRID_API_KEY,
      from_email: !!process.env.SENDGRID_FROM_EMAIL
    },
    server: {
      node_env: process.env.NODE_ENV,
      port: process.env.PORT
    }
  };
  res.json(envStatus);
});


const emailRoutes = require('./routes/email.routes');
app.use('/api/email', emailRoutes);``


>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
async function sendNotificationToRole(role, title, body) {
  try {
    const { data: users, error } = await supabase
      .from(role === 'cliente' ? 'clientes' : role === 'supervisor' ? 'supervisores' : 'empleados')
      .select("fcm_token")
      .not("fcm_token", "is", null);

    if (error) {
      throw new Error(`Error fetching ${role}: ${error.message}`);
    }

    if (!users || users.length === 0) {3
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

<<<<<<< HEAD
// Notificar maitre nuevo cliente
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

<<<<<<< HEAD
// Notificar cliente mesa asignada
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
app.post("/notify-client-table-assigned", async (req, res) => {
  const { clienteEmail, mesaNumero, clienteNombre, clienteApellido } = req.body;
  
  try {
<<<<<<< HEAD
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token")
      .eq("correo", clienteEmail)
      .single();

<<<<<<< HEAD
    if (error || !cliente?.fcm_token) {
      return res.status(200).send({ message: "Cliente no encontrado o sin token FCM" });
    }

    const message = {
      notification: {
        title: "Mesa asignada",
        body: `Hola ${clienteNombre}, te hemos asignado la mesa ${mesaNumero}. ¡Disfruta tu experiencia!`
      },
      token: cliente.fcm_token,
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

// Notificar mozos consulta cliente
=======
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


>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

<<<<<<< HEAD
// Notificar bartender nuevo pedido
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

<<<<<<< HEAD
// Notificar cocinero nuevo pedido
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

<<<<<<< HEAD
// Notificar mozo pedido listo
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

<<<<<<< HEAD
// Notificar mozo solicitud cuenta
=======

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
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

// Notificar supervisores nuevo cliente
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

// Borrar FCM token
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