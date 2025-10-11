import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-mayor-menor',
  templateUrl: './mayor-menor.component.html',
  styleUrls: ['./mayor-menor.component.scss'],
})
export class MayorMenorComponent  implements OnInit {

  protected cartaAnterior : number = 0
  protected carta : number = 0
  protected numerosPosibles: number[] = [1,2,3,4,5,6,7,8,9,10,11,12]
  protected puntos : number = 0
  protected puntosBD : number = 0
  protected record : number = 0;
  protected mensaje : string = ''
  private indiceAnterior : number = 0;
  protected color  = 'red';
  protected usuarioActual : any
  isFlipping = false

  constructor() { }

  ngOnInit() {}

  generarCarta(){
    let indice = Math.floor(Math.random() * 12);
    while(indice === this.indiceAnterior){
      indice = Math.floor(Math.random() * 12);
    }
    this.indiceAnterior = indice;
    console.log('carta: ' + (indice + 1))
    this.carta = this.numerosPosibles[indice]
  }

  triggerFlip() {
    this.isFlipping = true;

    setTimeout(() => {
      this.isFlipping = false;
    }, 300);
  }


  mayorMenor(condicion: string) {
    this.cartaAnterior = this.carta;
    this.generarCarta();
  
    if ((condicion === 'mayor' && this.carta >= this.cartaAnterior) || 
        (condicion === 'menor' && this.carta <= this.cartaAnterior)) {
      this.puntos += 1;
      this.triggerFlip()
    } else {
      //this.mensaje = `Alcanzaste ${this.puntos} puntos! Inténtalo otra vez`;
  
      // Llamar al método para verificar y actualizar récord en segundo plano
      // if (this.puntos > this.record) {
      //   this.puntosBD = this.puntos
      // }
  
  
      this.puntos = 0;  
    }
  
    console.log(this.carta);
  }

}
