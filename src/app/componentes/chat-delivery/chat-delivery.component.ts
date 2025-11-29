import { Component, OnInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonFooter,
  IonTextarea,
  IonItem,
  ToastController
} from '@ionic/angular/standalone';
import { SupabaseService } from '../../servicios/supabase.service';
import { AuthService } from '../../servicios/auth.service';
import { DeliveryService } from '../../servicios/delivery.service';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';
import { addIcons } from 'ionicons';
import { arrowBackOutline, sendOutline } from 'ionicons/icons';

@Component({
  selector: 'app-chat-delivery',
  templateUrl: './chat-delivery.component.html',
  styleUrls: ['./chat-delivery.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonFooter,
    IonTextarea,
    IonItem,
    FritosSpinnerComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatDeliveryComponent implements OnInit {
  @ViewChild(IonContent, { static: false }) content!: IonContent;

  pedidoId!: number;
  conversacionId!: number;
  mensajes: any[] = [];
  nuevoMensaje: string = '';
  miTipo: string = ''; // 'cliente' o 'repartidor'
  esRepartidor: boolean = false;
  nombreOtraParte: string = '';
  cargando: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService,
    private auth: AuthService,
    private deliveryService: DeliveryService,
    private toastController: ToastController
  ) {
    addIcons({ arrowBackOutline, sendOutline });
  }

  async ngOnInit() {
    this.pedidoId = Number(this.route.snapshot.paramMap.get('pedidoId'));
    
    const perfil = this.auth.getPerfilUsuario();
    this.miTipo = perfil === 'repartidor' ? 'repartidor' : 'cliente';
    this.esRepartidor = this.miTipo === 'repartidor';
    
    await this.cargarConversacion();
    await this.cargarMensajes();
    this.suscribirNuevosMensajes();
    this.marcarMensajesComoLeidos();
    
    this.cargando = false;
  }

  async cargarConversacion() {
    try {
      const { data, error } = await this.supabase.supabase
        .from('conversaciones_delivery')
        .select('*')
        .eq('pedido_id', this.pedidoId)
        .single();
      
      if (error) {
        console.error('Error al cargar conversación:', error);
        
        // Si no existe la conversación, intentar crearla
        if (error.code === 'PGRST116') {
          await this.crearConversacion();
        }
        return;
      }
      
      this.conversacionId = data.id;
      
      // Obtener nombre de la otra parte
      if (this.esRepartidor) {
        const pedido = await this.deliveryService.obtenerPedidoPorId(this.pedidoId);
        this.nombreOtraParte = pedido?.cliente_nombre || 'Cliente';
      } else {
        // Obtener nombre del repartidor desde la conversación o pedido
        const pedido = await this.deliveryService.obtenerPedidoPorId(this.pedidoId);
        this.nombreOtraParte = pedido?.repartidor_nombre || 'Repartidor';
      }
    } catch (error) {
      console.error('Error:', error);
      await this.mostrarToast('Error al cargar conversación', 'danger');
    }
  }

  async crearConversacion() {
    try {
      const pedido = await this.deliveryService.obtenerPedidoPorId(this.pedidoId);
      
      if (!pedido || !pedido.repartidor_id) {
        await this.mostrarToast('Este pedido aún no tiene repartidor asignado', 'warning');
        this.volver();
        return;
      }

      const { data, error } = await this.supabase.supabase
        .from('conversaciones_delivery')
        .insert([{
          pedido_id: this.pedidoId,
          cliente_id: pedido.cliente_id,
          repartidor_id: pedido.repartidor_id,
          activa: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      this.conversacionId = data.id;
    } catch (error) {
      console.error('Error al crear conversación:', error);
    }
  }

  async cargarMensajes() {
    if (!this.conversacionId) return;

    try {
      const { data, error } = await this.supabase.supabase
        .from('mensajes_delivery')
        .select('*')
        .eq('conversacion_id', this.conversacionId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      this.mensajes = data || [];
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    }
  }

  suscribirNuevosMensajes() {
    if (!this.conversacionId) return;

    this.supabase.supabase
      .channel(`mensajes_${this.conversacionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_delivery',
          filter: `conversacion_id=eq.${this.conversacionId}`
        },
        (payload: any) => {
          console.log('Nuevo mensaje recibido:', payload);
          
          // Solo agregar si es de la otra parte (evitar duplicados de mensajes propios)
          if (payload.new.remitente_tipo !== this.miTipo) {
            // Verificar que no exista ya el mensaje (por si acaso)
            const yaExiste = this.mensajes.some(m => m.id === payload.new.id);
            if (!yaExiste) {
              this.mensajes.push(payload.new);
              setTimeout(() => this.scrollToBottom(), 100);
            }
            this.marcarMensajeComoLeido(payload.new.id);
          }
        }
      )
      .subscribe();
  }

  async enviarMensaje() {
    if (!this.nuevoMensaje.trim() || !this.conversacionId) return;

    const mensajeTexto = this.nuevoMensaje.trim();
    this.nuevoMensaje = ''; // Limpiar input inmediatamente

    try {
      const { data: { user } } = await this.auth.getCurrentUser();
      if (!user) return;

      let remitente: any;
      
      if (this.esRepartidor) {
        remitente = await this.deliveryService.obtenerInfoRepartidor(user.email!);
      } else {
        remitente = await this.deliveryService.obtenerInfoCliente();
      }

      if (!remitente) {
        await this.mostrarToast('Error al obtener información del usuario', 'danger');
        return;
      }

      const nuevoMensajeObj = {
        conversacion_id: this.conversacionId,
        remitente_tipo: this.miTipo,
        remitente_id: remitente.id,
        remitente_nombre: `${remitente.nombre} ${remitente.apellido || ''}`,
        mensaje: mensajeTexto
      };

      const { data, error } = await this.supabase.supabase
        .from('mensajes_delivery')
        .insert([nuevoMensajeObj])
        .select()
        .single();

      if (error) throw error;

      // Agregar el mensaje a la lista inmediatamente
      this.mensajes.push(data);
      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error: any) {
      console.error('Error al enviar mensaje:', error);
      await this.mostrarToast('Error al enviar mensaje', 'danger');
    }
  }

  async marcarMensajesComoLeidos() {
    if (!this.conversacionId) return;

    try {
      await this.supabase.supabase
        .from('mensajes_delivery')
        .update({ 
          leido: true,
          leido_at: new Date().toISOString()
        })
        .eq('conversacion_id', this.conversacionId)
        .eq('leido', false)
        .neq('remitente_tipo', this.miTipo);
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
    }
  }

  async marcarMensajeComoLeido(mensajeId: number) {
    try {
      await this.supabase.supabase
        .from('mensajes_delivery')
        .update({ 
          leido: true,
          leido_at: new Date().toISOString()
        })
        .eq('id', mensajeId);
    } catch (error) {
      console.error('Error al marcar mensaje como leído:', error);
    }
  }

  formatearHora(fecha: string): string {
    return new Date(fecha).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (date.toDateString() === hoy.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  }

  mostrarSeparadorFecha(index: number): boolean {
    if (index === 0) return true;
    
    const fechaActual = new Date(this.mensajes[index].created_at).toDateString();
    const fechaAnterior = new Date(this.mensajes[index - 1].created_at).toDateString();
    
    return fechaActual !== fechaAnterior;
  }

  scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  async mostrarToast(mensaje: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color: color,
      position: 'top'
    });
    await toast.present();
  }

  volver() {
    this.router.navigate([this.esRepartidor ? '/panel-repartidor' : '/home']);
  }

  ngOnDestroy() {
    // Desuscribirse del canal
    this.supabase.supabase.removeAllChannels();
  }
}

