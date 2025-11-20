import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, ToastController, IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonIcon, IonButton,IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButtons, IonCardSubtitle } from '@ionic/angular/standalone';
import { SupabaseService } from '../../servicios/supabase.service';
import { FeedbackService } from '../../servicios/feedback-service.service';
import { ReservasService } from '../../servicios/reservas.service';
import { AuthService } from '../../servicios/auth.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';


interface ClienteEspera {
  id: number;
  nombre: string;
  correo: string;
  fecha_ingreso: string;
}

interface Mesa {
  numero: number;
  tipo: string;
  imagen?: string;
  qr?: string;
  comensales: number;
  ocupada: boolean;
  clienteAsignadoId: number | null;
}


@Component({
  selector: 'app-maitre-mesas',
  templateUrl: './maitre-mesas.component.html',
  styleUrls: ['./maitre-mesas.component.scss'],
  imports: [IonCardSubtitle, IonButtons, CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonIcon, IonButton, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle]
})
export class MaitreMesasComponent  implements OnInit {

   clientesEspera: ClienteEspera[] = [];
  mesas: Mesa[] = [];
  usuario: any = null;
  clienteSeleccionado: ClienteEspera | null = null;
  mesaSeleccionada: Mesa | null = null;
  mesaAsignada: any = null;
  notificacion: { mensaje: string, tipo: 'exito' | 'error' | 'info' } | null = null;
  qrEnProceso: boolean = false;
    clienteSentado: boolean = false;
  mostrarBotonHacerPedido: boolean = false;
    clienteInfo: any = null;
  mostrarBotonVerEstadoPedido: boolean = false;


  constructor(
    private sb: SupabaseService,
    private feedback: FeedbackService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private reservasService: ReservasService
  ) { }

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    await this.cargarClientesEspera();
    await this.cargarMesas();
  }

  // Carga clientes que aún no tienen mesa
  async cargarClientesEspera() {
    try {
      // Simula obtener la lista de espera (solo clientes que aún no tienen mesa asignada)
      const { data, error } = await this.sb.supabase
        .from('lista_espera')
        .select(`id, nombre, correo, fecha_ingreso`)
        .is('mesa_asignada', null); // Asumiendo que la tabla tiene este campo

      if (error) throw error;
      this.clientesEspera = data as ClienteEspera[];
    } catch (e: any) {
      this.feedback.showToast('error', 'Error al cargar clientes: ' + e.message);
    }
  }

  // Carga todas las mesas y su estado
  async cargarMesas() {
    try {
      const { data, error } = await this.sb.supabase
        .from('mesas')
        .select(`numero, tipo, comensales, ocupada, clienteAsignadoId`);
      
      if (error) throw error;
      console.log('Mesas cargadas:', data); 
      this.mesas = data as Mesa[];
    } catch (e: any) {
      this.feedback.showToast('error', 'Error al cargar mesas: ' + e.message);
    }
  }

  // --- Selección de Elementos ---

  seleccionarCliente(cliente: ClienteEspera) {
    this.clienteSeleccionado = cliente;
    console.log("clienteSeleccionado: ", this.clienteSeleccionado);
    this.feedback.showToast('exito', `Cliente ${cliente.nombre} seleccionado.`);
  }

  seleccionarMesa(mesa: Mesa) {
    console.log(mesa);
    if (mesa.ocupada) {
      this.feedback.showToast('error', 'Mesa ocupada. No se puede reasignar.');
      this.mesaSeleccionada = null;
      return;
    }
    this.mesaSeleccionada = mesa;
    this.feedback.showToast('exito', `Mesa ${mesa.numero} seleccionada.`);
  }

  // --- Lógica de Asignación (Punto 10) ---

  async asignarMesa() {
    if (!this.clienteSeleccionado || !this.mesaSeleccionada) {
      this.feedback.showToast('error', 'Seleccione un cliente y una mesa disponibles.');
      return;
    }

    const cliente = this.clienteSeleccionado;
    const mesa = this.mesaSeleccionada;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Asignación',
      message: `¿Asignar la Mesa N° ${mesa.numero} a ${cliente.nombre}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Asignar',
          handler: async () => {
            await this.ejecutarAsignacion(cliente, mesa);
          }
        }
      ]
    });
    await alert.present();
  }

  async ejecutarAsignacion(cliente: ClienteEspera, mesa: Mesa) {
    const loading = await this.feedback.showLoading('Asignando mesa...');
    
    try {
      console.log('🔵 [ejecutarAsignacion] Iniciando asignación');
      console.log('👤 Cliente:', cliente);
      console.log('🪑 Mesa:', mesa);

      // 0. Verificar si la mesa tiene una reserva confirmada activa
      const tieneReservaActiva = await this.reservasService.tieneReservaConfirmadaActiva(mesa.numero);
      
      if (tieneReservaActiva) {
        this.feedback.hide();
        this.feedback.showToast('error', `❌ La mesa ${mesa.numero} está reservada y no puede ser asignada a otro cliente.`);
        return;
      }

      // 1. Primero, actualizar lista_espera con mesa asignada
      const { error: errorEspera } = await this.sb.supabase
        .from('lista_espera')
        .update({ mesa_asignada: mesa.numero })
        .eq('id', cliente.id);
        
      if (errorEspera) throw errorEspera;
      console.log('✅ Cliente agregado a lista_espera con mesa_asignada:', mesa.numero);

      // 2. Contar cuántos clientes están asignados a esta mesa DESPUÉS de la asignación
      const { data: clientesEnMesa, error: errorConteo } = await this.sb.supabase
        .from('lista_espera')
        .select('id')
        .eq('mesa_asignada', mesa.numero);

      if (errorConteo) {
        console.error('❌ Error al contar clientes:', errorConteo);
      }

      const cantidadClientesAsignados = clientesEnMesa?.length || 0;
      const capacidadMesa = mesa.comensales;

      console.log('📊 Cantidad de clientes asignados:', cantidadClientesAsignados);
      console.log('📊 Capacidad de la mesa:', capacidadMesa);

      // 3. Solo marcar como ocupada si alcanzó o superó la capacidad
      const debeMarcarComoOcupada = cantidadClientesAsignados >= capacidadMesa;
      console.log('🔍 ¿Debe marcar como ocupada?:', debeMarcarComoOcupada);

      // Actualizar la tabla 'mesas' - NO sobrescribir clienteAsignadoId
      const updateData: any = {};
      if (debeMarcarComoOcupada) {
        updateData.ocupada = true;
        console.log('🔴 Marcando mesa como OCUPADA');
      } else {
        console.log('🟢 Mesa sigue DISPONIBLE para más comensales');
      }

      const { error: errorMesa } = await this.sb.supabase
        .from('mesas')
        .update(updateData)
        .eq('numero', mesa.numero);

      if (errorMesa) throw errorMesa;

      // NO marcar cliente como sentado aquí - eso debe hacerlo el cliente al escanear el QR de la mesa
      // const {error: errorCliente }= await this.sb.supabase.from('clientes').update(
      //   {
      //     sentado: true,
      //   }).eq('id', cliente.id,);

      // if (errorCliente) throw errorCliente;

      // 3. ENVIAR PUSH NOTIFICATION al cliente (A IMPLEMENTAR)
      // Lógica simulada: notificar al dispositivo del cliente (celular 3)
      // Ejemplo: this.notificationService.sendPush(cliente.correo, `Tu mesa asignada es la N° ${mesa.numero}`);
      
      const mensajeCapacidad = debeMarcarComoOcupada 
        ? `Mesa ${mesa.numero} completa (${cantidadClientesAsignados}/${capacidadMesa}). ¡Mesa llena!`
        : `Mesa ${mesa.numero} asignada a ${cliente.nombre} (${cantidadClientesAsignados}/${capacidadMesa}).`;
      
      this.feedback.showToast('exito', `✅ ${mensajeCapacidad}`);
      console.log('🎉 Asignación completada exitosamente');

      // Limpiar selección y recargar datos
      this.clienteSeleccionado = null;
      this.mesaSeleccionada = null;
      await this.cargarDatos();

    } catch (e: any) {
      console.error('💥 Error en ejecutarAsignacion:', e);
      this.feedback.showToast('error', 'Error al asignar: ' + e.message);
    } finally {
      await loading.dismiss();
    }
  }

  // --- Funcionalidad Adicional: Liberar Mesa ---
  
  async liberarMesa(mesa: Mesa) {
    if (!mesa.ocupada) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Liberación',
      message: `¿Desea liberar la Mesa N° ${mesa.numero}? Esto finalizará el servicio de todos los clientes en esta mesa.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Liberar',
          handler: async () => {
            const loading = await this.feedback.showLoading('Liberando mesa...');
            try {
              console.log('🔓 [liberarMesa] Liberando mesa:', mesa.numero);

              // 1. Remover clientes de la lista de espera (o marcar mesa_asignada como null)
              const { error: errorLista } = await this.sb.supabase
                .from('lista_espera')
                .delete()
                .eq('mesa_asignada', mesa.numero);

              if (errorLista) {
                console.error('⚠️ Error al limpiar lista_espera:', errorLista);
              } else {
                console.log('✅ Clientes removidos de lista_espera');
              }

              // 2. Marcar la mesa como libre
              const { error } = await this.sb.supabase
                .from('mesas')
                .update({ ocupada: false, clienteAsignadoId: null })
                .eq('numero', mesa.numero);

              if (error) throw error;
              
              console.log('✅ Mesa liberada exitosamente');
              this.feedback.showToast('exito', `Mesa ${mesa.numero} liberada con éxito.`);
              await this.cargarMesas();
            } catch (e: any) {
              console.error('💥 Error al liberar mesa:', e);
              this.feedback.showToast('error', 'Error al liberar: ' + e.message);
            } finally {
              await loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }


   async escanearQR() {
    this.qrEnProceso = true;
    this.feedback.showLoading('Escaneando QR...');
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.procesarCodigoEscaneado(codigoEscaneado);
      } else {
        await this.mostrarNotificacion('No se detectó ningún código QR.', 'info');
      }
    } catch (error) {
      await this.mostrarNotificacion('Error al escanear el código QR.', 'error');
    } finally {
      this.feedback.hide();
      this.qrEnProceso = false;
    }
  }

  async procesarCodigoEscaneado(codigo: string) {
    const codigoEsperado = 'b71c9d3a4e1f5a62c3340b87df0e8a129cab6e3d';
    
    if (codigo === codigoEsperado) {
      await this.agregarAListaEspera();
    } else {
      await this.mostrarNotificacion('Código inválido', 'error');
    }
  }

  async agregarAListaEspera() {
    try {
      if (!this.usuario) {
        await this.mostrarNotificacion('No se pudo obtener la información del usuario.', 'error');
        return;
      }

      const { data: clienteEnLista } = await this.sb.supabase
        .from('lista_espera')
        .select('*')
        .eq('correo', this.usuario.email)
        .single();

      if (clienteEnLista) {
        await this.mostrarNotificacion('Ya en Lista', 'exito');
        return;
      }

      const { data: cliente, error: errorCliente } = await this.sb.supabase
        .from('clientes')
        .select('nombre, apellido, correo')
        .eq('correo', this.usuario.email)
        .single();

      if (errorCliente || !cliente) {
        await this.mostrarNotificacion('No se pudo obtener la información del cliente.', 'error');
        return;
      }

      const ahora = new Date();
      const fechaFormateada = ahora.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      });

      const [fecha, hora] = fechaFormateada.replace(',', '').split(' ');
      const [dia, mes, anio] = fecha.split('/');
      const fechaFinal = `${anio}-${mes}-${dia} ${hora}:00`;

      const { error: errorInsert } = await this.sb.supabase
        .from('lista_espera')
        .insert([{
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          correo: cliente.correo,
          fecha_ingreso: fechaFinal
        }]);

      if (errorInsert) {
        await this.mostrarNotificacion('No se pudo agregar a la lista de espera: ' + errorInsert.message, 'error');
        return;
      }

      // try {
      //   await this.pushNotificationService.notificarMaitreNuevoCliente(
      //     cliente.nombre,
      //     cliente.apellido
      //   );
      // } catch (error) {
      // }

      await this.mostrarNotificacion('Has sido agregado exitosamente a la lista de espera.', 'exito');
      
    } catch (error) {
      await this.mostrarNotificacion('Error inesperado al agregar a la lista de espera.', 'error');
    }
  }

  async escanearMesaAsignada() {
    this.feedback.showLoading("Escaneando QR de mesa...");
    
    try {
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.validarMesaEscaneada(codigoEscaneado);
      } else {
        this.feedback.showLoading('QR inválido, escanea el QR de tu mesa');
      }
    } catch (error) {
      this.feedback.showLoading('QR inválido, escanea el QR de tu mesa');
    } finally {
      this.feedback.hide();
    }
  }

  async validarMesaEscaneada(codigoEscaneado: string) {
    
    let qrValido = false;
    try {
      const datosQR = JSON.parse(codigoEscaneado);

      const numeroMesaQR = String(datosQR.numeroMesa);
      const mesaAsignadaStr = String(this.mesaAsignada);
      
      if (numeroMesaQR === mesaAsignadaStr) {
        qrValido = true;
      }
    } catch (e) {
      const patronEsperado = `numeroMesa: ${this.mesaAsignada}`;
      
      if (codigoEscaneado.includes(patronEsperado)) {
        qrValido = true;
      }
    }
    
    if (!qrValido) {
      //this.mostrarMensajeError('QR inválido, escanea el QR de tu mesa');
      this.feedback.showToast('error', 'QR inválido, escanea el QR de tu mesa');
    } else {
      await this.marcarClienteSentado();
    }
  }

   async marcarClienteSentado() {
    try {
      const { error } = await this.sb.supabase
        .from('clientes')
        .update({
          sentado: true
        })
        .eq('correo', this.usuario.email);

      if (error) {
        this.mostrarNotificacion('No se pudo marcar el cliente como sentado.', 'error');
      } else {
        this.mostrarNotificacion('¡Bienvenido!', 'exito');
        this.clienteSentado = true;
        this.mostrarBotonHacerPedido = false;
        //await this.verificarPedidoExistente();
      }
    } catch (error) {
      this.mostrarNotificacion('Error al marcar el cliente como sentado.', 'error');
    }
  }

  async cargarClienteInfo() {
    if (!this.usuario ) return;
    
    try {
      const { data, error } = await this.sb.supabase
        .from('clientes')
        .select('*')
        .eq('correo', this.usuario.email)
        .single();
      
      if (!error && data) {
        this.clienteInfo = data;
        
      }
    } catch (error) {
    }
  }

  // async verificarPedidoExistente() {
  //   if (!this.mesaAsignada ) {
  //     this.mostrarBotonVerEstadoPedido = false;
  //     this.pedidoActualCliente = null;
  //     return;
  //   }
  //   const { data, error } = await this.sb.supabase
  //     .from('pedidos')
  //     .select('*')
  //     .eq('mesa', this.mesaAsignada)
  //     .order('id', { ascending: false })
  //     .limit(1);
  //   if (!error && data && data.length > 0) {
  //     this.mostrarBotonVerEstadoPedido = true;
  //     this.pedidoActualCliente = data[0];
  //     this.mostrarBotonHacerPedido = false;
  //   } else {
  //     this.mostrarBotonVerEstadoPedido = false;
  //     this.pedidoActualCliente = null;
  //     this.mostrarBotonHacerPedido = this.clienteSentado;
  //   }

  //   await this.cargarClienteInfo();
  // }

   mostrarNotificacion(mensaje: string, tipo: 'exito' | 'error' | 'info' = 'info') {
    this.notificacion = { mensaje, tipo };
    setTimeout(() => {
      this.notificacion = null;
    }, 3500);
  }


}
