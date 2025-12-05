import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
  IonDatetime,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonNote,
  AlertController,
  ToastController, IonButtons } from '@ionic/angular/standalone';
import { ReservasService, Reserva } from '../../servicios/reservas.service';
import { AuthService } from '../../servicios/auth.service';
import { CustomLoader } from '../../servicios/custom-loader.service';
import { Haptics } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, 
  timeOutline, 
  peopleOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  trashOutline,
  addCircleOutline,
  arrowBackOutline,
  restaurantOutline,
  documentTextOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.component.html',
  styleUrls: ['./reservas.component.scss'],
  standalone: true,
  imports: [IonButtons, 
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonDatetime,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonNote
  ]
})
export class ReservasComponent implements OnInit {
  reservaForm: FormGroup;
  reservas: Reserva[] = [];
  clienteInfo: { id: number; nombre: string; apellido: string; email: string; validado?: boolean; aceptado?: boolean } | null = null;
  puedeHacerReserva: boolean = false;
  fechaMinima: string = '';
  horaMinima: string = '';
  fechaSeleccionada: string = '';
  mostrarFormulario: boolean = false;
  horaSeleccionada: string = '';
  horasDisponibles: string[] = [];
  capacidadesDisponibles: number[] = [];
  cargandoCapacidades: boolean = false;

  constructor(
    private fb: FormBuilder,
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
      trashOutline,
      addCircleOutline,
      arrowBackOutline,
      restaurantOutline,
      documentTextOutline
    });
    
    // Configurar fecha mínima (hoy)
    const hoy = new Date();
    this.fechaMinima = hoy.toISOString().split('T')[0];
    
    // Configurar hora mínima (ahora + 1 hora)
    const horaMinima = new Date();
    horaMinima.setHours(horaMinima.getHours() + 1);
    this.horaMinima = horaMinima.toTimeString().slice(0, 5);

    this.reservaForm = this.fb.group({
      fecha_reserva: ['', [Validators.required]],
      hora_reserva: ['', [Validators.required]],
      cantidad_comensales: ['', [Validators.required, Validators.min(1)]],
      notas: ['']
    });
  }

  async ngOnInit() {
    try {
      // Verificar que el usuario sea cliente
      const perfil = this.authService.getPerfilUsuario();
      if (perfil !== 'cliente') {
        this.mostrarMensaje('Solo los clientes registrados pueden hacer reservas', 'danger');
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 2000);
        return;
      }

      // Obtener información del cliente primero
      this.clienteInfo = await this.reservasService.obtenerInfoCliente();
      if (!this.clienteInfo) {
        this.mostrarMensaje('Error al obtener información del cliente', 'danger');
        return;
      }

      // Verificar si puede hacer reservas basándose en la info del cliente
      this.puedeHacerReserva = await this.reservasService.puedeHacerReserva();
      
      // Solo mostrar el mensaje si definitivamente no puede hacer reservas
      // (validado y aceptado confirmados como false)
      if (!this.puedeHacerReserva) {
        console.log('Cliente no puede hacer reservas - validado:', this.clienteInfo.validado, 'aceptado:', this.clienteInfo.aceptado);
        if (this.clienteInfo.validado === false || this.clienteInfo.aceptado === false) {
          this.mostrarMensaje('Tu cuenta debe estar validada y aceptada para hacer reservas', 'warning');
        }
      }

      // Cargar reservas existentes
      await this.cargarReservas();
    } catch (error) {
      console.error('Error en ngOnInit de reservas:', error);
    }
  }

  async cargarReservas() {
    try {
      this.customLoader.show();
      this.reservas = await this.reservasService.obtenerReservasCliente();
      // Filtrar solo reservas pendientes y confirmadas
      this.reservas = this.reservas.filter(r => r.estado === 'pendiente' || r.estado === 'confirmada');
    } catch (error: any) {
      console.error('Error al cargar reservas:', error);
      this.mostrarMensaje(error.message || 'Error al cargar las reservas', 'danger');
    } finally {
      setTimeout(() => {
        this.customLoader.hide();
      }, 1000);
    }
  }

  async abrirSelectorComensales() {
    // Opciones de 1 a 20 comensales (el supervisor decidirá disponibilidad)
    const opciones = Array.from({length: 20}, (_, i) => i + 1);

    const alert = await this.alertController.create({
      header: 'Cantidad de Comensales',
      subHeader: 'Selecciona la cantidad de personas',
      cssClass: 'comensales-selector-alert',
      inputs: opciones.map(cantidad => ({
        type: 'radio' as const,
        label: `${cantidad} ${cantidad === 1 ? 'persona' : 'personas'}`,
        value: cantidad,
        checked: this.reservaForm.get('cantidad_comensales')?.value === cantidad
      })),
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: (cantidad: number) => {
            if (cantidad) {
              this.reservaForm.patchValue({ cantidad_comensales: cantidad });
            }
          }
        }
      ]
    });

    await alert.present();
  }

  onFechaChange(event: any) {
    const fechaSeleccionada = event.detail.value;
    if (fechaSeleccionada) {
      // Extraer la fecha correctamente sin problemas de zona horaria
      // El ion-datetime puede devolver formato ISO con timezone
      // Usamos substring para obtener solo YYYY-MM-DD
      if (fechaSeleccionada.includes('T')) {
        // Si viene con hora, extraer solo la fecha
        this.fechaSeleccionada = fechaSeleccionada.substring(0, 10);
      } else {
        this.fechaSeleccionada = fechaSeleccionada;
      }
      
      // Actualizar el formulario con la fecha limpia
      this.reservaForm.patchValue({ fecha_reserva: this.fechaSeleccionada });
      
      // Si la fecha seleccionada es hoy, la hora mínima debe ser ahora + 1 hora
      const hoy = new Date();
      const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      
      if (this.fechaSeleccionada === hoyStr) {
        const horaMinima = new Date();
        horaMinima.setHours(horaMinima.getHours() + 1);
        this.horaMinima = horaMinima.toTimeString().slice(0, 5);
      } else {
        // Si es una fecha futura, la hora mínima puede ser desde las 00:00
        this.horaMinima = '00:00';
      }
      
      // Generar horas disponibles
      this.generarHorasDisponibles();
    }
  }

  generarHorasDisponibles() {
    this.horasDisponibles = [];
    
    // Horario del restaurante: 11:00 AM a 11:00 PM (23:00)
    const horaInicio = 11;
    const horaFin = 23;
    
    // Determinar desde qué hora empezar
    let horaActual = horaInicio;
    
    // Obtener fecha de hoy en formato local (sin UTC)
    const ahora = new Date();
    const hoyLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    
    const esHoy = this.fechaSeleccionada === hoyLocal;
    
    // Si es hoy, empezar desde la hora actual + 1
    if (esHoy) {
      // Usar hora local directamente
      const horaActualLocal = ahora.getHours();
      horaActual = Math.max(horaInicio, horaActualLocal + 1);
    }
    
    // Generar horas cada 30 minutos
    for (let hora = horaActual; hora <= horaFin; hora++) {
      for (let minuto = 0; minuto < 60; minuto += 30) {
        const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
        
        // Si es hoy, verificar que la hora no haya pasado
        if (esHoy) {
          const horaActualLocal = ahora.getHours();
          const minutoActualLocal = ahora.getMinutes();
          const [h, m] = horaStr.split(':').map(Number);
          
          // Comparar hora:minuto directamente
          if (h > horaActualLocal || (h === horaActualLocal && m > minutoActualLocal)) {
            this.horasDisponibles.push(horaStr);
          }
        } else {
          this.horasDisponibles.push(horaStr);
        }
      }
    }
  }

  async abrirSelectorHora() {
    console.log('Intentando abrir selector de hora...');
  
    // 1. Validar fecha seleccionada
    if (!this.fechaSeleccionada) {
      console.log('Falta fecha');
      this.mostrarMensaje('Por favor, selecciona primero una fecha', 'warning');
      return;
    }
  
    // 2. Generar horas si está vacío
    if (!this.horasDisponibles || this.horasDisponibles.length === 0) {
      console.log('Generando horas...');
      this.generarHorasDisponibles();
    }
  
    // 3. Verificación de seguridad: ¿Sigue vacío?
    if (!this.horasDisponibles || this.horasDisponibles.length === 0) {
      console.error('ERROR: No hay horas disponibles para mostrar.');
      this.mostrarMensaje('No hay horarios disponibles para esta fecha.', 'warning');
      return;
    }
  
    console.log('Abriendo Alert con horas:', this.horasDisponibles);
  
    const alert = await this.alertController.create({
      header: 'Selecciona una hora',
      // ASEGÚRATE de que este nombre coincide con el de tu global.scss
      cssClass: 'hora-selector-alert', 
      inputs: this.horasDisponibles.map(hora => ({
        type: 'radio',
        label: hora,
        value: hora,
        checked: hora === this.horaSeleccionada
      })),
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: (hora: string) => {
            if (hora) {
              this.horaSeleccionada = hora;
              // Actualizamos el formulario también
              this.reservaForm.patchValue({ hora_reserva: hora });
            }
          }
        }
      ]
    });
  
    await alert.present();
  }

  async crearReserva() {
    if (!this.puedeHacerReserva) {
      this.mostrarMensaje('Tu cuenta debe estar validada para hacer reservas', 'warning');
      return;
    }

    if (this.reservaForm.invalid) {
      this.mostrarMensaje('Por favor, completa todos los campos requeridos', 'warning');
      return;
    }

    if (!this.clienteInfo) {
      this.mostrarMensaje('Error al obtener información del cliente', 'danger');
      return;
    }

    try {
      this.customLoader.show();

      const formValue = this.reservaForm.value;
      
      console.log('📋 [crearReserva COMPONENT] formValue:', formValue);
      console.log('📋 [crearReserva COMPONENT] formValue.fecha_reserva:', formValue.fecha_reserva);
      console.log('📋 [crearReserva COMPONENT] formValue.hora_reserva:', formValue.hora_reserva);
      
      // Extraer la fecha correctamente (puede venir con T o sin T)
      let fechaReservaLimpia = formValue.fecha_reserva;
      if (fechaReservaLimpia && fechaReservaLimpia.includes('T')) {
        fechaReservaLimpia = fechaReservaLimpia.substring(0, 10);
      }
      
      console.log('📋 [crearReserva COMPONENT] fechaReservaLimpia:', fechaReservaLimpia);
      
      // Validar que la fecha y hora sean futuras
      // Crear la fecha usando los componentes para evitar problemas de timezone
      const [year, month, day] = fechaReservaLimpia.split('-').map(Number);
      const [hour, minute] = formValue.hora_reserva.split(':').map(Number);
      
      console.log('📋 [crearReserva COMPONENT] Componentes:', { year, month, day, hour, minute });
      
      const fechaHoraReserva = new Date(year, month - 1, day, hour, minute);
      const ahora = new Date();
      
      console.log('📋 [crearReserva COMPONENT] fechaHoraReserva:', fechaHoraReserva.toString());
      console.log('📋 [crearReserva COMPONENT] ahora:', ahora.toString());
      console.log('📋 [crearReserva COMPONENT] ¿Es futuro?:', fechaHoraReserva > ahora);
      
      if (fechaHoraReserva <= ahora) {
        console.error('❌ [crearReserva COMPONENT] RECHAZADO en componente');
        this.mostrarMensaje('La reserva debe ser en una fecha y hora futuras', 'warning');
        setTimeout(() => {
          this.customLoader.hide();
        }, 1000);
        return;
      }
      
      console.log('✅ [crearReserva COMPONENT] Validación componente pasada');

      // Crear la reserva con la fecha limpia (YYYY-MM-DD)
      const nuevaReserva: Omit<Reserva, 'id' | 'created_at' | 'updated_at'> = {
        cliente_id: this.clienteInfo.id,
        cliente_email: this.clienteInfo.email,
        cliente_nombre: this.clienteInfo.nombre,
        cliente_apellido: this.clienteInfo.apellido,
        fecha_reserva: fechaReservaLimpia,
        hora_reserva: formValue.hora_reserva,
        cantidad_comensales: formValue.cantidad_comensales,
        estado: 'pendiente',
        notas: formValue.notas || null
      };

      await this.reservasService.crearReserva(nuevaReserva);
      
      this.mostrarMensaje('¡Reserva creada exitosamente!', 'success');
      
      // Limpiar formulario
      this.reservaForm.reset({
        fecha_reserva: '',
        hora_reserva: '',
        cantidad_comensales: 1,
        notas: ''
      });
      this.mostrarFormulario = false;
      
      // Recargar reservas
      await this.cargarReservas();
      
    } catch (error: any) {
      console.error('Error al crear reserva:', error);
      this.mostrarMensaje(error.message || 'Error al crear la reserva', 'danger');
    } finally {
      setTimeout(() => {
        this.customLoader.hide();
      }, 1000);
    }
  }

  async cancelarReserva(reserva: Reserva) {
    const alert = await this.alertController.create({
      header: 'Cancelar Reserva',
      message: `¿Estás seguro de que deseas cancelar la reserva del ${this.formatearFecha(reserva.fecha_reserva)} a las ${reserva.hora_reserva}?`,
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          role: 'confirm',
          handler: async () => {
            try {
              this.customLoader.show();
              if (reserva.id) {
                await this.reservasService.cancelarReserva(reserva.id);
                this.mostrarMensaje('Reserva cancelada exitosamente', 'success');
                await this.cargarReservas();
              }
            } catch (error: any) {
              console.error('Error al cancelar reserva:', error);
              this.mostrarMensaje(error.message || 'Error al cancelar la reserva', 'danger');
            } finally {
              setTimeout(() => {
                this.customLoader.hide();
              }, 1000);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // formatearFecha(fecha: string): string { METODO QUE MUESTRA MAL LA FECHA, COMENTADO ENTERO POR LAS DUDAS POR SI HAY QUE VOLVER A USARLO
  //   const date = new Date(fecha);
  //   return date.toLocaleDateString('es-AR', { 
  //     weekday: 'long', 
  //     year: 'numeric', 
  //     month: 'long', 
  //     day: 'numeric' 
  //   });
  // }
  formatearFecha(fecha: string): string {
    
    const fechaLimpia = fecha.split('T')[0]; 
    const date = new Date(fechaLimpia);

    return date.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC' // <--- LO NUEVO PARA MANTENER EL DIA
    });
  }

  formatearHora(hora: string): string {
    return hora.slice(0, 5);
  }

  getEstadoColor(estado: string | undefined): string {
    switch (estado) {
      case 'confirmada':
        return 'success';
      case 'pendiente':
        return 'warning';
      case 'cancelada':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getEstadoTexto(estado: string | undefined): string {
    switch (estado) {
      case 'confirmada':
        return 'Confirmada';
      case 'pendiente':
        return 'Pendiente';
      case 'cancelada':
        return 'Cancelada';
      default:
        return 'Desconocido';
    }
  }

  toggleFormulario() {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (this.mostrarFormulario) {
      // Resetear fecha mínima cuando se abre el formulario
      const hoy = new Date();
      this.fechaMinima = hoy.toISOString().split('T')[0];
      const horaMinima = new Date();
      horaMinima.setHours(horaMinima.getHours() + 1);
      this.horaMinima = horaMinima.toTimeString().slice(0, 5);
    }
  }

  async mostrarMensaje(mensaje: string, color: string = 'primary') {
    // Vibrar en errores y warnings
    if (color === 'danger' || color === 'warning') {
      try {
        await Haptics.vibrate({ duration: 300 });
      } catch (err) {
        console.warn('No se pudo vibrar');
      }
    }
    
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

