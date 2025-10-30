import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, computed } from '@angular/core';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonicModule, IonicSlides } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SwiperContainer } from 'swiper/element';
import { CarritoService } from 'src/app/servicios/carrito.service';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/servicios/auth.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';


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
  mesaAsignada: number | null = null;
  usuario: any = null;
  tieneMesaAsignada: boolean = false;
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
    private router: Router,
    private authService: AuthService,
    private feedback: FeedbackService
  ) { }

  async ngOnInit() {
    await this.verificarMesaAsignada();
    this.cargarBebidas();
    this.cargarPlatos();
  }

  async verificarMesaAsignada() {
    try {
      console.log('🔍 [menu] Verificando mesa asignada');
      const { data: user } = await this.authService.getCurrentUser();
      
      if (!user?.user?.email) {
        console.log('❌ [menu] No hay usuario logueado');
        return;
      }

      this.usuario = user.user;
      const email = user.user.email;

      // Verificar si tiene mesa asignada en lista_espera
      const { data: clienteEnLista, error } = await this.supabaseService.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', email)
        .not('mesa_asignada', 'is', null)
        .single();

      if (!error && clienteEnLista) {
        this.mesaAsignada = clienteEnLista.mesa_asignada;
        this.tieneMesaAsignada = true;
        console.log('✅ [menu] Cliente tiene mesa asignada:', this.mesaAsignada);
      } else {
        this.tieneMesaAsignada = false;
        console.log('⚠️ [menu] Cliente NO tiene mesa asignada');
      }
    } catch (error) {
      console.error('💥 [menu] Error al verificar mesa:', error);
    }
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
    if (!this.tieneMesaAsignada) {
      this.feedback.showToast('error', '⚠️ Necesitas tener una mesa asignada para agregar productos');
      return;
    }
    
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
    if (!this.tieneMesaAsignada) {
      this.feedback.showToast('error', '⚠️ Necesitas tener una mesa asignada');
      return;
    }
    
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

  irAConsultaMozo() {
    if (!this.mesaAsignada) {
      this.feedback.showToast('error', '⚠️ Necesitas tener una mesa asignada para consultar al mozo');
      return;
    }
    this.router.navigate(['/consulta-mozo'], { 
      queryParams: { mesa: this.mesaAsignada } 
    });
  }

}
