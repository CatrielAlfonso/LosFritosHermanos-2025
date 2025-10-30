import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';

@Component({
  selector: 'app-bar',
  templateUrl: './bar.component.html',
  styleUrls: ['./bar.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class BarComponent  implements OnInit {

  private supabaseService = inject(SupabaseService);
  private pushService = inject(PushNotificationService);
  private toastController = inject(ToastController);

  private pedidosAbiertos = signal<{[key: string]: boolean}>({});

  pedidosBar = computed(() => {
    const todosPedidos = this.supabaseService.todosLosPedidos();
    
    return todosPedidos.filter(pedido => 
      pedido.estado === 'en preparacion' && 
      pedido.bebidas.length > 0 &&
      pedido.estado_bebida !== 'listo'
    );
  });

  constructor() { }

  ngOnInit() {
    this.supabaseService.cargarPedidos()
  }

  togglePedido(pedidoId: string) {
    const actual = this.pedidosAbiertos();
    this.pedidosAbiertos.set({
      ...actual,
      [pedidoId]: !actual[pedidoId]
    });
  }

  pedidoAbierto(pedidoId: string): boolean {
    return this.pedidosAbiertos()[pedidoId] || false;
  }

  getEstadoTexto(estado: string): string {
    const estados: {[key: string]: string} = {
      'pendiente': 'Pendiente',
      'en preparacion': 'En Preparación',
      'listo': 'Listo'
    };
    return estados[estado] || estado;
  }

  async marcarComoListo(pedido: any) {
    try {
      // 1. Marcar como listo en la base de datos
      await this.supabaseService.actualizarPedido(pedido.id, {
        estado_bebida: 'listo'
      });
      
      // 2. Preparar información de los productos
      const productos = pedido.bebidas.map((b: any) => `${b.cantidad}x ${b.nombre}`);
      
      // 3. Verificar si el pedido completo está listo
      const tieneComidas = (pedido.comidas && pedido.comidas.length > 0) || 
                           (pedido.postres && pedido.postres.length > 0);
      const comidasListas = !tieneComidas || pedido.estado_comida === 'listo';
      const pedidoCompleto = comidasListas;
      
      // 4. Enviar notificación al mozo
      const tipoProducto = pedidoCompleto ? 'PEDIDO COMPLETO' : 'Bebidas';
      
      console.log('🔔 Enviando notificación al mozo:', {
        mesa: pedido.mesa,
        tipo: tipoProducto,
        productos,
        pedidoCompleto
      });
      
      await this.pushService.notificarMozoPedidoListo(
        pedido.mesa.toString(),
        tipoProducto,
        productos,
        pedido.id
      );
      
      // 5. Mostrar confirmación
      const toast = await this.toastController.create({
        message: pedidoCompleto 
          ? `✅ Pedido completo de Mesa ${pedido.mesa} - Mozo notificado` 
          : `✅ Bebidas de Mesa ${pedido.mesa} listas - Mozo notificado`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Error marcando pedido como listo:', error);
      
      const toast = await this.toastController.create({
        message: '❌ Error al marcar como listo',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

}
