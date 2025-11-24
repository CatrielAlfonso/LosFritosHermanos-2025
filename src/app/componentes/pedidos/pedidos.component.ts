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
      'cancelado': 'Cancelado'
    };
    return estados[estado] || estado;
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

  async escanearQRPropina() {
    try {
      this.feedback.showToast('exito', 'Escaneá el QR de tu mesa para acceder al pago');
      
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes && barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.procesarQRPropina(codigoEscaneado);
      } else {
        this.feedback.showToast('error', 'No se detectó ningún código QR');
      }
    } catch (error) {
      console.error('Error al escanear QR para propina:', error);
      this.feedback.showToast('error', 'Error al escanear el código QR');
    }
  }

  async procesarQRPropina(codigoEscaneado: string) {
    try {
      const user = this.user();
      if (!user?.id) {
        this.feedback.showToast('error', 'Error de autenticación');
        return;
      }

      // Verificar si es QR genérico de propina
      if (codigoEscaneado === 'PROPINA_FRITOS_HERMANOS' || 
          (codigoEscaneado.includes('tipo') && codigoEscaneado.includes('propina'))) {
        await this.mostrarPedidosParaPagar();
        return;
      }

      // Si no es QR genérico, procesar como QR específico de mesa
      let numeroMesa: number | null = null;
      
      // Intentar parsear como JSON (formato nuevo)
      try {
        const datosQR = JSON.parse(codigoEscaneado);
        if (datosQR.numeroMesa) {
          numeroMesa = parseInt(datosQR.numeroMesa);
        }
      } catch {
        // Si no es JSON, intentar extraer número con regex (formato legacy)
        const match = codigoEscaneado.match(/numeroMesa[:\s]+(\d+)/);
        if (match) {
          numeroMesa = parseInt(match[1]);
        }
      }
      
      if (!numeroMesa) {
        this.feedback.showToast('error', 'QR inválido. Escaneá el QR de propina o de tu mesa.');
        return;
      }
      
      // Buscar pedido del cliente en esa mesa
      const pedidoEnMesa = this.misPedidos().find(pedido => 
        parseInt(pedido.mesa) === numeroMesa && 
        pedido.cuenta_habilitada && 
        pedido.estado === 'entregado'
      );
      
      if (!pedidoEnMesa) {
        this.feedback.showToast('error', 'No tenés una cuenta habilitada en esta mesa o el pedido no está entregado');
        return;
      }
      
      // Redirigir a la página de pagos
      this.feedback.showToast('exito', 'QR válido. Accediendo al pago...');
      this.router.navigate(['/pagos', numeroMesa]);
      
    } catch (error) {
      console.error('Error procesando QR de propina:', error);
      this.feedback.showToast('error', 'Error al procesar el código QR');
    }
  }

  async mostrarPedidosParaPagar() {
    // Obtener pedidos del cliente con cuenta habilitada
    const pedidosConCuentaHabilitada = this.misPedidos().filter(pedido => 
      pedido.cuenta_habilitada && 
      pedido.estado === 'entregado' &&
      !pedido.solicita_cuenta
    );

    if (pedidosConCuentaHabilitada.length === 0) {
      this.feedback.showToast('error', 'No tenés cuentas habilitadas para pagar');
      return;
    }

    if (pedidosConCuentaHabilitada.length === 1) {
      // Si solo hay un pedido, ir directamente al pago
      const pedido = pedidosConCuentaHabilitada[0];
      this.feedback.showToast('exito', `Accediendo al pago de Mesa ${pedido.mesa}...`);
      this.router.navigate(['/pagos', pedido.mesa]);
      return;
    }

    // Si hay múltiples pedidos, mostrar selector
    const opciones = pedidosConCuentaHabilitada.map(pedido => ({
      text: `Mesa ${pedido.mesa} - $${pedido.cuenta}`,
      handler: () => {
        this.router.navigate(['/pagos', pedido.mesa]);
      }
    }));

    opciones.push({
      text: 'Cancelar',
      handler: () => {}
    });

    const alert = await this.alertController.create({
      header: 'Seleccionar Mesa para Pagar',
      message: 'Tenés múltiples cuentas habilitadas. Seleccioná cuál querés pagar:',
      buttons: opciones
    });

    await alert.present();
  }


}
