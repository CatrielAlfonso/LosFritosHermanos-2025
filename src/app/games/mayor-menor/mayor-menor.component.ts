import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { JuegosService, JUEGOS_CONFIG } from '../../servicios/juegos.service';
import { FeedbackService } from '../../servicios/feedback-service.service';

type GameState = 'inicio' | 'jugando' | 'terminado';

@Component({
  selector: 'app-mayor-menor',
  templateUrl: './mayor-menor.component.html',
  styleUrls: ['./mayor-menor.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class MayorMenorComponent implements OnInit {

  private router = inject(Router);
  private juegosService = inject(JuegosService);
  private feedback = inject(FeedbackService);

  // Estado del juego
  gameState: GameState = 'inicio';
  
  // Cartas
  cartaAnterior: number = 0;
  carta: number = 0;
  numerosPosibles: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  // Puntuación
  puntos: number = 0;
  puntosParaGanar: number = 5; // Necesita 5 aciertos seguidos para ganar
  
  // Estado de elegibilidad
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  descuentoJuego: number = JUEGOS_CONFIG['mayor-menor'].descuento; // 15%
  
  // Resultado
  gano: boolean = false;
  mensajeResultado: string = '';
  
  // Animación
  isFlipping: boolean = false;
  private indiceAnterior: number = 0;

  constructor() { }

  async ngOnInit() {
    await this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
    this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
    this.yaUsoIntento = elegibilidad.yaUsoIntento;
    this.esAnonimo = elegibilidad.esAnonimo;
    
    console.log('🎮 Elegibilidad Mayor o Menor:', elegibilidad);
  }

  iniciarJuego() {
    this.gameState = 'jugando';
    this.puntos = 0;
    this.gano = false;
    this.generarCarta();
  }

  generarCarta() {
    let indice = Math.floor(Math.random() * 12);
    while (indice === this.indiceAnterior) {
      indice = Math.floor(Math.random() * 12);
    }
    this.indiceAnterior = indice;
    this.carta = this.numerosPosibles[indice];
  }

  triggerFlip() {
    this.isFlipping = true;
    setTimeout(() => {
      this.isFlipping = false;
    }, 300);
  }

  async mayorMenor(condicion: string) {
    this.cartaAnterior = this.carta;
    this.generarCarta();

    const acierto = (condicion === 'mayor' && this.carta >= this.cartaAnterior) ||
                    (condicion === 'menor' && this.carta <= this.cartaAnterior);

    if (acierto) {
      this.puntos += 1;
      this.triggerFlip();

      // Verificar si ganó
      if (this.puntos >= this.puntosParaGanar) {
        await this.terminarJuego(true);
      }
    } else {
      // Perdió
      await this.terminarJuego(false);
    }
  }

  async terminarJuego(gano: boolean) {
    this.gameState = 'terminado';
    this.gano = gano;

    // Registrar resultado usando el servicio de juegos
    const resultado = await this.juegosService.registrarResultadoJuego('mayor-menor', gano);
    this.mensajeResultado = resultado.mensaje;

    // Actualizar estado después de jugar
    await this.verificarElegibilidad();
  }

  getMensajeInicio(): string {
    if (this.esAnonimo) {
      return '🎮 ¡Jugá por diversión! Los descuentos son para clientes registrados.';
    }
    if (this.yaUsoIntento) {
      return '🎮 ¡Jugá libremente! Ya usaste tu intento de descuento.';
    }
    return `🎯 ¡Acertá ${this.puntosParaGanar} veces seguidas y obtené ${this.descuentoJuego}% de descuento!`;
  }

  reiniciarJuego() {
    this.gameState = 'inicio';
    this.puntos = 0;
    this.carta = 0;
    this.cartaAnterior = 0;
    this.gano = false;
    this.mensajeResultado = '';
  }

  volverAlMenu() {
    this.router.navigate(['/game-selector']);
  }
}
