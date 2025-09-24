import { Component, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonicModule, IonicSlides } from '@ionic/angular';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MenuComponent  implements OnInit {

  public bebidas : any[]= []

  constructor( 
    private supabaseService : SupabaseService
  ) { }

  ngOnInit() {
    this.cargarBebidas()
  }

  async cargarBebidas(){
    try {
      this.bebidas = await this.supabaseService.getBebidas()
      console.log('bebidas obtenidas con exito: ', this.bebidas)
    }catch(error){
      console.log('error al traer las bebidas: ', error)
    }
  }

}
