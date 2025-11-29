import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Vibration } from '@awesome-cordova-plugins/vibration/ngx';
import { IonContent, IonButton } from "@ionic/angular/standalone";
import { NgZone } from '@angular/core';
import { Motion } from '@capacitor/motion';

type Obstacle = { x: number; y: number; size: number; img: string; tag: string };

@Component({
  selector: 'app-extra-game',
  templateUrl: './extragame.component.html',
  styleUrls: ['./extragame.component.scss'],
  imports: [IonButton, IonContent, CommonModule ],
})
export class ExtraGameComponent implements OnInit, OnDestroy {
  
   mozoX = 20;
  mozoY = 20;
  mesaX = 80;
  mesaY = 80;

  obstaculos: Array<{x:number,y:number,tipo:string,imagen:string}> = [];
  
  juegoIniciado = false;
  juegoTerminado = false;
  mensaje = '';

  audioInicio: HTMLAudioElement;
  audioFin: HTMLAudioElement;
  audioError: HTMLAudioElement;

  motionListener: any;
  mozoSize = 15;
  mesaSize = 18;
  obstaculoSize = 20;

  lastGyroLog = 0;

  constructor(private vibration: Vibration, private ngZone: NgZone) {

    this.audioInicio = new Audio('../../../assets/sounds/start_sound.mp3');
    this.audioFin = new Audio('../../../assets/sounds/winner.mp3');
    this.audioError = new Audio('../../../assets/sounds/error.mp3');
  }

  ngOnInit() {
    this.inicializarObstaculos();
    this.activarControlesTeclado();
  }

  activarControlesTeclado() {
  window.addEventListener('keydown', (event) => {

    if (!this.juegoIniciado || this.juegoTerminado) return;

    const velocidad = 5; // velocidad de movimiento con teclas

    switch (event.key) {

      case 'ArrowUp':
      case 'w':
      case 'W':
        this.mozoY -= velocidad;
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        this.mozoY += velocidad;
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.mozoX -= velocidad;
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        this.mozoX += velocidad;
        break;
    }

    this.verificarColisiones();
  });
}

  iniciarJuego() {
    this.audioInicio.play();
    this.mozoX = 20;
    this.mozoY = 20;
    this.juegoIniciado = true;
    this.juegoTerminado = false;
    this.mensaje = '';

    this.inicializarObstaculos();
    this.iniciarSensorMotion();
  }

  // -------------------------------
  // ⭐️ USAR CAPACITOR MOTION
  // -------------------------------
  async iniciarSensorMotion() {
    console.log("Activando Motion…");

    try {
      this.motionListener = await Motion.addListener('orientation', (event) => {
        

        if (!this.juegoIniciado || this.juegoTerminado) return;

          const beta = event.beta ?? 0;   // inclinación adelante/atrás
          const gamma = event.gamma ?? 0; // inclinación izquierda/derecha

          console.log("beta:", beta, "gamma:", gamma);

          const sensibilidad = 0.6;
          this.mozoX += gamma * sensibilidad;
          this.mozoY += beta * sensibilidad;

          const now = Date.now();
          if (now - this.lastGyroLog > 500) 
          {
            
              // beta,
              // gamma,
              // mozoX: this.mozoX,
              // mozoY:this.mozoY
              this.lastGyroLog = now;
          }

          this.verificarColisiones();
  
       
      });

    } catch (error) {
      console.log("Error con Motion:", error);
      alert("No se pudieron leer sensores. ¿Concediste permisos?");
    }
  }

  detenerSensorMotion() {
    if (this.motionListener) {
      this.motionListener.remove();
      this.motionListener = null;
    }
  }

  // -------------------------------
  // LÓGICA DEL JUEGO (igual que antes)
  // -------------------------------

  inicializarObstaculos() {
    const tipos = [
      { tipo: 'patines', imagen: '../../../assets/imgs/patines.png' },
      { tipo: 'banana', imagen: '../../../assets/imgs/banana.png' },
      { tipo: 'aceite', imagen: '../../../assets/imgs/aceite.png' }
    ];

    this.obstaculos = [];

    for (let i = 0; i < 3; i++) {
      let x=0,y=0,valido=false;

      while (!valido) {
        x = Math.random()*60+20;
        y = Math.random()*60+20;

        valido = this.obstaculos.every(obs => {
          const dist = Math.hypot(obs.x - x, obs.y - y);
          return dist > 15;
        });

        const distMozo = Math.hypot(this.mozoX - x, this.mozoY - y);
        const distMesa = Math.hypot(this.mesaX - x, this.mesaY - y);

        if (distMozo < 15 || distMesa < 15) valido = false;
      }

      this.obstaculos.push({
        x, y,
        tipo: tipos[i].tipo,
        imagen: tipos[i].imagen
      });
    }
  }

  verificarColisiones() {
    if (this.mozoX < 0 || this.mozoX > 100 - this.mozoSize ||
        this.mozoY < 0 || this.mozoY > 100 - this.mozoSize) {

          console.log("Colisión con borde");
      this.perderJuego();
      return;
    }

    for (const o of this.obstaculos) {
      if (this.hayColision(this.mozoX, this.mozoY, o.x, o.y, this.obstaculoSize)) {
        console.log("Colisión con obstáculo:", o.tipo);
        this.perderJuego();
        return;
      }
    }

    if (this.hayColision(this.mozoX, this.mozoY, this.mesaX, this.mesaY, this.mesaSize)) {
      console.log("Llegaste a la mesa");
      this.ganarJuego();
    }
  }

  hayColision(x1:number,y1:number,x2:number,y2:number,size:number):boolean {
    const d = Math.hypot(x1-x2, y1-y2);
    return d < (this.mozoSize + size)/2;
  }

  perderJuego() {
    this.juegoTerminado = true;
    this.mensaje = 'Perdiste';
    this.audioError.play();
    this.vibration.vibrate(500);
    this.detenerSensorMotion();
  }

  ganarJuego() {
    this.juegoTerminado = true;
    this.mensaje = '¡Ganaste! 🎉';
    this.audioFin.play();
    this.detenerSensorMotion();
  }

  reiniciarJuego() {
    this.iniciarJuego();
  }

  ngOnDestroy() {
    this.detenerSensorMotion();
  }
}