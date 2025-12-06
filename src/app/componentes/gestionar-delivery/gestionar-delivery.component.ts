import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  IonNote,
  IonSegment,
  IonSegmentButton,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { DeliveryService, PedidoDelivery } from '../../servicios/delivery.service';
import { AuthService } from '../../servicios/auth.service';
import { CustomLoader } from '../../servicios/custom-loader.service';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  locationOutline,
  cashOutline,
  restaurantOutline,
  bicycleOutline,
  callOutline,
  refreshOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-gestionar-delivery',
  templateUrl: './gestionar-delivery.component.html',
  styleUrls: ['./gestionar-delivery.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    IonNote,
    IonSegment,
    IonSegmentButton,
    FritosSpinnerComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GestionarDeliveryComponent implements OnInit {
  pedidos: PedidoDelivery[] = [];
  pedidosFiltrados: PedidoDelivery[] = [];
  filtroEstado: string = 'pendiente';
  cargando: boolean = false;

  constructor(
    private deliveryService: DeliveryService,
    private authService: AuthService,
    private router: Router,
    private customLoader: CustomLoader,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({
      arrowBackOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      locationOutline,
      cashOutline,
      restaurantOutline,
      bicycleOutline,
      callOutline,
      refreshOutline
    });
  }

  async ngOnInit() {
    // Verificar que sea dueño o supervisor
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'dueño' && perfil !== 'supervisor') {
      await this.mostrarToast('Solo dueños y supervisores pueden acceder a esta sección', 'danger');
      this.router.navigate(['/home']);
      return;
    }

    await this.cargarPedidos();
  }

  async cargarPedidos() {
    try {
      this.cargando = true;
      this.pedidos = await this.deliveryService.obtenerTodosPedidosDelivery();
      this.aplicarFiltro();
    } catch (error: any) {
      console.error('Error al cargar pedidos delivery:', error);
      await this.mostrarToast('Error al cargar los pedidos', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltro() {
    if (this.filtroEstado === 'todos') {
      this.pedidosFiltrados = this.pedidos;
    } else {
      this.pedidosFiltrados = this.pedidos.filter(
        pedido => pedido.estado === this.filtroEstado
      );
    }
  }

  async confirmarPedido(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: 'Confirmar Pedido Delivery',
      message: '¿Confirmar este pedido? Se notificará al cliente y se derivará a cocina/bar.',
      inputs: [
        {
          name: 'tiempo_estimado',
          type: 'number',
          placeholder: 'Tiempo estimado (minutos)',
          value: 45,
          min: 15,
          max: 120
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async (data) => {
            const tiempoEstimado = parseInt(data.tiempo_estimado) || 45;
            await this.procesarConfirmacion(pedido, tiempoEstimado);
          }
        }
      ]
    });

    await alert.present();
  }

  async procesarConfirmacion(pedido: PedidoDelivery, tiempoEstimado: number) {
    try {
      this.customLoader.show();

      // Confirmar el pedido
      await this.deliveryService.confirmarPedidoDelivery(pedido.id!, tiempoEstimado);

      // Derivar a cocina y bar
      await this.derivarACocinaYBar(pedido);

      // Actualizar lista
      await this.cargarPedidos();

      this.customLoader.hide();
      await this.mostrarToast(
        `Pedido confirmado. Cliente notificado. Tiempo estimado: ${tiempoEstimado} minutos`,
        'success'
      );

    } catch (error: any) {
      console.error('Error al confirmar pedido:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al confirmar el pedido', 'danger');
    }
  }

  async rechazarPedido(pedido: PedidoDelivery) {
    const alert = await this.alertController.create({
      header: 'Rechazar Pedido Delivery',
      message: 'Ingresa el motivo del rechazo:',
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Ej: No hay repartidores disponibles, dirección fuera de zona de reparto, etc.'
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
            if (!data.motivo || data.motivo.trim() === '') {
              await this.mostrarToast('Debes ingresar un motivo', 'warning');
              return false;
            }
            await this.procesarRechazo(pedido, data.motivo.trim());
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async procesarRechazo(pedido: PedidoDelivery, motivo: string) {
    try {
      this.customLoader.show();

      await this.deliveryService.rechazarPedidoDelivery(pedido.id!, motivo);

      await this.cargarPedidos();

      this.customLoader.hide();
      await this.mostrarToast('Pedido rechazado. Cliente notificado.', 'success');

    } catch (error: any) {
      console.error('Error al rechazar pedido:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al rechazar el pedido', 'danger');
    }
  }

  // En gestionar-delivery.component.ts

async derivarACocinaYBar(pedido: PedidoDelivery) {
  try {
    const { data: { user } } = await this.authService.getCurrentUser();
    
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // 1. BUSCAR EL UUID DEL CLIENTE REAL
    let clienteUuid = null;
    if (pedido.cliente_email) {
      clienteUuid = await this.deliveryService.obtenerUuidClientePorEmail(pedido.cliente_email);
    }

    // Si no encontramos UUID, enviamos null para que no falle con error de sintaxis "16"
    console.log(`Derivando pedido. ID Numérico: ${pedido.cliente_id} -> UUID encontrado: ${clienteUuid}`);

    const pedidoRestaurante = {
      // 2. USAMOS EL UUID ENCONTRADO (O NULL)
      cliente_id: clienteUuid, 

      comidas: pedido.comidas || [],
      bebidas: pedido.bebidas || [],
      postres: pedido.postres || [],
      precio: pedido.precio_productos || pedido.precio_total,
      tiempo_estimado: pedido.tiempo_estimado || 45,
      confirmado: false, // Pendiente de confirmación del mozo
      mesa: 'DELIVERY', 
      estado: 'pendiente', // El mozo debe aceptarlo primero
      estado_comida: 'pendiente',
      estado_bebida: 'pendiente',
      estado_postre: 'pendiente',
      recepcion: false,
      pagado: 0,
      cuenta: pedido.precio_productos || pedido.precio_total || 0,
      fecha_pedido: new Date().toISOString(),
      // Campos para el repartidor
      cliente_nombre: pedido.cliente_nombre,
      cliente_telefono: pedido.cliente_telefono,
      direccion_completa: pedido.direccion_completa,
      direccion_referencia: pedido.direccion_referencia,
      latitud: pedido.latitud,
      longitud: pedido.longitud,
      // Guardamos el ID numérico en observaciones por si acaso
      observaciones_generales: `DELIVERY - CLIENTE #${pedido.cliente_id}: ${pedido.cliente_nombre} - DIR: ${pedido.direccion_completa} - OBS: ${pedido.observaciones_generales || ''}`
    };

    const { data: pedidoCreado, error } = await this.deliveryService.crearPedidoRestaurante(pedidoRestaurante);

    if (error) {
      console.error('Error al crear pedido en restaurante:', error);
      throw new Error(`Error BD: ${error.message}`); 
    }

    // Notificar a los mozos para que acepten el pedido
    await this.notificarMozosNuevoPedido(pedido, pedidoCreado);

    console.log('✅ Pedido delivery creado y enviado a mozos para confirmación');

  } catch (error: any) {
    console.error('Error al derivar a cocina y bar:', error);
    throw error;
  }
}

  async notificarCocinaYBar(pedidoDelivery: PedidoDelivery, pedidoRestaurante: any) {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080';

      // Notificar a cocina si hay comidas o postres
      if (pedidoDelivery.comidas && pedidoDelivery.comidas.length > 0 || 
          pedidoDelivery.postres && pedidoDelivery.postres.length > 0) {
        
        const comidasYPostres = [
          ...(pedidoDelivery.comidas || []),
          ...(pedidoDelivery.postres || [])
        ];

        await fetch(`${backendUrl}/notify-cocinero-new-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesaNumero: `DELIVERY #${pedidoDelivery.id}`,
            comidas: comidasYPostres,
            postres: []
          })
        });
      }

      // Notificar a bar si hay bebidas
      if (pedidoDelivery.bebidas && pedidoDelivery.bebidas.length > 0) {
        await fetch(`${backendUrl}/notify-bartender-new-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesaNumero: `DELIVERY #${pedidoDelivery.id}`,
            bebidas: pedidoDelivery.bebidas
          })
        });
      }

      console.log('✅ Notificaciones enviadas a cocina y bar');

    } catch (error) {
      console.error('Error al notificar a cocina/bar:', error);
      // No lanzamos error para no bloquear la confirmación del pedido
    }
  }

  /**
   * Notifica a todos los mozos sobre un nuevo pedido delivery pendiente
   */
  async notificarMozosNuevoPedido(pedidoDelivery: PedidoDelivery, pedidoRestaurante: any) {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080';

      await fetch(`${backendUrl}/notify-mozo-new-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaNumero: 'DELIVERY',
          clienteNombre: pedidoDelivery.cliente_nombre,
          pedidoId: pedidoRestaurante.id
        })
      });

      console.log('✅ Notificación enviada a mozos para pedido delivery');

    } catch (error) {
      console.error('Error al notificar a mozos:', error);
      // No lanzamos error para no bloquear la confirmación del pedido
    }
  }

  getCantidadPendientes(): number {
    return this.pedidos.filter(p => p.estado === 'pendiente').length;
  }

  getEstadoColor(estado: string | undefined): string {
    if (!estado) return 'medium';
    const colores: { [key: string]: string } = {
      'pendiente': 'warning',
      'confirmado': 'primary',
      'preparando': 'secondary',
      'en_camino': 'tertiary',
      'entregado': 'success',
      'cancelado': 'danger'
    };
    return colores[estado] || 'medium';
  }

  getEstadoTexto(estado: string | undefined): string {
    if (!estado) return 'Sin estado';
    const textos: { [key: string]: string } = {
      'pendiente': '⏳ Pendiente',
      'confirmado': '✅ Confirmado',
      'preparando': '🍳 Preparando',
      'en_camino': '🚴 En Camino',
      'entregado': '✅ Entregado',
      'cancelado': '❌ Cancelado'
    };
    return textos[estado] || estado;
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

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }

  getTotalProductos(pedido: PedidoDelivery): number {
    const comidas = pedido.comidas?.length || 0;
    const bebidas = pedido.bebidas?.length || 0;
    const postres = pedido.postres?.length || 0;
    return comidas + bebidas + postres;
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

