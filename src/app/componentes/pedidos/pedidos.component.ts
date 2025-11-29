import { CommonModule } from '@angular/common';
import { Component, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AuthService } from 'src/app/servicios/auth.service';
import { CarritoService } from 'src/app/servicios/carrito.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class PedidosComponent  implements OnInit {

  pedidos : any = null
  user = this.authService.userActual

// En pedidos.component.ts

// En pedidos.component.ts

misPedidos = computed(() => {
  const user = this.user();
  const todosPedidos = this.supabase.todosLosPedidos();
  
  // Obtenemos el rol del usuario (Asegúrate de tener acceso a esto)
  // Puede venir de una signal en authService o de una variable local
  const perfil = this.authService.getPerfilUsuario(); // 'cliente', 'cocinero', 'dueño', etc.

  if (!user || !todosPedidos) return [];

  console.log(`👤 Usuario: ${user.email} | Rol: ${perfil}`);

  // --- LÓGICA CONDICIONAL ---

  // CASO 1: ES UN CLIENTE
  // Solo puede ver SUS propios pedidos
  if (perfil === 'cliente') {
    return todosPedidos.filter(p => p.cliente_id === user.id);
  }

  // CASO 2: ES STAFF (Cocinero, Dueño, Mozo)
  // Necesita ver TODOS los pedidos para trabajar.
  // Opcional: Puedes filtrar solo los "activos" si no quieres ver los viejos.
  else {
    // Retornamos todos (o filtra solo los pendientes/en proceso si prefieres)
    return todosPedidos.filter(p => 
      // Opcional: Ocultar los cancelados/entregados viejos para limpiar la vista del cocinero
      p.estado !== 'entregado' && p.estado !== 'finalizado'
    );
  }
});
    

  constructor(
    private supabase : SupabaseService,
    private router : Router,
    private authService : AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private carritoService : CarritoService,
    private notificationService : PushNotificationService,
    private feedback : FeedbackService
  ) { }

  ngOnInit() {
    this.supabase.cargarPedidos();
  }

  getEstadoTexto(estado: string): string {
    const estados: {[key: string]: string} = {
      'pendiente': 'Pendiente',
      'en preparacion': 'En Preparación',
      'listo': 'Listo para servir',
      'entregado': 'Entregado',
      'pagado_pendiente': 'Pago en proceso',
      'finalizado': 'Finalizado',
      'cancelado': 'Cancelado'
    };
    return estados[estado] || estado;
  }

  /**
   * Obtiene el estado detallado del pedido para mostrar al cliente
   * basado en los estados de comida y bebida
   */
  getEstadoDetallado(pedido: any): string {
    const tieneComidas = pedido.comidas?.length > 0 || pedido.postres?.length > 0;
    const tieneBebidas = pedido.bebidas?.length > 0;
    
    // Si el pedido general no está en preparación, usar el estado general
    if (pedido.estado !== 'en preparacion') {
      return this.getEstadoTexto(pedido.estado);
    }
    
    const estadoComida = pedido.estado_comida;
    const estadoBebida = pedido.estado_bebida;
    
    // Verificar si todo está derivado (recién aceptado por mozo)
    const todoDerivado = 
      (!tieneComidas || estadoComida === 'derivado') && 
      (!tieneBebidas || estadoBebida === 'derivado');
    
    if (todoDerivado) {
      return 'Derivado a sectores';
    }
    
    // Verificar si todo está listo
    const todoListo = 
      (!tieneComidas || estadoComida === 'listo') && 
      (!tieneBebidas || estadoBebida === 'listo');
    
    if (todoListo) {
      return 'Listo para servir';
    }
    
    // Si hay algo en preparación
    return 'En Preparación';
  }

  /**
   * Obtiene el estado de cada sector para mostrar detalle al cliente
   */
  getEstadoSectores(pedido: any): { cocina?: string, bar?: string } {
    const resultado: { cocina?: string, bar?: string } = {};
    
    const tieneComidas = pedido.comidas?.length > 0 || pedido.postres?.length > 0;
    const tieneBebidas = pedido.bebidas?.length > 0;
    
    if (tieneComidas && pedido.estado === 'en preparacion') {
      switch(pedido.estado_comida) {
        case 'derivado':
          resultado.cocina = 'Esperando recepción';
          break;
        case 'en preparacion':
          resultado.cocina = 'En preparación';
          break;
        case 'listo':
          resultado.cocina = 'Listo ✓';
          break;
        default:
          resultado.cocina = pedido.estado_comida || 'Pendiente';
      }
    }
    
    if (tieneBebidas && pedido.estado === 'en preparacion') {
      switch(pedido.estado_bebida) {
        case 'derivado':
          resultado.bar = 'Esperando recepción';
          break;
        case 'en preparacion':
          resultado.bar = 'En preparación';
          break;
        case 'listo':
          resultado.bar = 'Listo ✓';
          break;
        default:
          resultado.bar = pedido.estado_bebida || 'Pendiente';
      }
    }
    
    return resultado;
  }

  volverAHome() {
    this.router.navigate(['/home']);
  }

  irAlMenu() {
    this.router.navigate(['/menu']);
  }

  modificarPedido(pedido: any) {
    this.carritoService.cargarPedidoAlCarrito(pedido);
    this.supabase.eliminarPedido(pedido.id)
    this.router.navigate(['/carrito']);
  }

  async eliminarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Eliminar Pedido',
      message: '¿Estás seguro de que querés eliminar este pedido?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await this.supabase.eliminarPedido(pedido.id);
              // El realtime actualizará automáticamente la lista
            } catch (error) {
              console.error('Error eliminando pedido:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Confirma la recepción del pedido por parte del cliente
   * Habilita acceso a juegos y encuestas
   */
  async confirmarRecepcion(pedido: any) {
    try {
      await this.supabase.actualizarPedido(pedido.id, {
        recepcion: true
      });
      
      this.feedback.showToast('exito', '✅ ¡Recepción confirmada! Ya podés acceder a Juegos y Encuestas desde el menú principal.');
      
    } catch (error) {
      console.error('Error al confirmar recepción:', error);
      this.feedback.showToast('error', 'Error al confirmar la recepción. Intentá nuevamente.');
    }
  }

  async pedirCuenta(pedido : any){
    this.notificationService.solicitarCuentaMozo(
      pedido.mesa,
      'Walter',
      "White"
    ).then(()=>{
      this.feedback.showToast('exito', 'Se ha notificado al mozo')
    }).catch(err => {
      this.feedback.showToast('error', 'No se pudo notificar al mozo, intente de nuevo.')
    })
    await this.supabase.actualizarPedido(pedido.id, {
      solicita_cuenta: true
    });
  }

  async escanearQRPropina(pedido: any) {
    try {
      this.feedback.showToast('exito', 'Escaneá el QR de propina');
      
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes && barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.procesarQRPropina(codigoEscaneado, pedido);
      } else {
        this.feedback.showToast('error', 'No se detectó ningún código QR');
      }
    } catch (error) {
      console.error('Error al escanear QR para propina:', error);
      this.feedback.showToast('error', 'Error al escanear el código QR');
    }
  }

  async procesarQRPropina(codigoEscaneado: string, pedido: any) {
    try {
      // Verificar si es QR de propina válido
      const esQRPropina = codigoEscaneado === 'PROPINA_FRITOS_HERMANOS' || 
                          codigoEscaneado.includes('propina') ||
                          codigoEscaneado.includes('PROPINA');
      
      if (!esQRPropina) {
        // Intentar validar como QR de mesa
        let numeroMesa: number | null = null;
        try {
          const datosQR = JSON.parse(codigoEscaneado);
          if (datosQR.numeroMesa) {
            numeroMesa = parseInt(datosQR.numeroMesa);
          }
        } catch {
          const match = codigoEscaneado.match(/numeroMesa[:\s]+(\d+)/);
          if (match) {
            numeroMesa = parseInt(match[1]);
          }
        }
        
        // Validar que sea la mesa correcta
        if (numeroMesa && parseInt(pedido.mesa) === numeroMesa) {
          // Es QR de mesa válido, mostrar selector de propina
          await this.mostrarSelectorPropina(pedido);
          return;
        }
        
        this.feedback.showToast('error', 'QR inválido. Escaneá el QR de propina o de tu mesa.');
        return;
      }
      
      // QR de propina válido, mostrar selector
      await this.mostrarSelectorPropina(pedido);
      
    } catch (error) {
      console.error('Error procesando QR de propina:', error);
      this.feedback.showToast('error', 'Error al procesar el código QR');
    }
  }

  /**
   * Muestra un selector de propina usando AlertController
   */
  async mostrarSelectorPropina(pedido: any) {
    const alert = await this.alertController.create({
      header: '¿Cuánto querés dejar de propina?',
      message: `Subtotal: $${this.calcularSubtotal(pedido).toFixed(2)}`,
      inputs: [
        { name: 'propina', type: 'radio', label: '0% - Sin propina', value: 0 },
        { name: 'propina', type: 'radio', label: '5%', value: 5 },
        { name: 'propina', type: 'radio', label: '10%', value: 10, checked: true },
        { name: 'propina', type: 'radio', label: '15%', value: 15 },
        { name: 'propina', type: 'radio', label: '20%', value: 20 }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async (data) => {
            const propina = data;
            await this.guardarPropina(pedido, propina);
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Guarda la propina seleccionada en el pedido
   */
  async guardarPropina(pedido: any, propina: number) {
    try {
      await this.supabase.actualizarPedido(pedido.id, {
        propina: propina
      });
      
      this.feedback.showToast('exito', `✅ Propina del ${propina}% registrada. Esperando habilitación del mozo.`);
      
    } catch (error) {
      console.error('Error al guardar propina:', error);
      this.feedback.showToast('error', 'Error al guardar la propina. Intentá nuevamente.');
    }
  }

  // ========== CÁLCULOS DE CUENTA ==========

  calcularSubtotal(pedido: any): number {
    if (!pedido) return 0;

    let subtotal = 0;

    // Función helper para calcular el precio de un item
    const calcularPrecioItem = (item: any): number => {
      // Si tiene precioTotal, usarlo
      if (item.precioTotal) return item.precioTotal;
      // Si no, calcular precio * cantidad
      const precio = item.precio || 0;
      const cantidad = item.cantidad || 1;
      return precio * cantidad;
    };

    if (pedido.comidas && Array.isArray(pedido.comidas)) {
      subtotal += pedido.comidas.reduce((sum: number, c: any) => sum + calcularPrecioItem(c), 0);
    }

    if (pedido.bebidas && Array.isArray(pedido.bebidas)) {
      subtotal += pedido.bebidas.reduce((sum: number, b: any) => sum + calcularPrecioItem(b), 0);
    }

    if (pedido.postres && Array.isArray(pedido.postres)) {
      subtotal += pedido.postres.reduce((sum: number, p: any) => sum + calcularPrecioItem(p), 0);
    }

    return subtotal;
  }

  calcularDescuento(pedido: any): number {
    if (!pedido || !pedido.descuento) return 0;
    const subtotal = this.calcularSubtotal(pedido);
    return (subtotal * pedido.descuento) / 100;
  }

  calcularPropina(pedido: any): number {
    if (!pedido || !pedido.propina) return 0;
    const subtotal = this.calcularSubtotal(pedido);
    const descuento = this.calcularDescuento(pedido);
    const basePropina = subtotal - descuento;
    return (basePropina * pedido.propina) / 100;
  }

  calcularTotal(pedido: any): number {
    const subtotal = this.calcularSubtotal(pedido);
    const descuento = this.calcularDescuento(pedido);
    const propina = this.calcularPropina(pedido);
    return subtotal - descuento + propina;
  }

  /**
   * Procesa el pago del pedido (simulado)
   * El cliente espera confirmación del mozo
   */
  async procesarPago(pedido: any) {
    try {
      const total = this.calcularTotal(pedido);
      
      // Marcar el pedido como pagado (pendiente de confirmación del mozo)
      await this.supabase.actualizarPedido(pedido.id, {
        pagado: total,
        estado: 'pagado_pendiente' // Estado intermedio hasta que el mozo confirme
      });
      
      // Notificar al mozo, dueño y supervisor
      await this.notificationService.notificarPagoExitoso(pedido.mesa, total);
      
      this.feedback.showToast('exito', '✅ ¡Pago registrado! Esperando confirmación del mozo.');
      
    } catch (error) {
      console.error('Error al procesar pago:', error);
      this.feedback.showToast('error', 'Error al procesar el pago. Intentá nuevamente.');
    }
  }

}
