import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from 'src/app/servicios/supabase.service';

@Component({
  selector: 'app-bar',
  templateUrl: './bar.component.html',
  styleUrls: ['./bar.component.scss'],
  imports: [IonicModule, CommonModule]
})
export class BarComponent  implements OnInit {

  private supabaseService = inject(SupabaseService);

  private pedidosAbiertos = signal<{[key: string]: boolean}>({});

  pedidosBar = computed(() => {
    const todosPedidos = this.supabaseService.todosLosPedidos();
    
    return todosPedidos.filter(pedido => 
      pedido.estado === 'en preparacion' && 
      pedido.bebidas.length > 0 &&
      pedido.estado_bebida !== 'listo'
    );
  });

  constructor() { }

  ngOnInit() {
    this.supabaseService.cargarPedidos()
  }

  togglePedido(pedidoId: string) {
    const actual = this.pedidosAbiertos();
    this.pedidosAbiertos.set({
      ...actual,
      [pedidoId]: !actual[pedidoId]
    });
  }

  pedidoAbierto(pedidoId: string): boolean {
    return this.pedidosAbiertos()[pedidoId] || false;
  }

  getEstadoTexto(estado: string): string {
    const estados: {[key: string]: string} = {
      'pendiente': 'Pendiente',
      'en preparacion': 'En Preparación',
      'listo': 'Listo'
    };
    return estados[estado] || estado;
  }

  async marcarComoListo(pedido: any) {
    try {
      await this.supabaseService.actualizarPedido(pedido.id, {
        estado_bebida: 'listo'
      });
      
      // El realtime actualizará automáticamente la lista
      
    } catch (error) {
      console.error('Error marcando pedido como listo:', error);
    }
  }

}
