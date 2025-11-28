import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { JuegosService, JUEGOS_CONFIG } from '../../servicios/juegos.service';
import { FeedbackService } from '../../servicios/feedback-service.service';

type GameState = 'inicio' | 'jugando' | 'terminado';

interface Carta {
  id: number;
  imagen: string;
  nombre: string;
  volteada: boolean;
  encontrada: boolean;
}

@Component({
  selector: 'app-memoria-de-sabores',
  templateUrl: './memoria-de-sabores.component.html',
  styleUrls: ['./memoria-de-sabores.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class MemoriaDeSaboresComponent implements OnInit {

  private router = inject(Router);
  private juegosService = inject(JuegosService);
  private feedback = inject(FeedbackService);

  // Estado del juego
  gameState: GameState = 'inicio';
  
  // Cartas del juego
  cartas: Carta[] = [];
  cartasVolteadas: Carta[] = [];
  bloqueado: boolean = false;
  
  // Puntuación
  intentos: number = 0;
  paresEncontrados: number = 0;
  totalPares: number = 6;
  maxIntentos: number = 12; // Máximo de intentos para ganar con descuento
  
  // Estado de elegibilidad
  puedeJugarPorDescuento: boolean = false;
  yaUsoIntento: boolean = false;
  esAnonimo: boolean = false;
  descuentoJuego: number = JUEGOS_CONFIG['memoria-de-sabores'].descuento; // 20%
  
  // Resultado
  gano: boolean = false;
  mensajeResultado: string = '';

  // Imágenes de comidas para las cartas
  private imagenes = [
    { imagen: 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png', nombre: 'Pollo' },
    { imagen: 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png', nombre: 'Hamburguesa' },
    { imagen: 'https://cdn-icons-png.flaticon.com/512/3595/3595458.png', nombre: 'Pizza' },
    { imagen: 'https://cdn-icons-png.flaticon.com/512/2515/2515183.png', nombre: 'Papas' },
    { imagen: 'https://cdn-icons-png.flaticon.com/512/2515/2515207.png', nombre: 'Hot Dog' },
    { imagen: 'https://cdn-icons-png.flaticon.com/512/2515/2515264.png', nombre: 'Taco' },
  ];

  constructor() { }

  async ngOnInit() {
    await this.verificarElegibilidad();
  }

  async verificarElegibilidad() {
    const elegibilidad = await this.juegosService.verificarElegibilidadDescuento();
    this.puedeJugarPorDescuento = elegibilidad.puedeJugarPorDescuento;
    this.yaUsoIntento = elegibilidad.yaUsoIntento;
    this.esAnonimo = elegibilidad.esAnonimo;
    
    console.log('🎮 Elegibilidad Memoria de Sabores:', elegibilidad);
  }

  iniciarJuego() {
    this.gameState = 'jugando';
    this.intentos = 0;
    this.paresEncontrados = 0;
    this.gano = false;
    this.cartasVolteadas = [];
    this.bloqueado = false;
    this.generarCartas();
  }

  generarCartas() {
    // Crear pares de cartas
    let id = 0;
    const cartasTemp: Carta[] = [];
    
    this.imagenes.forEach(img => {
      // Agregar dos cartas iguales (par)
      cartasTemp.push({
        id: id++,
        imagen: img.imagen,
        nombre: img.nombre,
        volteada: false,
        encontrada: false
      });
      cartasTemp.push({
        id: id++,
        imagen: img.imagen,
        nombre: img.nombre,
        volteada: false,
        encontrada: false
      });
    });
    
    // Mezclar cartas
    this.cartas = this.mezclarArray(cartasTemp);
  }

  mezclarArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  voltearCarta(carta: Carta) {
    // No hacer nada si está bloqueado, ya volteada o encontrada
    if (this.bloqueado || carta.volteada || carta.encontrada) {
      return;
    }

    // Voltear la carta
    carta.volteada = true;
    this.cartasVolteadas.push(carta);

    // Si hay dos cartas volteadas, verificar si son iguales
    if (this.cartasVolteadas.length === 2) {
      this.intentos++;
      this.bloqueado = true;
      
      const [carta1, carta2] = this.cartasVolteadas;
      
      if (carta1.nombre === carta2.nombre) {
        // ¡Par encontrado!
        carta1.encontrada = true;
        carta2.encontrada = true;
        this.paresEncontrados++;
        this.cartasVolteadas = [];
        this.bloqueado = false;
        
        // Verificar si ganó
        if (this.paresEncontrados === this.totalPares) {
          this.terminarJuego(true);
        }
      } else {
        // No son iguales, voltear de nuevo después de un delay
        setTimeout(() => {
          carta1.volteada = false;
          carta2.volteada = false;
          this.cartasVolteadas = [];
          this.bloqueado = false;
          
          // Verificar si perdió (superó máximo de intentos)
          if (this.intentos >= this.maxIntentos) {
            this.terminarJuego(false);
          }
        }, 1000);
      }
    }
  }

  async terminarJuego(gano: boolean) {
    this.gameState = 'terminado';
    this.gano = gano;

    // Registrar resultado usando el servicio de juegos
    const resultado = await this.juegosService.registrarResultadoJuego('memoria-de-sabores', gano);
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
    return `🎯 ¡Encontrá todos los pares en ${this.maxIntentos} intentos o menos y obtené ${this.descuentoJuego}% de descuento!`;
  }

  reiniciarJuego() {
    this.gameState = 'inicio';
    this.cartas = [];
    this.intentos = 0;
    this.paresEncontrados = 0;
    this.gano = false;
    this.mensajeResultado = '';
  }

  volverAlMenu() {
    this.router.navigate(['/game-selector']);
  }
}
