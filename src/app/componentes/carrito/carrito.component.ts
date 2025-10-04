import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CarritoService, CartItem } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';



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

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController,
    private supabase : SupabaseService
  ) {}


  ngOnInit(){
    this.user = this.authService.userActual
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
    const alert = await this.alertController.create({
      header: 'Eliminar producto',
      message: `¿Estás seguro de que querés eliminar ${item.nombre} del carrito?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: () => {
            this.carritoService.eliminarProducto(item.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmarPedido() {
    if (this.items().length === 0) return;

    const alert = await this.alertController.create({
      header: 'Confirmar pedido',
      message: `¿Confirmás tu pedido de ${this.totalItems()} productos por ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(this.total())}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: () => {
            this.realizarPedido();
          }
        }
      ]
    });

    await alert.present();
  }

  async realizarPedido() {
    try {
      
      if (!this.user) {
      throw new Error('Usuario no autenticado');
    }
      const itemsCarrito = this.items();
      if (itemsCarrito.length === 0) {
        throw new Error('El carrito está vacío');
      }
      const pedido = this.carritoService.generarPedidoParaConfirmacion(
        this.user.id,
        '1',
        '',
      );
      const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .insert([pedido])
      .select();

      if (error) {
        throw error;
      }

      console.log('Pedido realizado con éxito:', data);

      const alert = await this.alertController.create({
        header: 'Pedido Enviado',
        message: 'Tu pedido ha sido enviado a la cocina. Esperá la confirmación del mozo.',
        buttons: ['OK']
      });
      await alert.present();
      this.carritoService.limpiarCarrito();
      this.router.navigate(['/home']);
      
    } catch (error) {
      console.error('Error realizando pedido:', error);
    }
  }

  volverAlMenu() {
    this.router.navigate(['/menu']);
  }
}
