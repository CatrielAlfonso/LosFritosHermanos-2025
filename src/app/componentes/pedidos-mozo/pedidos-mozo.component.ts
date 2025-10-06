import { Component, computed, OnInit, signal } from '@angular/core';
import { Pedido } from 'src/app/servicios/carrito.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonHeader, IonIcon } from "@ionic/angular/standalone";
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.component.html',
  styleUrls: ['./pedidos-mozo.component.scss'],
  imports: [CurrencyPipe, IonicModule, DatePipe, CommonModule]
})
export class PedidosMozoComponent  implements OnInit {

  //pedidosPendientes = signal<any[]>([]);
  pedidosPendientes = computed(() => this.sb.pedidosPendientes());
  categoriasAbiertas = signal<{[key: string]: {[categoria: string]: boolean}}>({});
  pedidos :any = []
  private subscription: any;

  constructor(private sb : SupabaseService) { 
    
  }

  async ngOnInit() {
    console.log('🎯 Componente mozo iniciado');
    console.log('Pedidos iniciales:', this.pedidosPendientes());
    this.sb.getPedidos();
    
  }

  async aceptarPedido(pedido: Pedido) {
    // await this.sb.actualizarPedido(pedido.id, {
    //   estado: 'en preparacion',
    //   confirmado: true
    // });
    
    // 4. Recargás los pedidos para actualizar la signal
    //await this.cargarPedidos();
  }

  suscribirCambiosEnTiempoReal() {
    
  }

  toggleCategoria(pedidoId: string, categoria: string) {
    const actual = this.categoriasAbiertas();
    const pedidoActual = actual[pedidoId] || {};
    
    this.categoriasAbiertas.set({
      ...actual,
      [pedidoId]: {
        ...pedidoActual,
        [categoria]: !pedidoActual[categoria]
      }
    });
  }

  categoriaAbierta(pedidoId: string, categoria: string): boolean {
    return this.categoriasAbiertas()[pedidoId]?.[categoria] || false;
  }


  ngOnDestroy() {
    // if (this.subscription) {
    //   this.sb.supabase.removeChannel(this.subscription);
    // }
  }

}
