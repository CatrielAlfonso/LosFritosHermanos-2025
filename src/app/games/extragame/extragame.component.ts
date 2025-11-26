import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';

import { CommonModule } from '@angular/common';
import { NgModule} from '@angular/core';

type Obstacle = { x: number; y: number; size: number; img: string; tag: string };

@Component({
  selector: 'app-extra-game',
  templateUrl: './extragame.component.html',
  styleUrls: ['./extragame.component.scss'],
  imports: [CommonModule],
})
export class ExtraGameComponent implements OnInit, OnDestroy {
  
  @ViewChild('arena', { static: true }) arenaRef!: ElementRef<HTMLDivElement>;
  @ViewChild('startSound') startSoundRef!: ElementRef<HTMLAudioElement>;
  @ViewChild('endSound') endSoundRef!: ElementRef<HTMLAudioElement>;
  @ViewChild('errorSound') errorSoundRef!: ElementRef<HTMLAudioElement>;

  running = false;
  stopped = false;
  won = false;

  arenaW = 0;
  arenaH = 0;

  // player state
  player = { x: 20, y: 20, w: 80, h: 80, vx: 0, vy: 0 };
  speed = 1.6; // multiplier, adjust

  // target table (opposite corner)
  target = { x: 0, y: 0, w: 110, h: 110 };

  obstacles: Obstacle[] = [];

  // loop
  rafId: any = null;

  constructor() {}

  ngOnInit(): void {
    this.setArenaSize();
    window.addEventListener('resize', () => this.setArenaSize());
  }

  ngOnDestroy(): void {
    this.stopSensors();
    cancelAnimationFrame(this.rafId);
  }

  setArenaSize() {
    const rect = this.arenaRef.nativeElement.getBoundingClientRect();
    this.arenaW = Math.floor(rect.width);
    this.arenaH = Math.floor(rect.height);

    // place initial target bottom-right
    this.target.x = this.arenaW - this.target.w - 10;
    this.target.y = this.arenaH - this.target.h - 10;

    // reset player start corner (top-left)
    this.player.x = 10;
    this.player.y = 10;
  }

  async startGame() {
    // ask for permission on iOS
    await this.requestDevicePermissionIfNeeded();

    this.running = true;
    this.stopped = false;
    this.won = false;

    // recompute arena sizes
    this.setArenaSize();

    // create obstacles randomly near center
    this.createObstacles();

    // play start sound
    this.startSoundRef.nativeElement.currentTime = 0;
    this.startSoundRef.nativeElement.play().catch(()=>{});

    // start sensors and loop
    this.startSensors();
    this.loop();
  }

  resetGame() {
    this.stopSensors();
    this.running = false;
    this.stopped = false;
    this.won = false;
    cancelAnimationFrame(this.rafId);
    this.obstacles = [];
    this.setArenaSize();
  }

  // create 3 obstacles around center with random jitter
  createObstacles() {
    this.obstacles = [];
    const centerX = this.arenaW / 2;
    const centerY = this.arenaH / 2;
    const imgs = [
      '../../../assets/imgs/patines.png', 
      '../../../assets/imgs/banana.png',
      '../../../assets/imgs/aceite.png'
    ];

    for (let i = 0; i < 3; i++) {
      const size = Math.max(60, Math.min(120, Math.floor(Math.min(this.arenaW, this.arenaH) * 0.12)));
      const jitter = 80;
      const o: Obstacle = {
        x: centerX + (Math.random() - 0.5) * jitter - size / 2,
        y: centerY + (Math.random() - 0.5) * jitter - size / 2,
        size,
        img: imgs[i],
        tag: ['patines','cascara','aceite'][i]
      };
      this.obstacles.push(o);
    }
  }

  // sensor handling
  deviceHandler = (e: any) => {
    // prefer deviceorientation gamma/beta
    const gamma = e.gamma ?? (e.rotationRate?.alpha ?? 0); // left-right tilt
    const beta = e.beta ?? (e.rotationRate?.beta ?? 0); // front-back tilt

    // map to velocity
    // on phones gamma ∈ [-90,90], beta ∈ [-180,180]
    // reduce sensitivity
    this.player.vx = (gamma / 30) * this.speed;
    this.player.vy = (beta / 30) * this.speed;
  };

  startSensors() {
    // for modern browsers: deviceorientation
    if (typeof DeviceOrientationEvent !== 'undefined' && 'ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', this.deviceHandler, true);
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', this.deviceHandler, true);
    }
  }

  stopSensors() {
    window.removeEventListener('deviceorientation', this.deviceHandler, true);
    window.removeEventListener('devicemotion', this.deviceHandler, true);
  }

  // iOS permission request
  async requestDevicePermissionIfNeeded(): Promise<void> {
    const anyWin: any = window;
    if (anyWin.DeviceMotionEvent && typeof anyWin.DeviceMotionEvent.requestPermission === 'function') {
      try {
        const res = await anyWin.DeviceMotionEvent.requestPermission();
        if (res !== 'granted') {
          alert('Necesitamos permiso para leer sensores. Habilitá Motion & Orientation en tu navegador.');
        }
      } catch (err) {
        console.warn('requestPermission error', err);
      }
    }
  }

  // main loop
  loop = () => {
    if (!this.running) return;
    // update position
    if (!this.stopped && !this.won) {
      this.player.x += this.player.vx;
      this.player.y += this.player.vy;

      // clamp to arena and check edges collision
      if (this.player.x < 0 || this.player.y < 0 || (this.player.x + this.player.w) > this.arenaW || (this.player.y + this.player.h) > this.arenaH) {
        // collided with border -> lose
        this.handleLose('edge');
      } else {
        // check obstacle collisions
        for (const o of this.obstacles) {
          if (this.rectsOverlap(this.player.x, this.player.y, this.player.w, this.player.h, o.x, o.y, o.size, o.size)) {
            this.handleLose(o.tag);
            break;
          }
        }

        // check success: if player reaches target rect (table)
        if (this.rectsOverlap(this.player.x, this.player.y, this.player.w, this.player.h, this.target.x, this.target.y, this.target.w, this.target.h)) {
          this.handleWin();
        }
      }
    }

    // update waiter rotation for visual effect
    const rot = Math.max(-25, Math.min(25, this.player.vx * 6));
    const waiterEl = this.arenaRef.nativeElement.querySelector('.waiter') as HTMLElement | null;
    if (waiterEl) waiterEl.style.transform = `translateZ(0) rotate(${rot}deg)`;

    this.rafId = requestAnimationFrame(this.loop);
  };

  rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  handleLose(tag: string) {
    if (this.stopped || this.won) return;
    this.stopped = true;
    // play error sound
    this.errorSoundRef.nativeElement.currentTime = 0;
    this.errorSoundRef.nativeElement.play().catch(()=>{});
    // vibrate
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    console.log('Perdiste por:', tag);
    // stop sensors
    this.stopSensors();
  }

  handleWin() {
    if (this.won || this.stopped) return;
    this.won = true;
    this.endSoundRef.nativeElement.currentTime = 0;
    this.endSoundRef.nativeElement.play().catch(()=>{});
    this.stopSensors();
    console.log('Ganaste');
  }

  focusArena() {
    // helpful on some devices to start reading sensor
    this.arenaRef.nativeElement.focus();
  }
}