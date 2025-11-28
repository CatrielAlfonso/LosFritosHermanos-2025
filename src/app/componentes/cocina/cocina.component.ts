import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonicModule, ToastController, Platform } from '@ionic/angular';
import { SupabaseService } from 'src/app/servicios/supabase.service';
//import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { NotificationsService } from 'src/app/servicios/notifications.service';
import { INotification } from 'src/app/models/notification.model';
import * as moment from 'moment-timezone';


@Component({
  selector: 'app-cocina',
  templateUrl: './cocina.component.html',
  styleUrls: ['./cocina.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class CocinaComponent  implements OnInit {

  notification:INotification = {
    title: '',
    body: '',
    date: moment().format('YYYY-MM-DD HH:mm:ss'),
    url: ''
  };

  sendNotification()
  {
    console.log(this.notification);
    this.notificationsService.sendNotification(this.notification).then((responseStatus:boolean)=>{
      if(responseStatus)
      {
        this.feedback.showToast('exito','✅ Notificación programada');
      }
      else
      {
        this.feedback.showToast('error','❌ Error al programar la notificación');
      }

    })
  }

  async notificarAlMozo(pedido: any) {
  try {
    const notification: INotification = {
      title: `🍽 Pedido listo - Mesa ${pedido.mesa}`,
      body: `El pedido #${pedido.id} está listo para servir.`,
      date: moment().format('YYYY-MM-DD HH:mm:ss'),
      url: 'https://http.cat/' // o una ruta interna si tenés browser.open()
    };

    const result = await this.notificationsService.sendNotification(notification);

    if (result) {
      this.feedback.showToast('exito', '📢 Notificación enviada al mozo');
      console.log('Notificación enviada al mozo para el pedido:', pedido.id);
    } else {
      this.feedback.showToast('error', '❌ Error al enviar notificación');
      console.log('Error al enviar notificación al mozo para el pedido:', pedido.id);
    }
  } catch (err) {
    console.error('Error al notificar al mozo:', err);
    this.feedback.showToast('error', '❌ Error interno al notificar');
  }
}

  private supabaseService = inject(SupabaseService);
  private pushService = inject(PushNotificationService);
  private toastController = inject(ToastController);
  //private pushService = inject(PushNotificationService);
  private feedback = inject(FeedbackService);
  
  //NOTIFICACIONES
  private notificationsService = inject(NotificationsService);
  private plataform = inject(Platform);

  private pedidosAbiertos = signal<{[key: string]: boolean}>({});

  pedidosCocina = computed(() => {
    const todosPedidos = this.supabaseService.todosLosPedidos();
    
    return todosPedidos.filter(pedido => 
      pedido.estado === 'en preparacion' && 
      (pedido.comidas.length > 0 || pedido.postres.length > 0) &&
      pedido.estado_comida !== 'listo' &&
      (pedido.estado_comida === 'derivado' || pedido.estado_comida === 'en preparacion')
    );
  });

  constructor() { }

  ngOnInit() {

    this.plataform.ready().then(()=>{
      this.notificationsService.init();
      console.log('Notificaciones inicializadas en Cocina');
    });

    this.supabaseService.cargarPedidos();
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
      'derivado': 'Nuevo - Por recibir',
      'en preparacion': 'En Preparación',
      'listo': 'Listo'
    };
    return estados[estado] || estado;
  }

  async marcarComoRecibido(pedido: any) {
    try {
      await this.supabaseService.actualizarPedido(pedido.id, {
        estado_comida: 'en preparacion'
      });
      
      // Si es un pedido de delivery, sincronizar
      if (pedido.mesa === 'DELIVERY') {
        await this.sincronizarConPedidoDelivery(pedido, { estado_comida: 'en preparacion' });
      }
      
      const toast = await this.toastController.create({
        message: `✅ Pedido de Mesa ${pedido.mesa} recibido - En preparación`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Error marcando pedido como recibido:', error);
      
      const toast = await this.toastController.create({
        message: '❌ Error al marcar como recibido',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  async marcarComoListo(pedido: any) {
    try {
      // 1. Marcar como listo en la base de datos
      await this.supabaseService.actualizarPedido(pedido.id, {
        estado_comida: 'listo'
      });
      
      // 1.1. Si es un pedido de delivery, sincronizar con pedidos_delivery
      if (pedido.mesa === 'DELIVERY') {
        await this.sincronizarConPedidoDelivery(pedido, { estado_comida: 'listo' });
      }
      
      // 2. Preparar información de los productos
      const productos = [
        ...pedido.comidas.map((c: any) => `${c.cantidad}x ${c.nombre}`),
        ...pedido.postres.map((p: any) => `${p.cantidad}x ${p.nombre}`)
      ];
      
      // 3. Verificar si el pedido completo está listo
      const tieneBebidas = pedido.bebidas && pedido.bebidas.length > 0;
      const bebidasListas = !tieneBebidas || pedido.estado_bebida === 'listo';
      const pedidoCompleto = bebidasListas;
      
      // 4. Enviar notificación al mozo
      const tipoProducto = pedidoCompleto ? 'PEDIDO COMPLETO' : 'Comidas y Postres';
      
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
          : `✅ Comidas de Mesa ${pedido.mesa} listas - Mozo notificado`,
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

  /**
   * Sincroniza los estados de un pedido con la tabla pedidos_delivery
   */
  private async sincronizarConPedidoDelivery(pedido: any, estadosActualizados: any) {
    try {
      // Extraer el ID del pedido delivery desde las observaciones
      const observaciones = pedido.observaciones_generales || '';
      const match = observaciones.match(/CLIENTE #(\d+):/);
      
      if (!match) {
        console.log('🔍 No se pudo extraer ID de delivery desde observaciones:', observaciones);
        return;
      }
      
      const deliveryId = parseInt(match[1]);
      console.log('🔄 Sincronizando pedido delivery ID:', deliveryId, 'con estados:', estadosActualizados);
      
      // Actualizar el pedido de delivery
      const { error } = await this.supabaseService.supabase
        .from('pedidos_delivery')
        .update(estadosActualizados)
        .eq('id', deliveryId);
      
      if (error) {
        console.error('❌ Error sincronizando con pedidos_delivery:', error);
      } else {
        console.log('✅ Pedido delivery sincronizado correctamente');
      }
      
    } catch (error) {
      console.error('❌ Error en sincronización con delivery:', error);
    }
  }

}
