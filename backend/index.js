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


let serviceAccount;
try {
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {

    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
  } else {

    const serviceAccountPath = require('path').join(__dirname, 'fritos-hermanos-firebase-adminsdk-fbsvc-d13be52569.json');
    serviceAccount = require(serviceAccountPath);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);

}

app.get("/", (req, res) => {
  res.send("Backend is running!");
});


const emailRoutes = require('./routes/email.routes');
app.use('/api/email', emailRoutes);``


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