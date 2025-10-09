import { Component, OnInit, Output, EventEmitter, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonButton, IonIcon} from '@ionic/angular/standalone';
import { AlertController } from '@ionic/angular';
import { inject } from '@angular/core';

export interface ResultadoJuego {
  exito: boolean;
  porcentaje: number; // 0, 5, 10 o 15
}

interface Obstaculo {
  id: number;
  x: number; // Posición horizontal (ej: en píxeles desde la izquierda)
  huecoY: number; // Posición vertical del centro del hueco (en %)
  ancho: number; // Ancho del obstáculo
  huecoAltura: number; // Altura del hueco (en %)
}

@Component({
  selector: 'app-atrapa-el-pollo',
  templateUrl: './atrapa-el-pollo.component.html',
  styleUrls: ['./atrapa-el-pollo.component.scss'],
  imports: [CommonModule, FormsModule, IonContent]
})
export class AtrapaElPolloComponent  implements OnInit, OnDestroy {

// Evento que se emitirá cuando el juego termine (gana o pierde)
@Output() juegoTerminado = new EventEmitter<ResultadoJuego>();
private alertCtrl = inject(AlertController); 

  // Variables del Pollo
  polloY = 50; // Posición vertical inicial (en porcentaje)
  polloAltura = 10; // Altura del pollo (en porcentaje de la pantalla)
  velocidadVertical = 0; // Velocidad de subida/bajada

  // Variables del Juego
  obstaculos: Obstaculo[] = [];
   velocidadJuego = 3; // Velocidad horizontal de los obstáculos (ej: 3 unidades/frame)
  distanciaEntreObstaculos = 300; // Espacio entre generación (en unidades)
  ultimoObstaculoX = 0;

  juegoActivo = false;
  juegoInterval: any;
  gravedad = 0.4;
  saltoFuerza = -8; // Valor negativo para mover hacia arriba
  distanciaGanar = 750; // Distancia total para ganar (en píxeles o unidades de juego)
  distanciaRecorrida = 0;

  // Variables de Obstáculos (Simplificado: solo la meta)
  metaDistancia = 800;
  metaAncho = 50; // Ancho del objetivo

  // --- Lógica de HostListener para capturar clics/toques ---

  // Escucha el evento 'click' o 'keydown.space' en la ventana/documento
  @HostListener('document:click', ['$event'])
  @HostListener('document:keydown.space', ['$event'])
  onAction(event: Event) {
    if (this.juegoActivo) {
      this.saltar();
    } else if (event.type === 'click') {
      this.iniciarJuego();
    }
  }

  constructor() { }

  ngOnInit() {
    // Es buena práctica inicializar la posición y el estado
  }

  ngOnDestroy() {
    this.detenerJuego();
  }

  iniciarJuego() {
    if (this.juegoActivo) return;

    this.juegoActivo = true;
    this.polloY = 50;
    this.velocidadVertical = 0;
    this.distanciaRecorrida = 0;

    // Lógica principal de actualización (simulando un "game loop")
    this.juegoInterval = setInterval(() => {
      this.actualizarJuego();
    }, 30); // 30ms ≈ 33 FPS
  }

  detenerJuego() {
    if (this.juegoInterval) {
      clearInterval(this.juegoInterval);
      this.juegoInterval = null;
    }
    this.juegoActivo = false;
  }

  saltar() {
    this.velocidadVertical = this.saltoFuerza;
  }

  actualizarJuego() {
    // 1. Aplicar Gravedad y Mover el Pollo
    this.velocidadVertical += this.gravedad;
    this.polloY += this.velocidadVertical * 0.1; // Multiplicador para suavizar el movimiento

    // 2. Comprobar Colisión con Techo/Suelo (pérdida)
    if (this.polloY < 0 || this.polloY > 100 - this.polloAltura) {
      this.terminarJuego(this.calcularDescuento(this.distanciaRecorrida)); // Pérdida (0% o % parcial)
      return;
    }

    // 3. Simular Avance
    this.generarObstaculos();
    this.moverObstaculos();
    //this.distanciaRecorrida += 1; // Avance constante

    // 4. Comprobar Condición de Ganar
     for (let obstaculo of this.obstaculos) {
      if (this.checkCollision(obstaculo)) {
        this.terminarJuego(this.calcularDescuento(this.distanciaRecorrida)); // Colisión, juego termina.
        return;
      }
    }

    // 5. Simular Avance (usaremos la distancia para el descuento)
    this.distanciaRecorrida += this.velocidadJuego;

  }

  // calcularDescuento(distancia: number): number {
  //   // En este ejemplo, simplificaremos la colisión para premiar por llegar al final
  //   // En el Flappy Bird real, la colisión con obstáculos determina si pierdes antes de llegar.
    
  //   // Regla: Si llegaste al final, ganas el 15%
  //   return 15; 
  // }

  terminarJuego(porcentaje: number) {
    this.detenerJuego();
    
    const resultado: ResultadoJuego = {
      exito: porcentaje > 0,
      porcentaje: porcentaje
    };

    this.juegoTerminado.emit(resultado);
  }

  // Helper para el template
  get polloStyle(): string {
    return `translateY(${this.polloY}vh)`;
  }


   generarObstaculos() {
    // Generar un nuevo obstáculo si el último ha avanzado lo suficiente
    if (this.obstaculos.length === 0 || this.ultimoObstaculoX < 1000 - this.distanciaEntreObstaculos) {
      
      const nuevoObstaculo: Obstaculo = {
        id: Date.now(),
        x: 1000, // Comienza fuera del borde derecho
        huecoY: 30 + Math.random() * 40, // Hueco entre 30% y 70% de la altura
        ancho: 80,
        huecoAltura: 30 // El hueco es el 30% de la altura
      };
      
      this.obstaculos.push(nuevoObstaculo);
      this.ultimoObstaculoX = nuevoObstaculo.x;
    }
  }

  moverObstaculos() {
    this.obstaculos = this.obstaculos.map(obs => ({
      ...obs,
      x: obs.x - this.velocidadJuego // Mover a la izquierda
    }));

    // Eliminar obstáculos que están fuera de la pantalla
    this.obstaculos = this.obstaculos.filter(obs => obs.x > -100);

    // Actualizar la posición X del último obstáculo para la generación
    if (this.obstaculos.length > 0) {
      this.ultimoObstaculoX = this.obstaculos[this.obstaculos.length - 1].x;
    }
  }
  
  // Modificación de calcularDescuento para premiar por la distancia recorrida
  calcularDescuento(distancia: number): number {
    if (distancia >= 1500) return 15;
    if (distancia >= 1000) return 10;
    if (distancia >= 500) return 5;
    return 0; // Si no llega a 100 unidades, 0%
  }



/**
 * Comprueba si Crispy colisiona con una columna (parte superior o inferior).
 * @param obstaculo El obstáculo a verificar.
 * @returns true si hay colisión.
 */
checkCollision(obstaculo: Obstaculo): boolean {
  // 1. Obtener las coordenadas de Crispy (lo convertimos a píxeles o unidades fijas)
  // Asumiremos que el juego usa un área de 1000 unidades de ancho.
  const crispyX = 100; // Posición fija de Crispy en el eje X (ej: 10% del ancho)
  const crispyYPixeles = this.polloY * 10; // Convertir % a unidad (ej: 1000px de alto)
  const crispyWidth = 50; // Ancho en píxeles (o unidades)
  const crispyHeight = 50; // Alto en píxeles (o unidades)

  // 2. Obtener las coordenadas del obstáculo
  const obstaculoX = obstaculo.x;
  const obstaculoWidth = obstaculo.ancho;

  // 3. Obtener las coordenadas de las dos partes del obstáculo
  const topYEnd = (obstaculo.huecoY - obstaculo.huecoAltura / 2) * 10; // Fin de la columna superior
  const bottomYStart = (obstaculo.huecoY + obstaculo.huecoAltura / 2) * 10; // Inicio de la columna inferior

  // === Detección de Colisión X (Crispy está entre el inicio y el fin del obstáculo) ===
  const collisionX = crispyX + crispyWidth > obstaculoX && 
                     crispyX < obstaculoX + obstaculoWidth;

  if (collisionX) {
    // === Detección de Colisión Y (Crispy toca la columna superior O la inferior) ===

    // Colisión con la columna superior
    const collisionYTop = crispyYPixeles < topYEnd;

    // Colisión con la columna inferior
    const collisionYBottom = crispyYPixeles + crispyHeight > bottomYStart;

    // Si hay colisión en X, y toca la columna superior O la inferior, ¡es colisión!
    return collisionYTop || collisionYBottom;
  }

  return false;
  }

}
