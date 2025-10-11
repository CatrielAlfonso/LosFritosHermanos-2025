import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private backendUrl = 'https://backend-los-fritos-hermanos-2025.onrender.com';

  constructor() { }

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

  async notificarEstadoCliente(clienteEmail: string, nombre: string, apellido: string, estado: 'aceptado' | 'rechazado') {
    try {
      console.log('=== NOTIFICANDO ESTADO CLIENTE ===');
      console.log('Backend URL:', this.backendUrl);
      console.log('Cliente Email:', clienteEmail);
      console.log('Nombre:', nombre);
      console.log('Estado:', estado);

      const pushUrl = `${this.backendUrl}/notify-client-status`;
      console.log('Push URL completa:', pushUrl);

      const pushBody = {
        clienteEmail,
        nombre,
        estado
      };
      console.log('Push Body:', JSON.stringify(pushBody, null, 2));

      console.log('Enviando petición push...');
      const pushResponse = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushBody),
      });

      console.log('Push Response Status:', pushResponse.status);
      console.log('Push Response OK:', pushResponse.ok);
      console.log('Push Response StatusText:', pushResponse.statusText);

      if (!pushResponse.ok) {
        const errorText = await pushResponse.text();
        console.error('Error al enviar notificación push:', errorText);
      } else {
        const result = await pushResponse.json();
        console.log('Push Response Success:', result);
      }

      if (estado === 'rechazado') {
        console.log('=== ENVIANDO CORREO DE RECHAZO ===');
        const emailUrl = `${this.backendUrl}/enviar-correo-rechazo`;
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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailBody),
        });

        console.log('Email Response Status:', emailResponse.status);
        console.log('Email Response OK:', emailResponse.ok);
        console.log('Email Response StatusText:', emailResponse.statusText);

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Error al enviar correo:', errorText);
        } else {
          const result = await emailResponse.json();
          console.log('Email Response Success:', result);
        }
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
}