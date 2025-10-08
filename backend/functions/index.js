const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors")({ origin: true });
const { createClient } = require("@supabase/supabase-js");
const admin = require("firebase-admin");
const { enviarCorreoRechazo } = require("./email");
require("dotenv").config();

const app = express();

// Envolver toda la aplicación en el middleware cors
exports.api = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    if (!admin.apps.length) {
      const supabaseUrl = process.env.SUPABASE_URL || functions.config().supabase.url;
      const supabaseKey = process.env.SUPABASE_KEY || functions.config().supabase.key;
      supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (serviceAccountPath) {
          serviceAccount = require(serviceAccountPath);
        } else {
          serviceAccount = {
            type: functions.config().service_account.type,
            project_id: functions.config().service_account.project_id,
            private_key_id: functions.config().service_account.private_key_id,
            private_key: functions.config().service_account.private_key.replace(/\\n/g, '\n'),
            client_email: functions.config().service_account.client_email,
            client_id: functions.config().service_account.client_id,
            auth_uri: functions.config().service_account.auth_uri,
            token_uri: functions.config().service_account.token_uri,
            auth_provider_x509_cert_url: functions.config().service_account.auth_provider_x509_cert_url,
            client_x509_cert_url: functions.config().service_account.client_x509_cert_url
          };
        }
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (e) {
        console.error("Error initializing Firebase Admin SDK:", e);
      }
    }

    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Backend is running!");
    });

    app.post("/notify-owner", async (req, res) => {
      const { title, body } = req.body;

      if (!title || !body) {
        return res.status(400).send({ error: "Title and body are required." });
      }

      try {
        const { data: supervisors, error } = await supabase
          .from("supervisores")
          .select("fcm_token")
          .in("perfil", ["dueño", "supervisor"]);

        if (error) {
          throw new Error(`Error fetching supervisors: ${error.message}`);
        }

        if (!supervisors || supervisors.length === 0) {
          console.log("No owner or supervisors found to notify.");
          return res.status(200).send({ message: "No owner or supervisors to notify." });
        }

        const tokens = supervisors.map((s) => s.fcm_token).filter((t) => t);

        if (tokens.length === 0) {
          console.log("No valid FCM tokens found for owner or supervisors.");
          return res.status(200).send({ message: "No valid FCM tokens found." });
        }

        const message = {
          notification: {
            title: title,
            body: body,
          },
          tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log("Successfully sent message:", response);

        res.status(200).send({ message: "Notification sent successfully.", response });
      } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).send({ error: `Failed to send notification: ${error.message}` });
      }
    });

    app.post("/notify-client-status", async (req, res) => {
      const { clienteEmail, nombre, estado } = req.body;

      if (!clienteEmail || !nombre || !estado) {
        return res.status(400).send({ error: "Email, nombre y estado son requeridos." });
      }

      try {
        const { data: tokens } = await supabase
          .from('clientes')
          .select('fcm_token')
          .eq('correo', clienteEmail)
          .single();

        if (tokens?.fcm_token) {
          const message = {
            notification: {
              title: 'Estado de tu Registro',
              body: estado === 'aceptado' 
                ? '¡Tu registro ha sido aprobado! Ya puedes acceder a la aplicación.' 
                : 'Tu registro ha sido rechazado. Recibirás un correo con más información.'
            },
            token: tokens.fcm_token
          };

          await admin.messaging().send(message);
        }

        res.status(200).send({ success: true });
      } catch (error) {
        console.error('Error al enviar notificación:', error);
        res.status(500).send({ error: error.message });
      }
    });

<<<<<<< HEAD
=======
    app.post("/notify-client-table-assigned", async (req, res) => {
      const { clienteNombre, clienteApellido, mesaNumero, fcmToken } = req.body;

      if (!clienteNombre || !mesaNumero || !fcmToken) {
        return res.status(400).send({ error: "Nombre del cliente, número de mesa y token FCM son requeridos." });
      }

      try {
        const message = {
          notification: {
            title: 'Mesa Asignada',
            body: `${clienteNombre} ${clienteApellido || ''}, se te ha asignado la mesa ${mesaNumero}. Por favor, escanea el código QR de la mesa para confirmar tu ubicación.`
          },
          token: fcmToken
        };

        await admin.messaging().send(message);
        res.status(200).send({ success: true });
      } catch (error) {
        console.error('Error al enviar notificación:', error);
        res.status(500).send({ error: error.message });
      }
    });

>>>>>>> e3fee9318b61bfd4da2dc7a6cee374f45569cd92
    app.post("/enviar-correo-rechazo", async (req, res) => {
      const { correo, nombre, apellido } = req.body;

      if (!correo || !nombre) {
        return res.status(400).send({ error: "Correo y nombre son requeridos." });
      }

      try {
        const result = await enviarCorreoRechazo({ correo, nombre, apellido });
        res.status(200).send({ message: "Correo enviado exitosamente", result });
      } catch (error) {
        console.error("Error al enviar correo:", error);
        res.status(500).send({ error: `Error al enviar correo: ${error.message}` });
      }
    });

    app(request, response);
  });
});