import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private backendUrl = 'https://backend-taco-mex-2025.onrender.com';

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

  // async enviarCorreoEstadoCliente(clienteEmail: string, nombre: string, estado: 'aceptado' | 'rechazado') {
  //   try {
  //     const response = await fetch(`${this.backendUrl}/enviarCorreoEstado`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         clienteEmail,
  //         nombre,
  //         estado
  //       }),
  //     });

  //     const resultado = await response.json();
  //     if (!response.ok) {
  //       throw new Error(resultado.error || 'Error al enviar el correo');
  //     }

  //     return resultado;
  //   } catch (error) {
  //     console.error('Error al enviar el correo:', error);
  //     throw error;
  //   }
  // }
}