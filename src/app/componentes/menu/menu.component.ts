import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, computed } from '@angular/core';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonicModule, IonicSlides } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SwiperContainer } from 'swiper/element';
import { CarritoService } from 'src/app/servicios/carrito.service';
import { Router } from '@angular/router';


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
  totalItems = this.carritoService.totalItems;
  totalPrecio = this.carritoService.totalPrecio;
//   cantidadesProductos = computed(() => {
//   const items = this.carritoService.obtenerItems()();
//   const cantidades: { [productoId: string]: number } = {};
  
//   items.forEach(item => {
//     cantidades[item.productoId] = item.cantidad;
//   });
  
//   return cantidades;
// });
  

  constructor( 
    private supabaseService : SupabaseService,
    private carritoService: CarritoService, 
    private router: Router 
  ) { }

  ngOnInit() {
    this.cargarBebidas()
    this.cargarPlatos()
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


  agregarAlCarrito(producto: any) {
    this.carritoService.agregarProducto(producto);
    
    console.log('✅ Producto agregado:', producto.nombre);
  }

  
  irAlCarrito() {
    this.router.navigate(['/carrito']);
  }

  obtenerCantidadProducto = (productoId: string) => {
  const items = this.carritoService.obtenerItems(); 
  const item = items.find(item => item.productoId === productoId);
  return item ? item.cantidad : 0;
}


  restarProducto(producto: any) {
    const items = this.carritoService.obtenerItems(); 
    const item = items.find(item => item.productoId === producto.id);
    
    if (item) {
      if (item.cantidad > 1) {
        this.carritoService.actualizarCantidad(item.id, item.cantidad - 1);
      } else {
        this.carritoService.eliminarProducto(item.id);
      }
    }
  }



}
