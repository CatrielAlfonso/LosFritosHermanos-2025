import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonicModule, Platform } from '@ionic/angular';
import { SupabaseService } from 'src/app/servicios/supabase.service';
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
      pedido.estado_comida !== 'listo'
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
      'en preparacion': 'En Preparación',
      'listo': 'Listo'
    };
    return estados[estado] || estado;
  }

  async marcarComoListo(pedido: any) {
    try {
      await this.supabaseService.actualizarPedido(pedido.id, {
        estado_comida: 'listo'
      });
      //await this.pushService.notificarMozoPedidoListo(pedido.mesa, pedido.comidas.tipo, pedido.productos, pedido.id);
      //this.feedback.showToast('exito', '📢 Notificación enviada a los mozos');
      // El realtime actualizará automáticamente la lista
      await this.notificarAlMozo(pedido);
      this.feedback.showToast('exito', '🥳 Pedido marcado como listo');

    } catch (error) {
      console.error('Error marcando pedido como listo:', error);
      this.feedback.showToast('error', '❌ No se pudo actualizar el pedido');
    }
  }

}
