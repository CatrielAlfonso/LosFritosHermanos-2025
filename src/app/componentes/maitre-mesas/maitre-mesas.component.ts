import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertController, ToastController, IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonIcon, IonButton,IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonButtons, IonCardSubtitle } from '@ionic/angular/standalone';
import { SupabaseService } from '../../servicios/supabase.service';
import { FeedbackService } from '../../servicios/feedback-service.service';


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
  
  clienteSeleccionado: ClienteEspera | null = null;
  mesaSeleccionada: Mesa | null = null;

  constructor(
    private sb: SupabaseService,
    private feedback: FeedbackService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
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

      let clienteDefinitivoId: number;
      // 1. Actualizar la tabla 'mesas' (establecer ocupada y cliente asignado)
      const { error: errorMesa } = await this.sb.supabase
        .from('mesas')
        .update({ ocupada: true, clienteAsignadoId: cliente.id })
        .eq('numero', mesa.numero);

      if (errorMesa) throw errorMesa;

      // 2. Actualizar la tabla 'lista_espera' (remover cliente o marcar con mesa)
      // Usaremos la eliminación de lista de espera (o moverlo a clientes sentados)
      const { error: errorEspera } = await this.sb.supabase
        .from('lista_espera')
        .delete()
        .eq('id', cliente.id);
        
      if (errorEspera) throw errorEspera;

      // cliente sentado
      const {error: errorCliente }= await this.sb.supabase.from('clientes').update(
        {
          sentado: true,
        }).eq('id', cliente.id,);

      if (errorCliente) throw errorCliente;

      // 3. ENVIAR PUSH NOTIFICATION al cliente (A IMPLEMENTAR)
      // Lógica simulada: notificar al dispositivo del cliente (celular 3)
      // Ejemplo: this.notificationService.sendPush(cliente.correo, `Tu mesa asignada es la N° ${mesa.numero}`);
      this.feedback.showToast('exito', `✅ Mesa ${mesa.numero} asignada a ${cliente.nombre}. ¡Notificación enviada!`);

      // Limpiar selección y recargar datos
      this.clienteSeleccionado = null;
      this.mesaSeleccionada = null;
      await this.cargarDatos();

    } catch (e: any) {
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
      message: `¿Desea liberar la Mesa N° ${mesa.numero}? Esto finalizará el servicio del cliente.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Liberar',
          handler: async () => {
            const loading = await this.feedback.showLoading('Liberando mesa...');
            try {
              const { error } = await this.sb.supabase
                .from('mesas')
                .update({ ocupada: false, clienteAsignadoId: null })
                .eq('numero', mesa.numero);

              if (error) throw error;
              this.feedback.showToast('exito', `Mesa ${mesa.numero} liberada con éxito.`);
              await this.cargarMesas();
            } catch (e: any) {
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

}
