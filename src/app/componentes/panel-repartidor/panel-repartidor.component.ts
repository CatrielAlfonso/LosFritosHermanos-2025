import { Component, OnInit, ViewChild, ElementRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonButtons,
  IonList,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  AlertController,
  ToastController,
  ModalController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
import { AuthService } from '../../servicios/auth.service';
import { CustomLoader } from '../../servicios/custom-loader.service';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  mapOutline,
  chatbubbleOutline,
  bicycleOutline,
  locationOutline,
  callOutline,
  refreshOutline,
  navigateOutline,
  timeOutline
} from 'ionicons/icons';

declare var google: any;

@Component({
  selector: 'app-panel-repartidor',
  templateUrl: './panel-repartidor.component.html',
  styleUrls: ['./panel-repartidor.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonButtons,
    IonList,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PanelRepartidorComponent implements OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  pedidos: PedidoDelivery[] = [];
  pedidosFiltrados: PedidoDelivery[] = [];
  filtroEstado: string = 'asignados'; // asignados, en_camino, todos
  repartidorInfo: any = null;
  map: any;
  directionsService: any;
  directionsRenderer: any;
  cargando: boolean = false;

  constructor(
    private deliveryService: DeliveryService,
    private authService: AuthService,
    private router: Router,
    private customLoader: CustomLoader,
    private alertController: AlertController,
    private toastController: ToastController,
    private modalController: ModalController
  ) {
    addIcons({
      arrowBackOutline,
      checkmarkCircleOutline,
      mapOutline,
      chatbubbleOutline,
      bicycleOutline,
      locationOutline,
      callOutline,
      refreshOutline,
      navigateOutline,
      timeOutline
    });
  }

  async ngOnInit() {
    // Verificar que sea repartidor
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'repartidor') {
      await this.mostrarToast('Solo repartidores pueden acceder a esta sección', 'danger');
      this.router.navigate(['/home']);
      return;
    }

    // Obtener info del repartidor
    await this.cargarInfoRepartidor();
    
    // Cargar pedidos
    await this.cargarPedidos();
  }

  async cargarInfoRepartidor() {
    try {
      const { data: { user } } = await this.authService.getCurrentUser();
      if (!user || !user.email) return;

      this.repartidorInfo = await this.deliveryService.obtenerInfoRepartidor(user.email);
    } catch (error) {
      console.error('Error al cargar info del repartidor:', error);
    }
  }

  async cargarPedidos() {
    try {
      this.cargando = true;
      
      if (!this.repartidorInfo) {
        throw new Error('No se pudo obtener información del repartidor');
      }

      this.pedidos = await this.deliveryService.obtenerPedidosRepartidor(this.repartidorInfo.id);
      this.aplicarFiltro();
    } catch (error: any) {
      console.error('Error al cargar pedidos:', error);
      await this.mostrarToast('Error al cargar los pedidos', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltro() {
    if (this.filtroEstado === 'asignados') {
      this.pedidosFiltrados = this.pedidos.filter(
        p => p.estado === 'confirmado' || p.estado === 'preparando'
      );
    } else if (this.filtroEstado === 'en_camino') {
      this.pedidosFiltrados = this.pedidos.filter(p => p.estado === 'en_camino');
    } else {
      this.pedidosFiltrados = this.pedidos;
    }
  }

  async confirmarRecepcion(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: 'Confirmar Recepción',
      message: '¿Confirmas que has recibido este pedido y estás listo para entregarlo?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            await this.procesarConfirmacion(pedido);
          }
        }
      ]
    });

    await alert.present();
  }

  async procesarConfirmacion(pedido: PedidoDelivery) {
    try {
      this.customLoader.show();

      await this.deliveryService.confirmarRecepcionRepartidor(pedido.id!);

      await this.cargarPedidos();

      this.customLoader.hide();
      await this.mostrarToast('Pedido confirmado. ¡En camino!', 'success');

    } catch (error: any) {
      console.error('Error al confirmar recepción:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al confirmar', 'danger');
    }
  }

  async marcarEnCamino(pedido: PedidoDelivery) {
    try {
      this.customLoader.show();

      await this.deliveryService.actualizarEstadoPedidoDelivery(pedido.id!, 'en_camino');

      await this.cargarPedidos();

      this.customLoader.hide();
      await this.mostrarToast('Estado actualizado: En camino', 'success');

    } catch (error: any) {
      console.error('Error al actualizar estado:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al actualizar', 'danger');
    }
  }

  async marcarEntregado(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: 'Confirmar Entrega',
      message: '¿Confirmas que has entregado este pedido al cliente?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar Entrega',
          handler: async () => {
            await this.procesarEntrega(pedido);
          }
        }
      ]
    });

    await alert.present();
  }

  async procesarEntrega(pedido: PedidoDelivery) {
    try {
      this.customLoader.show();

      await this.deliveryService.marcarPedidoEntregado(pedido.id!);

      await this.cargarPedidos();

      this.customLoader.hide();
      await this.mostrarToast('¡Pedido entregado exitosamente!', 'success');

    } catch (error: any) {
      console.error('Error al marcar como entregado:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al entregar', 'danger');
    }
  }

  async verMapa(pedido: PedidoDelivery) {
    if (!pedido.latitud || !pedido.longitud) {
      await this.mostrarToast('Este pedido no tiene coordenadas GPS', 'warning');
      return;
    }

    // Abrir modal con mapa
    const modal = await this.modalController.create({
      component: MapaRutaComponent,
      componentProps: {
        pedido: pedido,
        restauranteLat: -34.6037, // Coordenadas del restaurante
        restauranteLng: -58.3816
      }
    });

    await modal.present();
  }

  async abrirChat(pedido: PedidoDelivery) {
    // Navegar al componente de chat
    this.router.navigate(['/chat-delivery', pedido.id]);
  }

  getCantidadAsignados(): number {
    return this.pedidos.filter(p => p.estado === 'confirmado' || p.estado === 'preparando').length;
  }

  getCantidadEnCamino(): number {
    return this.pedidos.filter(p => p.estado === 'en_camino').length;
  }

  getEstadoColor(estado: string | undefined): string {
    if (!estado) return 'medium';
    const colores: { [key: string]: string } = {
      'confirmado': 'primary',
      'preparando': 'secondary',
      'en_camino': 'tertiary',
      'entregado': 'success'
    };
    return colores[estado] || 'medium';
  }

  getEstadoTexto(estado: string | undefined): string {
    if (!estado) return 'Sin estado';
    const textos: { [key: string]: string } = {
      'confirmado': '✅ Confirmado',
      'preparando': '🍳 Preparando',
      'en_camino': '🚴 En Camino',
      'entregado': '✅ Entregado'
    };
    return textos[estado] || estado;
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }

  llamarCliente(telefono: string) {
    if (telefono) {
      window.open(`tel:${telefono}`, '_system');
    }
  }

  getTotalProductos(pedido: PedidoDelivery): number {
    const comidas = pedido.comidas?.length || 0;
    const bebidas = pedido.bebidas?.length || 0;
    const postres = pedido.postres?.length || 0;
    return comidas + bebidas + postres;
  }

  abrirGoogleMaps(pedido: PedidoDelivery) {
    if (pedido.latitud && pedido.longitud) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${pedido.latitud},${pedido.longitud}`;
      window.open(url, '_system');
    }
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

// Componente para el modal del mapa (simplificado, se puede crear archivo separado)
@Component({
  selector: 'app-mapa-ruta',
  template: `
    <ion-header>
      <ion-toolbar color="fritos-red">
        <ion-title>Ruta al Cliente</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cerrar()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div #mapContainer class="map-full"></div>
      <div class="map-info">
        <h3>{{ pedido.direccion_completa }}</h3>
        <p><ion-icon name="call-outline"></ion-icon> {{ pedido.cliente_telefono }}</p>
        <ion-button expand="block" (click)="abrirEnGoogleMaps()">
          <ion-icon name="navigate-outline" slot="start"></ion-icon>
          Abrir en Google Maps
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .map-full {
      width: 100%;
      height: 70vh;
    }
    .map-info {
      padding: 20px;
      h3 {
        color: var(--ion-color-fritos-red);
        margin-bottom: 10px;
      }
      p {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
      }
      ion-button {
        margin-top: 15px;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent]
})
export class MapaRutaComponent implements OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  pedido: any;
  restauranteLat: number = -34.6037;
  restauranteLng: number = -58.3816;
  map: any;
  directionsService: any;
  directionsRenderer: any;

  constructor(private modalController: ModalController) {
    addIcons({
      closeOutline: 'close-outline',
      callOutline: 'call-outline',
      navigateOutline: 'navigate-outline'
    } as any);
  }

  ngOnInit() {
    setTimeout(() => this.initMap(), 500);
  }

  initMap() {
    this.map = new google.maps.Map(this.mapContainer.nativeElement, {
      zoom: 14,
      center: { lat: this.restauranteLat, lng: this.restauranteLng }
    });

    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      suppressMarkers: false
    });

    this.calcularRuta();
  }

  calcularRuta() {
    const request = {
      origin: { lat: this.restauranteLat, lng: this.restauranteLng },
      destination: { lat: this.pedido.latitud, lng: this.pedido.longitud },
      travelMode: google.maps.TravelMode.DRIVING
    };

    this.directionsService.route(request, (result: any, status: any) => {
      if (status === 'OK') {
        this.directionsRenderer.setDirections(result);
      }
    });
  }

  abrirEnGoogleMaps() {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${this.restauranteLat},${this.restauranteLng}&destination=${this.pedido.latitud},${this.pedido.longitud}`;
    window.open(url, '_system');
  }

  cerrar() {
    this.modalController.dismiss();
  }
}

