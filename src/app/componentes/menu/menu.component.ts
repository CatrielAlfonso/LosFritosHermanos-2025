import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonicModule, IonicSlides } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SwiperContainer } from 'swiper/element';


@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MenuComponent  implements OnInit {

  public bebidas : any[] = []
  public platos : any[] = []
  

  constructor( 
    private supabaseService : SupabaseService
  ) { }

  ngOnInit() {
    this.cargarBebidas()
    this.cargarPlatos()

    //setTimeout(() => this.inicializarSwipers(), 300);
  }



  async cargarPlatos(){
    try {
      this.platos = await this.supabaseService.getPlatos()
      console.log('platos obtenidos con exito: ', this.platos)
    }catch(error){
      console.log('error al traer los platos: ', error)
    }
  }

  async cargarBebidas(){
    try {
      this.bebidas = await this.supabaseService.getBebidas()
      console.log('bebidas obtenidas con exito: ', this.bebidas)
    }catch(error){
      console.log('error al traer las bebidas: ', error)
    }
  }

  // inicializarSwipers() {
  //   const swipers = document.querySelectorAll('swiper-container');
  //   swipers.forEach(swiper => {
  //     if (swiper && !swiper.swiper) {
  //       (swiper as any).initialize();
  //     }
  //   });
  // }

  

}
