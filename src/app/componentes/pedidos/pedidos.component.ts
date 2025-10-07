import { CommonModule } from '@angular/common';
import { Component, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/servicios/auth.service';
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
  // misPedidos = computed(() => {
  //   return this.supabase.todosLosPedidos() 
  //     .filter(p => p.cliente_id === this.user?.id);
  // });
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
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.supabase.cargarPedidos();
    setTimeout(() => {
      console.log('user iddddd:', this.user()?.id);
      console.log('pedidos:', this.misPedidos());
      console.log('todos los pedidos:', this.supabase.todosLosPedidos());
    }, 5000);
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
    // Lógica para cargar el pedido en el carrito y redirigir
    console.log('Modificar pedido:', pedido);
    // this.carritoService.cargarPedidoAlCarrito(pedido);
    // this.router.navigate(['/carrito']);
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


}
