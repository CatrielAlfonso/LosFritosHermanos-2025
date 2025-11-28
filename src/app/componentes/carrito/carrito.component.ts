import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { CarritoService, CartItem } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import Swal from 'sweetalert2';



@Component({
  selector: 'app-carrito',
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule]
})
export class CarritoComponent {
  items = computed(() => this.carritoService.obtenerItems());
  total = computed(() => this.carritoService.totalPrecio());
  totalItems = computed(() => this.carritoService.totalItems());
  observaciones : string = '' 
  user : any = null
  mesa = '3'

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private toastController : ToastController,
    private supabase : SupabaseService,
    private route : ActivatedRoute,
    private pushService: PushNotificationService
  ) {}


  async ngOnInit(){
    this.user = this.authService.userActual;
    this.mesa = this.route.snapshot.paramMap.get('mesa') || '';
    
    console.log('🛒 [Carrito] Inicializando...');
    console.log('🛒 [Carrito] Mesa desde parámetro de ruta:', this.mesa);
    
    // Si no hay mesa en la ruta, intentar obtenerla de lista_espera
    if (!this.mesa && this.user) {
      await this.obtenerMesaDelUsuario();
    }
    
    console.log('🛒 [Carrito] Mesa final:', this.mesa);
  }

  async obtenerMesaDelUsuario() {
    try {
      const { data: authData } = await this.authService.getCurrentUser();
      if (!authData?.user?.email) {
        console.log('🛒 [Carrito] No hay usuario logueado');
        return;
      }

      const email = authData.user.email;
      console.log('🛒 [Carrito] Buscando mesa para email:', email);

      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', email)
        .not('mesa_asignada', 'is', null)
        .single();

      if (!error && clienteEnLista?.mesa_asignada) {
        this.mesa = String(clienteEnLista.mesa_asignada);
        console.log('🛒 [Carrito] Mesa obtenida de lista_espera:', this.mesa);
      } else {
        console.log('🛒 [Carrito] No se encontró mesa asignada en lista_espera');
      }
    } catch (error) {
      console.error('🛒 [Carrito] Error al obtener mesa:', error);
    }
  }

  aumentarCantidad(item: CartItem) {
    this.carritoService.actualizarCantidad(item.id, item.cantidad + 1);
  }

  disminuirCantidad(item: CartItem) {
    if (item.cantidad > 1) {
      this.carritoService.actualizarCantidad(item.id, item.cantidad - 1);
    } else {
      this.eliminarItem(item);
    }
  }

  async eliminarItem(item: CartItem) {

    Swal.fire({
      title: 'Eliminar producto',
      text: `¿Estás seguro de que querés eliminar ${item.nombre} del carrito?`,
      icon: 'warning',
      confirmButtonText: 'Eliminar',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d32f2f', // Tu color --ion-color-primary (Rojo fuerte)
      cancelButtonColor: '#ff9800',  // Tu color --ion-color-fritos-orange
      heightAuto: false, // ⚠️ IMPORTANTE PARA IONIC: Evita que la pantalla "salte"
      backdrop: true,    // Oscurece el fondo
      allowOutsideClick: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.carritoService.eliminarProducto(item.id)
      }
    })


    // const alert = await this.alertController.create({
    //   header: 'Eliminar producto',
    //   message: `¿Estás seguro de que querés eliminar ${item.nombre} del carrito?`,
    //   buttons: [
    //     {
    //       text: 'Cancelar',
    //       role: 'cancel'
    //     },
    //     {
    //       text: 'Eliminar',
    //       handler: () => {
    //         this.carritoService.eliminarProducto(item.id);
    //       }
    //     }
    //   ]
    // });

    // await alert.present();
  }

  async confirmarPedido() {
    if (this.items().length === 0) return;

    Swal.fire({
      title: 'Confirmar pedido',
      text: `¿Confirmás tu pedido de ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(this.total())}?`,
      icon: 'question',
      confirmButtonText: 'Confirmar',
      showCancelButton: true,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d32f2f', // Tu color --ion-color-primary (Rojo fuerte)
      cancelButtonColor: '#ff9800',  // Tu color --ion-color-fritos-orange
      heightAuto: false, // ⚠️ IMPORTANTE PARA IONIC: Evita que la pantalla "salte"
      backdrop: true,    // Oscurece el fondo
      allowOutsideClick: false
    }).then((result) => {
      if (result.isConfirmed) {
        this.realizarPedido();
      }
    })

    // const alert = await this.alertController.create({
    //   header: 'Confirmar pedido',
    //   message: `¿Confirmás tu pedido de ${this.totalItems()} productos por ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(this.total())}?`,
    //   buttons: [
    //     {
    //       text: 'Cancelar',
    //       role: 'cancel'
    //     },
    //     {
    //       text: 'Confirmar',
    //       handler: () => {
    //         this.realizarPedido();
    //       }
    //     }
    //   ]
    // });

    // await alert.present();
  }

  async realizarPedido() {
    try {
      if (!this.user) {
        throw new Error('Usuario no autenticado');
      }
      
      console.log('🛒 [realizarPedido] Iniciando pedido...');
      console.log('🛒 [realizarPedido] User ID:', this.user().id);
      console.log('🛒 [realizarPedido] Mesa:', this.mesa);
      
      // Si la mesa está vacía, intentar obtenerla nuevamente
      if (!this.mesa) {
        console.log('🛒 [realizarPedido] Mesa vacía, intentando obtener...');
        await this.obtenerMesaDelUsuario();
        console.log('🛒 [realizarPedido] Mesa después de obtener:', this.mesa);
      }
      
      const itemsCarrito = this.items();
      if (itemsCarrito.length === 0) {
        throw new Error('El carrito está vacío');
      }
      
      const pedido = this.carritoService.generarPedidoParaConfirmacion(
        this.user().id,
        this.mesa,
        this.observaciones,
      );
      
      console.log('🛒 [realizarPedido] Pedido generado:', pedido);
      console.log('🛒 [realizarPedido] Mesa en pedido:', pedido.mesa);
      const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .insert([pedido])
      .select();

      if (error) {
        throw error;
      }

      console.log('Pedido realizado con éxito:', data);

      // Notificar a todos los mozos sobre el nuevo pedido
      try {
        await this.notificarMozosNuevoPedido(data[0]);
      } catch (notifError) {
        console.error('Error al notificar mozos:', notifError);
        // No bloquear el flujo si falla la notificación
      }

      const toast = await this.toastController.create({
        message: 'Pedido enviado',
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      this.carritoService.limpiarCarrito();
      this.router.navigate(['/home']);
      
    } catch (error) {
      console.error('Error realizando pedido:', error);
    }
  }

  volverAlMenu() {
    this.router.navigate(['/menu']);
  }

  /**
   * Notifica a todos los mozos sobre un nuevo pedido
   */
  private async notificarMozosNuevoPedido(pedido: any) {
    try {
      // Obtener información del cliente
      const { data: cliente } = await this.supabase.supabase
        .from('clientes')
        .select('nombre, apellido')
        .eq('uid', pedido.cliente_id)
        .single();

      const clienteNombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente';
      
      // Preparar lista de productos
      const productos = [
        ...pedido.comidas.map((c: any) => `${c.cantidad}x ${c.nombre}`),
        ...pedido.bebidas.map((b: any) => `${b.cantidad}x ${b.nombre}`),
        ...pedido.postres.map((p: any) => `${p.cantidad}x ${p.nombre}`)
      ];

      // Obtener todos los mozos
      const { data: mozos } = await this.supabase.supabase
        .from('empleados')
        .select('correo, nombre, apellido, fcm_token')
        .eq('perfil', 'mozo');

      if (mozos && mozos.length > 0) {
        console.log('🔔 Notificando nuevo pedido a', mozos.length, 'mozos');
        
        // Notificar a cada mozo
        for (const mozo of mozos) {
          if (mozo.fcm_token) {
            await this.pushService.notificarMozoNuevoPedido(
              mozo.correo,
              pedido.mesa,
              clienteNombre,
              productos,
              pedido.precio
            );
          }
        }
      }
    } catch (error) {
      console.error('Error al notificar mozos sobre nuevo pedido:', error);
      throw error;
    }
  }
}
