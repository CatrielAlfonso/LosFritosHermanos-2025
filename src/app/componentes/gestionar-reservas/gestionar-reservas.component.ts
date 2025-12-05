import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  AlertController,
  ToastController,
  IonButtons,
  IonTextarea,
  IonSelect,
  IonSelectOption
} from '@ionic/angular/standalone';
import { ReservasService, Reserva } from '../../servicios/reservas.service';
import { AuthService } from '../../servicios/auth.service';
import { CustomLoader } from '../../servicios/custom-loader.service';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  timeOutline, 
  peopleOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline,
  arrowBackOutline,
  restaurantOutline,
  documentTextOutline,
  mailOutline,
  personOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-gestionar-reservas',
  templateUrl: './gestionar-reservas.component.html',
  styleUrls: ['./gestionar-reservas.component.scss'],
  standalone: true,
  imports: [
    IonButtons,
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonTextarea,
    IonSelect,
    IonSelectOption
  ]
})
export class GestionarReservasComponent implements OnInit {
  reservas: Reserva[] = [];
  reservasPendientes: Reserva[] = [];
  reservasFiltradas: Reserva[] = [];
  filtroEstado: string = 'pendiente'; // 'pendiente', 'confirmada', 'cancelada', 'todas'
  reservaSeleccionada: Reserva | null = null;
  motivoRechazo: string = '';
  mesaNumero: number | null = null;

  constructor(
    private reservasService: ReservasService,
    private authService: AuthService,
    private router: Router,
    private customLoader: CustomLoader,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({ 
      calendarOutline, 
      timeOutline, 
      peopleOutline, 
      checkmarkCircleOutline, 
      closeCircleOutline,
      arrowBackOutline,
      restaurantOutline,
      documentTextOutline,
      mailOutline,
      personOutline
    });
  }

  async ngOnInit() {
    // Verificar que el usuario sea supervisor o dueño
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'supervisor' && perfil !== 'dueño') {
      this.router.navigate(['/home']);
      return;
    }

    await this.cargarReservas();
  }

  async cargarReservas() {
    try {
      this.customLoader.show();
      
      // Cargar todas las reservas
      this.reservas = await this.reservasService.obtenerTodasLasReservas();
      
      // Filtrar reservas pendientes
      this.reservasPendientes = this.reservas.filter(r => r.estado === 'pendiente');
      
      // Aplicar filtro inicial
      this.aplicarFiltro();
      
      setTimeout(async () => {
        this.customLoader.hide();
      }, 500);
    } catch (error: any) {
      console.error('Error al cargar reservas:', error);
      this.mostrarToast('Error al cargar las reservas', 'danger');
      setTimeout(async () => {
        this.customLoader.hide();
      }, 500);
    }
  }

  aplicarFiltro() {
    if (this.filtroEstado === 'todas') {
      this.reservasFiltradas = this.reservas;
    } else {
      this.reservasFiltradas = this.reservas.filter(r => r.estado === this.filtroEstado);
    }
    
    // Ordenar por fecha y hora
    this.reservasFiltradas.sort((a, b) => {
      const fechaA = new Date(`${a.fecha_reserva}T${a.hora_reserva}`);
      const fechaB = new Date(`${b.fecha_reserva}T${b.hora_reserva}`);
      return fechaA.getTime() - fechaB.getTime();
    });
  }

  async aprobarReserva(reserva: Reserva) {
    const alert = await this.alertController.create({
      header: 'Aprobar Reserva',
      message: `¿Deseas aprobar la reserva de ${reserva.cliente_nombre} ${reserva.cliente_apellido || ''}?`,
      inputs: [
        {
          name: 'mesaNumero',
          type: 'number',
          placeholder: 'Número de mesa (opcional)',
          attributes: {
            min: 1
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Aprobar',
          handler: async (data) => {
            try {
              this.customLoader.show();
              
              const mesaNum = data.mesaNumero ? parseInt(data.mesaNumero) : undefined;
              await this.reservasService.aprobarReservaConCorreo(reserva.id!, mesaNum);
              
              this.mostrarToast('Reserva aprobada y correo enviado', 'success');
              await this.cargarReservas();
              return true;
            } catch (error: any) {
              console.error('Error al aprobar reserva:', error);
              this.mostrarToast(error.message || 'Error al aprobar la reserva', 'danger');
              setTimeout(async () => {
                this.customLoader.hide();
              }, 500);
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async rechazarReserva(reserva: Reserva) {
    const alert = await this.alertController.create({
      header: 'Rechazar Reserva',
      subHeader: `Reserva de ${reserva.cliente_nombre} ${reserva.cliente_apellido || ''}`,
      message: 'Por favor, indica el motivo del rechazo:',
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Motivo del rechazo (requerido)',
          attributes: {
            rows: 4,
            maxlength: 500
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Rechazar',
          handler: async (data) => {
            if (!data.motivo || data.motivo.trim().length === 0) {
              this.mostrarToast('El motivo del rechazo es requerido', 'warning');
              return false;
            }

            try {
              this.customLoader.show();
              
              await this.reservasService.rechazarReservaConCorreo(reserva.id!, data.motivo.trim());
              
              this.mostrarToast('Reserva rechazada y correo enviado', 'success');
              await this.cargarReservas();
              return true;
            } catch (error: any) {
              console.error('Error al rechazar reserva:', error);
              this.mostrarToast(error.message || 'Error al rechazar la reserva', 'danger');
              setTimeout(async () => {
                this.customLoader.hide();
              }, 500);
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  formatearFecha(fecha: string): string {
    try {
      // Extraer solo la parte de la fecha (YYYY-MM-DD) sin timezone
      const fechaLimpia = fecha.split('T')[0];
      const [year, month, day] = fechaLimpia.split('-').map(Number);
      // Crear fecha usando componentes locales para evitar problemas de timezone
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('es-AR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return fecha;
    }
  }

  formatearHora(hora: string): string {
    return hora.substring(0, 5); // HH:MM
  }

  getEstadoColor(estado: string | undefined): string {
    switch (estado) {
      case 'pendiente':
        return 'warning';
      case 'confirmada':
        return 'success';
      case 'cancelada':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getEstadoTexto(estado: string | undefined): string {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'confirmada':
        return 'Confirmada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return 'Desconocido';
    }
  }

  getCantidadPendientes(): number {
    return this.reservasPendientes.length;
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
    this.router.navigate(['/home']);
  }
}

