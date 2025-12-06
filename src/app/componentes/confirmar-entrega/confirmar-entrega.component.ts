import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonTextarea,
  IonRange,
  IonChip,
  IonBadge,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
import { AuthService } from '../../servicios/auth.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline, 
  checkmarkCircleOutline,
  starOutline,
  star,
  cashOutline,
  receiptOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-confirmar-entrega',
  templateUrl: './confirmar-entrega.component.html',
  styleUrls: ['./confirmar-entrega.component.scss'],
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonTextarea,
    IonRange,
    IonChip,
    IonBadge,
    FritosSpinnerComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ConfirmarEntregaComponent implements OnInit {
  pedidoId!: number;
  pedido: PedidoDelivery | null = null;
  cargando: boolean = true;

  // Estado del proceso
  pasoActual: number = 1; // 1: Confirmar, 2: Propina, 3: Encuesta, 4: Finalizado

  // Propina
  propinaPorcentaje: number = 10;
  propinaPersonalizada: number = 0;
  comentarioPropina: string = '';

  // Encuesta
  calificacionGeneral: number = 5;
  calificacionRepartidor: number = 5;
  calificacionTiempo: number = 5;
  calificacionCalidad: number = 5;
  comentarioEncuesta: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deliveryService: DeliveryService,
    private auth: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
    private pushNotificationService: PushNotificationService
  ) {
    addIcons({ 
      arrowBackOutline, 
      checkmarkCircleOutline,
      starOutline,
      star,
      cashOutline,
      receiptOutline
    });
  }

  async ngOnInit() {
    this.pedidoId = Number(this.route.snapshot.paramMap.get('pedidoId'));
    await this.cargarPedido();
  }

  async cargarPedido() {
    try {
      this.pedido = await this.deliveryService.obtenerPedidoPorId(this.pedidoId);
      
      if (!this.pedido) {
        await this.mostrarToast('Pedido no encontrado', 'danger');
        this.volver();
        return;
      }

      // Verificar que el pedido esté en estado "entregado"
      if (this.pedido.estado !== 'entregado') {
        await this.mostrarToast('Este pedido aún no ha sido entregado', 'warning');
        this.volver();
        return;
      }

      this.cargando = false;
    } catch (error) {
      console.error('Error al cargar pedido:', error);
      await this.mostrarToast('Error al cargar el pedido', 'danger');
      this.volver();
    }
  }

  async confirmarRecepcion() {
    const alert = await this.alertController.create({
      header: '¿Confirmar Recepción?',
      message: '¿Has recibido tu pedido completo y en buen estado?',
      buttons: [
        {
          text: 'No, hay un problema',
          role: 'cancel',
          handler: () => {
            this.reportarProblema();
          }
        },
        {
          text: 'Sí, confirmar',
          handler: () => {
            this.avanzarAPropina();
          }
        }
      ]
    });

    await alert.present();
  }

  async reportarProblema() {
    const alert = await this.alertController.create({
      header: 'Reportar Problema',
      message: 'Por favor, describe el problema con tu pedido:',
      inputs: [
        {
          name: 'problema',
          type: 'textarea',
          placeholder: 'Describe el problema...'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Enviar Reporte',
          handler: async (data) => {
            if (data.problema) {
              // TODO: Guardar el reporte en la base de datos
              await this.mostrarToast('Reporte enviado. Nos pondremos en contacto contigo.', 'success');
              this.volver();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async avanzarAPropina() {
    // Notificar al repartidor y dueño/supervisor que el cliente está confirmando
    await this.notificarConfirmacionDelivery();
    this.pasoActual = 2;
  }

  async notificarConfirmacionDelivery() {
    if (!this.pedido) return;
    
    try {
      await this.pushNotificationService.notificarConfirmacionDelivery(
        this.pedido.id!,
        this.pedido.cliente_nombre,
        this.pedido.precio_total || 0
      );
    } catch (error) {
      console.error('Error al enviar notificación de confirmación delivery:', error);
    }
  }

  calcularPropina(): number {
    if (!this.pedido) return 0;
    
    if (this.propinaPorcentaje === 0 && this.propinaPersonalizada > 0) {
      return this.propinaPersonalizada;
    }
    
    return ((this.pedido.precio_total || 0) * this.propinaPorcentaje) / 100;
  }

  calcularTotal(): number {
    if (!this.pedido) return 0;
    return (this.pedido.precio_total || 0) + this.calcularPropina();
  }

  async confirmarPropina() {
    this.pasoActual = 3;
  }

  async omitirPropina() {
    this.propinaPorcentaje = 0;
    this.propinaPersonalizada = 0;
    this.pasoActual = 3;
  }

  async enviarEncuesta() {
    if (!this.pedido) return;

    try {
      const encuesta = {
        pedido_id: this.pedidoId,
        cliente_id: this.pedido.cliente_id,
        repartidor_id: this.pedido.repartidor_id,
        calificacion_general: this.calificacionGeneral,
        calificacion_repartidor: this.calificacionRepartidor,
        calificacion_tiempo: this.calificacionTiempo,
        calificacion_calidad: this.calificacionCalidad,
        comentario: this.comentarioEncuesta,
        propina: this.calcularPropina(),
        comentario_propina: this.comentarioPropina
      };

      await this.deliveryService.guardarEncuestaDelivery(encuesta);
      await this.deliveryService.actualizarPropinaDelivery(this.pedidoId, this.calcularPropina());

      // Generar y enviar PDF
      await this.generarYEnviarPDF();

      this.pasoActual = 4;
      await this.mostrarToast('¡Gracias por tu feedback!', 'success');

      // Redirigir después de 3 segundos
      setTimeout(() => {
        this.volver();
      }, 3000);
    } catch (error) {
      console.error('Error al enviar encuesta:', error);
      await this.mostrarToast('Error al enviar la encuesta', 'danger');
    }
  }

  async omitirEncuesta() {
    try {
      // Solo guardar la propina si existe
      if (this.calcularPropina() > 0) {
        await this.deliveryService.actualizarPropinaDelivery(this.pedidoId, this.calcularPropina());
      }

      // Generar y enviar PDF
      await this.generarYEnviarPDF();

      this.pasoActual = 4;
      await this.mostrarToast('¡Gracias por tu compra!', 'success');

      setTimeout(() => {
        this.volver();
      }, 2000);
    } catch (error) {
      console.error('Error:', error);
      await this.mostrarToast('Error al procesar', 'danger');
    }
  }

  async generarYEnviarPDF() {
    if (!this.pedido) return;

    try {
      await this.deliveryService.generarYEnviarBoletaDelivery(
        this.pedidoId,
        this.calcularPropina()
      );
      await this.mostrarToast('Boleta enviada a tu correo', 'success');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      // No bloqueamos el flujo si falla el PDF
    }
  }

  getEstrellas(cantidad: number): number[] {
    return Array(cantidad).fill(0);
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
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

  getTodosLosProductos(pedido: PedidoDelivery | null): any[] {
    if (!pedido) return [];
    return [
      ...(pedido.comidas || []),
      ...(pedido.bebidas || []),
      ...(pedido.postres || [])
    ];
  }
}

