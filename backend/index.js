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
// CRON JOBS PARA GESTIÓN DE RESERVAS Y MESAS
// ============================================

/**
 * Cron job que se ejecuta cada minuto para:
 * 1. Asignar mesas a reservas cuando llega su hora
 * 2. Liberar mesas de reservas expiradas (45 min sin escanear QR)
 */
cron.schedule('* * * * *', async () => {
  try {
    const argentina = obtenerFechaHoraArgentina();
    console.log(`🔄 [CRON] Procesando reservas... Hora Argentina: ${argentina.fecha} ${argentina.hora} (UTC: ${new Date().toISOString()})`);
    
    // 1. ASIGNAR MESAS A RESERVAS QUE LLEGAN A SU HORA
    await procesarReservasParaAsignarMesa();
    
    // 2. LIBERAR MESAS DE RESERVAS EXPIRADAS (45 min sin escanear QR)
    await liberarMesasReservasExpiradas();
    
  } catch (cronError) {
    console.error('💥 Error crítico en cron job de reservas:', cronError);
  }
});

/**
 * Obtiene la fecha y hora actual en Argentina (UTC-3)
 */
function obtenerFechaHoraArgentina() {
  const ahora = new Date();
  // Convertir a hora de Argentina (UTC-3)
  const offsetArgentina = -3 * 60; // -3 horas en minutos
  const offsetLocal = ahora.getTimezoneOffset(); // offset local en minutos
  const diferenciaMinutos = offsetArgentina - (-offsetLocal);
  
  const ahoraArgentina = new Date(ahora.getTime() + diferenciaMinutos * 60 * 1000);
  
  const year = ahoraArgentina.getUTCFullYear();
  const month = String(ahoraArgentina.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ahoraArgentina.getUTCDate()).padStart(2, '0');
  const hours = String(ahoraArgentina.getUTCHours()).padStart(2, '0');
  const minutes = String(ahoraArgentina.getUTCMinutes()).padStart(2, '0');
  
  return {
    fecha: `${year}-${month}-${day}`,
    hora: `${hours}:${minutes}`,
    timestamp: ahoraArgentina,
    original: ahora
  };
}

/**
 * Asigna mesas a reservas confirmadas 30 MINUTOS ANTES de la hora de reserva
 * Ejemplo: reserva a las 16:00 → mesa asignada a las 15:30
 */
async function procesarReservasParaAsignarMesa() {
  try {
    const argentina = obtenerFechaHoraArgentina();
    const hoy = argentina.fecha;
    const horaActual = argentina.hora;
    
    // Calcular la hora límite para asignar (hora actual + 30 min)
    // Si son las 15:30, buscar reservas hasta las 16:00
    const [horaActualH, horaActualM] = horaActual.split(':').map(Number);
    const minutosActuales = horaActualH * 60 + horaActualM;
    const minutosLimite = minutosActuales + 30; // 30 minutos en el futuro
    const horaLimiteAsignacion = `${String(Math.floor(minutosLimite / 60)).padStart(2, '0')}:${String(minutosLimite % 60).padStart(2, '0')}`;
    
    console.log(`🕐 [CRON] Hora Argentina: ${hoy} ${horaActual} | Asignando mesas para reservas hasta las ${horaLimiteAsignacion}`);
    
    // Buscar reservas confirmadas de hoy sin mesa asignada cuya hora es dentro de los próximos 30 min
    // Es decir: hora_reserva <= horaActual + 30min
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('estado', 'confirmada')
      .eq('fecha_reserva', hoy)
      .is('mesa_numero', null)
      .lte('hora_reserva', horaLimiteAsignacion);
    
    if (error) {
      console.error('❌ Error al buscar reservas para asignar mesa:', error);
      return;
    }
    
    if (!reservas || reservas.length === 0) {
      return; // No hay reservas para procesar
    }
    
    console.log(`📋 [CRON] Encontradas ${reservas.length} reservas para asignar mesa (30 min antes)`);
    
    for (const reserva of reservas) {
      // Verificar que no hayan pasado más de 45 minutos desde la hora de reserva
      // Crear fecha de reserva usando componentes para evitar problemas de timezone
      const [year, month, day] = reserva.fecha_reserva.split('-').map(Number);
      const [hour, minute] = reserva.hora_reserva.split(':').map(Number);
      
      // Calcular minutos desde medianoche para comparar
      const minutosReserva = hour * 60 + minute;
      const minutosDiferenciaDesdeReserva = minutosActuales - minutosReserva;
      
      if (minutosDiferenciaDesdeReserva > 45) {
        // La reserva expiró sin que el cliente llegara (más de 45 min después de la hora de reserva)
        console.log(`⏰ [CRON] Reserva ${reserva.id} expiró sin asignar mesa (${minutosDiferenciaDesdeReserva} min después de ${reserva.hora_reserva})`);
        await supabase
          .from('reservas')
          .update({ estado: 'expirada' })
          .eq('id', reserva.id);
        continue;
      }
      
      // Buscar mesa disponible para la cantidad de comensales
      const { data: mesasDisponibles, error: errorMesas } = await supabase
        .from('mesas')
        .select('*')
        .eq('ocupada', false)
        .eq('comensales', reserva.cantidad_comensales)
        .order('numero', { ascending: true })
        .limit(1);
      
      if (errorMesas || !mesasDisponibles || mesasDisponibles.length === 0) {
        console.log(`⚠️ [CRON] No hay mesas disponibles para reserva ${reserva.id} (${reserva.cantidad_comensales} comensales)`);
        continue;
      }
      
      const mesa = mesasDisponibles[0];
      const ahora = new Date();
      
      // Calcular hora límite: 45 minutos DESPUÉS de la hora de la reserva
      // Ejemplo: reserva 16:00 → límite 16:45
      const fechaHoraReserva = new Date(year, month - 1, day, hour, minute);
      const horaLimite = new Date(fechaHoraReserva.getTime() + 45 * 60 * 1000);
      
      console.log(`📋 [CRON] Reserva ${reserva.id}: hora reserva ${reserva.hora_reserva}, límite para escanear QR: ${horaLimite.toLocaleTimeString('es-AR')}`);
      
      // Asignar mesa a la reserva
      const { error: errorAsignar } = await supabase
        .from('reservas')
        .update({
          mesa_id: mesa.id,
          mesa_numero: mesa.numero,
          hora_asignacion: ahora.toISOString(),
          hora_limite: horaLimite.toISOString()
        })
        .eq('id', reserva.id);
      
      if (errorAsignar) {
        console.error(`❌ [CRON] Error al asignar mesa a reserva ${reserva.id}:`, errorAsignar);
        continue;
      }
      
      // Marcar mesa como ocupada
      const { error: errorMesa } = await supabase
        .from('mesas')
        .update({ ocupada: true })
        .eq('id', mesa.id);
      
      if (errorMesa) {
        console.error(`❌ [CRON] Error al marcar mesa ${mesa.numero} como ocupada:`, errorMesa);
        // Revertir la asignación
        await supabase
          .from('reservas')
          .update({ mesa_id: null, mesa_numero: null, hora_asignacion: null, hora_limite: null })
          .eq('id', reserva.id);
        continue;
      }
      
      // Agregar al cliente a la lista de espera con su mesa asignada
      const { error: errorListaEspera } = await supabase
        .from('lista_espera')
        .insert({
          nombre: reserva.cliente_nombre || 'Cliente',
          apellido: reserva.cliente_apellido || 'Reserva',
          correo: reserva.cliente_email || `reserva-${reserva.id}@fritos.com`,
          mesa_asignada: mesa.numero.toString(),
          fecha_ingreso: ahora.toISOString()
        });
      
      if (errorListaEspera) {
        console.error(`⚠️ [CRON] Error al agregar a lista de espera:`, errorListaEspera);
        // No revertimos, la reserva sigue válida aunque no esté en lista de espera
      } else {
        console.log(`📋 [CRON] Cliente agregado a lista de espera con mesa ${mesa.numero}`);
      }
      
      console.log(`✅ [CRON] Mesa ${mesa.numero} asignada a reserva ${reserva.id} (${reserva.cliente_nombre})`);
      // No se envía push notification al asignar mesa
    }
  } catch (error) {
    console.error('❌ Error en procesarReservasParaAsignarMesa:', error);
  }
}

/**
 * Libera mesas de reservas que expiraron (45 min sin escanear QR)
 */
async function liberarMesasReservasExpiradas() {
  try {
    const ahora = new Date();
    const argentina = obtenerFechaHoraArgentina();
    
    console.log(`🕐 [CRON-LIBERAR] Verificando reservas expiradas - Hora Argentina: ${argentina.fecha} ${argentina.hora}`);
    
    // Buscar reservas confirmadas con mesa asignada donde:
    // - El cliente NO llegó (cliente_llego = false o null)
    // - Han pasado más de 45 minutos desde hora_asignacion
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('estado', 'confirmada')
      .not('mesa_numero', 'is', null)
      .or('cliente_llego.is.null,cliente_llego.eq.false');
    
    if (error) {
      console.error('❌ Error al buscar reservas expiradas:', error);
      return;
    }
    
    if (!reservas || reservas.length === 0) {
      return; // No hay reservas para procesar
    }
    
    let mesasLiberadas = 0;
    
    for (const reserva of reservas) {
      if (!reserva.hora_asignacion) continue;
      
      // hora_asignacion está en formato ISO (UTC), la comparación es directa
      const horaAsignacion = new Date(reserva.hora_asignacion);
      const minutosDiferencia = (ahora.getTime() - horaAsignacion.getTime()) / (1000 * 60);
      
      // Si pasaron más de 45 minutos desde la asignación y el cliente no llegó
      if (minutosDiferencia > 45) {
        console.log(`⏰ [CRON] Liberando mesa ${reserva.mesa_numero} de reserva ${reserva.id} (expirada: ${minutosDiferencia.toFixed(0)} min)`);
        
        // Marcar la reserva como expirada y quitar la mesa
        const { error: errorReserva } = await supabase
          .from('reservas')
          .update({
            estado: 'expirada',
            mesa_id: null,
            mesa_numero: null
          })
          .eq('id', reserva.id);
        
        if (errorReserva) {
          console.error(`❌ [CRON] Error al actualizar reserva ${reserva.id}:`, errorReserva);
          continue;
        }
        
        // Liberar la mesa
        const { error: errorMesa } = await supabase
          .from('mesas')
          .update({ 
            ocupada: false,
            clienteAsignadoId: null
          })
          .eq('numero', reserva.mesa_numero);
        
        if (errorMesa) {
          console.error(`❌ [CRON] Error al liberar mesa ${reserva.mesa_numero}:`, errorMesa);
        } else {
          mesasLiberadas++;
          console.log(`✅ [CRON] Mesa ${reserva.mesa_numero} liberada (reserva ${reserva.id} expirada)`);
        }
      }
    }
    
    if (mesasLiberadas > 0) {
      console.log(`📋 [CRON] Total mesas liberadas por reservas expiradas: ${mesasLiberadas}`);
    }
  } catch (error) {
    console.error('❌ Error en liberarMesasReservasExpiradas:', error);
  }
}

/**
 * Notifica al cliente que su mesa fue asignada
 */
async function notificarMesaAsignadaReserva(reserva, mesaNumero) {
  try {
    // Buscar el token FCM del cliente
    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('fcm_token')
      .eq('correo', reserva.cliente_email)
      .single();
    
    if (error || !cliente || !cliente.fcm_token) {
      console.log(`ℹ️ [CRON] Cliente ${reserva.cliente_email} no tiene token FCM`);
      return;
    }
    
    const message = {
      notification: {
        title: '🪑 ¡Tu mesa está lista!',
        body: `Tu reserva de las ${reserva.hora_reserva} tiene la mesa N° ${mesaNumero} asignada. Tienes 45 minutos para escanear el QR de tu mesa.`
      },
      token: cliente.fcm_token,
      data: {
        link: '/home',
        reservaId: reserva.id.toString(),
        mesaNumero: mesaNumero.toString()
      }
    };
    
    await admin.messaging().send(message);
    console.log(`📱 [CRON] Notificación enviada a ${reserva.cliente_email} - Mesa ${mesaNumero}`);
  } catch (error) {
    console.error('Error al enviar notificación de mesa asignada:', error);
  }
}

console.log('⏰ Cron job de gestión de reservas configurado: cada minuto');

// Mantener el cron job original para liberar mesas de lista_espera vencidas
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('🔄 Ejecutando liberación de mesas vencidas (lista_espera)...', new Date().toISOString());
    
    const { data, error } = await supabase.rpc('liberar_mesas_vencidas');
    
    if (error) {
      console.error('❌ Error al liberar mesas vencidas:', error);
    } else {
      if (data && data.reservas_liberadas > 0) {
        console.log(`✅ Liberadas ${data.reservas_liberadas} reservas vencidas`);
        console.log(`📋 Mesas liberadas: ${data.mesas_liberadas?.join(', ') || 'ninguna'}`);
      }
    }
  } catch (cronError) {
    console.error('💥 Error crítico en cron job de liberación de mesas:', cronError);
  }
});

console.log('⏰ Cron job de liberación de mesas (lista_espera) configurado: cada 5 minutos');

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
    let users, error;
    
    if (role === 'cliente') {
      // Buscar en tabla clientes
      const result = await supabase
        .from('clientes')
        .select("fcm_token")
        .not("fcm_token", "is", null);
      users = result.data;
      error = result.error;
    } else if (role === 'supervisor') {
      // Supervisores y dueños están en la tabla EMPLEADOS con perfil 'supervisor' o 'dueño'
      const result = await supabase
        .from('empleados')
        .select("fcm_token, perfil")
        .in("perfil", ["supervisor", "dueño"])
        .not("fcm_token", "is", null);
      users = result.data;
      error = result.error;
      console.log(`🔍 Buscando supervisores/dueños en tabla empleados:`, users?.length || 0, 'encontrados');
    } else {
      // Otros empleados (mozo, maitre, bartender, cocinero, etc.)
      const result = await supabase
        .from('empleados')
        .select("fcm_token")
        .not("fcm_token", "is", null);
      users = result.data;
      error = result.error;
    }

    if (error) {
      throw new Error(`Error fetching ${role}: ${error.message}`);
    }

    if (!users || users.length === 0) {
      console.log(`No ${role} found to notify.`);
      return { success: true, message: `No ${role} to notify.` };
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(users.map(u => u.fcm_token).filter(t => t))];

    if (tokensUnicos.length === 0) {
      console.log(`No valid FCM tokens found for ${role}.`);
      return { success: true, message: "No valid FCM tokens found." };
    }

    if (tokensUnicos.length < users.length) {
      console.log(`   ⚠️ Se detectaron ${users.length - tokensUnicos.length} tokens duplicados`);
    }

    console.log(`📤 Enviando notificación a ${tokensUnicos.length} ${role}(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
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
    const title = "👤 Nuevo cliente registrado";
    const body = `${clienteNombre} ${clienteApellido || ''} se ha registrado y espera aprobación`;
    
    // Obtener solo los tokens de empleados con perfil "maitre"
    const { data: maitres, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "maitre")
      .not("fcm_token", "is", null);

    if (error || !maitres?.length) {
      console.log("No se encontraron maîtres con token FCM");
      return res.status(200).send({ success: true, message: "No hay maîtres para notificar" });
    }

    const tokens = maitres.map(m => m.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ success: true, message: "No hay tokens FCM válidos" });
    }

    console.log(`📤 Notificando a ${tokens.length} maître(s) sobre nuevo cliente`);

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

// Notificar SOLO al maître cuando un cliente entra en lista de espera
app.post("/notify-maitre-lista-espera", async (req, res) => {
  const { clienteNombre } = req.body;
  
  try {
    const title = "📋 Nuevo cliente en lista de espera";
    const body = `${clienteNombre} está esperando asignación de mesa`;
    
    // Obtener solo los tokens de empleados con perfil "maitre"
    const { data: maitres, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "maitre")
      .not("fcm_token", "is", null);

    if (error) {
      console.error("Error al buscar maîtres:", error);
      return res.status(500).send({ error: `Error en base de datos: ${error.message}` });
    }

    if (!maitres || maitres.length === 0) {
      console.log("No se encontraron maîtres con token FCM");
      return res.status(200).send({ success: true, message: "No hay maîtres para notificar" });
    }

    const tokens = maitres.map(m => m.fcm_token).filter(t => t);
    
    if (tokens.length === 0) {
      return res.status(200).send({ success: true, message: "No hay tokens FCM válidos" });
    }

    const message = {
      notification: { title, body },
      tokens: tokens,
      data: {
        link: '/lista-espera'
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log("Notificación a maître enviada:", response);

    res.status(200).send({ 
      success: true, 
      message: "Notificación enviada al maître",
      response 
    });
  } catch (error) {
    console.error("Error al notificar al maître:", error);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-client-table-assigned", async (req, res) => {
  const { clienteEmail, mesaNumero, clienteNombre, clienteApellido } = req.body;
  
  try {
    console.log(`📤 [notify-client-table-assigned] Notificando mesa ${mesaNumero} a ${clienteNombre} (${clienteEmail})`);
    
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token, correo")
      .eq("correo", clienteEmail)
      .single();

    if (error) {
      console.error('❌ Error buscando cliente:', error);
    }

    // Detectar si es cliente anónimo
    const esAnonimo = clienteEmail && clienteEmail.includes('anonimo');
    console.log(`   - Es anónimo: ${esAnonimo}`);
    console.log(`   - Tiene FCM token: ${cliente?.fcm_token ? 'Sí' : 'No'}`);

    let pushEnviada = false;
    let emailEnviado = false;

    // 1. Enviar push notification (tanto para anónimos como registrados)
    if (cliente?.fcm_token) {
      try {
        const message = {
          notification: {
            title: "🪑 Mesa asignada",
            body: `Hola ${clienteNombre}, te hemos asignado la mesa ${mesaNumero}. ¡Escaneá el QR de tu mesa!`
          },
          data: {
            tipo: 'mesa_asignada',
            mesa: mesaNumero.toString()
          },
          token: cliente.fcm_token,
        };

        await admin.messaging().send(message);
        pushEnviada = true;
        console.log(`   ✅ Push notification enviada a ${clienteNombre}`);
      } catch (pushError) {
        console.error('   ❌ Error enviando push:', pushError.message);
      }
    } else {
      console.log(`   ⚠️ Cliente sin FCM token, no se puede enviar push`);
    }

    // 2. Enviar email SOLO si NO es anónimo (los anónimos no tienen email real)
    if (!esAnonimo) {
      try {
        const { sendEmail } = require('./services/email.service');
        const emailResult = await sendEmail({
          to: clienteEmail,
          subject: "🪑 Mesa Asignada - Los Fritos Hermanos",
          text: `Hola ${clienteNombre}, te hemos asignado la mesa ${mesaNumero}. ¡Disfruta tu experiencia!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>¡Tu mesa está lista!</h2>
              <p>Hola ${clienteNombre},</p>
              <p>Te confirmamos que te hemos asignado la <strong>mesa ${mesaNumero}</strong>.</p>
              <p>Detalles de tu asignación:</p>
              <ul>
                <li>Mesa: ${mesaNumero}</li>
                <li>Nombre: ${clienteNombre} ${clienteApellido || ''}</li>
              </ul>
              <p>¡Esperamos que disfrutes tu experiencia en Los Fritos Hermanos!</p>
              <p>Si necesitas algo, no dudes en consultarnos.</p>
              <br>
              <p>Saludos,</p>
              <p>El equipo de Los Fritos Hermanos</p>
            </div>
          `
        });
        emailEnviado = true;
        console.log(`   ✅ Email enviado a ${clienteEmail}`);
      } catch (emailError) {
        console.error('   ❌ Error enviando email:', emailError.message);
      }
    } else {
      console.log(`   ℹ️ Cliente anónimo, no se envía email`);
    }

    res.status(200).send({ 
      message: "Notificación procesada",
      esAnonimo,
      pushEnviada,
      emailEnviado
    });
  } catch (error) {
    console.error('❌ Error general:', error);
    res.status(500).send({ error: `Failed to send notifications: ${error.message}` });
  }
});

app.post("/notify-mozos-client-query", async (req, res) => {
  const { clienteNombre, clienteApellido, mesaNumero, consulta } = req.body;
  
  try {
    const title = "💬 Consulta de cliente";
    const body = `${clienteNombre} ${clienteApellido || ''} (Mesa ${mesaNumero}): ${consulta}`;
    
    // Obtener solo los mozos (case-insensitive)
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre")
      .ilike("perfil", "mozo")
      .not("fcm_token", "is", null);

    console.log(`💬 [notify-mozos-client-query] Mesa ${mesaNumero} - Consulta`);
    console.log(`   - Mozos encontrados: ${mozos?.length || 0}`);

    if (error || !mozos?.length) {
      console.log(`   ⚠️ No se encontraron mozos`);
      return res.status(200).send({ message: "No mozos found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(mozos.map(m => m.fcm_token).filter(t => t))];
    
    if (tokensUnicos.length < mozos.length) {
      console.log(`   ⚠️ Se detectaron ${mozos.length - tokensUnicos.length} tokens duplicados`);
    }
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} mozo(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-client-mozo-response", async (req, res) => {
  const { clienteEmail, mozoNombre, mesa } = req.body;
  
  try {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token")
      .eq("correo", clienteEmail)
      .single();

    if (error || !cliente?.fcm_token) {
      return res.status(200).send({ message: "Cliente not found or no FCM token" });
    }

    const title = "Respuesta del mozo";
    const body = `${mozoNombre} respondió tu consulta (Mesa ${mesa})`;

    const message = {
      notification: { title, body },
      token: cliente.fcm_token,
    };

    const response = await admin.messaging().send(message);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

// Notificar a un mozo específico cuando hay una nueva consulta de cliente
app.post("/notify-mozo-new-query", async (req, res) => {
  const { mozoEmail, clienteNombre, mesa } = req.body;
  
  try {
    console.log(`📤 [notify-mozo-new-query] Notificando a mozo ${mozoEmail} sobre consulta de ${clienteNombre} (Mesa ${mesa})`);
    
    const { data: mozo, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre")
      .eq("correo", mozoEmail)
      .single();

    if (error || !mozo?.fcm_token) {
      console.log(`⚠️ Mozo ${mozoEmail} no tiene FCM token`);
      return res.status(200).send({ message: "Mozo not found or no FCM token" });
    }

    const title = "💬 Nueva consulta de cliente";
    const body = `${clienteNombre} de la Mesa ${mesa} tiene una consulta`;

    const message = {
      notification: { title, body },
      token: mozo.fcm_token,
      data: {
        tipo: 'nueva_consulta',
        mesa: mesa.toString(),
        clienteNombre
      }
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notificación enviada a mozo ${mozo.nombre}`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`❌ Error al notificar mozo:`, error);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-bartender-new-order", async (req, res) => {
  const { mesaNumero, bebidas } = req.body;
  
  try {
    const title = "🍺 Nuevo pedido de bebidas";
    const body = `Mesa ${mesaNumero}: ${bebidas.join(', ')}`;
    
    // Buscar bartenders (case-insensitive usando ilike)
    const { data: bartenders, error } = await supabase
      .from("empleados")
      .select("fcm_token, perfil, nombre")
      .ilike("perfil", "bartender")
      .not("fcm_token", "is", null);

    console.log(`🍺 [notify-bartender] Buscando bartenders...`);
    console.log(`   - Encontrados: ${bartenders?.length || 0}`);
    if (bartenders?.length > 0) {
      console.log(`   - Perfiles: ${bartenders.map(b => b.perfil).join(', ')}`);
    }

    if (error || !bartenders?.length) {
      console.log(`   ⚠️ No se encontraron bartenders`);
      return res.status(200).send({ message: "No bartenders found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(bartenders.map(b => b.fcm_token).filter(t => t))];
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    if (tokensUnicos.length < bartenders.length) {
      console.log(`   ⚠️ Se detectaron ${bartenders.length - tokensUnicos.length} tokens duplicados`);
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} bartender(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-cocinero-new-order", async (req, res) => {
  const { mesaNumero, comidas, postres } = req.body;
  
  try {
    const items = [...(comidas || []), ...(postres || [])];
    const title = "🍳 Nuevo pedido de cocina";
    const body = `Mesa ${mesaNumero}: ${items.join(', ')}`;
    
    // Buscar cocineros (case-insensitive usando ilike)
    const { data: cocineros, error } = await supabase
      .from("empleados")
      .select("fcm_token, perfil, nombre")
      .ilike("perfil", "cocinero")
      .not("fcm_token", "is", null);

    console.log(`🍳 [notify-cocinero] Buscando cocineros...`);
    console.log(`   - Encontrados: ${cocineros?.length || 0}`);
    if (cocineros?.length > 0) {
      console.log(`   - Perfiles: ${cocineros.map(c => c.perfil).join(', ')}`);
    }

    if (error || !cocineros?.length) {
      console.log(`   ⚠️ No se encontraron cocineros`);
      return res.status(200).send({ message: "No cocineros found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(cocineros.map(c => c.fcm_token).filter(t => t))];
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    if (tokensUnicos.length < cocineros.length) {
      console.log(`   ⚠️ Se detectaron ${cocineros.length - tokensUnicos.length} tokens duplicados`);
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} cocinero(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-mozo-order-ready", async (req, res) => {
  const { mesaNumero, tipoProducto, productos, pedidoId } = req.body;
  
  try {
    const title = "✅ Pedido listo para servir";
    const body = `Mesa ${mesaNumero}: ${tipoProducto} - ${productos.join(', ')}`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre")
      .ilike("perfil", "mozo")
      .not("fcm_token", "is", null);

    console.log(`✅ [notify-mozo-order-ready] Mesa ${mesaNumero} - Pedido listo`);
    console.log(`   - Mozos encontrados: ${mozos?.length || 0}`);

    if (error || !mozos?.length) {
      console.log(`   ⚠️ No se encontraron mozos`);
      return res.status(200).send({ message: "No mozos found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(mozos.map(m => m.fcm_token).filter(t => t))];
    
    if (tokensUnicos.length < mozos.length) {
      console.log(`   ⚠️ Se detectaron ${mozos.length - tokensUnicos.length} tokens duplicados`);
    }
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} mozo(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-mozo-request-bill", async (req, res) => {
  const { mesaNumero, clienteNombre, clienteApellido } = req.body;
  
  try {
    const title = "📋 Solicitud de cuenta";
    const body = `${clienteNombre} ${clienteApellido || ''} (Mesa ${mesaNumero}) solicita la cuenta`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre, correo")
      .ilike("perfil", "mozo")
      .not("fcm_token", "is", null);

    console.log(`📋 [notify-mozo-request-bill] Mesa ${mesaNumero} solicita cuenta`);
    console.log(`   - Mozos encontrados: ${mozos?.length || 0}`);

    if (error || !mozos?.length) {
      console.log(`   ⚠️ No se encontraron mozos`);
      return res.status(200).send({ message: "No mozos found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(mozos.map(m => m.fcm_token).filter(t => t))];
    
    console.log(`   - Tokens totales: ${mozos.length}, Tokens únicos: ${tokensUnicos.length}`);
    if (tokensUnicos.length < mozos.length) {
      console.log(`   ⚠️ Se detectaron ${mozos.length - tokensUnicos.length} tokens duplicados`);
    }
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} mozo(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
      data : {
        link : `/pedidos-mozo`
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/notify-supervisors-new-client", async (req, res) => {
  const { clienteNombre, clienteApellido } = req.body;
  
  try {
    const title = "👤 Nuevo cliente pendiente";
    const body = `${clienteNombre} ${clienteApellido || ''} se registró y espera aprobación`;
    
    // Notificar a todos los supervisores (dueños y supervisores) - están en la misma tabla
    const result = await sendNotificationToRole('supervisor', title, body);
    console.log(`✅ Notificación enviada a supervisores/dueños sobre nuevo cliente: ${clienteNombre} ${clienteApellido}`);
    res.status(200).send(result);
  } catch (error) {
    console.error('❌ Error al notificar supervisores:', error);
    res.status(500).send({ error: `Failed to send notification: ${error.message}` });
  }
});

app.post("/clear-fcm-token", async (req, res) => {
  const { email } = req.body;
  
  try {
    // Intentar borrar el token de TODAS las tablas de usuarios
    const tables = ['clientes', 'empleados', 'repartidores'];
    
    for (const table of tables) {
      await supabase
        .from(table)
        .update({ fcm_token: null })
        .eq('correo', email);
    }
    
    console.log(`🔑 FCM token limpiado para ${email}`);
    
    res.status(200).send({ message: "FCM token cleared successfully" });
  } catch (error) {
    res.status(500).send({ error: `Failed to clear FCM token: ${error.message}` });
  }
});

/**
 * Endpoint para limpiar tokens FCM duplicados en todas las tablas
 * Esto asegura que un token solo esté asociado a un usuario
 * POST /clear-duplicate-fcm-tokens
 */
app.post("/clear-duplicate-fcm-tokens", async (req, res) => {
  const { token, keepEmail } = req.body;
  
  if (!token || !keepEmail) {
    return res.status(400).send({ error: "token y keepEmail son requeridos" });
  }
  
  try {
    console.log(`🧹 Limpiando tokens duplicados. Manteniendo solo para: ${keepEmail}`);
    
    const tables = ['clientes', 'empleados', 'repartidores'];
    let cleaned = 0;
    
    for (const table of tables) {
      // Borrar el token de todos los usuarios EXCEPTO el que debe mantenerlo
      const { data, error } = await supabase
        .from(table)
        .update({ fcm_token: null })
        .eq('fcm_token', token)
        .neq('correo', keepEmail);
      
      if (!error) {
        cleaned++;
      }
    }
    
    console.log(`✅ Tokens duplicados limpiados de ${cleaned} tablas`);
    
    res.status(200).send({ 
      message: "Duplicate FCM tokens cleared successfully",
      tablesProcessed: cleaned 
    });
  } catch (error) {
    console.error('Error al limpiar tokens duplicados:', error);
    res.status(500).send({ error: `Failed to clear duplicate tokens: ${error.message}` });
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

    // 1. Obtener tokens de Supervisores y Dueños (están en tabla empleados)
    const { data: staffSuperior, error: staffError } = await supabase
      .from("empleados")
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
    let whereClause = null;
    
    if (role === 'empleado') {
      tableName = 'empleados';
      selectFields = "correo, nombre, apellido, fcm_token, perfil";
    } else if (role === 'supervisor') {
      // Supervisores y dueños están en tabla empleados
      tableName = 'empleados';
      selectFields = "correo, nombre, apellido, fcm_token, perfil";
      whereClause = { field: 'perfil', values: ['supervisor', 'dueño'] };
    }
    
    let query = supabase
      .from(tableName)
      .select(selectFields)
      .not("fcm_token", "is", null);
    
    // Aplicar filtro si es supervisor
    if (whereClause) {
      query = query.in(whereClause.field, whereClause.values);
    }
    
    const { data, error } = await query;
    
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

    // Obtener tokens SOLO de supervisores (tabla empleados con perfil 'supervisor')
    const { data: supervisores, error: supervisorError } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "supervisor")
      .not("fcm_token", "is", null);

    if (supervisorError) {
      console.error("Error al buscar tokens de supervisores:", supervisorError);
      throw new Error("Error en la base de datos al buscar destinatarios.");
    }
    
    const tokensSupervisores = supervisores?.map(s => s.fcm_token).filter(t => t) || [];

    if (tokensSupervisores.length === 0) {
      console.log("No se encontraron supervisores con tokens válidos para notificar la reserva.");
      return res.status(200).send({ message: "No se encontraron supervisores para notificar." });
    }

    console.log(`📅 [notify-new-reservation] Notificando a ${tokensSupervisores.length} supervisor(es)`);

    // Preparar y enviar la notificación SOLO a supervisores
    const message = {
      notification: { title, body },
      tokens: tokensSupervisores,
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
    
    // Formatear fecha (parseando como fecha local Argentina, no UTC)
    const [year, month, day] = fechaReserva.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day);
    const fechaFormateada = fechaLocal.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires'
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
 * Envía correo de confirmación de reserva SIN mesa asignada
 * La mesa se asignará automáticamente a la hora de la reserva
 * POST /enviar-correo-reserva-confirmada-sin-mesa
 */
app.post("/enviar-correo-reserva-confirmada-sin-mesa", async (req, res) => {
  const { correo, nombre, apellido, fechaReserva, horaReserva, cantidadComensales } = req.body;
  
  if (!correo || !nombre || !fechaReserva || !horaReserva) {
    return res.status(400).send({ error: "Correo, nombre, fechaReserva y horaReserva son requeridos." });
  }
  
  try {
    const { sendEmail } = require('./services/email.service');
    
    // Formatear fecha (parseando como fecha local Argentina, no UTC)
    const [year, month, day] = fechaReserva.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day);
    const fechaFormateada = fechaLocal.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires'
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
              }
              .celebration { font-size: 60px; margin: 20px 0; }
              .content { padding: 40px 30px; }
              .greeting {
                  font-size: 22px;
                  color: #228B22;
                  font-weight: 700;
                  margin-bottom: 25px;
                  font-family: 'Playfair Display', serif;
              }
              .message { font-size: 16px; color: #34495e; line-height: 2; margin-bottom: 20px; }
              .success-box {
                  background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
                  border-left: 6px solid #228B22;
                  padding: 25px;
                  margin: 30px 0;
                  border-radius: 12px;
              }
              .info-box {
                  background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
                  border-left: 6px solid #ffc107;
                  padding: 25px;
                  margin: 30px 0;
                  border-radius: 12px;
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
              }
              .detail-icon { font-size: 24px; margin-right: 15px; color: #228B22; width: 30px; text-align: center; }
              .detail-label { font-weight: 700; color: #228B22; margin-right: 10px; min-width: 140px; }
              .detail-value { color: #2c3e50; font-weight: 600; }
              .footer {
                  text-align: center;
                  font-size: 14px;
                  color: #7f8c8d;
                  padding: 30px;
                  background-color: #ecf0f1;
                  border-top: 3px solid #228B22;
              }
              .logo-footer {
                  font-family: 'Playfair Display', serif;
                  color: #228B22;
                  font-weight: 700;
                  font-size: 20px;
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
                          🎉 ¡Tu reserva está confirmada! 🎉
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
                  </div>
                  
                  <div class="info-box">
                      <p style="font-size: 16px; color: #856404; font-weight: 600; margin: 0;">
                          📱 <strong>Importante:</strong> Tu mesa será asignada automáticamente a las <strong>${horaReserva}</strong>. 
                          Recibirás una notificación cuando tu mesa esté lista.
                      </p>
                      <p style="font-size: 14px; color: #856404; margin: 15px 0 0 0;">
                          ⏰ Tendrás <strong>45 minutos</strong> desde la hora de tu reserva para escanear el QR de tu mesa. 
                          Si no llegas a tiempo, la mesa será liberada automáticamente.
                      </p>
                  </div>
                  
                  <p class="message" style="text-align: center; font-size: 18px; color: #228B22; font-weight: 600;">
                      ¡Te esperamos en Los Fritos Hermanos!
                  </p>
              </div>
              
              <div class="footer">
                  <p class="logo-footer">🌮 Los Fritos Hermanos 🌮</p>
                  <p>© 2025 Los Fritos Hermanos. Todos los derechos reservados.</p>
                  <p style="font-size: 13px; color: #95a5a6; font-style: italic;">Este es un correo automático, por favor no responder directamente.</p>
              </div>
          </div>
      </body>
      </html>
    `;
    
    const result = await sendEmail({
      to: correo,
      subject: '✅ Reserva Confirmada - Los Fritos Hermanos',
      text: `¡Hola ${nombre}! Tu reserva para el ${fechaFormateada} a las ${horaReserva} ha sido confirmada. Tu mesa será asignada automáticamente a las ${horaReserva}. Tendrás 45 minutos para escanear el QR de tu mesa. ¡Te esperamos!`,
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
    
    // Formatear fecha (parseando como fecha local Argentina, no UTC)
    const [year, month, day] = fechaReserva.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day);
    const fechaFormateada = fechaLocal.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires'
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
      text: `Estimado/a ${nombre}, lamentamos informarte que tu reserva para el ${fechaFormateada} a las ${horaReserva} ha sido rechazada. Motivo: ${motivo}. Esperamos poder atenderte en otra ocasión.`,
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
    
    console.log("🚴 [notify-repartidor-pedido] Datos recibidos:", { repartidorEmail, pedidoId, clienteNombre, direccion });
    
    if (!repartidorEmail || !pedidoId) {
      return res.status(400).send({ 
        error: "repartidorEmail y pedidoId son requeridos" 
      });
    }

    // Obtener token FCM del repartidor
    const { data: repartidor, error: repartidorError } = await supabase
      .from("repartidores")
      .select("fcm_token, nombre, apellido, correo")
      .eq("correo", repartidorEmail)
      .single();

    console.log("🚴 [notify-repartidor-pedido] Repartidor encontrado:", repartidor);

    if (repartidorError || !repartidor) {
      console.error("Error al buscar repartidor:", repartidorError);
      return res.status(404).send({ error: "Repartidor no encontrado" });
    }

    if (!repartidor.fcm_token) {
      console.log("⚠️ Repartidor no tiene token FCM registrado");
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
    console.log("✅ Notificación enviada al repartidor:", response);

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

// Endpoint para notificar a TODOS los repartidores disponibles
// Se usa cuando no hay un repartidor asignado específico
app.post("/notify-all-repartidores", async (req, res) => {
  try {
    const { pedidoId, clienteNombre, direccion } = req.body;
    
    console.log("🚴 [notify-all-repartidores] Notificando a todos los repartidores:", { pedidoId, clienteNombre, direccion });
    
    if (!pedidoId) {
      return res.status(400).send({ 
        error: "pedidoId es requerido" 
      });
    }

    // Obtener todos los repartidores con FCM token
    const { data: repartidores, error: repartidoresError } = await supabase
      .from("repartidores")
      .select("fcm_token, nombre, correo")
      .not("fcm_token", "is", null);

    console.log("🚴 [notify-all-repartidores] Repartidores encontrados:", repartidores?.length || 0);

    if (repartidoresError) {
      console.error("Error al buscar repartidores:", repartidoresError);
      return res.status(500).send({ error: "Error al buscar repartidores" });
    }

    if (!repartidores || repartidores.length === 0) {
      console.log("⚠️ No hay repartidores con FCM token");
      return res.status(200).send({ message: "No hay repartidores con notificaciones habilitadas" });
    }

    // Construir mensaje de notificación
    const title = "🚴 ¡Nuevo Pedido Delivery!";
    const body = `Hay un nuevo pedido #${pedidoId} para ${clienteNombre || 'cliente'}. Dirección: ${direccion || 'Ver en app'}`;

    // Enviar a todos los repartidores
    const notificaciones = repartidores.map(async (repartidor) => {
      if (!repartidor.fcm_token) return null;
      
      const message = {
        notification: { title, body },
        token: repartidor.fcm_token,
        data: {
          link: '/panel-repartidor',
          pedidoId: pedidoId.toString(),
          tipo: 'nuevo_pedido'
        }
      };

      try {
        const result = await admin.messaging().send(message);
        console.log(`✅ Notificación enviada a ${repartidor.nombre}:`, result);
        return result;
      } catch (err) {
        console.error(`❌ Error enviando a ${repartidor.nombre}:`, err.message);
        return null;
      }
    });

    const resultados = await Promise.all(notificaciones);
    const enviados = resultados.filter(r => r !== null).length;
    
    console.log(`✅ Total notificaciones enviadas: ${enviados}/${repartidores.length}`);

    res.status(200).send({ 
      message: `Notificación enviada a ${enviados} repartidores`,
      total: repartidores.length,
      enviados
    });

  } catch (error) {
    console.error("Error en /notify-all-repartidores:", error);
    res.status(500).send({ 
      error: `Falló el envío de la notificación: ${error.message}` 
    });
  }
});

// Endpoint para notificar al repartidor que el pedido está LISTO para recoger
// Se llama cuando AMBOS (cocina Y bar) terminaron de preparar
app.post("/notify-repartidor-pedido-listo", async (req, res) => {
  try {
    const { pedidoId, clienteNombre, direccion } = req.body;
    
    console.log("📦 Notificando repartidor - Pedido listo:", { pedidoId, clienteNombre, direccion });
    
    if (!pedidoId) {
      return res.status(400).send({ 
        error: "pedidoId es requerido" 
      });
    }

    // Buscar el pedido para obtener el repartidor asignado
    const { data: pedidoDelivery, error: pedidoError } = await supabase
      .from("pedidos_delivery")
      .select("repartidor_id")
      .eq("id", pedidoId)
      .single();

    // Si no encontramos en pedidos_delivery, buscar el repartidor asignado de otra forma
    // o notificar a todos los repartidores disponibles
    let repartidorId = pedidoDelivery?.repartidor_id;

    if (!repartidorId) {
      // Si no hay repartidor asignado específico, notificar a todos los repartidores disponibles
      console.log("⚠️ No hay repartidor asignado, notificando a todos los disponibles");
      
      const { data: repartidores, error: repartidoresError } = await supabase
        .from("repartidores")
        .select("fcm_token, nombre")
        .eq("disponible", true)
        .not("fcm_token", "is", null);

      if (repartidoresError || !repartidores || repartidores.length === 0) {
        console.log("No hay repartidores disponibles con FCM token");
        return res.status(200).send({ message: "No hay repartidores disponibles para notificar" });
      }

      // Enviar a todos los repartidores disponibles
      const title = "🍽️ ¡Pedido Listo para Recoger!";
      const body = `El pedido #${pedidoId} para ${clienteNombre || 'cliente'} está listo. Dirección: ${direccion || 'Ver en app'}`;

      const notificaciones = repartidores.map(async (repartidor) => {
        if (!repartidor.fcm_token) return null;
        
        const message = {
          notification: { title, body },
          token: repartidor.fcm_token,
          data: {
            link: '/panel-repartidor',
            pedidoId: pedidoId.toString(),
            tipo: 'pedido_listo'
          }
        };

        try {
          return await admin.messaging().send(message);
        } catch (err) {
          console.error(`Error enviando a ${repartidor.nombre}:`, err.message);
          return null;
        }
      });

      const resultados = await Promise.all(notificaciones);
      const enviados = resultados.filter(r => r !== null).length;
      
      console.log(`✅ Notificaciones enviadas a ${enviados} repartidores`);
      return res.status(200).send({ 
        message: `Notificación enviada a ${enviados} repartidores`,
        enviados
      });
    }

    // Si hay repartidor asignado, notificar solo a él
    const { data: repartidor, error: repartidorError } = await supabase
      .from("repartidores")
      .select("fcm_token, nombre, apellido")
      .eq("id", repartidorId)
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
    const title = "🍽️ ¡Pedido Listo para Recoger!";
    const body = `El pedido #${pedidoId} para ${clienteNombre || 'cliente'} está listo. Dirección: ${direccion || 'Ver en app'}`;

    const message = {
      notification: { title, body },
      token: repartidor.fcm_token,
      data: {
        link: '/panel-repartidor',
        pedidoId: pedidoId.toString(),
        tipo: 'pedido_listo'
      }
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Notificación enviada al repartidor:", response);

    res.status(200).send({ 
      message: "Notificación enviada al repartidor exitosamente", 
      response 
    });

  } catch (error) {
    console.error("Error en /notify-repartidor-pedido-listo:", error);
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
    const title = "🍽️ Nuevo pedido";
    const productosTexto = productos.slice(0, 2).join(', ');
    const masProductos = productos.length > 2 ? `... +${productos.length - 2}` : '';
    const body = `Mesa ${mesa}: ${clienteNombre} - ${productosTexto}${masProductos} ($${total})`;
    
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre")
      .ilike("perfil", "mozo")
      .not("fcm_token", "is", null);

    console.log(`🍽️ [notify-mozo-new-order] Mesa ${mesa} - Nuevo pedido`);
    console.log(`   - Mozos encontrados: ${mozos?.length || 0}`);

    if (error || !mozos?.length) {
      console.log(`   ⚠️ No se encontraron mozos`);
      return res.status(200).send({ message: "No mozos found" });
    }

    // Eliminar tokens duplicados usando Set
    const tokensUnicos = [...new Set(mozos.map(m => m.fcm_token).filter(t => t))];
    
    console.log(`   - Tokens totales: ${mozos.length}, Tokens únicos: ${tokensUnicos.length}`);
    if (tokensUnicos.length < mozos.length) {
      console.log(`   ⚠️ Se detectaron ${mozos.length - tokensUnicos.length} tokens duplicados`);
    }
    
    if (tokensUnicos.length === 0) {
      return res.status(200).send({ message: "No valid FCM tokens found." });
    }

    console.log(`   📤 Enviando a ${tokensUnicos.length} mozo(s)`);

    const message = {
      notification: { title, body },
      tokens: tokensUnicos,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`   ✅ Enviado: ${response.successCount} éxitos, ${response.failureCount} fallos`);
    res.status(200).send({ message: "Notification sent successfully.", response });
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
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
    
    // Obtener tokens de dueños y supervisores (están en tabla empleados)
    const { data: supervisores, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    if (error || !supervisores?.length) {
      console.log("No se encontraron supervisores/dueños para notificar");
      return res.status(200).send({ message: "No supervisors found" });
    }

    console.log(`📤 Notificando a ${supervisores.length} supervisores/dueños`);
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

// Notificar al repartidor y dueños/supervisores cuando el cliente confirma recepción del delivery
app.post("/notify-delivery-confirmed", async (req, res) => {
  const { pedidoId, clienteNombre, montoTotal } = req.body;
  
  try {
    const title = "Entrega confirmada";
    const body = `${clienteNombre} confirmo la recepcion del pedido #${pedidoId} ($${montoTotal})`;
    
    // Obtener el repartidor del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos_delivery")
      .select("repartidor_id")
      .eq("id", pedidoId)
      .single();

    const tokens = [];

    // Obtener token del repartidor
    if (pedido?.repartidor_id) {
      const { data: repartidor } = await supabase
        .from("repartidores")
        .select("fcm_token")
        .eq("id", pedido.repartidor_id)
        .single();
      
      if (repartidor?.fcm_token) {
        tokens.push(repartidor.fcm_token);
      }
    }

    // Obtener tokens de dueños y supervisores
    const { data: supervisores } = await supabase
      .from("supervisores")
      .select("fcm_token")
      .in("perfil", ["dueño", "supervisor"])
      .not("fcm_token", "is", null);

    if (supervisores?.length) {
      tokens.push(...supervisores.map(s => s.fcm_token).filter(t => t));
    }

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


//probando enviar especificamente por mail
app.post("/notify-specific-client", async (req, res) => {
  const { clienteEmail, title, body, data } = req.body;
  
  try {
    // Buscar SOLO ese cliente específico
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("fcm_token, nombre, apellido")
      .eq("correo", clienteEmail) // FILTRO: solo este email
      .single(); // Devuelve un solo resultado

    if (error || !cliente) {
      return res.status(404).send({ error: "Cliente no encontrado" });
    }

    if (!cliente.fcm_token) {
      return res.status(200).send({ 
        message: "Cliente no tiene token FCM registrado" 
      });
    }

    // Enviar a UN solo token
    const message = {
      notification: { title, body },
      token: cliente.fcm_token, // UN solo token, no array
      data: data || {}
    };

    const response = await admin.messaging().send(message);
    
    res.status(200).send({ 
      success: true,
      message: `Notificación enviada a ${cliente.nombre} ${cliente.apellido}`,
      response 
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: error.message });
  }
});


app.post("/notify-only-mozos", async (req, res) => {
  const { title, body, data } = req.body;
  
  try {
    // Obtener SOLO empleados con perfil "mozo"
    const { data: mozos, error } = await supabase
      .from("empleados")
      .select("fcm_token, nombre, apellido")
      .eq("perfil", "mozo") // 🔥 FILTRO: solo mozos
      .not("fcm_token", "is", null);

    if (error) {
      throw new Error(`Error al buscar mozos: ${error.message}`);
    }

    if (!mozos || mozos.length === 0) {
      return res.status(200).send({ 
        message: "No hay mozos con notificaciones habilitadas" 
      });
    }

    const tokens = mozos.map(m => m.fcm_token).filter(t => t);

    const message = {
      notification: { title, body },
      tokens: tokens, // Array de tokens solo de mozos
      data: data || {}
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    res.status(200).send({ 
      success: true,
      message: `Notificación enviada a ${mozos.length} mozos`,
      response 
    });
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: error.message });
  }
});

app.post("/notify-only-bartenders", async (req, res) => {
  const { title, body } = req.body;
  
  try {
    const { data: bartenders, error } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "bartender") // 🔥 FILTRO: solo bartenders
      .not("fcm_token", "is", null);

    if (error || !bartenders?.length) {
      return res.status(200).send({ 
        message: "No hay bartenders disponibles" 
      });
    }

    const tokens = bartenders.map(b => b.fcm_token).filter(t => t);

    const message = {
      notification: { title, body },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.status(200).send({ success: true, response });
    
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.post("/notify-order-ready", async (req, res) => {
  const { pedidoId, mesaNumero, clienteEmail, productos } = req.body;
  
  try {
    // 1. Notificar al CLIENTE específico
    const { data: cliente } = await supabase
      .from("clientes")
      .select("fcm_token, nombre")
      .eq("correo", clienteEmail)
      .single();
    
    if (cliente?.fcm_token) {
      await admin.messaging().send({
        notification: {
          title: "🍽️ ¡Tu pedido está listo!",
          body: `Mesa ${mesaNumero}: ${productos.join(', ')}`
        },
        token: cliente.fcm_token,
        data: { pedidoId: pedidoId.toString() }
      });
    }
    
    // 2. Notificar a TODOS los MOZOS
    const { data: mozos } = await supabase
      .from("empleados")
      .select("fcm_token")
      .eq("perfil", "mozo")
      .not("fcm_token", "is", null);
    
    if (mozos?.length) {
      const tokens = mozos.map(m => m.fcm_token);
      await admin.messaging().sendEachForMulticast({
        notification: {
          title: "📋 Pedido listo para servir",
          body: `Mesa ${mesaNumero} - Llevar a la mesa`
        },
        tokens: tokens
      });
    }
    
    res.status(200).send({ 
      success: true, 
      message: "Notificaciones enviadas" 
    });
    
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});  


// curl -X POST http://localhost:3000/notify-maitre-lista-espera \
//   -H "Content-Type: application/json" \
//   -d '{
// NOTA: El endpoint /notify-maitre-lista-espera ya está definido arriba (línea ~257)
// Se eliminó el duplicado para evitar notificaciones dobles