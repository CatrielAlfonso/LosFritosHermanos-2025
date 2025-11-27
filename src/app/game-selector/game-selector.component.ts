import { Component, OnInit,inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFabButton } from '@angular/material/button';
import { MatIcon, MatIconModule } from '@angular/material/icon'; 
import { LoadingService } from '../servicios/loading.service';


interface Game {
  id: string;
  nombre: string;
  descripcion: string;
  ruta: string;
  imagen: string;
  jugado: boolean;
}

@Component({
  selector: 'app-game-selector',
  standalone: true,
  templateUrl: './game-selector.component.html',
  styleUrls: ['./game-selector.component.scss'],
  imports: [CommonModule, 
    MatButtonModule,
    MatIconModule,
  ],
})
export class GameSelectorComponent  implements OnInit {

 // boton : MatButtonModule;

  loadingService = inject(LoadingService);

  ngOnInit(): void {
    
  }

   juegos: Game[] = [
    {
      id: 'atrapa',
      nombre: 'Atrapa el Pollo',
      descripcion: 'Tocá el pollo para ganar antes de que escape.',
      ruta: '/atrapa-el-pollo',
      imagen: '../../assets/imgs/atrapaElPollo.png',
      jugado: false
    },
    {
      id: 'extra',
      nombre: 'Mozo Equilibrio',
      descripcion: 'Evitá los obstáculos usando el giroscopio.',
      ruta: '/mozo-quilibrio',
      imagen: '../../assets/imgs/mozoEquilibrio.png',
      jugado: false
    },
    {
      id: 'mayor',
      nombre: 'Mayor o Menor',
      descripcion: 'Adiviná si la próxima carta es mayor o menor.',
      ruta: '/mayor-menor',
      imagen: '../../assets/imgs/mozoEquilibrio.png',
      jugado: false
    },
    {
      id: 'memoria',
      nombre: 'Memoria de Sabores',
      descripcion: 'Memorizá las cartas y encontrá las parejas.',
      ruta: '/memoria-de-sabores',
      imagen: '../../assets/imgs/memoriaSabores.png',
      jugado: false
    },
  ];

  descuento = 0;

  constructor(private router: Router) {}

  async jugar(juego: Game) {
    console.log(`Navegando a ${juego.ruta}`);
    this.loadingService.show();
    await this.router.navigateByUrl(juego.ruta);

    this.loadingService.hide();

  }

  volver() {
    this.router.navigateByUrl('/home'); // ajustá la ruta según tu menú principal
  }

  marcarJugado(id: string) {
    const juego = this.juegos.find(j => j.id === id);

    if (juego) {
      juego.jugado = true;
      this.calcularDescuento();
    }
  }

  calcularDescuento() {
    const jugados = this.juegos.filter(j => j.jugado).length;
    this.descuento = jugados * 3.75; // 4 juegos → 15%
  }

}
