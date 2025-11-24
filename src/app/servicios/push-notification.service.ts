import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';  //COMENTADA PARA PROBAR LOCAL HOST, ESTA ES LA QUE VA
  //private backendUrl = 'http://localhost:3000' //para probar en local host por si los cambios no se actualizaron
  private authService = inject(AuthService)
  private router = inject(Router)

  constructor() { }

  inicializarListeners() {
    // Listener para cuando la app está ABIERTA y recibe una notificación
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Notificación recibida en primer plano:', notification);
      
      // La mostramos visualmente porque por defecto no aparece
      LocalNotifications.schedule({
        notifications: [{
          title: notification.title || '',
          body: notification.body || '',
          id: new Date().getTime(),
          smallIcon: 'ic_stat_fritos_hermanos.png',
          sound: 'default'
        }]
      });
    });

    // Listener para cuando el usuario TOCA la notificación (y la app estaba cerrada/segundo plano)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('El usuario tocó la notificación:', action);
      
      const data = action.notification.data;
      if (data && data.link) {
        this.router.navigateByUrl(data.link);
      }else {
        this.router.navigateByUrl('/home');
      }
    });
  }

  async generarFacturaYConfirmarPago(pedido: any, esAnonimo: boolean = false) {
    try {
      console.log('En el push notification service: ', pedido)
      console.log('DEBUG (SERVICIO): El VALOR de pedido.id que voy a enviar es:', pedido.id);
      const response = await fetch(`${this.backendUrl}/api/facturacion/generar-y-enviar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pedidoId: pedido.id
        })
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const result = await response.json();
      console.log('Respuesta del backend (facturación):', result);
      return result;

    } catch (error) {
      console.error('Falló el servicio de generación de factura:', error);
      throw error;
    }
  }



  async notificarMaitreNuevoCliente(clienteNombre: string, clienteApellido: string = '') {
    try {
      const response = await fetch(`${this.backendUrl}/notify-maitre-new-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteNombre,
          clienteApellido
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarClienteAsignadaMesa(
    clienteEmail: string, 
    mesaNumero: string, 
    clienteNombre: string, 
    clienteApellido: string
  ) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-client-table-assigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteEmail,
          mesaNumero,
          clienteNombre,
          clienteApellido
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarMozosConsultaCliente(
    clienteNombre: string,
    clienteApellido: string,
    mesaNumero: string,
    consulta: string
  ) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-mozos-client-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteNombre,
          clienteApellido,
          mesaNumero,
          consulta
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarBartenderNuevoPedido(mesaNumero: string, bebidas: string[]) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-bartender-new-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesaNumero,
          bebidas
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarCocineroNuevoPedido(mesaNumero: string, comidas: string[], postres: string[]) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-cocinero-new-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesaNumero,
          comidas,
          postres
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarMozoPedidoListo(mesaNumero: string, tipoProducto: string, productos: string[], pedidoId: number) {
    try {
      const requestBody = {
        mesaNumero,
        tipoProducto,
        productos,
        pedidoId
      };
      
      const response = await fetch(`${this.backendUrl}/notify-mozo-order-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, text: ${errorText}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Error al enviar notificación a mozos:', error);
      throw error;
    }
  }

  async notificarMozoSolicitudCuenta(mesaNumero: string, clienteNombre: string, clienteApellido: string) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-mozo-request-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesaNumero,
          clienteNombre,
          clienteApellido
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async notificarSupervisoresNuevoCliente(clienteNombre: string, clienteApellido: string = '') {
    try {
      const response = await fetch(`${this.backendUrl}/notify-supervisors-new-client`, {
        method: 'POST',
        headers: {
          "Access-Control-Allow-Headers" : "Content-Type",
          "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json',
         "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PATCH",
        },
        body: JSON.stringify({
          clienteNombre,
          clienteApellido
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      throw error;
    }
  }

  async borrarFcmToken(email: string) {
    try {
      const response = await fetch(`${this.backendUrl}/clear-fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
      
    } catch (error) {
      console.error('Error al borrar FCM token:', error);
      throw error;
    }
  }

  // Notificar a mozos cuando hay una nueva consulta
  async notificarMozoNuevaConsulta(mozoEmail: string, clienteNombre: string, mesa: number) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-mozo-new-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mozoEmail,
          clienteNombre,
          mesa
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación enviada al mozo:', mozoEmail);
      return result;
      
    } catch (error) {
      console.error('Error al notificar mozo:', error);
      throw error;
    }
  }

  // Notificar al cliente cuando el mozo responde
  async notificarClienteRespuestaMozo(clienteEmail: string, mozoNombre: string, mesa: number) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-client-mozo-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteEmail,
          mozoNombre,
          mesa
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación enviada al cliente:', clienteEmail);
      return result;
      
    } catch (error) {
      console.error('Error al notificar cliente:', error);
      throw error;
    }
  }

  async notificarEstadoCliente(clienteEmail: string, nombre: string, apellido: string, estado: 'aceptado' | 'rechazado') {
    try {
      console.log('=== NOTIFICANDO ESTADO CLIENTE ===');
      console.log('Backend URL:', this.backendUrl);
      console.log('Cliente Email:', clienteEmail);
      console.log('Nombre:', nombre);
      console.log('Estado:', estado);

      const emailUrl = estado === 'rechazado' 
        ? `${this.backendUrl}/enviar-correo-rechazo`
        : `${this.backendUrl}/enviar-correo-aceptacion`;
      
      const tipoCorreo = estado === 'rechazado' ? 'RECHAZO' : 'ACEPTACIÓN';
      console.log(`=== ENVIANDO CORREO DE ${tipoCorreo} ===`);
      console.log('Email URL completa:', emailUrl);

      const emailBody = {
        correo: clienteEmail,
        nombre,
        apellido
      };
      console.log('Email Body:', JSON.stringify(emailBody, null, 2));

      console.log('Enviando petición email...');
      const emailResponse = await fetch(emailUrl, {
        method: 'POST',
        headers: {
          "Access-Control-Allow-Headers" : "Content-Type",
          "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json',
         "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PATCH"
        },
        credentials: 'omit',
        body: JSON.stringify(emailBody),
      });

      console.log('Email Response Status:', emailResponse.status);
      console.log('Email Response OK:', emailResponse.ok);
      console.log('Email Response StatusText:', emailResponse.statusText);

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error('Error al enviar correo:', errorText);
        throw new Error(`Error al enviar correo: ${errorText}`);
      } else {
        const result = await emailResponse.json();
        console.log('Email Response Success:', result);
      }

      console.log('=== NOTIFICACIÓN COMPLETADA ===');
      return { success: true };
    } catch (error) {
      console.error('=== ERROR EN NOTIFICACIÓN ===');
      console.error('Error completo:', error);
      console.error('Error message:', (error as Error).message);
      console.error('Error stack:', (error as Error).stack);
      throw error;
    }
  }

  async solicitarCuentaMozo(mesaNumero: string, clienteNombre: string, clienteApellido: string){
    try{
      const response = await fetch(`${this.backendUrl}/notify-mozo-request-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesaNumero,
          clienteNombre,
          clienteApellido
        })
      })
      if (!response.ok) {
        // Si el servidor responde con un error (ej: 404, 500), se lanza una excepción.
        throw new Error(`Error del servidor: ${response.status}`);
      }
      const result = await response.json();
      console.log('Notificación de solicitud de cuenta enviada:', result);
      return result;

    }catch(error){
      console.error('Falló al notificar la solicitud de cuenta:', error);
      throw error;
    }
  }

  async notificarPagoExitoso(mesaNumero: string, montoTotal: number) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-payment-success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesaNumero,
          montoTotal
        })
      });

      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const result = await response.json();
      console.log('Notificación de pago enviada:', result);
      return result;

    } catch (error) {
      console.error('Falló al notificar el pago:', error);
      throw error;
    }
  }

  // Notificar a mozos cuando hay un nuevo pedido del cliente
  async notificarMozoNuevoPedido(
    mozoEmail: string, 
    mesa: string, 
    clienteNombre: string, 
    productos: string[], 
    total: number
  ) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-mozo-new-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mozoEmail,
          mesa,
          clienteNombre,
          productos,
          total
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación de nuevo pedido enviada al mozo:', mozoEmail);
      return result;
      
    } catch (error) {
      console.error('Error al notificar mozo sobre nuevo pedido:', error);
      throw error;
    }
  }

  // Notificar al cliente cuando el mozo confirma el pedido
  async notificarClientePedidoConfirmado(clienteEmail: string, mesa: string, tiempoEstimado: number) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-client-order-confirmed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteEmail,
          mesa,
          tiempoEstimado
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación de pedido confirmado enviada al cliente:', clienteEmail);
      return result;
      
    } catch (error) {
      console.error('Error al notificar cliente sobre confirmación:', error);
      throw error;
    }
  }

  // Notificar al cliente cuando el mozo rechaza el pedido
  async notificarClientePedidoRechazado(clienteEmail: string, mesa: string, motivo: string) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-client-order-rejected`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteEmail,
          mesa,
          motivo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación de pedido rechazado enviada al cliente:', clienteEmail);
      return result;
      
    } catch (error) {
      console.error('Error al notificar cliente sobre rechazo:', error);
      throw error;
    }
  }

  // Notificar a dueños y supervisores cuando el mozo confirma un pago
  async notificarConfirmacionPago(mesa: string, montoTotal: number, mozoNombre: string) {
    try {
      const response = await fetch(`${this.backendUrl}/notify-payment-confirmed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mesa,
          montoTotal,
          mozoNombre
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Notificación de confirmación de pago enviada a dueños/supervisores');
      return result;
      
    } catch (error) {
      console.error('Error al notificar confirmación de pago:', error);
      throw error;
    }
  }



}