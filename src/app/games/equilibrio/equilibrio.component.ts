// equilibrio.component.ts - VERSIÓN COMPLETA CORREGIDA

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
//import { JuegosService } from '../servicios/juegos.service';
//import { DeliveryService } from '../servicios/delivery.service';
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

  // ✅ NUEVO: Variables para sistema de descuentos
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  esDelivery: boolean = false;
  pedidoDeliveryId: number | null = null;
  mensajeResultado: string = '';
  descuentoObtenido: number = 15; // Mozo Equilibrio da 15% de descuento

  state: GameState = 'idle';

  areaWidth = 0;
  areaHeight = 0;
  mensaje = '';

  mozo: Entity = { x: 0, y: 0, width: 60, height: 60 };
  mesa: Entity = { x: 0, y: 0, width: 60, height: 60 };
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
    
    // ✅ NUEVO: Verificar si viene de delivery
    const pedidoIdStr = localStorage.getItem('pedidoDeliveryActual');
    if (pedidoIdStr) {
      this.esDelivery = true;
      this.pedidoDeliveryId = parseInt(pedidoIdStr);
      console.log('🎮 Juego iniciado desde delivery, pedido:', this.pedidoDeliveryId);
    }

    // ✅ NUEVO: Verificar elegibilidad para descuento
    await this.verificarElegibilidad();
  }

  // ✅ NUEVO: Verificar elegibilidad para descuentos
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
          this.mozo.y -= velocidad;
          break;

        case 'ArrowDown':
        case 's':
        case 'S':
          this.mozo.y += velocidad;
          break;

        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.mozo.x -= velocidad;
          break;

        case 'ArrowRight':
        case 'd':
        case 'D':
          this.mozo.x += velocidad;
          break;
      }

      this.update();
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
    this.state = 'playing';
    this.mensaje = '';
    this.mensajeResultado = '';

    this.updateAreaSize();
    this.setupCorners();
    this.generateObstacles();

    this.vx = 0;
    this.vy = 0;

    this.safePlay(this.startSound);
    await this.startMotion();
    this.startLoop();
  }

  private generateObstacles() {
    this.obstacles = [];

    const centerXMin = this.areaWidth * 0.25;
    const centerXMax = this.areaWidth * 0.75;
    const centerYMin = this.areaHeight * 0.25;
    const centerYMax = this.areaHeight * 0.75;

    for (let i = 0; i < 3; i++) {
      this.obstacles.push({
        x: centerXMin + Math.random() * (centerXMax - centerXMin - this.mozo.width),
        y: centerYMin + Math.random() * (centerYMax - centerYMin - this.mozo.height),
        width: 60,
        height: 60,
        type: this.obstacleTypes[i],
      });
    }
  }

  volverAjuegos() {
    this.stopLoop();
    this.stopMotion();
    this.state = 'idle';
    
    // ✅ NUEVO: Limpiar localStorage
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
    if (this.motionListenerActive) return;

    try {
      await Motion.addListener(
        'orientation',
        (event: MotionOrientationEventResult) => {
          if (this.state !== 'playing') return;

          const beta = event.beta ?? 0;
          const gamma = event.gamma ?? 0;

          const factor = 0.15;
          this.vx = gamma * factor;
          this.vy = beta * factor;
        },
      );
      this.motionListenerActive = true;
    } catch (e) {
      console.error('Error iniciando Motion', e);
    }
  }

  private stopMotion() {
    if (!this.motionListenerActive) return;
    Motion.removeAllListeners();
    this.motionListenerActive = false;
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
    let newX = this.mozo.x + this.vx;
    let newY = this.mozo.y + this.vy;

    if (
      newX < 0 ||
      newY < 0 ||
      newX + this.mozo.width > this.areaWidth ||
      newY + this.mozo.height > this.areaHeight
    ) {
      this.handleLose();
      return;
    }

    this.mozo.x = newX;
    this.mozo.y = newY;

    for (const o of this.obstacles) {
      if (this.collide(this.mozo, o)) {
        this.handleLose();
        return;
      }
    }

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

  // ✅ MODIFICADO: handleLose con lógica de descuentos
  private async handleLose() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.mensaje = '😔 Perdiste';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();

    this.safePlay(this.errorSound);

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    // ✅ NUEVO: Registrar resultado (perdió = no descuento)
    await this.registrarResultado(false);
  }

  // ✅ MODIFICADO: handleWin con lógica de descuentos
  private async handleWin() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.mensaje = '🎉 ¡Ganaste!';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();

    this.safePlay(this.winSound);

    // ✅ NUEVO: Registrar resultado (ganó = posible descuento)
    await this.registrarResultado(true);
  }

  // ✅ NUEVO: Registrar resultado del juego
  private async registrarResultado(gano: boolean) {
    if (this.esDelivery && this.pedidoDeliveryId) {
      // Delivery: aplicar descuento si ganó
      await this.guardarDescuentoDelivery(gano ? this.descuentoObtenido : 0);
    } else {
      // Restaurante: usar servicio de juegos
      const resultado = await this.juegosService.registrarResultadoJuego(
        'mozo-equilibrio',
        gano
      );
      
      this.mensajeResultado = this.generarMensajeResultado(gano, resultado);
      await this.verificarElegibilidad();
    }
  }

  // ✅ NUEVO: Guardar descuento en delivery
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

  // ✅ NUEVO: Generar mensaje según el contexto
  generarMensajeResultado(gano: boolean, resultado: any): string {
    if (resultado.descuentoAplicado && gano) {
      return `🎉 ¡Ganaste ${resultado.porcentajeDescuento}% de descuento en tu primer intento!`;
    }
    
    if (!this.yaUsoIntento && !gano) {
      return '😔 No ganaste el descuento en tu primer intento. ¡Puedes seguir jugando por diversión!';
    }
    
    if (this.yaUsoIntento) {
      if (resultado.descuentoExistente > 0) {
        return `🎮 ¡Bien jugado! Ya tienes ${resultado.descuentoExistente}% de descuento de un juego anterior.`;
      }
      return '🎮 ¡Bien jugado! Este intento es solo por diversión.';
    }
    
    return resultado.mensaje || '¡Gracias por jugar!';
  }

  // ✅ NUEVO: Determinar si debe mostrar descuento
  deberMostrarDescuento(): boolean {
    return this.puedeJugarPorDescuento && this.state === 'won';
  }

  // ✅ NUEVO: Mensaje de inicio según elegibilidad
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