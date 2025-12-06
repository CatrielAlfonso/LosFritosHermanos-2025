// equilibrio.component.ts - VERSIÓN CORREGIDA

import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  OnInit,
} from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule} from '@angular/common';
import { Motion, MotionOrientationEventResult } from '@capacitor/motion';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { JuegosService } from 'src/app/servicios/juegos.service';
import { DeliveryService } from 'src/app/servicios/delivery.service';

type GameState = 'idle' | 'playing' | 'lost' | 'won';

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
}

@Component({
  selector: 'app-equilibrio',
  templateUrl: './equilibrio.component.html',
  styleUrls: ['./equilibrio.component.scss'],
  imports: [IonicModule, CommonModule],
})
export class EquilibrioComponent implements AfterViewInit, OnDestroy, OnInit {

  @ViewChild('gameArea') gameAreaRef!: ElementRef<HTMLDivElement>;

  private obstacleTypes = ['patines', 'banana', 'aceite'];
  
  router = inject(Router);
  private juegosService = inject(JuegosService);
  private deliveryService = inject(DeliveryService);
  private toastCtrl = inject(ToastController);

  // Variables para sistema de descuentos
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  esDelivery: boolean = false;
  pedidoDeliveryId: number | null = null;
  mensajeResultado: string = '';
  descuentoObtenido: number = 15;

  state: GameState = 'idle';

  areaWidth = 0;
  areaHeight = 0;
  mensaje = '';

  // ✅ TAMAÑOS AUMENTADOS PARA MÓVIL
  mozo: Entity = { x: 0, y: 0, width: 70, height: 70 };
  mesa: Entity = { x: 0, y: 0, width: 70, height: 70 };
  obstacles: Entity[] = [];

  vx = 0;
  vy = 0;

  private animationFrameId: number | null = null;
  private motionListenerActive = false;

  private startSound = new Audio('../../../assets/sounds/start_sound.mp3');
  private winSound = new Audio('../../../assets/sounds/winner.mp3');
  private errorSound = new Audio('../../../assets/sounds/error.mp3');

  async ngOnInit() {
    this.activarControlesTeclado();
    
    const pedidoIdStr = localStorage.getItem('pedidoDeliveryActual');
    if (pedidoIdStr) {
      this.esDelivery = true;
      this.pedidoDeliveryId = parseInt(pedidoIdStr);
      console.log('🎮 Juego iniciado desde delivery, pedido:', this.pedidoDeliveryId);
    }

    await this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
    this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
    this.yaUsoIntento = elegibilidad.yaUsoIntento;
    this.esAnonimo = elegibilidad.esAnonimo;
    
    console.log('🎮 Elegibilidad Mozo Equilibrio:', elegibilidad);
  }

  activarControlesTeclado() {
    window.addEventListener('keydown', (event) => {
      if (this.state !== "playing") return;

      const velocidad = 5;

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.vy = -velocidad;
          break;

        case 'ArrowDown':
        case 's':
        case 'S':
          this.vy = velocidad;
          break;

        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.vx = -velocidad;
          break;

        case 'ArrowRight':
        case 'd':
        case 'D':
          this.vx = velocidad;
          break;
      }
    });

    // ✅ RESETEAR VELOCIDAD AL SOLTAR TECLA
    window.addEventListener('keyup', (event) => {
      if (this.state !== "playing") return;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'w':
        case 's':
        case 'W':
        case 'S':
          this.vy = 0;
          break;

        case 'ArrowLeft':
        case 'ArrowRight':
        case 'a':
        case 'd':
        case 'A':
        case 'D':
          this.vx = 0;
          break;
      }
    });
  }

  ngAfterViewInit() {
    this.updateAreaSize();
    this.setupCorners();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.stopMotion();
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    this.updateAreaSize();
    this.setupCorners();
  };

  private updateAreaSize() {
    const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
    this.areaWidth = rect.width;
    this.areaHeight = rect.height;
  }

  private setupCorners() {
    this.mozo.x = 10;
    this.mozo.y = 10;
    this.mesa.x = this.areaWidth - this.mesa.width - 10;
    this.mesa.y = this.areaHeight - this.mesa.height - 10;
  }

  async startGame() {
    // ✅ IMPORTANTE: Detener motion anterior primero
    this.stopMotion();
    this.stopLoop();

    this.state = 'playing';
    this.mensaje = '';
    this.mensajeResultado = '';

    this.updateAreaSize();
    this.setupCorners();
    this.generateObstacles();

    // ✅ RESETEAR VELOCIDADES
    this.vx = 0;
    this.vy = 0;

    this.safePlay(this.startSound);
    
    // ✅ Esperar un momento antes de iniciar motion
    await new Promise(resolve => setTimeout(resolve, 100));
    await this.startMotion();
    this.startLoop();
  }

  private generateObstacles() {
    this.obstacles = [];

    const centerXMin = this.areaWidth * 0.25;
    const centerXMax = this.areaWidth * 0.75;
    const centerYMin = this.areaHeight * 0.25;
    const centerYMax = this.areaHeight * 0.75;

    // ✅ TAMAÑO AUMENTADO PARA MÓVIL
    const obstacleSize = 70;

    for (let i = 0; i < 3; i++) {
      this.obstacles.push({
        x: centerXMin + Math.random() * (centerXMax - centerXMin - obstacleSize),
        y: centerYMin + Math.random() * (centerYMax - centerYMin - obstacleSize),
        width: obstacleSize,
        height: obstacleSize,
        type: this.obstacleTypes[i],
      });
    }
  }

  volverAjuegos() {
    this.stopLoop();
    this.stopMotion();
    this.state = 'idle';
    
    localStorage.removeItem('pedidoDeliveryActual');
    localStorage.removeItem('juegoSeleccionado');
    localStorage.removeItem('puedeJugarPorDescuento');

    if (this.esDelivery) {
      this.router.navigate(['/mis-pedidos-delivery']);
    } else {
      this.router.navigate(['/game-selector']);
    }
  }

  private async startMotion() {
    if (this.motionListenerActive) {
      console.log('Motion listener ya está activo');
      return;
    }

    try {
      await Motion.addListener(
        'orientation',
        (event: MotionOrientationEventResult) => {
          if (this.state !== 'playing') return;

          const beta = event.beta ?? 0;  // Inclinación adelante/atrás (-180 a 180)
          const gamma = event.gamma ?? 0; // Inclinación izquierda/derecha (-90 a 90)

          // ✅ FACTOR REDUCIDO Y CON LÍMITE DE VELOCIDAD
          const factor = 0.3;
          const maxSpeed = 8;

          // Calcular velocidades con límite
          let newVx = gamma * factor;
          let newVy = beta * factor;

          // Limitar velocidad máxima
          this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, newVx));
          this.vy = Math.max(-maxSpeed, Math.min(maxSpeed, newVy));
        },
      );
      this.motionListenerActive = true;
      console.log('✅ Motion listener iniciado correctamente');
    } catch (e) {
      console.error('❌ Error iniciando Motion', e);
    }
  }

  private stopMotion() {
    if (!this.motionListenerActive) return;
    
    try {
      Motion.removeAllListeners();
      this.motionListenerActive = false;
      console.log('🛑 Motion listener detenido');
    } catch (e) {
      console.error('Error deteniendo motion:', e);
    }
  }

  private startLoop() {
    const step = () => {
      if (this.state === 'playing') {
        this.update();
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.stopLoop();
      }
    };
    this.animationFrameId = requestAnimationFrame(step);
  }

  private stopLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private update() {
    // ✅ APLICAR VELOCIDADES CON LÍMITES ESTRICTOS
    let newX = this.mozo.x + this.vx;
    let newY = this.mozo.y + this.vy;

    // ✅ CONSTRAIN: Mantener dentro de los límites
    newX = Math.max(0, Math.min(this.areaWidth - this.mozo.width, newX));
    newY = Math.max(0, Math.min(this.areaHeight - this.mozo.height, newY));

    // ✅ DETECCIÓN MEJORADA DE COLISIÓN CON BORDES
    if (
      newX <= 0 ||
      newY <= 0 ||
      newX >= this.areaWidth - this.mozo.width ||
      newY >= this.areaHeight - this.mozo.height
    ) {
      // Si toca el borde, detener el movimiento en esa dirección
      if (newX <= 0) newX = 0;
      if (newX >= this.areaWidth - this.mozo.width) newX = this.areaWidth - this.mozo.width;
      if (newY <= 0) newY = 0;
      if (newY >= this.areaHeight - this.mozo.height) newY = this.areaHeight - this.mozo.height;
      
      // ✅ OPCIONAL: Descomentar para perder al tocar borde
      // this.handleLose();
      // return;
    }

    this.mozo.x = newX;
    this.mozo.y = newY;

    // Verificar colisiones con obstáculos
    for (const o of this.obstacles) {
      if (this.collide(this.mozo, o)) {
        this.handleLose();
        return;
      }
    }

    // Verificar si llegó a la meta
    if (this.collide(this.mozo, this.mesa)) {
      this.handleWin();
    }
  }

  private collide(a: Entity, b: Entity): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  private async handleLose() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.mensaje = '😢 Perdiste';

    // ✅ RESETEAR VELOCIDADES
    this.vx = 0;
    this.vy = 0;
    this.stopMotion();
    this.stopLoop();

    this.safePlay(this.errorSound);

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    await this.registrarResultado(false);
  }

  private async handleWin() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.mensaje = '🎉 ¡Ganaste!';

    // ✅ RESETEAR VELOCIDADES
    this.vx = 0;
    this.vy = 0;
    this.stopMotion();
    this.stopLoop();

    this.safePlay(this.winSound);

    await this.registrarResultado(true);
  }

  private async registrarResultado(gano: boolean) {
    if (this.esDelivery && this.pedidoDeliveryId) {
      await this.guardarDescuentoDelivery(gano ? this.descuentoObtenido : 0);
    } else {
      const resultado = await this.juegosService.registrarResultadoJuego(
        'mozo-equilibrio',
        gano
      );
      
      this.mensajeResultado = this.generarMensajeResultado(gano, resultado);
      await this.verificarElegibilidad();
    }
  }

  private async guardarDescuentoDelivery(porcentaje: number) {
    try {
      await this.deliveryService.actualizarDescuentoDelivery(
        this.pedidoDeliveryId!,
        porcentaje
      );
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

  generarMensajeResultado(gano: boolean, resultado: any): string {
    if (resultado.descuentoAplicado && gano) {
      return `🎉 ¡Ganaste ${resultado.porcentajeDescuento}% de descuento en tu primer intento!`;
    }
    
    if (!this.yaUsoIntento && !gano) {
      return '😢 No ganaste el descuento en tu primer intento. ¡Puedes seguir jugando por diversión!';
    }
    
    if (this.yaUsoIntento) {
      if (resultado.descuentoExistente > 0) {
        return `🎮 ¡Bien jugado! Ya tienes ${resultado.descuentoExistente}% de descuento de un juego anterior.`;
      }
      return '🎮 ¡Bien jugado! Este intento es solo por diversión.';
    }
    
    return resultado.mensaje || '¡Gracias por jugar!';
  }

  deberMostrarDescuento(): boolean {
    return this.puedeJugarPorDescuento && this.state === 'won';
  }

  getMensajeInicio(): string {
    if (this.esAnonimo) {
      return '🎮 ¡Jugá por diversión! Los descuentos son para clientes registrados.';
    }
    if (this.yaUsoIntento) {
      const descuentoActual = localStorage.getItem('descuentoObtenido') || '0';
      if (parseInt(descuentoActual) > 0) {
        return `🎉 Ya tenés ${descuentoActual}% de descuento. ¡Seguí jugando por diversión!`;
      }
      return '🎮 Ya usaste tu intento de descuento. ¡Seguí jugando por diversión!';
    }
    return `🎯 ¡Llevá la bandeja sin chocar y ganá ${this.descuentoObtenido}% de descuento!`;
  }

  private safePlay(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}