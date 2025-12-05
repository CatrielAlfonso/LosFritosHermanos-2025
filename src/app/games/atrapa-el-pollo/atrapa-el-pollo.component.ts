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
  pasado: boolean; // Para saber si ya fue contado
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

  // Variables de Estado
  gameState: GameState = 'inicio';

  // Variables del Pollo
  polloY = 50;
  polloAltura = 10;
  velocidadVertical = 0;

  // Variables del Juego
  obstaculos: Obstaculo[] = [];
  velocidadJuego = 2.5; // Reducida para que sea más manejable
  distanciaEntreObstaculos = 250; // Ajustado para mejor spacing

  juegoActivo = false;
  juegoInterval: any;
  gravedad = 0.35; // Reducida ligeramente para mejor control
  saltoFuerza = -7.5; // Ajustado para mejor equilibrio

  // NUEVO: Sistema de paredes pasadas
  paredesPasadas = 0;
  totalParedes = 8; // Total de paredes para ganar
  
  // Niveles de descuento basados en paredes
  nivelesDescuento = {
    3: 10,  // 3 paredes = 10%
    5: 15,  // 5 paredes = 15%
    8: 20   // 8 paredes (ganar) = 20%
  };

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
    this.paredesPasadas = 0;
    this.obstaculos = [];

    // Generar el primer obstáculo inmediatamente a la derecha
    this.generarObstaculoInicial();

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
    // Aplicar física al pollo
    this.velocidadVertical += this.gravedad;
    this.polloY += this.velocidadVertical * 0.1;

    // Verificar límites de pantalla
    if (this.polloY < 0 || this.polloY > 100 - this.polloAltura) {
      this.terminarJuego(false);
      return;
    }

    // Generar y mover obstáculos
    this.generarObstaculos();
    this.moverObstaculos();
    this.verificarParedPasada();

    // Verificar colisiones
    for (let obstaculo of this.obstaculos) {
      if (this.checkCollision(obstaculo)) {
        this.terminarJuego(false);
        return;
      }
    }

    // Verificar si ganó (pasó todas las paredes)
    if (this.paredesPasadas >= this.totalParedes) {
      this.terminarJuego(true);
    }
  }

  generarObstaculoInicial() {
    const nuevoObstaculo: Obstaculo = {
      id: Date.now(),
      x: 600, // Aparece a mitad de pantalla
      huecoY: 40 + Math.random() * 20, // Entre 40% y 60%
      ancho: 80,
      huecoAltura: 35, // Hueco más generoso
      pasado: false
    };
    this.obstaculos.push(nuevoObstaculo);
  }

  // ✅ NUEVO: Método para determinar si debe mostrar el descuento en pantalla final
  deberMostrarDescuento(): boolean {
    // Solo mostrar si es el primer intento Y realmente ganó descuento
    return this.puedeJugarPorDescuento && this.resultadoFinal.porcentaje > 0;
  }

  generarObstaculos() {
    // Solo generar si no hay suficientes obstáculos en pantalla
    const ultimoObstaculo = this.obstaculos[this.obstaculos.length - 1];
    
    if (!ultimoObstaculo || ultimoObstaculo.x < 1000 - this.distanciaEntreObstaculos) {
      const nuevoObstaculo: Obstaculo = {
        id: Date.now(),
        x: 1000,
        huecoY: 30 + Math.random() * 40, // Entre 30% y 70% de altura
        ancho: 80,
        huecoAltura: 35,
        pasado: false
      };

      this.obstaculos.push(nuevoObstaculo);
    }
  }

  moverObstaculos() {
    this.obstaculos = this.obstaculos.map(obs => ({
      ...obs,
      x: obs.x - this.velocidadJuego
    }));

    // Eliminar obstáculos que salieron de la pantalla
    this.obstaculos = this.obstaculos.filter(obs => obs.x > -100);
  }

  verificarParedPasada() {
    const crispyX = 100; // Posición fija de Crispy (10% = 100px aprox)

    for (let obstaculo of this.obstaculos) {
      // Si el obstáculo no fue contado y ya pasó a Crispy
      if (!obstaculo.pasado && obstaculo.x + obstaculo.ancho < crispyX) {
        obstaculo.pasado = true;
        this.paredesPasadas++;
        console.log(`🎯 ¡Pared pasada! Total: ${this.paredesPasadas}/${this.totalParedes}`);
      }
    }
  }

  checkCollision(obstaculo: Obstaculo): boolean {
    const crispyX = 100; // 10% de la pantalla
    const crispyYPixeles = this.polloY * 10; // Convertir vh a px aproximado
    const crispyWidth = 50;
    const crispyHeight = 50;

    const obstaculoX = obstaculo.x;
    const obstaculoWidth = obstaculo.ancho;

    // Calcular posiciones de los huecos
    const topYEnd = (obstaculo.huecoY - obstaculo.huecoAltura / 2) * 10;
    const bottomYStart = (obstaculo.huecoY + obstaculo.huecoAltura / 2) * 10;

    // Verificar colisión en X
    const collisionX = crispyX + crispyWidth > obstaculoX &&
      crispyX < obstaculoX + obstaculoWidth;

    if (collisionX) {
      // Verificar si está en el hueco (NO colisión)
      const enHueco = crispyYPixeles >= topYEnd && 
                      crispyYPixeles + crispyHeight <= bottomYStart;
      
      return !enHueco; // Hay colisión si NO está en el hueco
    }

    return false;
  }

  calcularDescuento(): number {
    // Calcular descuento basado en paredes pasadas
    if (this.paredesPasadas >= 8) return 20;
    if (this.paredesPasadas >= 5) return 15;
    if (this.paredesPasadas >= 3) return 10;
    return 0;
  }

  async terminarJuego(gano: boolean) {
  this.detenerJuego();
  this.gameState = 'terminado';

  const descuentoObtenido = this.calcularDescuento();

  this.resultadoFinal = {
    exito: gano,
    porcentaje: descuentoObtenido,
    distancia: this.paredesPasadas
  };

  // Si es delivery, guardar el descuento en el pedido
  if (this.esDelivery && this.pedidoDeliveryId) {
    await this.guardarDescuentoDelivery(descuentoObtenido);
  } else {
    // Para pedidos en restaurante, usar el servicio de juegos
    const resultado = await this.juegosService.registrarResultadoJuego(
      'atrapa-el-pollo', 
      descuentoObtenido > 0
    );
    
    // ✅ CORRECCIÓN: Generar mensaje basado en el estado real
    this.mensajeResultado = this.generarMensajeResultado(descuentoObtenido > 0, resultado);
    
    // Actualizar estado después de jugar
    await this.verificarElegibilidad();
  }

  this.juegoTerminado.emit(this.resultadoFinal);
}

// ✅ NUEVO MÉTODO: Genera el mensaje correcto según el contexto
generarMensajeResultado(ganoEnEsteIntento: boolean, resultado: any): string {
  // Caso 1: Es el primer intento y ganó descuento
  if (resultado.descuentoAplicado && ganoEnEsteIntento) {
    return `🎉 ¡Ganaste ${resultado.porcentajeDescuento}% de descuento en tu primer intento!`;
  }
  
  // Caso 2: Es el primer intento pero no alcanzó el descuento
  if (!this.yaUsoIntento && !ganoEnEsteIntento) {
    return '😔 No alcanzaste el descuento en tu primer intento. ¡Puedes seguir jugando por diversión!';
  }
  
  // Caso 3: Ya usó su intento antes (segundo juego o más)
  if (this.yaUsoIntento) {
    // Si ya tiene un descuento de un juego anterior
    if (resultado.descuentoExistente > 0) {
      return `🎮 ¡Bien jugado! Ya tienes ${resultado.descuentoExistente}% de descuento de un juego anterior.`;
    }
    // Si no ganó descuento en el primer intento y sigue jugando
    return '🎮 ¡Bien jugado! Este intento es solo por diversión.';
  }
  
  // Caso por defecto
  return resultado.mensaje || '¡Gracias por jugar!';
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

  getMensajeInicio(): string {
  if (this.esAnonimo) {
    return '🎮 ¡Jugá por diversión! Los descuentos son para clientes registrados.';
  }
  if (this.yaUsoIntento) {
    // Verificar si tiene descuento
    const descuentoActual = localStorage.getItem('descuentoObtenido') || '0';
    if (parseInt(descuentoActual) > 0) {
      return `🎉 Ya tenés ${descuentoActual}% de descuento. ¡Seguí jugando por diversión!`;
    }
    return '🎮 Ya usaste tu intento de descuento. ¡Seguí jugando por diversión!';
  }
  return `🎯 ¡Pasá paredes y ganá descuentos! 3 paredes = 10%, 5 = 15%, 8 = 20%`;
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
    this.paredesPasadas = 0;
    this.obstaculos = [];
    this.mensajeResultado = '';
  }
}