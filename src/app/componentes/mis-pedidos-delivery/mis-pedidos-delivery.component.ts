import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  IonBadge,
  IonChip,
  IonRefresher,
  IonRefresherContent,
  ToastController,
  AlertController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
import { PushNotificationService } from '../../servicios/push-notification.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline,
  refreshOutline,
  bicycleOutline,
  chatbubbleOutline,
  receiptOutline,
  checkmarkCircleOutline,
  gameControllerOutline,
  clipboardOutline,
  cashOutline,
  qrCodeOutline,
  timeOutline,
  statsChartOutline,
  cardOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-mis-pedidos-delivery',
  templateUrl: './mis-pedidos-delivery.component.html',
  styleUrls: ['./mis-pedidos-delivery.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
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
    IonBadge,
    IonChip,
    IonRefresher,
    IonRefresherContent,
    FritosSpinnerComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MisPedidosDeliveryComponent implements OnInit {
  pedidos: PedidoDelivery[] = [];
  cargando: boolean = true;
  qrEscaneado: boolean = false; // Indica si se escaneó el QR DELIVERY

  estadosConfig: { [key: string]: { color: string; texto: string } } = {
    'pendiente': { color: 'warning', texto: '⏳ Pendiente' },
    'confirmado': { color: 'primary', texto: '✅ Confirmado' },
    'preparando': { color: 'secondary', texto: '🍳 Preparando' },
    'en_camino': { color: 'tertiary', texto: '🚴 En Camino' },
    'entregado': { color: 'success', texto: '✅ Entregado' },
    'cancelado': { color: 'danger', texto: '❌ Cancelado' }
  };

  constructor(
    private router: Router,
    private deliveryService: DeliveryService,
    private toastController: ToastController,
    private alertController: AlertController,
    private pushNotificationService: PushNotificationService
  ) {
    addIcons({ 
      arrowBackOutline,
      refreshOutline,
      bicycleOutline,
      chatbubbleOutline,
      receiptOutline,
      checkmarkCircleOutline,
      gameControllerOutline,
      clipboardOutline,
      cashOutline,
      qrCodeOutline,
      timeOutline,
      statsChartOutline,
      cardOutline
    });
  }

  async ngOnInit() {
    await this.cargarPedidos();
    // El QR DELIVERY debe escanearse cada vez que se inicia la app
    this.qrEscaneado = false;
  }

  async cargarPedidos() {
    try {
      this.pedidos = await this.deliveryService.obtenerPedidosClienteActual();
      this.cargando = false;
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      await this.mostrarToast('Error al cargar tus pedidos', 'danger');
      this.cargando = false;
    }
  }

  async refrescar(event: any) {
    await this.cargarPedidos();
    event.target.complete();
  }

  getColorEstado(estado: string | undefined): string {
    if (!estado) return 'medium';
    return this.estadosConfig[estado]?.color || 'medium';
  }

  getTextoEstado(estado: string | undefined): string {
    if (!estado) return 'Sin estado';
    return this.estadosConfig[estado]?.texto || estado;
  }

  // Obtener texto del estado de un sector (cocina/bar)
  getTextoEstadoSector(estado: string | undefined): string {
    const estados: { [key: string]: string } = {
      'pendiente': '⏳ Pendiente',
      'derivado': '📥 Derivado - Por recibir',
      'en preparacion': '🍳 En Preparación',
      'listo': '✅ Listo'
    };
    return estados[estado || ''] || estado || 'Sin estado';
  }

  // Obtener color del estado de un sector
  getColorEstadoSector(estado: string | undefined): string {
    const colores: { [key: string]: string } = {
      'pendiente': 'medium',
      'derivado': 'warning',
      'en preparacion': 'primary',
      'listo': 'success'
    };
    return colores[estado || ''] || 'medium';
  }

  // Verificar si el pedido tiene comidas/postres
  tieneComidas(pedido: PedidoDelivery): boolean {
    return (pedido.comidas && pedido.comidas.length > 0) || 
           (pedido.postres && pedido.postres.length > 0);
  }

  // Verificar si el pedido tiene bebidas
  tieneBebidas(pedido: PedidoDelivery): boolean {
    return pedido.bebidas && pedido.bebidas.length > 0;
  }

  getTotalProductos(pedido: PedidoDelivery): number {
    const comidas = (pedido.comidas || []).reduce((sum: number, item: any) => sum + item.cantidad, 0);
    const bebidas = (pedido.bebidas || []).reduce((sum: number, item: any) => sum + item.cantidad, 0);
    const postres = (pedido.postres || []).reduce((sum: number, item: any) => sum + item.cantidad, 0);
    return comidas + bebidas + postres;
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  abrirChat(pedido: PedidoDelivery) {
    if (pedido.estado === 'en_camino' || pedido.estado === 'preparando') {
      this.router.navigate(['/chat-delivery', pedido.id]);
    } else {
      this.mostrarToast('El chat solo está disponible cuando el pedido está en camino', 'warning');
    }
  }

  confirmarEntrega(pedido: PedidoDelivery) {
    if (pedido.estado === 'entregado') {
      this.router.navigate(['/confirmar-entrega', pedido.id]);
    } else {
      this.mostrarToast('Solo puedes confirmar pedidos ya entregados', 'warning');
    }
  }

  irAJuegos(pedido: PedidoDelivery) {
    // Guardar el pedido ID para asociar el descuento (mesa = DELIVERY)
    localStorage.setItem('pedidoDeliveryActual', pedido.id?.toString() || '');
    localStorage.setItem('mesaActual', 'DELIVERY');
    this.router.navigate(['/game-selector']);
  }

  // Ir a completar encuesta (solo si no la completó aún)
  irAEncuesta(pedido: PedidoDelivery) {
    localStorage.setItem('pedidoDeliveryActual', pedido.id?.toString() || '');
    localStorage.setItem('mesaActual', 'DELIVERY');
    this.router.navigate(['/encuestas']);
  }

  // Ver resultados de encuestas (gráficos)
  verResultadosEncuestas(pedido: PedidoDelivery) {
    this.router.navigate(['/encuestas'], { queryParams: { modo: 'ver' } });
  }

  // Confirmar recepción del pedido (primer paso después de entregado)
  async confirmarRecepcionPedido(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: '¿Confirmar Recepción?',
      message: '¿Has recibido tu pedido completo (comidas, bebidas y postres) y en buen estado?',
      buttons: [
        {
          text: 'No, hay un problema',
          role: 'cancel',
          handler: () => {
            this.reportarProblema(pedido);
          }
        },
        {
          text: 'Sí, confirmar',
          handler: async () => {
            await this.marcarRecepcionConfirmada(pedido);
          }
        }
      ]
    });

    await alert.present();
  }

  // Reportar problema con el pedido
  async reportarProblema(pedido: PedidoDelivery) {
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
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // Marcar recepción confirmada en el pedido
  async marcarRecepcionConfirmada(pedido: PedidoDelivery) {
    try {
      await this.deliveryService.actualizarPedidoDelivery(pedido.id!, {
        recepcion: true
      });
      
      // Actualizar pedido local
      pedido.recepcion = true;
      
      await this.mostrarToast('✅ ¡Recepción confirmada! Ahora podés acceder a juegos, encuesta y pedir la cuenta.', 'success');
      
      // Recargar pedidos para reflejar cambios
      await this.cargarPedidos();
    } catch (error) {
      console.error('Error al confirmar recepción:', error);
      await this.mostrarToast('Error al confirmar recepción. Intentá nuevamente.', 'danger');
    }
  }

  // Pedir la cuenta (notifica al mozo/dueño)
  async pedirCuenta(pedido: PedidoDelivery) {
    try {
      // Notificar al restaurante
      await this.pushNotificationService.solicitarCuentaMozo(
        'DELIVERY',
        pedido.cliente_nombre,
        ''
      );
      
      // Actualizar el pedido
      await this.deliveryService.actualizarPedidoDelivery(pedido.id!, {
        solicita_cuenta: true
      });
      
      // Actualizar pedido local
      pedido.solicita_cuenta = true;
      
      await this.mostrarToast('✅ Se ha notificado tu solicitud de cuenta. Escaneá el QR para ingresar propina.', 'success');
      
      // Recargar pedidos
      await this.cargarPedidos();
    } catch (error) {
      console.error('Error al pedir cuenta:', error);
      await this.mostrarToast('Error al solicitar la cuenta. Intentá nuevamente.', 'danger');
    }
  }

  // Escanear QR para propina (después de pedir cuenta)
  async escanearQRPropina(pedido: PedidoDelivery) {
    try {
      // Verificar permisos
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newCamera } = await BarcodeScanner.requestPermissions();
        if (newCamera !== 'granted') {
          await this.mostrarToast('Se necesitan permisos de cámara para escanear', 'warning');
          return;
        }
      }

      document.body.classList.add('barcode-scanner-active');
      const result = await BarcodeScanner.scan();
      await BarcodeScanner.stopScan();
      document.body.classList.remove('barcode-scanner-active');

      if (result.barcodes.length > 0) {
        const qrContent = result.barcodes[0].rawValue.trim().toUpperCase();
        
        // Aceptar QR de propina o QR DELIVERY
        if (qrContent === 'PROPINA_FRITOS_HERMANOS' || 
            qrContent.includes('PROPINA') ||
            qrContent === 'DELIVERY' || 
            qrContent === 'QR DELIVERY') {
          await this.mostrarSelectorPropina(pedido);
        } else {
          await this.mostrarToast('QR inválido. Escaneá el QR de propina o DELIVERY', 'warning');
        }
      }
    } catch (error: any) {
      document.body.classList.remove('barcode-scanner-active');
      await BarcodeScanner.stopScan();
      
      if (error.message && !error.message.includes('cancelled') && !error.message.includes('cancelado')) {
        console.error('Error al escanear QR:', error);
        await this.mostrarToast('Error al escanear el QR', 'danger');
      }
    }
  }

  // Mostrar selector de propina
  async mostrarSelectorPropina(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: '💰 Ingresá la Propina',
      message: '¿Qué porcentaje de propina querés dejar?',
      inputs: [
        { name: 'propina', type: 'radio', label: '0% - Sin propina', value: '0' },
        { name: 'propina', type: 'radio', label: '5%', value: '5' },
        { name: 'propina', type: 'radio', label: '10%', value: '10', checked: true },
        { name: 'propina', type: 'radio', label: '15%', value: '15' },
        { name: 'propina', type: 'radio', label: '20%', value: '20' },
        { name: 'propina', type: 'radio', label: '25%', value: '25' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async (data) => {
            const propina = parseInt(data);
            await this.guardarPropina(pedido, propina);
          }
        }
      ]
    });
    
    await alert.present();
  }

  // Guardar propina
  async guardarPropina(pedido: PedidoDelivery, propina: number) {
    try {
      await this.deliveryService.actualizarPropinaDelivery(pedido.id!, propina);
      
      // Actualizar pedido local
      pedido.propina = propina;
      
      await this.mostrarToast(`✅ Propina del ${propina}% registrada.`, 'success');
      
      // Recargar pedidos
      await this.cargarPedidos();
    } catch (error) {
      console.error('Error al guardar propina:', error);
      await this.mostrarToast('Error al guardar la propina. Intentá nuevamente.', 'danger');
    }
  }

  // Ver detalle de la cuenta
  verDetalleCuenta(pedido: PedidoDelivery) {
    this.router.navigate(['/confirmar-entrega', pedido.id]);
  }

  // Verificar si el pedido ya fue confirmado (tiene propina o calificación)
  pedidoYaConfirmado(pedido: PedidoDelivery): boolean {
    return (pedido.propina !== undefined && pedido.propina !== null) || 
           (pedido as any).calificacion !== undefined;
  }

  // Verificar si el cliente confirmó la recepción
  recepcionConfirmada(pedido: PedidoDelivery): boolean {
    return pedido.recepcion === true;
  }

  // Verificar si ya respondió la encuesta
  encuestaRespondida(pedido: PedidoDelivery): boolean {
    return pedido.encuesta_respondida === true;
  }

  // Verificar si ya solicitó la cuenta
  cuentaSolicitada(pedido: PedidoDelivery): boolean {
    return pedido.solicita_cuenta === true;
  }

  // Verificar si ya tiene propina cargada
  tienePropina(pedido: PedidoDelivery): boolean {
    return pedido.propina !== undefined && pedido.propina !== null;
  }

  // Calcular el monto de propina basado en el porcentaje
  calcularMontoPropina(pedido: PedidoDelivery): number {
    if (!pedido.propina || !pedido.precio_total) return 0;
    return (pedido.precio_total * pedido.propina) / 100;
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

  async escanearQRDelivery() {
    try {
      // Verificar permisos
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: newCamera } = await BarcodeScanner.requestPermissions();
        if (newCamera !== 'granted') {
          await this.mostrarToast('Se necesitan permisos de cámara para escanear', 'warning');
          return;
        }
      }

      // Activar clase para el body durante el escaneo
      document.body.classList.add('barcode-scanner-active');

      // Iniciar escaneo
      const result = await BarcodeScanner.scan();
      await BarcodeScanner.stopScan();
      document.body.classList.remove('barcode-scanner-active');

      if (result.barcodes.length > 0) {
        const qrContent = result.barcodes[0].rawValue.trim().toUpperCase();
        
        // Verificar que sea el QR DELIVERY (acepta "DELIVERY" o "QR DELIVERY")
        if (qrContent === 'DELIVERY' || qrContent === 'QR DELIVERY') {
          this.qrEscaneado = true;
          // NO guardamos en localStorage - el cliente debe escanear cada vez que inicia la app
          await this.mostrarToast('✅ QR escaneado correctamente. ¡Ya podés acceder a los juegos!', 'success');
        } else {
          await this.mostrarToast('QR inválido. Escaneá el código QR DELIVERY', 'warning');
        }
      } else {
        await this.mostrarToast('No se detectó ningún código QR', 'warning');
      }
    } catch (error: any) {
      document.body.classList.remove('barcode-scanner-active');
      await BarcodeScanner.stopScan();
      
      // Si el usuario canceló, no mostrar error
      if (error.message && !error.message.includes('cancelled') && !error.message.includes('cancelado')) {
        console.error('Error al escanear QR:', error);
        await this.mostrarToast('Error al escanear el QR', 'danger');
      }
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }
}

