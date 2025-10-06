import { Component, computed, OnInit, signal } from '@angular/core';
import { Pedido } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonHeader, IonIcon } from "@ionic/angular/standalone";
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.component.html',
  styleUrls: ['./pedidos-mozo.component.scss'],
  imports: [CurrencyPipe, IonicModule, DatePipe, CommonModule]
})
export class PedidosMozoComponent  implements OnInit {

  //pedidosPendientes = signal<any[]>([]);
  pedidosPendientes = computed(() => this.sb.pedidosPendientes());
  categoriasAbiertas = signal<{[key: string]: {[categoria: string]: boolean}}>({});
  pedidos :any = []
  private subscription: any;

  constructor(private sb : SupabaseService,
    private toastController: ToastController,
    private alertController: AlertController
  ) { 
    
  }

  async ngOnInit() {
    console.log('🎯 Componente mozo iniciado');
    console.log('Pedidos iniciales:', this.pedidosPendientes());
    this.sb.getPedidos();
    
  }

  async aceptarPedido(pedido: Pedido) {
    // await this.sb.actualizarPedido(pedido.id, {
    //   estado: 'en preparacion',
    //   confirmado: true
    // });
    
    // 4. Recargás los pedidos para actualizar la signal
    //await this.cargarPedidos();
  }

  suscribirCambiosEnTiempoReal() {
    
  }

  toggleCategoria(pedidoId: string, categoria: string) {
    const actual = this.categoriasAbiertas();
    const pedidoActual = actual[pedidoId] || {};
    
    this.categoriasAbiertas.set({
      ...actual,
      [pedidoId]: {
        ...pedidoActual,
        [categoria]: !pedidoActual[categoria]
      }
    });
  }

  categoriaAbierta(pedidoId: string, categoria: string): boolean {
    return this.categoriasAbiertas()[pedidoId]?.[categoria] || false;
  }


  async rechazarPedido(pedido: any) {
  const alert = await this.alertController.create({
    header: 'Rechazar Pedido',
    message: `Mesa ${pedido.mesa} - $${pedido.cuenta}`,
    inputs: [
      {
        name: 'motivo',
        type: 'textarea',
        placeholder: 'Ingresá el motivo del rechazo...',
        attributes: {
          required: true
        }
      }
    ],
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Rechazar Pedido',
        handler: (data) => {
          if (!data.motivo || data.motivo.trim() === '') {
            // Mostrar error si no hay motivo
            this.mostrarErrorMotivo();
            return false; // Previene que se cierre el alert
          }
          this.confirmarRechazo(pedido, data.motivo.trim());
          return true;
        }
      }
    ]
  });

  await alert.present();
}

  private async mostrarErrorMotivo() {
    const toast = await this.toastController.create({
      message: 'Debés ingresar un motivo para rechazar el pedido',
      duration: 3000,
      color: 'warning',
      position: 'top'
    });
    await toast.present();
  }

  private async confirmarRechazo(pedido: any, motivo: string) {
    try {
      
      await this.sb.actualizarPedido(pedido.id, {
        estado: 'cancelado',
        confirmado: false,
        motivo_rechazo: motivo
      });

      // No necesitas recargar manualmente, realtime lo hará automáticamente
      
      const toast = await this.toastController.create({
        message: `Pedido de Mesa ${pedido.mesa} rechazado`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();

    } catch (error) {
      console.error('Error rechazando pedido:', error);
      
      const toast = await this.toastController.create({
        message: 'Error al rechazar el pedido',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

}
