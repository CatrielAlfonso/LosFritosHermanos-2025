import { Component, OnInit, Output, EventEmitter, HostListener, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonButton, IonIcon } from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { DeliveryService } from '../../servicios/delivery.service';
import { JuegosService, JuegoId, JUEGOS_CONFIG } from '../../servicios/juegos.service';
import { AuthService } from '../../servicios/auth.service';

type GameState = 'inicio' | 'jugando' | 'terminado';

export interface ResultadoJuego {
  exito: boolean;
  porcentaje: number;
  distancia: number;
}

interface Obstaculo {
  id: number;
  x: number;
  huecoY: number;
  ancho: number;
  huecoAltura: number;
}

@Component({
  selector: 'app-atrapa-el-pollo',
  templateUrl: './atrapa-el-pollo.component.html',
  styleUrls: ['./atrapa-el-pollo.component.scss'],
  imports: [CommonModule, FormsModule, IonContent, DecimalPipe, IonButton, IonIcon]
})
export class AtrapaElPolloComponent implements OnInit, OnDestroy {

  @Output() juegoTerminado = new EventEmitter<ResultadoJuego>();
  @Output() volverHome = new EventEmitter<void>();

  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private deliveryService = inject(DeliveryService);
  private juegosService = inject(JuegosService);
  private authService = inject(AuthService);

  // Para delivery
  esDelivery: boolean = false;
  pedidoDeliveryId: number | null = null;

  // Estado de elegibilidad para descuento
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  descuentoJuego: number = JUEGOS_CONFIG['atrapa-el-pollo'].descuento; // 10%

  // Variables de Estado
  gameState: GameState = 'inicio';

  // Variables del Pollo
  polloY = 50;
  polloAltura = 10;
  velocidadVertical = 0;

  // Variables del Juego
  obstaculos: Obstaculo[] = [];
  velocidadJuego = 3;
  distanciaEntreObstaculos = 300;
  ultimoObstaculoX = 0;

  juegoActivo = false;
  juegoInterval: any;
  gravedad = 0.4;
  saltoFuerza = -8;
  distanciaGanar = 750;
  distanciaRecorrida = 0;

  metaDistancia = 800;
  metaAncho = 50;

  resultadoFinal: ResultadoJuego = { exito: false, porcentaje: 0, distancia: 0 };
  mensajeResultado: string = '';

  @HostListener('document:click', ['$event'])
  @HostListener('document:keydown.space', ['$event'])
  onAction(event: Event) {
    if (this.gameState === 'jugando') {
      this.saltar();
    } else if (this.gameState === 'inicio' && event.type === 'click') {
      this.iniciarJuego();
    }
  }

  constructor(private router: Router) { }

  async ngOnInit() {
    // Verificar si viene de un pedido delivery
    const pedidoIdStr = localStorage.getItem('pedidoDeliveryActual');
    if (pedidoIdStr) {
      this.esDelivery = true;
      this.pedidoDeliveryId = parseInt(pedidoIdStr);
      console.log('🎮 Juego iniciado desde delivery, pedido:', this.pedidoDeliveryId);
    }

    // Verificar elegibilidad para descuento
    await this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
    this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
    this.yaUsoIntento = elegibilidad.yaUsoIntento;
    this.esAnonimo = elegibilidad.esAnonimo;
    
    console.log('🎮 Elegibilidad Atrapa el Pollo:', elegibilidad);
  }

  ngOnDestroy() {
    this.detenerJuego();
  }

  iniciarJuego() {
    if (this.gameState === 'jugando') return;

    this.gameState = 'jugando';
    this.polloY = 50;
    this.velocidadVertical = 0;
    this.distanciaRecorrida = 0;
    this.obstaculos = [];
    this.ultimoObstaculoX = 0;

    this.juegoInterval = setInterval(() => {
      this.actualizarJuego();
    }, 30);
  }

  detenerJuego() {
    if (this.juegoInterval) {
      clearInterval(this.juegoInterval);
      this.juegoInterval = null;
    }
  }

  saltar() {
    this.velocidadVertical = this.saltoFuerza;
  }

  actualizarJuego() {
    this.velocidadVertical += this.gravedad;
    this.polloY += this.velocidadVertical * 0.1;

    if (this.polloY < 0 || this.polloY > 100 - this.polloAltura) {
      this.terminarJuego(false);
      return;
    }

    this.generarObstaculos();
    this.moverObstaculos();

    for (let obstaculo of this.obstaculos) {
      if (this.checkCollision(obstaculo)) {
        this.terminarJuego(false);
        return;
      }
    }

    this.distanciaRecorrida += this.velocidadJuego;

    // Verificar si ganó (llegó a la distancia objetivo)
    if (this.distanciaRecorrida >= this.distanciaGanar) {
      this.terminarJuego(true);
    }
  }

  async terminarJuego(gano: boolean) {
    this.detenerJuego();
    this.gameState = 'terminado';

    this.resultadoFinal = {
      exito: gano,
      porcentaje: gano ? this.descuentoJuego : 0,
      distancia: this.distanciaRecorrida
    };

    // Si es delivery, guardar el descuento en el pedido
    if (this.esDelivery && this.pedidoDeliveryId) {
      await this.guardarDescuentoDelivery(gano ? this.descuentoJuego : 0);
    } else {
      // Para pedidos en restaurante, usar el servicio de juegos
      const resultado = await this.juegosService.registrarResultadoJuego('atrapa-el-pollo', gano);
      this.mensajeResultado = resultado.mensaje;
      
      // Actualizar estado después de jugar
      await this.verificarElegibilidad();
    }

    this.juegoTerminado.emit(this.resultadoFinal);
  }

  async guardarDescuentoDelivery(porcentaje: number) {
    try {
      await this.deliveryService.actualizarDescuentoDelivery(this.pedidoDeliveryId!, porcentaje);
      localStorage.removeItem('pedidoDeliveryActual');

      const toast = await this.toastCtrl.create({
        message: porcentaje > 0
          ? `🎉 ¡Ganaste ${porcentaje}% de descuento en tu pedido!`
          : '¡Buen intento! Sigue practicando.',
        duration: 3000,
        color: porcentaje > 0 ? 'success' : 'warning',
        position: 'top'
      });
      await toast.present();
    } catch (error) {
      console.error('Error al guardar descuento delivery:', error);
    }
  }

  get polloStyle(): string {
    return `translateY(${this.polloY}vh)`;
  }

  generarObstaculos() {
    if (this.obstaculos.length === 0 || this.ultimoObstaculoX < 1000 - this.distanciaEntreObstaculos) {
      const nuevoObstaculo: Obstaculo = {
        id: Date.now(),
        x: 1000,
        huecoY: 30 + Math.random() * 40,
        ancho: 80,
        huecoAltura: 30
      };

      this.obstaculos.push(nuevoObstaculo);
      this.ultimoObstaculoX = nuevoObstaculo.x;
    }
  }

  moverObstaculos() {
    this.obstaculos = this.obstaculos.map(obs => ({
      ...obs,
      x: obs.x - this.velocidadJuego
    }));

    this.obstaculos = this.obstaculos.filter(obs => obs.x > -100);

    if (this.obstaculos.length > 0) {
      this.ultimoObstaculoX = this.obstaculos[this.obstaculos.length - 1].x;
    }
  }

  checkCollision(obstaculo: Obstaculo): boolean {
    const crispyX = 100;
    const crispyYPixeles = this.polloY * 10;
    const crispyWidth = 50;
    const crispyHeight = 50;

    const obstaculoX = obstaculo.x;
    const obstaculoWidth = obstaculo.ancho;

    const topYEnd = (obstaculo.huecoY - obstaculo.huecoAltura / 2) * 10;
    const bottomYStart = (obstaculo.huecoY + obstaculo.huecoAltura / 2) * 10;

    const collisionX = crispyX + crispyWidth > obstaculoX &&
      crispyX < obstaculoX + obstaculoWidth;

    if (collisionX) {
      const collisionYTop = crispyYPixeles < topYEnd;
      const collisionYBottom = crispyYPixeles + crispyHeight > bottomYStart;
      return collisionYTop || collisionYBottom;
    }

    return false;
  }

  getMensajeInicio(): string {
    if (this.esAnonimo) {
      return '🎮 ¡Jugá por diversión! Los descuentos son para clientes registrados.';
    }
    if (this.yaUsoIntento) {
      return '🎮 ¡Jugá libremente! Ya usaste tu intento de descuento.';
    }
    return `🎯 ¡Ganá y obtené ${this.descuentoJuego}% de descuento!`;
  }

  volverAlHome() {
    localStorage.removeItem('pedidoDeliveryActual');
    localStorage.removeItem('juegoSeleccionado');
    localStorage.removeItem('puedeJugarPorDescuento');

    if (this.esDelivery) {
      this.router.navigate(['/mis-pedidos-delivery']);
    } else {
      this.router.navigate(['/game-selector']);
    }
  }

  reiniciarJuego() {
    this.gameState = 'inicio';
    this.polloY = 50;
    this.velocidadVertical = 0;
    this.distanciaRecorrida = 0;
    this.obstaculos = [];
    this.ultimoObstaculoX = 0;
    this.mensajeResultado = '';
  }
}
