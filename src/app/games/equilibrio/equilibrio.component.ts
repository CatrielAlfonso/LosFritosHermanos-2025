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

  mozo: Entity = { x: 0, y: 0, width: 60, height: 60 };
  mesa: Entity = { x: 0, y: 0, width: 60, height: 60 };
  obstacles: Entity[] = [];

  vx = 0;
  vy = 0;

  private animationFrameId: number | null = null;
  private motionListenerActive = false;
  // 🔧 FIX: Prevenir múltiples listeners de teclado
  private keyboardListenerAttached = false;

  private startSound = new Audio('../../../assets/sounds/start_sound.mp3');
  private winSound = new Audio('../../../assets/sounds/winner.mp3');
  private errorSound = new Audio('../../../assets/sounds/error.mp3');

  async ngOnInit() {
    console.log('🎮 [INIT] ngOnInit ejecutado');
    this.activarControlesTeclado();
    
    const pedidoIdStr = localStorage.getItem('pedidoDeliveryActual');
    if (pedidoIdStr) {
      this.esDelivery = true;
      this.pedidoDeliveryId = parseInt(pedidoIdStr);
      console.log('🎮 [INIT] Juego iniciado desde delivery, pedido:', this.pedidoDeliveryId);
    }

    await this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
    this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
    this.yaUsoIntento = elegibilidad.yaUsoIntento;
    this.esAnonimo = elegibilidad.esAnonimo;
    
    console.log('🎮 [ELEGIBILIDAD] Mozo Equilibrio:', elegibilidad);
  }

  activarControlesTeclado() {
    // 🔧 FIX: Solo agregar listener una vez
    if (this.keyboardListenerAttached) {
      console.log('⌨️ [TECLADO] Listener ya existe, omitiendo...');
      return;
    }

    console.log('⌨️ [TECLADO] Activando controles de teclado');
    window.addEventListener('keydown', (event) => {
      if (this.state !== "playing") {
        console.log('⌨️ [TECLADO] Ignorado - Estado:', this.state);
        return;
      }

      const velocidad = 5;

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.mozo.y -= velocidad;
          console.log('⌨️ [TECLADO] Arriba - Y:', this.mozo.y);
          break;

        case 'ArrowDown':
        case 's':
        case 'S':
          this.mozo.y += velocidad;
          console.log('⌨️ [TECLADO] Abajo - Y:', this.mozo.y);
          break;

        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.mozo.x -= velocidad;
          console.log('⌨️ [TECLADO] Izquierda - X:', this.mozo.x);
          break;

        case 'ArrowRight':
        case 'd':
        case 'D':
          this.mozo.x += velocidad;
          console.log('⌨️ [TECLADO] Derecha - X:', this.mozo.x);
          break;
      }

      this.update();
    });
    
    this.keyboardListenerAttached = true;
  }

  ngAfterViewInit() {
    console.log('🎮 [VIEW] ngAfterViewInit ejecutado');
    this.updateAreaSize();
    this.setupCorners();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    console.log('🎮 [DESTROY] Limpiando componente');
    this.stopLoop();
    this.stopMotion();
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => {
    console.log('🎮 [RESIZE] Ventana redimensionada');
    this.updateAreaSize();
    this.setupCorners();
  };

  private updateAreaSize() {
    const rect = this.gameAreaRef.nativeElement.getBoundingClientRect();
    this.areaWidth = rect.width;
    this.areaHeight = rect.height;
    console.log('📐 [SIZE] Área actualizada:', this.areaWidth, 'x', this.areaHeight);
  }

  private setupCorners() {
    this.mozo.x = 10;
    this.mozo.y = 10;
    this.mesa.x = this.areaWidth - this.mesa.width - 10;
    this.mesa.y = this.areaHeight - this.mesa.height - 10;
    console.log('🎯 [CORNERS] Mozo:', this.mozo.x, this.mozo.y, '| Mesa:', this.mesa.x, this.mesa.y);
  }

  async startGame() {
    console.log('🚀 [START] ========== INICIANDO JUEGO ==========');
    console.log('🚀 [START] Estado anterior:', this.state);
    
    // 🔧 FIX: Detener todo antes de reiniciar
    this.stopLoop();
    this.stopMotion();
    
    // 🔧 FIX: Resetear TODOS los estados
    this.state = 'playing';
    this.mensaje = '';
    this.mensajeResultado = '';
    this.vx = 0;
    this.vy = 0;
    
    console.log('🚀 [START] Estado cambiado a:', this.state);

    this.updateAreaSize();
    this.setupCorners();
    this.generateObstacles();

    this.safePlay(this.startSound);
    
    // 🔧 FIX: Asegurar que Motion se inicie correctamente
    await this.startMotion();
    
    // 🔧 FIX: Iniciar loop después de configurar todo
    this.startLoop();
    
    console.log('🚀 [START] Juego iniciado correctamente');
    console.log('🚀 [START] Motion activo:', this.motionListenerActive);
    console.log('🚀 [START] Loop ID:', this.animationFrameId);
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
    
    console.log('🚧 [OBSTACLES] Generados:', this.obstacles.length, 'obstáculos');
  }

  volverAjuegos() {
    console.log('🔙 [BACK] Volviendo al menú');
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
    console.log('📱 [MOTION] Iniciando Motion...');
    
    // 🔧 FIX: Siempre remover listeners previos antes de agregar nuevos
    if (this.motionListenerActive) {
      console.log('📱 [MOTION] Removiendo listener previo');
      await Motion.removeAllListeners();
      this.motionListenerActive = false;
    }

    try {
      await Motion.addListener(
        'orientation',
        (event: MotionOrientationEventResult) => {
          if (this.state !== 'playing') {
            console.log('📱 [MOTION] Evento ignorado - Estado:', this.state);
            return;
          }

          const beta = event.beta ?? 0;
          const gamma = event.gamma ?? 0;

          const factor = 0.15;
          this.vx = gamma * factor;
          this.vy = beta * factor;
          
          // Log ocasional para no saturar consola
          if (Math.random() < 0.01) {
            console.log('📱 [MOTION] vx:', this.vx.toFixed(2), 'vy:', this.vy.toFixed(2));
          }
        },
      );
      this.motionListenerActive = true;
      console.log('📱 [MOTION] ✅ Listener activo');
    } catch (e) {
      console.error('📱 [MOTION] ❌ Error iniciando Motion:', e);
    }
  }

  private stopMotion() {
    if (!this.motionListenerActive) {
      console.log('📱 [MOTION] No hay listener activo para detener');
      return;
    }
    console.log('📱 [MOTION] Deteniendo Motion...');
    Motion.removeAllListeners();
    this.motionListenerActive = false;
    console.log('📱 [MOTION] ✅ Motion detenido');
  }

  private startLoop() {
    console.log('🔄 [LOOP] Iniciando loop de animación...');
    
    // 🔧 FIX: Cancelar loop previo si existe
    if (this.animationFrameId !== null) {
      console.log('🔄 [LOOP] Cancelando loop previo:', this.animationFrameId);
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    const step = () => {
      if (this.state === 'playing') {
        this.update();
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        console.log('🔄 [LOOP] Detenido - Estado:', this.state);
        this.stopLoop();
      }
    };
    
    this.animationFrameId = requestAnimationFrame(step);
    console.log('🔄 [LOOP] ✅ Loop iniciado con ID:', this.animationFrameId);
  }

  private stopLoop() {
    if (this.animationFrameId !== null) {
      console.log('🔄 [LOOP] Cancelando loop:', this.animationFrameId);
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private update() {
    // Log ocasional para verificar que update se ejecuta
    if (Math.random() < 0.005) {
      console.log('🔄 [UPDATE] Posición mozo:', this.mozo.x.toFixed(2), this.mozo.y.toFixed(2));
      console.log('🔄 [UPDATE] Velocidad vx:', this.vx.toFixed(2), 'vy:', this.vy.toFixed(2));
    }
    
    let newX = this.mozo.x + this.vx;
    let newY = this.mozo.y + this.vy;

    if (
      newX < 0 ||
      newY < 0 ||
      newX + this.mozo.width > this.areaWidth ||
      newY + this.mozo.height > this.areaHeight
    ) {
      console.log('💥 [COLLISION] Colisión con borde!');
      this.handleLose();
      return;
    }

    this.mozo.x = newX;
    this.mozo.y = newY;

    for (const o of this.obstacles) {
      if (this.collide(this.mozo, o)) {
        console.log('💥 [COLLISION] Colisión con obstáculo:', o.type);
        this.handleLose();
        return;
      }
    }

    if (this.collide(this.mozo, this.mesa)) {
      console.log('🎉 [WIN] ¡Llegó a la mesa!');
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
    if (this.state !== 'playing') {
      console.log('❌ [LOSE] Ignorado - Estado:', this.state);
      return;
    }
    
    console.log('😔 [LOSE] ========== PERDISTE ==========');
    this.state = 'lost';
    this.mensaje = '😔 Perdiste';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();
    this.stopLoop();

    this.safePlay(this.errorSound);

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    await this.registrarResultado(false);
    console.log('😔 [LOSE] Estado final:', this.state);
  }

  private async handleWin() {
    if (this.state !== 'playing') {
      console.log('❌ [WIN] Ignorado - Estado:', this.state);
      return;
    }
    
    console.log('🎉 [WIN] ========== GANASTE ==========');
    this.state = 'won';
    this.mensaje = '🎉 ¡Ganaste!';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();
    this.stopLoop();

    this.safePlay(this.winSound);

    await this.registrarResultado(true);
    console.log('🎉 [WIN] Estado final:', this.state);
  }

  private async registrarResultado(gano: boolean) {
    console.log('💾 [RESULTADO] Registrando...', gano ? 'GANÓ' : 'PERDIÓ');
    
    if (this.esDelivery && this.pedidoDeliveryId) {
      await this.guardarDescuentoDelivery(gano ? this.descuentoObtenido : 0);
    } else {
      const resultado = await this.juegosService.registrarResultadoJuego(
        'mozo-equilibrio',
        gano
      );
      
      console.log('💾 [RESULTADO] Respuesta servicio:', resultado);
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
      console.error('❌ [DELIVERY] Error al guardar descuento:', error);
    }
  }

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