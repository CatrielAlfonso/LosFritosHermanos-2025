import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from '../../servicios/supabase.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { LoadingService } from '../../servicios/loading.service';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';

@Component({
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.component.html',
  styleUrls: ['./lista-espera.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class ListaEsperaComponent implements OnInit {
  listaEspera: any[] = [];
  mesasDisponibles: any[] = [];
  cargando: boolean = false;
  mensajeError: string = '';
  mensajeErrorQR: string = '';
  mensajeErrorAsignacion: string = '';
  mesaSeleccionada: any = null;
  modalClientesVisible: boolean = false;
  clientesParaAsignar: any[] = [];
  clienteActual: any = null;

  constructor(
    private sb: SupabaseService,
    private pushService: PushNotificationService,
    private loadingService: LoadingService
  ) {}

  ngOnInit() {
    this.cargarListaEspera();
    this.cargarMesasDisponibles();
  }

  async cargarListaEspera() {
    try {
      this.cargando = true;
      const { data, error } = await this.sb.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, fecha_ingreso, mesa_asignada')
        .order('fecha_ingreso', { ascending: true });

      if (error) throw error;

      this.listaEspera = data || [];
    } catch (error: any) {
      console.error('Error al cargar lista de espera:', error);
      this.mensajeError = 'Error al cargar la lista de espera';
    } finally {
      this.cargando = false;
    }
  }

  async cargarMesasDisponibles() {
    try {
      const { data, error } = await this.sb.supabase
        .from('mesas')
        .select('*')
        .eq('ocupada', false);

      if (error) {
        this.mostrarMensajeErrorQR('Error al cargar las mesas disponibles.');
        return;
      }

      this.mesasDisponibles = data || [];
    } catch (error) {
      console.error('Error al cargar mesas:', error);
      this.mostrarMensajeErrorQR('Error inesperado al cargar las mesas.');
    }
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString();
  }

  async escanearQR() {
    try {
      await BarcodeScanner.checkPermission({ force: true });
      BarcodeScanner.hideBackground();
      const result = await BarcodeScanner.startScan();
      
      if (result.hasContent) {
        const mesaNumero = result.content;
        
        // Verificar si la mesa existe
        const { data: mesa } = await this.sb.supabase
          .from('mesas')
          .select('*')
          .eq('numero', mesaNumero)
          .single();

        if (!mesa) {
          this.mostrarMensajeErrorQR('El QR escaneado no corresponde a una mesa válida.');
          return;
        }

        // Verificar si la mesa está ocupada
        if (mesa.ocupada) {
          this.mostrarMensajeErrorQR('Esta mesa ya está ocupada.');
          return;
        }

        // Obtener el cliente actual
        const { data: cliente } = await this.sb.supabase
          .from('clientes')
          .select('*')
          .eq('id', this.clienteActual?.id)
          .single();

        if (!cliente) {
          this.mostrarMensajeErrorQR('No se encontró información del cliente.');
          return;
        }

        // Verificar si el cliente ya tiene una mesa asignada
        if (cliente.mesa_asignada) {
          this.mostrarMensajeErrorQR(`Ya tienes asignada la mesa ${cliente.mesa_asignada}. No puedes cambiar de mesa.`);
          return;
        }

        // Verificar si esta mesa está asignada al cliente
        if (cliente.mesa_asignada !== mesaNumero) {
          this.mostrarMensajeErrorQR('Esta no es la mesa que te fue asignada.');
          return;
        }

        // Si todo está bien, confirmar la asignación
        await this.confirmarAsignacion(cliente);
      } else {
        this.mostrarMensajeErrorQR('No se detectó ningún código QR.');
      }
    } catch (error) {
      console.error('Error al escanear:', error);
      this.mostrarMensajeErrorQR('Ocurrió un error al escanear el QR.');
    } finally {
      BarcodeScanner.showBackground();
      BarcodeScanner.stopScan();
    }
  }

  async asignarClienteAMesa(mesa: any) {
    try {
      this.mesaSeleccionada = mesa;
      await this.mostrarListaClientes(mesa);
    } catch (error) {
      console.error('Error al preparar asignación:', error);
      this.mensajeErrorAsignacion = 'Error al preparar la asignación';
    }
  }

  async mostrarListaClientes(mesa: any) {
    try {
      const { data, error } = await this.sb.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, fecha_ingreso, mesa_asignada')
        .or('mesa_asignada.is.null,mesa_asignada.eq.');

      if (error) throw error;

      this.clientesParaAsignar = data || [];
      this.modalClientesVisible = true;
      this.mesaSeleccionada = mesa;
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      this.mensajeErrorAsignacion = 'Error al cargar lista de clientes';
    }
  }

  async confirmarAsignacion(cliente: any) {
    try {
      await this.loadingService.present('Asignando mesa...');

      // Verificar si el cliente ya tiene una mesa asignada
      const { data: clienteActual } = await this.sb.supabase
        .from('clientes')
        .select('mesa_asignada')
        .eq('id', cliente.id)
        .single();

      if (clienteActual?.mesa_asignada) {
        this.mensajeErrorAsignacion = `El cliente ya tiene asignada la mesa ${clienteActual.mesa_asignada}`;
        throw new Error('Cliente ya tiene mesa asignada');
      }

      // Verificar si la mesa está disponible
      const { data: mesaActual } = await this.sb.supabase
        .from('mesas')
        .select('ocupada')
        .eq('numero', this.mesaSeleccionada.numero)
        .single();

      if (mesaActual?.ocupada) {
        this.mensajeErrorAsignacion = 'La mesa ya está ocupada por otro cliente';
        throw new Error('Mesa ya ocupada');
      }

      // Actualizar cliente con mesa asignada
      const { error: errorCliente } = await this.sb.supabase
        .from('clientes')
        .update({ mesa_asignada: this.mesaSeleccionada.numero })
        .eq('id', cliente.id);

      if (errorCliente) {
        this.mensajeErrorAsignacion = 'Error al asignar cliente a la mesa';
        throw errorCliente;
      }

      // Marcar mesa como ocupada
      const { error: errorMesa } = await this.sb.supabase
        .from('mesas')
        .update({ ocupada: true })
        .eq('numero', this.mesaSeleccionada.numero);

      if (errorMesa) {
        // Revertir la asignación del cliente si falla la actualización de la mesa
        await this.sb.supabase
          .from('clientes')
          .update({ mesa_asignada: null })
          .eq('id', cliente.id);
          
        this.mensajeErrorAsignacion = 'Error al marcar mesa como ocupada';
        throw errorMesa;
      }

      // Enviar notificación al cliente
      await this.pushService.notificarClienteAsignadaMesa(
        cliente.nombre,
        cliente.apellido,
        this.mesaSeleccionada.numero,
        cliente.fcm_token
      );

      // Actualizar listas
      await this.cargarListaEspera();
      await this.cargarMesasDisponibles();

      this.modalClientesVisible = false;
      this.mesaSeleccionada = null;
      this.mostrarMensajeExito('Cliente asignado correctamente a la mesa.');
    } catch (error) {
      console.error('Error en asignación:', error);
      if (!this.mensajeErrorAsignacion) {
        this.mensajeErrorAsignacion = 'Error inesperado al asignar mesa';
      }
    } finally {
      await this.loadingService.dismiss();
    }
  }

  cerrarModalClientes() {
    this.modalClientesVisible = false;
    this.mesaSeleccionada = null;
    this.clientesParaAsignar = [];
  }

  mostrarMensajeExito(mensaje: string) {
    // Implementar según tu sistema de notificaciones
    console.log(mensaje);
  }

  mostrarMensajeErrorQR(mensaje: string) {
    this.mensajeErrorQR = mensaje;
    setTimeout(() => {
      this.mensajeErrorQR = '';
    }, 3000);
  }
}
