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
  ToastController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
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
  timeOutline
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
    private toastController: ToastController
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
      timeOutline
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
    // Guardar el pedido ID para asociar el descuento
    localStorage.setItem('pedidoDeliveryActual', pedido.id?.toString() || '');
    this.router.navigate(['/atrapa-el-pollo']);
  }

  irAEncuesta(pedido: PedidoDelivery) {
    this.router.navigate(['/confirmar-entrega', pedido.id]);
  }

  async pedirCuenta(pedido: PedidoDelivery) {
    // Navegar a la pantalla de confirmar entrega que tiene propina y cuenta
    this.router.navigate(['/confirmar-entrega', pedido.id]);
  }

  // Verificar si el pedido ya fue confirmado (tiene propina o calificación)
  pedidoYaConfirmado(pedido: PedidoDelivery): boolean {
    return (pedido.propina !== undefined && pedido.propina !== null) || 
           (pedido as any).calificacion !== undefined;
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

