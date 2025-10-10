import { CommonModule } from '@angular/common';
import { Component, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/servicios/auth.service';
import { CarritoService } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class PedidosComponent  implements OnInit {

  pedidos : any = null
  user = this.authService.userActual

  misPedidos = computed(() => {
    const user = this.user();
    const todosPedidos = this.supabase.todosLosPedidos();
    if (!user?.id || !todosPedidos) return [];
    
    return todosPedidos.filter(p => p.cliente_id === user.id);
  });
    

  constructor(
    private supabase : SupabaseService,
    private router : Router,
    private authService : AuthService,
    private toastController: ToastController,
    private alertController: AlertController,
    private carritoService : CarritoService
  ) { }

  ngOnInit() {
    this.supabase.cargarPedidos();
  }

  getEstadoTexto(estado: string): string {
    const estados: {[key: string]: string} = {
      'pendiente': 'Pendiente',
      'en preparacion': 'En Preparación',
      'listo': 'Listo para servir',
      'entregado': 'Entregado',
      'cancelado': 'Cancelado'
    };
    return estados[estado] || estado;
  }

  volverAHome() {
    this.router.navigate(['/home']);
  }

  irAlMenu() {
    this.router.navigate(['/menu']);
  }

  modificarPedido(pedido: any) {
    this.carritoService.cargarPedidoAlCarrito(pedido);
    this.supabase.eliminarPedido(pedido.id)
    this.router.navigate(['/carrito']);
  }

  async eliminarPedido(pedido: any) {
    const alert = await this.alertController.create({
      header: 'Eliminar Pedido',
      message: '¿Estás seguro de que querés eliminar este pedido?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          handler: async () => {
            try {
              await this.supabase.eliminarPedido(pedido.id);
              // El realtime actualizará automáticamente la lista
            } catch (error) {
              console.error('Error eliminando pedido:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async pedirCuenta(pedido : any){
    await this.supabase.actualizarPedido(pedido.id, {
      solicita_cuenta: true
    });
  }


}
