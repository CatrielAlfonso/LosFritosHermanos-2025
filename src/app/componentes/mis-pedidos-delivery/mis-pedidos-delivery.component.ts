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
  IonSpinner,
  ToastController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
import { addIcons } from 'ionicons';
import { 
  arrowBackOutline,
  refreshOutline,
  bicycleOutline,
  chatbubbleOutline,
  receiptOutline,
  checkmarkCircleOutline
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
    IonRefresherContent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MisPedidosDeliveryComponent implements OnInit {
  pedidos: PedidoDelivery[] = [];
  cargando: boolean = true;

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
      checkmarkCircleOutline
    });
  }

  async ngOnInit() {
    await this.cargarPedidos();
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

