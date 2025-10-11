import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { SupabaseService } from 'src/app/servicios/supabase.service';

@Component({
  selector: 'app-cocina',
  templateUrl: './cocina.component.html',
  styleUrls: ['./cocina.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class CocinaComponent  implements OnInit {

  private supabaseService = inject(SupabaseService);

  private pedidosAbiertos = signal<{[key: string]: boolean}>({});

  pedidosCocina = computed(() => {
    const todosPedidos = this.supabaseService.todosLosPedidos();
    
    return todosPedidos.filter(pedido => 
      pedido.estado === 'en preparacion' && 
      (pedido.comidas.length > 0 || pedido.postres.length > 0) &&
      pedido.estado_comida !== 'listo'
    );
  });

  constructor() { }

  ngOnInit() {
    this.supabaseService.cargarPedidos();
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
        estado_comida: 'listo'
      });
      
      // El realtime actualizará automáticamente la lista
      
    } catch (error) {
      console.error('Error marcando pedido como listo:', error);
    }
  }

}
