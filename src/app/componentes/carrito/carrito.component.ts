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
import { CustomLoader } from 'src/app/servicios/custom-loader.service';



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
  esClienteAnonimo: boolean = false;
  clienteAnonimo: any = null;

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private toastController : ToastController,
    private supabase : SupabaseService,
    private route : ActivatedRoute,
    private pushService: PushNotificationService,
    private customLoader: CustomLoader
  ) {}


  async ngOnInit(){
    this.user = this.authService.userActual;
    this.mesa = this.route.snapshot.paramMap.get('mesa') || '';
    
    console.log('🛒 [Carrito] Inicializando...');
    console.log('🛒 [Carrito] Mesa desde parámetro de ruta:', this.mesa);
    console.log('🛒 [Carrito] User autenticado:', this.user);
    
    // Verificar si es cliente anónimo
    const clienteAnonimoStr = localStorage.getItem('clienteAnonimo');
    if (clienteAnonimoStr) {
      try {
        this.clienteAnonimo = JSON.parse(clienteAnonimoStr);
        this.esClienteAnonimo = true;
        console.log('🛒 [Carrito] Cliente anónimo detectado:', this.clienteAnonimo);
      } catch (e) {
        console.error('🛒 [Carrito] Error parseando cliente anónimo:', e);
      }
    }
    
    // Si no hay mesa en la ruta, intentar obtenerla
    if (!this.mesa) {
      if (this.esClienteAnonimo && this.clienteAnonimo) {
        await this.obtenerMesaClienteAnonimo();
      } else if (this.user) {
        await this.obtenerMesaDelUsuario();
      }
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

  async obtenerMesaClienteAnonimo() {
    try {
      if (!this.clienteAnonimo?.correo) {
        console.log('🛒 [Carrito] Cliente anónimo sin correo');
        return;
      }

      console.log('🛒 [Carrito] Buscando mesa para cliente anónimo:', this.clienteAnonimo.correo);

      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', this.clienteAnonimo.correo)
        .not('mesa_asignada', 'is', null)
        .single();

      if (!error && clienteEnLista?.mesa_asignada) {
        this.mesa = String(clienteEnLista.mesa_asignada);
        console.log('🛒 [Carrito] Mesa obtenida para anónimo:', this.mesa);
      } else {
        console.log('🛒 [Carrito] No se encontró mesa para cliente anónimo');
      }
    } catch (error) {
      console.error('🛒 [Carrito] Error al obtener mesa anónimo:', error);
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
      // Verificar que haya usuario autenticado O cliente anónimo
      if (!this.user && !this.esClienteAnonimo) {
        throw new Error('Usuario no autenticado');
      }
      
      console.log('🛒 [realizarPedido] Iniciando pedido...');
      console.log('🛒 [realizarPedido] Es cliente anónimo:', this.esClienteAnonimo);
      console.log('🛒 [realizarPedido] User:', this.user);
      console.log('🛒 [realizarPedido] Cliente anónimo:', this.clienteAnonimo);
      console.log('🛒 [realizarPedido] Mesa:', this.mesa);
      this.customLoader.show()
      
      // Si la mesa está vacía, intentar obtenerla nuevamente
      if (!this.mesa) {
        console.log('🛒 [realizarPedido] Mesa vacía, intentando obtener...');
        if (this.esClienteAnonimo) {
          await this.obtenerMesaClienteAnonimo();
        } else {
          await this.obtenerMesaDelUsuario();
        }
        console.log('🛒 [realizarPedido] Mesa después de obtener:', this.mesa);
      }
      
      const itemsCarrito = this.items();
      if (itemsCarrito.length === 0) {
        this.customLoader.hide()
        throw new Error('El carrito está vacío');
      }
      
      // Determinar el ID del cliente
      let clienteId: string;
      if (this.esClienteAnonimo && this.clienteAnonimo) {
        // Para cliente anónimo, usar su ID o correo como identificador
        clienteId = this.clienteAnonimo.id?.toString() || this.clienteAnonimo.correo || `anonimo-${Date.now()}`;
        console.log('🛒 [realizarPedido] Usando ID de cliente anónimo:', clienteId);
      } else {
        clienteId = this.user().id;
        console.log('🛒 [realizarPedido] Usando ID de usuario autenticado:', clienteId);
      }
      
      const pedido = this.carritoService.generarPedidoParaConfirmacion(
        clienteId,
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
        this.customLoader.hide()
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
      
      this.customLoader.hide() 
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
      this.customLoader.hide()
      console.error('Error realizando pedido:', error);
    }
  }

  volverAlMenu() {
    this.router.navigate(['/menu']);
  }

  /**
   * Notifica a todos los mozos sobre un nuevo pedido
   * El endpoint del backend ya envía a TODOS los mozos, así que solo llamamos UNA vez
   */
  private async notificarMozosNuevoPedido(pedido: any) {
    try {
      let clienteNombre = 'Cliente';
      
      // Si es cliente anónimo, usar su nombre directamente
      if (this.esClienteAnonimo && this.clienteAnonimo) {
        clienteNombre = this.clienteAnonimo.nombre || 'Cliente Anónimo';
      } else {
        // Obtener información del cliente autenticado
        const { data: cliente } = await this.supabase.supabase
          .from('clientes')
          .select('nombre, apellido')
          .eq('uid', pedido.cliente_id)
          .single();

        clienteNombre = cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Cliente';
      }
      
      // Preparar lista de productos
      const productos = [
        ...pedido.comidas.map((c: any) => `${c.cantidad}x ${c.nombre}`),
        ...pedido.bebidas.map((b: any) => `${b.cantidad}x ${b.nombre}`),
        ...pedido.postres.map((p: any) => `${p.cantidad}x ${p.nombre}`)
      ];

      console.log('🔔 Notificando nuevo pedido a todos los mozos');
      
      // Llamar UNA SOLA VEZ - el backend ya notifica a todos los mozos con sendEachForMulticast
      await this.pushService.notificarMozoNuevoPedido(
        '', // No necesitamos email individual, el backend notifica a todos
        pedido.mesa,
        clienteNombre,
        productos,
        pedido.precio
      );
      
      console.log('✅ Notificación de nuevo pedido enviada');
    } catch (error) {
      console.error('Error al notificar mozos sobre nuevo pedido:', error);
      throw error;
    }
  }
}
