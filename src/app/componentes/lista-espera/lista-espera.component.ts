import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonList, IonItem, IonLabel, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon, IonBackButton, IonButtons, IonModal, AlertController } from '@ionic/angular/standalone';
import { SupabaseService } from '../../servicios/supabase.service';
import { LoadingService } from '../../servicios/loading.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { Router } from '@angular/router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

interface ClienteEnLista {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  fecha_ingreso: string;
  mesa_asignada?: string | null;
}

@Component({
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.component.html',
  styleUrls: ['./lista-espera.component.scss'],
  imports: [
    CommonModule,
    IonContent,

    IonButton,
    IonIcon,
 
    IonModal
  ],
  standalone: true
})
export class ListaEsperaComponent implements OnInit, OnDestroy {
  listaEspera: ClienteEnLista[] = [];
  cargando: boolean = false;
  private intervaloId: any;
  mostrarModalMesas: boolean = false;
  mesasDisponibles: any[] = [];
  mensajeErrorQR: string = '';
  mostrarModalClientes: boolean = false;
  clientesDisponibles: any[] = [];
  mesaSeleccionada: any = null;
  mensajeErrorAsignacion: string = '';

  constructor(
    private supabase: SupabaseService,
    private loadingService: LoadingService,
    private pushNotificationService: PushNotificationService,
    private router: Router,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.cargarListaEspera();
    this.iniciarActualizacionAutomatica();
  }

  ngOnDestroy() {
    this.detenerActualizacionAutomatica();
  }

  ionViewWillEnter() {
    this.cargarListaEspera();
    this.iniciarActualizacionAutomatica();
  }

  ionViewWillLeave() {
    this.detenerActualizacionAutomatica();
  }

  private iniciarActualizacionAutomatica() {
    this.intervaloId = setInterval(() => {
      this.cargarListaEspera(false);
    }, 10000);
  }

  private detenerActualizacionAutomatica() {
    if (this.intervaloId) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
    }
  }

  async cargarListaEspera(mostrarCargando: boolean = true) {
    if (mostrarCargando) {
      this.cargando = true;
      this.loadingService.show();
    }

    try {
      const { data, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('id, nombre, apellido, correo, fecha_ingreso, mesa_asignada')
        .order('fecha_ingreso', { ascending: true });

      if (error) {
        this.listaEspera = [];
      } else {
        this.listaEspera = data || [];
      }
    } catch (error) {
      this.listaEspera = [];
    } finally {
      if (mostrarCargando) {
        this.cargando = false;
        this.loadingService.hide();
      }
    }
  }

  volverAHome() {
    this.detenerActualizacionAutomatica();
    this.router.navigate(['/home']);
  }

  formatearFecha(fecha: string): string {
    try {
      const fechaObj = new Date(fecha);
      const dia = fechaObj.getDate().toString().padStart(2, '0');
      const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
      const hora = fechaObj.getHours().toString().padStart(2, '0');
      const minuto = fechaObj.getMinutes().toString().padStart(2, '0');
      return `${dia}/${mes} ${hora}:${minuto}`;
    } catch (error) {
      return fecha;
    }
  }

  async abrirModalMesasDisponibles() {
    this.loadingService.show();
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('*')
        .eq('ocupada', false)
        .order('numero', { ascending: true });
      
      if (error) {
        this.mostrarMensajeErrorQR('Error al cargar las mesas disponibles.');
        return;
      }
      
      this.mesasDisponibles = data || [];
      this.mostrarModalMesas = true;
    } catch (error) {
      this.mostrarMensajeErrorQR('Error inesperado al cargar las mesas.');
    } finally {
      this.loadingService.hide();
    }
  }

  cerrarModalMesasDisponibles() {
    this.mostrarModalMesas = false;
  }

  async escanearParaDisponibilidadMesas() {
    try {
      this.loadingService.show();
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const scannedCode = barcodes[0].displayValue;
        if (scannedCode === 'disponibilidadMesas') {
          await this.abrirModalMesasDisponibles();
        } else {
          this.mostrarMensajeErrorQR('El QR escaneado no es válido.');
        }
      } else {
        this.mostrarMensajeErrorQR('No se detectó ningún código QR.');
      }
    } catch (error) {
      this.mostrarMensajeErrorQR('Ocurrió un error al escanear el QR.');
    } finally {
      this.loadingService.hide();
    }
  }

  async asignarClienteAMesa(mesa: any) {
    try {
      this.loadingService.show();
      await this.mostrarListaClientes(mesa);
    } catch (error) {
      this.mensajeErrorAsignacion = 'Error al mostrar lista de clientes';
    } finally {
      this.loadingService.hide();
    }
  }

  async mostrarListaClientes(mesa: any) {
    try {
      const { data: clientes, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('id, nombre, apellido, correo, fecha_ingreso, mesa_asignada')
        .or('mesa_asignada.is.null,mesa_asignada.eq.');

      if (error) {
        this.mensajeErrorAsignacion = 'Error al cargar clientes';
        return;
      }

      if (!clientes || clientes.length === 0) {
        this.mensajeErrorAsignacion = 'No hay clientes disponibles para asignar';
        return;
      }

      this.clientesDisponibles = clientes;
      this.mesaSeleccionada = mesa;
      this.mostrarModalClientes = true;
      
    } catch (error) {
      this.mensajeErrorAsignacion = 'Error al mostrar lista de clientes';
    }
  }

  async asignarMesaACliente(clienteId: number) {
    try {
      this.loadingService.show();

      const clienteSeleccionado = this.clientesDisponibles.find(c => c.id === clienteId);
      if (!clienteSeleccionado) {
        this.mensajeErrorAsignacion = 'Cliente no encontrado';
        return;
      }
      
      const { error: errorCliente } = await this.supabase.supabase
        .from('lista_espera')
        .update({ mesa_asignada: this.mesaSeleccionada.numero })
        .eq('id', clienteId);

      if (errorCliente) {
        this.mensajeErrorAsignacion = 'Error al asignar cliente a la mesa';
        return;
      }

      // Contar cuántos clientes están asignados a esta mesa
      const { data: clientesEnMesa, error: errorConteo } = await this.supabase.supabase
        .from('lista_espera')
        .select('id')
        .eq('mesa_asignada', this.mesaSeleccionada.numero);

      if (errorConteo) {
        console.error('Error al contar clientes:', errorConteo);
      }

      const cantidadClientesAsignados = clientesEnMesa?.length || 0;
      const capacidadMesa = this.mesaSeleccionada.comensales;

      // Solo marcar como ocupada si alcanzó o superó la capacidad
      const debeMarcarComoOcupada = cantidadClientesAsignados >= capacidadMesa;

      if (debeMarcarComoOcupada) {
        const { error: errorMesa } = await this.supabase.supabase
          .from('mesas')
          .update({ ocupada: true })
          .eq('numero', this.mesaSeleccionada.numero);

        if (errorMesa) {
          this.mensajeErrorAsignacion = 'Error al marcar mesa como ocupada';
          return;
        }
      }

      try {
        await this.pushNotificationService.notificarClienteAsignadaMesa(
          clienteSeleccionado.correo,
          this.mesaSeleccionada.numero,
          clienteSeleccionado.nombre,
          clienteSeleccionado.apellido
        );
      } catch (error) {
        console.error('Error al enviar notificación push:', error);
      }

      this.cerrarModalClientes();
      this.cerrarModalMesasDisponibles();
      this.cargarListaEspera();
      
      // Mensaje más informativo
      const mensaje = debeMarcarComoOcupada 
        ? `Mesa ${this.mesaSeleccionada.numero} completa (${cantidadClientesAsignados}/${capacidadMesa}). ¡Mesa llena!`
        : `Cliente asignado a mesa ${this.mesaSeleccionada.numero} (${cantidadClientesAsignados}/${capacidadMesa}).`;
      
      this.mostrarMensajeExito(mensaje);
      
    } catch (error) {
      this.mensajeErrorAsignacion = 'Error inesperado al asignar mesa';
    } finally {
      this.loadingService.hide();
    }
  }

  cerrarModalClientes() {
    this.mostrarModalClientes = false;
    this.clientesDisponibles = [];
    this.mesaSeleccionada = null;
  }

  mostrarMensajeExito(mensaje: string) {
    const mensajeElement = document.createElement('div');
    mensajeElement.className = 'qr-success-message';
    mensajeElement.textContent = mensaje;
    document.body.appendChild(mensajeElement);
    
    setTimeout(() => {
      document.body.removeChild(mensajeElement);
    }, 3000);
  }

  mostrarMensajeErrorQR(mensaje: string) {
    this.mensajeErrorQR = mensaje;
    setTimeout(() => {
      this.mensajeErrorQR = '';
    }, 4000);
  }
}
