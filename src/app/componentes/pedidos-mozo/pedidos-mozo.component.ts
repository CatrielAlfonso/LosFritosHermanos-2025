import { Component, computed, OnInit, signal } from '@angular/core';
import { Pedido } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonHeader, IonIcon } from "@ionic/angular/standalone";
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { Haptics } from '@capacitor/haptics';

@Component({
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.component.html',
  styleUrls: ['./pedidos-mozo.component.scss'],
  imports: [CurrencyPipe, IonicModule, DatePipe, CommonModule]
})
export class PedidosMozoComponent  implements OnInit {

  //pedidosPendientes = signal<any[]>([]);
  //pedidosPendientes = computed(() => this.sb.pedidosPendientes());
  pedidosPendientes = computed(() => {
  const todosPedidos = this.sb.todosLosPedidos();
  
  return todosPedidos.filter(pedido => 
    pedido.estado === 'pendiente' || 
    pedido.estado === 'en preparacion' ||
    pedido.estado === 'entregado' ||
    pedido.estado === 'pagado_pendiente'
  );
});
  categoriasAbiertas = signal<{[key: string]: {[categoria: string]: boolean}}>({});
  pedidos :any = []
  pedidosListosParaEntregar = computed(() => {
  const todosPedidos = this.sb.todosLosPedidos();
  
  return todosPedidos.filter(pedido => 
    pedido.estado === 'en preparacion' && 
    this.estaListoParaEntregar(pedido)
  );
});

pedidosHistorial = computed(() => {
  const todosPedidos = this.sb.todosLosPedidos();
  
  return todosPedidos.filter(pedido => 
    pedido.estado === 'entregado' || 
    pedido.estado === 'cancelado' ||
    pedido.estado === 'finalizado'
  ).sort((a, b) => new Date(b.fecha_pedido).getTime() - new Date(a.fecha_pedido).getTime());
});

segmentoActivo = 'activos';

  constructor(private sb : SupabaseService,
    private toastController: ToastController,
    private alertController: AlertController,
    private http: HttpClient,
    private pushNotificationService: PushNotificationService,
    private toastService : FeedbackService
  ) { 
    
  }

  async ngOnInit() {
    console.log('🎯 Componente mozo iniciado');
    console.log('Pedidos iniciales:', this.pedidosPendientes());
    this.sb.getPedidos();
    
  }

  cambiarSegmento(event: any) {
    this.segmentoActivo = event.detail.value;
  }

  async habilitarCuenta(pedido : any){
    try{
      const {data, error} = await this.sb.actualizarPedido(pedido.id, {
        solicita_cuenta: false, 
        cuenta_habilitada: true,
      });
      if(error) throw error

      await this.sb.actualizarMesa(parseInt(pedido.mesa), {
        pedido_id: pedido.id
      });

      await this.sb.cargarPedidos();
      const toast = await this.toastController.create({
        message: `Cuenta habilitada para mesa ${pedido.mesa}`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    }catch(error){
      console.log('error al habilitar la cuenta', error)
    }
  }

  async aceptarPedido(pedido: any) {
    try{
      // Determinar qué sectores tienen productos
      const tieneComidas = pedido.comidas?.length > 0 || pedido.postres?.length > 0;
      const tieneBebidas = pedido.bebidas?.length > 0;
      
      // Preparar objeto de actualización con estados derivados
      const actualizacion: any = {
        estado: 'en preparacion',
        confirmado: true
      };
      
      // Derivar a cocina si hay comidas/postres
      if (tieneComidas) {
        actualizacion.estado_comida = 'derivado';
      }
      
      // Derivar a bar si hay bebidas
      if (tieneBebidas) {
        actualizacion.estado_bebida = 'derivado';
      }
      
      await this.sb.actualizarPedido(pedido.id, actualizacion);
      
      // Notificar al cliente que el pedido fue confirmado
      try {
        await this.notificarClientePedidoConfirmado(pedido);
      } catch (notifError) {
        console.error('Error al notificar cliente sobre confirmación:', notifError);
      }
      
      // Notificar a cocineros si hay comidas/postres
      if (tieneComidas) {
        try {
          const comidas = pedido.comidas?.map((c: any) => c.nombre) || [];
          const postres = pedido.postres?.map((p: any) => p.nombre) || [];
          console.log('🍳 Notificando a cocineros - Mesa:', pedido.mesa);
          await this.pushNotificationService.notificarCocineroNuevoPedido(
            pedido.mesa.toString(),
            comidas,
            postres
          );
        } catch (notifError) {
          console.error('Error al notificar cocineros:', notifError);
        }
      }
      
      // Notificar a bartenders si hay bebidas
      if (tieneBebidas) {
        try {
          const bebidas = pedido.bebidas?.map((b: any) => b.nombre) || [];
          console.log('🍺 Notificando a bartenders - Mesa:', pedido.mesa);
          await this.pushNotificationService.notificarBartenderNuevoPedido(
            pedido.mesa.toString(),
            bebidas
          );
        } catch (notifError) {
          console.error('Error al notificar bartenders:', notifError);
        }
      }
      
      await this.sb.cargarPedidos();
      const toast = await this.toastController.create({
        message: 'Pedido aceptado con exito',
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    }catch(error){
      console.log('error al actualizar el pedido por el mozo: ', error)
    }
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

      // Notificar al cliente que el pedido fue rechazado
      try {
        await this.notificarClientePedidoRechazado(pedido, motivo);
      } catch (notifError) {
        console.error('Error al notificar cliente sobre rechazo:', notifError);
        // No bloquear el flujo si falla la notificación
      }

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
      
      // Vibrar en error
      try { await Haptics.vibrate({ duration: 300 }); } catch (e) {}
      
      const toast = await this.toastController.create({
        message: 'Error al rechazar el pedido',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }

  estaListoParaEntregar(pedido: any): boolean {
    const tieneComida = pedido.comidas.length > 0;
    const tieneBebida = pedido.bebidas.length > 0;
    
    // console.log('🔍 Debug estaListoParaEntregar:', {
    //   mesa: pedido.mesa,
    //   tieneComida,
    //   tieneBebida, 
    //   estado_comida: pedido.estado_comida,
    //   estado_bebida: pedido.estado_bebida,
    //   comidas: pedido.comidas,
    //   bebidas: pedido.bebidas,
    //   precio: pedido.precio
    // });
    
    if (tieneComida && tieneBebida) {
      return pedido.estado_comida === 'listo' && pedido.estado_bebida === 'listo';
    }
    
    if (tieneComida) {
      return pedido.estado_comida === 'listo';
    }
    
    if (tieneBebida) {
      return pedido.estado_bebida === 'listo';
    }
    
    return false;
  }

  async entregarPedido(pedido: any) {
    try {
      await this.sb.actualizarPedido(pedido.id, {
        estado: 'entregado'
      });
      
      const toast = await this.toastController.create({
        message: `Pedido de Mesa ${pedido.mesa} entregado`,
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Error entregando pedido:', error);
      
      // Vibrar en error
      try { await Haptics.vibrate({ duration: 300 }); } catch (e) {}
      
      const toast = await this.toastController.create({
        message: 'Error al marcar como entregado',
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
      await toast.present();
    }
  }


  getEstadoTexto(estado: string): string {
    const estados: {[key: string]: string} = {
      'pendiente': 'Pendiente',
      'derivado': 'Derivado a sectores',
      'en preparacion': 'En Preparación', 
      'listo': 'Listo',
      'entregado': 'Entregado',
      'pagado_pendiente': '💰 Pago pendiente',
      'finalizado' : 'Finalizado'
    };
    return estados[estado] || estado;
  }

  async confirmarPagoPedido(pedido : any){
    try{
      const esClienteAnonimo = false

      console.log('DEBUG: El objeto PEDIDO que se envía es:', pedido);

      const resultado = await this.pushNotificationService.generarFacturaYConfirmarPago(pedido);

      if (resultado.success) {
        // ¡Éxito! Muestra un toast al mozo
        console.log('Pago confirmado y factura generada:', resultado.pdfUrl);
        
        // 1. Actualizar estado del pedido a finalizado
        await this.sb.actualizarPedido(pedido.id, {
          estado: 'finalizado'
        });

        // 2. Liberar la mesa
        //await this.liberarMesa(pedido.mesa);

        // 3. Notificar a dueños y supervisores
        try {
          await this.notificarConfirmacionPago(pedido);
        } catch (notifError) {
          console.error('Error al notificar confirmación de pago:', notifError);
          // No bloquear el flujo si falla la notificación
        }

        // 4. Recargar pedidos para actualizar la UI
        await this.sb.cargarPedidos();

        this.toastService.showToast('exito', 'Pago confirmado y mesa liberada');
      } else {
        // El backend manejó el error
        throw new Error(resultado.error || 'Error desconocido en el backend');
      }

    } catch (error) {
      console.error('Error al confirmar el pago:', error);
      this.toastService.showToast('error', 'Error al confirmar el pago')
    }
  }
  
  /**
   * Notifica al cliente que su pedido fue confirmado
   */
  private async notificarClientePedidoConfirmado(pedido: any) {
    try {
      // Obtener email del cliente
      const { data: cliente } = await this.sb.supabase
        .from('clientes')
        .select('correo')
        .eq('uid', pedido.cliente_id)
        .single();

      if (cliente && cliente.correo) {
        await this.pushNotificationService.notificarClientePedidoConfirmado(
          cliente.correo,
          pedido.mesa,
          pedido.tiempo_estimado || 30
        );
      }
    } catch (error) {
      console.error('Error al notificar cliente sobre confirmación:', error);
      throw error;
    }
  }

  /**
   * Notifica al cliente que su pedido fue rechazado
   */
  private async notificarClientePedidoRechazado(pedido: any, motivo: string) {
    try {
      // Obtener email del cliente
      const { data: cliente } = await this.sb.supabase
        .from('clientes')
        .select('correo')
        .eq('uid', pedido.cliente_id)
        .single();

      if (cliente && cliente.correo) {
        await this.pushNotificationService.notificarClientePedidoRechazado(
          cliente.correo,
          pedido.mesa,
          motivo
        );
      }
    } catch (error) {
      console.error('Error al notificar cliente sobre rechazo:', error);
      throw error;
    }
  }

  /**
   * Libera una mesa estableciendo su estado como disponible
   */
  private async liberarMesa(numeroMesa: string) {
    try {
      const { error } = await this.sb.supabase
        .from('mesas')
        .update({ 
          estado: 'libre',
          cliente_id: null,
          pedido_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('numero', parseInt(numeroMesa));

      if (error) {
        console.error('Error al liberar mesa:', error);
        throw error;
      }

      console.log(`✅ Mesa ${numeroMesa} liberada exitosamente`);
    } catch (error) {
      console.error('Error al liberar mesa:', error);
      throw error;
    }
  }

  /**
   * Notifica a dueños y supervisores sobre la confirmación de pago
   */
  private async notificarConfirmacionPago(pedido: any) {
    try {
      // Obtener nombre del mozo actual
      const { data: { user } } = await this.sb.supabase.auth.getUser();
      let mozoNombre = 'Mozo';
      
      if (user && user.email) {
        const { data: empleado } = await this.sb.supabase
          .from('empleados')
          .select('nombre, apellido')
          .eq('correo', user.email)
          .single();
        
        if (empleado) {
          mozoNombre = `${empleado.nombre} ${empleado.apellido}`;
        }
      }

      await this.pushNotificationService.notificarConfirmacionPago(
        pedido.mesa,
        pedido.precio || pedido.cuenta,
        mozoNombre
      );
    } catch (error) {
      console.error('Error al notificar confirmación de pago:', error);
      throw error;
    }
  }

}
