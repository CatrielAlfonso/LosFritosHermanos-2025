import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { LoadingService } from '../servicios/loading.service';
import { JuegosService, JUEGOS_CONFIG, JuegoId } from '../servicios/juegos.service';
import { FeedbackService } from '../servicios/feedback-service.service';
import { FritosSpinnerComponent } from '../componentes/fritos-spinner/fritos-spinner.component';

interface Game {
  id: JuegoId;
  nombre: string;
  descripcion: string;
  ruta: string;
  imagen: string;
  descuento?: number;
}

@Component({
  selector: 'app-game-selector',
  standalone: true,
  templateUrl: './game-selector.component.html',
  styleUrls: ['./game-selector.component.scss'],
  imports: [CommonModule, IonicModule, FritosSpinnerComponent],
})
export class GameSelectorComponent implements OnInit {

  loadingService = inject(LoadingService);
  juegosService = inject(JuegosService);
  feedback = inject(FeedbackService);

  // Estado del cliente
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  descuentoObtenido: number = 0;
  cargando: boolean = true;

  juegos: Game[] = [
    {
      id: 'atrapa-el-pollo',
      nombre: 'Atrapa el Pollo',
      descripcion: 'Tocá el pollo para ganar antes de que escape.',
      ruta: '/atrapa-el-pollo',
      imagen: '../../assets/imgs/atrapapollo.png',
      descuento: JUEGOS_CONFIG['atrapa-el-pollo'].descuento
    },
    {
      id: 'mozo-equilibrio',
      nombre: 'Mozo Equilibrio',
      descripcion: 'Evitá los obstáculos usando el giroscopio.',
      ruta: '/mozo-quilibrio',
      imagen: '../../assets/imgs/mozoEquilibrio.png',

    },
    {
      id: 'mayor-menor',
      nombre: 'Mayor o Menor',
      descripcion: 'Adiviná si la próxima carta es mayor o menor.',
      ruta: '/mayor-menor',
      imagen: '../../assets/imgs/mayormenor.png',
      descuento: JUEGOS_CONFIG['mayor-menor'].descuento
    },
    {
      id: 'memoria-de-sabores',
      nombre: 'Memoria de Sabores',
      descripcion: 'Memorizá las cartas y encontrá las parejas.',
      ruta: '/memoria-de-sabores',
      imagen: '../../assets/imgs/memoriaSabores.png',
      descuento: JUEGOS_CONFIG['memoria-de-sabores'].descuento
    },
  ];

  constructor(private router: Router) {}

  async ngOnInit() {
    await this.verificarEstadoDescuento();
  }

  async verificarEstadoDescuento() {
    this.cargando = true;
    try {
      const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
      
      this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
      this.yaUsoIntento = elegibilidad.yaUsoIntento;
      this.esAnonimo = elegibilidad.esAnonimo;
      this.descuentoObtenido = elegibilidad.descuentoActual;

      console.log('📊 Estado de elegibilidad:', elegibilidad);
    } catch (error) {
      console.error('Error al verificar elegibilidad:', error);
    } finally {
      this.cargando = false;
    }
  }

  async jugar(juego: Game) {
    console.log(`🎮 Navegando a ${juego.ruta}`);
    
    // Guardar el juego seleccionado para que el juego sepa cuál es
    localStorage.setItem('juegoSeleccionado', juego.id);
    localStorage.setItem('puedeJugarPorDescuento', String(this.puedeJugarPorDescuento));
    
    this.loadingService.show();
    await this.router.navigateByUrl(juego.ruta);
    this.loadingService.hide();
  }

  volver() {
    this.router.navigateByUrl('/home');
  }

  getMensajeEstado(): string {
    if (this.esAnonimo) {
      return '🎮 Jugá libremente. Los descuentos son solo para clientes registrados.';
    }
    if (this.yaUsoIntento) {
      if (this.descuentoObtenido > 0) {
        return `🎉 ¡Ya tenés ${this.descuentoObtenido}% de descuento! Podés seguir jugando por diversión.`;
      }
      return '🎮 Ya usaste tu intento de descuento. ¡Seguí jugando por diversión!';
    }
    return '🎯 ¡Ganando en el PRIMER intento obtenés descuento!';
  }

  getColorBoton(juego: Game): string {
    if (this.puedeJugarPorDescuento) {
      return 'success'; // Verde - puede ganar descuento
    }
    return 'secondary'; // Gris - juega por diversión
  }

  getTextoBoton(juego: Game): string {
    if (this.puedeJugarPorDescuento) {
      return `Jugar por ${juego.descuento}%`;
    }
    return 'Jugar';
  }
}
