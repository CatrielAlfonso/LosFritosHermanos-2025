import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService, Mensaje, Consulta } from 'src/app/servicios/chat.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-consulta-mozo',
  templateUrl: './consulta-mozo.component.html',
  styleUrls: ['./consulta-mozo.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ConsultaMozoComponent implements OnInit, OnDestroy {
  @ViewChild('chatContainer') chatContainer!: ElementRef;

  mensajes: Mensaje[] = [];
  nuevoMensaje: string = '';
  mesa: number | null = null;
  consulta: Consulta | null = null;
  usuario: any = null;
  usuarioNombre: string = '';
  esCliente: boolean = false;
  esMozo: boolean = false;
  
  private mensajesSubscription?: Subscription;
  private consultaSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private supabaseService: SupabaseService,
    private feedback: FeedbackService,
    private pushService: PushNotificationService
  ) {}

  async ngOnInit() {
    console.log('💬 [ConsultaMozo] Iniciando componente');
    
    // Obtener el número de mesa de los query params
    this.route.queryParams.subscribe(async params => {
      this.mesa = params['mesa'] ? parseInt(params['mesa']) : null;
      console.log('🪑 Mesa:', this.mesa);
      
      if (this.mesa) {
        await this.inicializar();
      }
    });
  }

  async inicializar() {
    // Obtener información del usuario
    const { data: user } = await this.authService.getCurrentUser();
    if (!user?.user) {
      this.feedback.showToast('error', 'No estás autenticado');
      this.router.navigate(['/home']);
      return;
    }

    this.usuario = user.user;
    const email = user.user.email;

    // Determinar si es cliente o mozo
    const { data: empleado } = await this.supabaseService.supabase
      .from('empleados')
      .select('nombre, apellido, perfil')
      .eq('correo', email)
      .single();

    if (empleado && empleado.perfil === 'mozo') {
      this.esMozo = true;
      this.usuarioNombre = `${empleado.nombre} ${empleado.apellido}`;
      console.log('👨‍🍳 Usuario es mozo');
    } else {
      // Es cliente
      const { data: cliente } = await this.supabaseService.supabase
        .from('clientes')
        .select('nombre, apellido')
        .eq('correo', email)
        .single();

      if (cliente) {
        this.esCliente = true;
        this.usuarioNombre = `${cliente.nombre} ${cliente.apellido}`;
        console.log('👤 Usuario es cliente');
      }
    }

    // Obtener o crear consulta
    await this.obtenerOCrearConsulta();
  }

  async obtenerOCrearConsulta() {
    if (!this.mesa) return;

    // Buscar consulta existente
    const consulta = await this.chatService.obtenerConsultaPorMesa(this.mesa);

    if (consulta) {
      console.log('✅ Consulta existente encontrada:', consulta.id);
      this.consulta = consulta;
      await this.chatService.cargarMensajes(consulta.id);
    } else if (this.esCliente) {
      // Solo el cliente puede crear nuevas consultas
      console.log('📝 Creando nueva consulta...');
      const nuevaConsulta = await this.chatService.crearConsulta(
        this.mesa,
        this.usuario.email,
        this.usuarioNombre
      );
      
      if (nuevaConsulta) {
        this.consulta = nuevaConsulta;
        
        // Enviar push notification a todos los mozos
        await this.notificarMozosNuevaConsulta();
      } else {
        this.feedback.showToast('error', 'Error al crear la consulta');
        return;
      }
    }

    // Suscribirse a mensajes en tiempo real
    if (this.consulta) {
      this.suscribirseAMensajes();
    }
  }

  suscribirseAMensajes() {
    if (!this.consulta) return;

    // Suscribirse al observable de mensajes
    this.mensajesSubscription = this.chatService.mensajes$.subscribe(mensajes => {
      this.mensajes = mensajes;
      setTimeout(() => this.scrollToBottom(), 100);
    });

    // Suscribirse a mensajes en tiempo real de Supabase
    this.chatService.suscribirMensajes(this.consulta.id);
  }

  async enviarMensaje() {
    if (!this.nuevoMensaje.trim() || !this.consulta) return;

    const remitenteTipo = this.esMozo ? 'mozo' : 'cliente';
    const contenidoMensaje = this.nuevoMensaje.trim();
    
    // Limpiar input inmediatamente para mejor UX
    this.nuevoMensaje = '';
    
    // Agregar mensaje local inmediatamente (optimistic update)
    const mensajeTemp: any = {
      id: Date.now(), // ID temporal
      consulta_id: this.consulta.id,
      contenido: contenidoMensaje,
      remitente_tipo: remitenteTipo,
      remitente_email: this.usuario.email,
      remitente_nombre: this.usuarioNombre,
      fecha: new Date().toISOString(),
      leido: false
    };
    
    this.mensajes.push(mensajeTemp as Mensaje);
    setTimeout(() => this.scrollToBottom(), 50);
    
    const exito = await this.chatService.enviarMensaje(
      this.consulta.id,
      contenidoMensaje,
      remitenteTipo,
      this.usuario.email,
      this.usuarioNombre
    );

    if (exito) {
      console.log('✅ Mensaje enviado exitosamente');
      
      // Si es un mozo respondiendo, enviar push al cliente
      if (this.esMozo && this.consulta.cliente_email) {
        await this.pushService.notificarClienteRespuestaMozo(
          this.consulta.cliente_email,
          this.usuarioNombre,
          this.mesa!
        );
      }
      
      // Si es un cliente enviando mensaje, notificar a los mozos
      if (this.esCliente) {
        console.log('📤 Cliente envió mensaje, notificando a mozos...');
        await this.pushService.notificarMozosConsultaCliente(
          this.usuarioNombre,
          '',  // apellido
          this.mesa!.toString(),
          contenidoMensaje
        );
      }
      
      // Recargar mensajes para obtener el ID real del servidor
      await this.chatService.cargarMensajes(this.consulta.id);
    } else {
      // Si falla, remover el mensaje temporal
      this.mensajes = this.mensajes.filter(m => m.id !== mensajeTemp.id);
      this.feedback.showToast('error', 'Error al enviar mensaje');
    }
  }

  async notificarMozosNuevaConsulta() {
    try {
      // Obtener todos los mozos
      const { data: mozos } = await this.supabaseService.supabase
        .from('empleados')
        .select('correo, nombre, apellido, fcm_token')
        .eq('perfil', 'mozo');

      if (mozos && mozos.length > 0) {
        console.log('🔔 Notificando a', mozos.length, 'mozos');
        
        for (const mozo of mozos) {
          if (mozo.fcm_token) {
            await this.pushService.notificarMozoNuevaConsulta(
              mozo.correo,
              this.usuarioNombre,
              this.mesa!
            );
          }
        }
      }
    } catch (error) {
      console.error('Error al notificar mozos:', error);
    }
  }

  scrollToBottom() {
    try {
      if (this.chatContainer) {
        const element = this.chatContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error al hacer scroll:', err);
    }
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const hoy = new Date();
    
    const esHoy = date.toDateString() === hoy.toDateString();
    
    const horas = date.getHours().toString().padStart(2, '0');
    const minutos = date.getMinutes().toString().padStart(2, '0');
    
    if (esHoy) {
      return `${horas}:${minutos}`;
    } else {
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${dia}/${mes} ${horas}:${minutos}`;
    }
  }

  esMensajePropio(mensaje: Mensaje): boolean {
    return mensaje.remitente_email === this.usuario.email;
  }

  volver() {
    this.router.navigate(['/menu']);
  }

  ngOnDestroy() {
    console.log('🔄 Limpiando suscripciones');
    if (this.mensajesSubscription) {
      this.mensajesSubscription.unsubscribe();
    }
    if (this.consultaSubscription) {
      this.consultaSubscription.unsubscribe();
    }
    this.chatService.limpiarSuscripciones();
  }
}
