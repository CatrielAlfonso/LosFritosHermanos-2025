import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
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
  IonRadio,
  IonRadioGroup,
  IonList,
  IonListHeader,
  IonNote,
  IonRow,
  IonCol,
  IonGrid
} from '@ionic/angular/standalone';
import { DeliveryService, DireccionDelivery } from '../../servicios/delivery.service';
import { CarritoService, CartItem } from '../../servicios/carrito.service';
import { AuthService } from '../../servicios/auth.service';
import { CustomLoader } from '../../servicios/custom-loader.service';
import { addIcons } from 'ionicons';
import {
  locationOutline,
  mapOutline,
  cartOutline,
  cashOutline,
  cardOutline,
  closeCircleOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  callOutline,
  homeOutline,
  addOutline,
  removeOutline
} from 'ionicons/icons';

declare var google: any;

@Component({
  selector: 'app-delivery',
  templateUrl: './delivery.component.html',
  styleUrls: ['./delivery.component.scss'],
  standalone: true,
  imports: [
    IonButtons,
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonIcon,
    IonBadge,
    IonTextarea,
    IonRadio,
    IonRadioGroup,
    IonList,
    IonListHeader,
    IonNote,
    IonRow,
    IonCol,
    IonGrid
  ]
})
export class DeliveryComponent implements OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  direccionForm: FormGroup;
  map: any;
  marker: any;
  clienteInfo: any = null;
  cartItems: CartItem[] = [];
  precioProductos: number = 0;
  precioEnvio: number = 500; // Precio base
  precioTotal: number = 0;
  metodoPago: string = 'efectivo';
  mostrarMapa: boolean = false;
  selectedLocation: { lat: number; lng: number } | null = null;

  // Coordenadas por defecto (Buenos Aires)
  defaultLat = -34.6037;
  defaultLng = -58.3816;

  constructor(
    private fb: FormBuilder,
    private deliveryService: DeliveryService,
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private customLoader: CustomLoader,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    addIcons({
      locationOutline,
      mapOutline,
      cartOutline,
      cashOutline,
      cardOutline,
      closeCircleOutline,
      arrowBackOutline,
      checkmarkCircleOutline,
      callOutline,
      homeOutline,
      addOutline,
      removeOutline
    });

    this.direccionForm = this.fb.group({
      calle: ['', [Validators.required, Validators.minLength(3)]],
      numero: ['', [Validators.required]],
      piso: [''],
      depto: [''],
      referencia: [''],
      telefono: ['', [Validators.required]]
    });
  }

  async ngOnInit() {
    // Verificar que el usuario sea cliente registrado
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'cliente') {
      await this.mostrarToast('Solo clientes registrados pueden hacer pedidos delivery', 'danger');
      this.router.navigate(['/home']);
      return;
    }

    // Cargar información del cliente
    await this.cargarInfoCliente();

    // Cargar productos del carrito
    this.cargarCarrito();

    // Verificar que haya productos en el carrito
    if (this.cartItems.length === 0) {
      await this.mostrarToast('Tu carrito está vacío. Agrega productos primero.', 'warning');
      this.router.navigate(['/menu']);
      return;
    }
  }

  async cargarInfoCliente() {
    try {
      this.clienteInfo = await this.deliveryService.obtenerInfoCliente();
      if (this.clienteInfo && this.clienteInfo.telefono) {
        this.direccionForm.patchValue({
          telefono: this.clienteInfo.telefono
        });
      }
    } catch (error: any) {
      console.error('Error al cargar info del cliente:', error);
    }
  }

  cargarCarrito() {
    this.cartItems = this.carritoService.obtenerItems();
    this.calcularPrecios();
  }

  calcularPrecios() {
    this.precioProductos = this.carritoService.totalPrecio();
    
    // Calcular precio de envío si hay coordenadas
    if (this.selectedLocation) {
      this.precioEnvio = this.deliveryService.calcularPrecioEnvio(
        this.selectedLocation.lat,
        this.selectedLocation.lng
      );
    } else {
      this.precioEnvio = 500; // Precio base
    }

    this.precioTotal = this.precioProductos + this.precioEnvio;
  }

  toggleMapa() {
    console.log('🔄 Toggle mapa, mostrar:', !this.mostrarMapa);
    this.mostrarMapa = !this.mostrarMapa;
    if (this.mostrarMapa) {
      setTimeout(() => {
        console.log('⏰ Timeout ejecutado, inicializando mapa...');
        this.initMap();
      }, 100);
    }
  }

  initMap() {
    console.log('🗺️ Inicializando mapa...');
    
    if (!this.mapContainer) {
      console.error('❌ mapContainer no disponible');
      return;
    }

    if (!this.mapContainer.nativeElement) {
      console.error('❌ mapContainer.nativeElement no disponible');
      return;
    }

    console.log('✅ Elemento del mapa:', this.mapContainer.nativeElement);

    try {
      const mapOptions = {
        center: { lat: this.defaultLat, lng: this.defaultLng },
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      };

      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      console.log('✅ Mapa creado');

      // Agregar marker inicial
      this.marker = new google.maps.Marker({
        position: { lat: this.defaultLat, lng: this.defaultLng },
        map: this.map,
        draggable: true,
        title: 'Ubicación de entrega'
      });
      console.log('✅ Marker creado');
    } catch (error) {
      console.error('❌ Error creando mapa:', error);
    }

    // Listener para cuando se mueve el marker
    google.maps.event.addListener(this.marker, 'dragend', (event: any) => {
      this.onMarkerMoved(event.latLng.lat(), event.latLng.lng());
    });

    // Listener para click en el mapa
    google.maps.event.addListener(this.map, 'click', (event: any) => {
      this.marker.setPosition(event.latLng);
      this.onMarkerMoved(event.latLng.lat(), event.latLng.lng());
    });

    // Obtener ubicación actual del usuario
    this.obtenerUbicacionActual();
  }

  obtenerUbicacionActual() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const pos = { lat, lng };

          this.map.setCenter(pos);
          this.marker.setPosition(pos);
          this.onMarkerMoved(lat, lng);
        },
        () => {
          console.log('No se pudo obtener la ubicación actual');
        }
      );
    }
  }

  onMarkerMoved(lat: number, lng: number) {
    this.selectedLocation = { lat, lng };
    this.calcularPrecios();
    
    // Obtener dirección desde coordenadas (geocoding inverso)
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === 'OK' && results[0]) {
        const addressComponents = results[0].address_components;
        this.autocompletarDireccion(addressComponents);
      }
    });
  }

  autocompletarDireccion(components: any[]) {
    let calle = '';
    let numero = '';

    for (const component of components) {
      const types = component.types;
      
      if (types.includes('street_number')) {
        numero = component.long_name;
      }
      if (types.includes('route')) {
        calle = component.long_name;
      }
    }

    if (calle) {
      this.direccionForm.patchValue({ calle, numero });
    }
  }

  aumentarCantidad(item: CartItem) {
    this.carritoService.actualizarCantidad(item.id, item.cantidad + 1);
    this.cargarCarrito();
  }

  disminuirCantidad(item: CartItem) {
    if (item.cantidad > 1) {
      this.carritoService.actualizarCantidad(item.id, item.cantidad - 1);
      this.cargarCarrito();
    }
  }

  async eliminarItem(item: CartItem) {
    const alert = await this.alertController.create({
      header: 'Eliminar producto',
      message: `¿Estás seguro de eliminar ${item.nombre}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: () => {
            this.carritoService.eliminarProducto(item.id);
            this.cargarCarrito();
            
            // Si no quedan productos, volver al menú
            if (this.cartItems.length === 0) {
              this.router.navigate(['/menu']);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmarPedido() {
    if (this.direccionForm.invalid) {
      await this.mostrarToast('Por favor, completa todos los campos obligatorios', 'warning');
      return;
    }

    if (this.cartItems.length === 0) {
      await this.mostrarToast('El carrito está vacío', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirmar Pedido Delivery',
      message: `¿Confirmar pedido por $${this.precioTotal.toFixed(2)}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: async () => {
            await this.realizarPedido();
          }
        }
      ]
    });

    await alert.present();
  }

  async realizarPedido() {
    try {
      this.customLoader.show();

      // 1. RE-VERIFICACIÓN DE SEGURIDAD
      // Si por alguna razón clienteInfo es null, intentamos cargarlo de nuevo
      if (!this.clienteInfo) {
        console.warn('⚠️ clienteInfo era null, intentando recargar...');
        await this.cargarInfoCliente();
      }

      // 2. FRENO DE EMERGENCIA
      // Si sigue siendo null, significa que el usuario está logueado pero 
      // NO existe en la tabla 'clientes' de tu base de datos.
      if (!this.clienteInfo || !this.clienteInfo.id) {
        this.customLoader.hide();
        await this.mostrarToast('Error crítico: No se encontró tu perfil de cliente en la base de datos.', 'danger');
        console.error('El usuario tiene Auth pero no tiene registro en la tabla clientes.');
        return; // Detenemos todo aquí para que no explote
      }

      const formValue = this.direccionForm.value;
      const direccionCompleta = `${formValue.calle} ${formValue.numero}${formValue.piso ? ', Piso ' + formValue.piso : ''}${formValue.depto ? ' Dpto ' + formValue.depto : ''}`;

      // Filtros de productos
      const comidas = this.cartItems.filter(item => item.tipo === 'comida');
      const bebidas = this.cartItems.filter(item => item.tipo === 'bebida');
      const postres = this.cartItems.filter(item => item.tipo === 'postre');

      // 3. ARMADO DEL OBJETO (Ahora es seguro usar clienteInfo.id)
      const pedido = {
        cliente_id: this.clienteInfo.id, // Esto es un NUMBER, como pide tu interfaz
        cliente_email: this.clienteInfo.email,
        cliente_nombre: `${this.clienteInfo.nombre} ${this.clienteInfo.apellido}`,
        cliente_telefono: formValue.telefono,
        
        direccion_calle: formValue.calle,
        direccion_numero: formValue.numero,
        direccion_piso: formValue.piso || undefined,
        direccion_depto: formValue.depto || undefined,
        direccion_referencia: formValue.referencia || undefined,
        direccion_completa: direccionCompleta,
        latitud: this.selectedLocation?.lat,
        longitud: this.selectedLocation?.lng,
        
        comidas: comidas.map(item => ({
          id: item.productoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario,
          observaciones: item.observaciones
        })),
        bebidas: bebidas.map(item => ({
          id: item.productoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario
        })),
        postres: postres.map(item => ({
          id: item.productoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precioUnitario
        })),
        
        precio_productos: this.precioProductos,
        precio_envio: this.precioEnvio,
        precio_total: this.precioTotal,
        
        metodo_pago: this.metodoPago,
        estado: 'pendiente',
        // Asignamos estados individuales solo si hay productos de ese tipo
        estado_comida: comidas.length > 0 ? 'pendiente' : undefined,
        estado_bebida: bebidas.length > 0 ? 'pendiente' : undefined,
        estado_postre: postres.length > 0 ? 'pendiente' : undefined,
        // Asignar automáticamente al repartidor único
        repartidor_id: 1,
        repartidor_nombre: 'Carlos Ramírez'
      };

      await this.deliveryService.crearPedidoDelivery(pedido);

      // Limpieza y éxito
      this.carritoService.limpiarCarrito();
      this.customLoader.hide();
      await this.mostrarToast('¡Pedido realizado con éxito! Te llegará en 45 minutos aproximadamente', 'success');
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al realizar pedido:', error);
      this.customLoader.hide();
      await this.mostrarToast(error.message || 'Error al realizar el pedido', 'danger');
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
    this.router.navigate(['/menu']);
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(precio);
  }
}

