import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService, Consulta } from 'src/app/servicios/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-consultas-lista',
  templateUrl: './consultas-lista.component.html',
  styleUrls: ['./consultas-lista.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ConsultasListaComponent implements OnInit, OnDestroy {
  consultasPendientes: Consulta[] = [];
  consultasRespondidas: Consulta[] = [];
  segmentoActual: string = 'pendientes';
  isLoading: boolean = true;
  private realtimeSubscription: any;

  constructor(
    private chatService: ChatService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.cargarConsultas();
    this.suscribirNuevasConsultas();
  }

  async cargarConsultas() {
    this.isLoading = true;
    
    // Cargar pendientes
    this.consultasPendientes = await this.chatService.obtenerConsultasPendientes();
    
    // Cargar respondidas (últimas 20)
    const todasLasConsultas = await this.obtenerTodasLasConsultas();
    this.consultasRespondidas = todasLasConsultas.filter(c => c.estado === 'respondida');
    
    this.isLoading = false;
    console.log('📋 Consultas cargadas:', {
      pendientes: this.consultasPendientes.length,
      respondidas: this.consultasRespondidas.length
    });
  }

  async obtenerTodasLasConsultas(): Promise<Consulta[]> {
    try {
      const { data, error } = await this.chatService['supabase'].supabase
        .from('consultas_mozo')
        .select('*')
        .in('estado', ['pendiente', 'respondida'])
        .order('fecha_creacion', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error al obtener consultas:', error);
      return [];
    }
  }

  suscribirNuevasConsultas() {
    this.chatService.suscribirNuevasConsultas((nuevaConsulta) => {
      console.log('🔔 Nueva consulta recibida en tiempo real');
      this.consultasPendientes.unshift(nuevaConsulta);
    });
  }

  abrirConsulta(consulta: Consulta) {
    console.log('📱 Abriendo consulta de mesa:', consulta.mesa);
    this.router.navigate(['/consulta-mozo'], {
      queryParams: { mesa: consulta.mesa }
    });
  }

  cambiarSegmento(event: any) {
    this.segmentoActual = event.detail.value;
    console.log('Segmento cambiado a:', this.segmentoActual);
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const hoy = new Date();
    
    const esHoy = date.toDateString() === hoy.toDateString();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const esAyer = date.toDateString() === ayer.toDateString();
    
    const horas = date.getHours().toString().padStart(2, '0');
    const minutos = date.getMinutes().toString().padStart(2, '0');
    
    if (esHoy) {
      return `Hoy ${horas}:${minutos}`;
    } else if (esAyer) {
      return `Ayer ${horas}:${minutos}`;
    } else {
      const dia = date.getDate().toString().padStart(2, '0');
      const mes = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${dia}/${mes} ${horas}:${minutos}`;
    }
  }

  getEstadoBadgeColor(estado: string): string {
    switch (estado) {
      case 'pendiente':
        return 'warning';
      case 'respondida':
        return 'success';
      case 'cerrada':
        return 'medium';
      default:
        return 'medium';
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }

  async refrescar(event: any) {
    await this.cargarConsultas();
    event.target.complete();
  }

  ngOnDestroy() {
    console.log('🔄 Limpiando suscripciones de consultas-lista');
    this.chatService.limpiarSuscripciones();
  }
}
