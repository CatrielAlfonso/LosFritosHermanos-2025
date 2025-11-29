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
export class EquilibrioComponent implements AfterViewInit, OnDestroy, OnInit  
{

  @ViewChild('gameArea') gameAreaRef!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    this.activarControlesTeclado();
  }
  private obstacleTypes = ['patines', 'banana', 'aceite'];
  router = inject(Router);

  activarControlesTeclado() {
  window.addEventListener('keydown', (event) => {

    if (this.state !== "playing") return;

    const velocidad = 5; // velocidad de movimiento con teclas

    switch (event.key) {

      case 'ArrowUp':
      case 'w':
      case 'W':
        this.mozo.y -= velocidad;
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        this.mozo.y  += velocidad;
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.mozo.x  -= velocidad;
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

    this.updateAreaSize();
    this.setupCorners();
    this.generateObstacles();

    this.vx = 0;
    this.vy = 0;

    this.safePlay(this.startSound);
    this.vx = 0;
    this.vy = 0;
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
        x:
          centerXMin +
          Math.random() * (centerXMax - centerXMin - this.mozo.width),
        y:
          centerYMin +
          Math.random() * (centerYMax - centerYMin - this.mozo.height),
        width: 60,
        height: 60,
        type: this.obstacleTypes[i],
      });
    }
  }

  volverAjuegos()
  {
    this.stopLoop();
    this.stopMotion();
    this.state = 'idle';

    this.router.navigateByUrl('/game-selector');
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

  private async handleLose() {
    if (this.state !== 'playing') return;
    this.state = 'lost';
    this.mensaje = 'Perdiste';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();

    this.safePlay(this.errorSound);

    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  }

  private handleWin() {
    if (this.state !== 'playing') return;
    this.state = 'won';
    this.mensaje = '¡Ganaste! 🎉';

    this.vx = 0;
    this.vy = 0;
    this.stopMotion();

    this.safePlay(this.winSound);
  }

  private safePlay(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

}
