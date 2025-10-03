import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CarritoService, CartItem } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';

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

  constructor(
    private carritoService: CarritoService,
    private supabaseService: SupabaseService,
    private router: Router,
    private alertController: AlertController
  ) {}

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
      // Aquí irá la lógica para guardar en Supabase
      console.log('Realizando pedido:', this.items());
      
      // Limpiar carrito después del pedido
      this.carritoService.limpiarCarrito();
      
      // Navegar a confirmación o home
      this.router.navigate(['/home']);
      
    } catch (error) {
      console.error('Error realizando pedido:', error);
    }
  }

  volverAlMenu() {
    this.router.navigate(['/menu']);
  }
}
