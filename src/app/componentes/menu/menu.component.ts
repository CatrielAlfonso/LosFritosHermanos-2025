import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, computed, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { IonicModule, IonicSlides } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { SwiperContainer } from 'swiper/element';
import { CarritoService } from 'src/app/servicios/carrito.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/servicios/auth.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { Motion, MotionEventResult } from '@capacitor/motion';


@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MenuComponent  implements OnInit, OnDestroy {
  @ViewChildren('swiperContainer') swiperContainers!: QueryList<ElementRef<SwiperContainer>>;

  public bebidas : any[] = []
  public platos : any[] = []
  public todosLosProductos: any[] = [] // Todos los productos combinados
  totalItems = this.carritoService.totalItems;
  totalPrecio = this.carritoService.totalPrecio;
  mesaAsignada: number | null = null;
  usuario: any = null;
  tieneMesaAsignada: boolean = false;
  esDelivery: boolean = false;

  // Variables para control por movimiento
  productoActualIndex: number = 0;
  motionListener: any;
  lastAcceleration = { x: 0, y: 0, z: 0 };
  lastTime = Date.now();
  motionEnabled: boolean = false;
  
  // Para detectar shake
  shakeThreshold = 15;
  shakeCount = 0;
  lastShakeTime = Date.now();
  
  // Para acumular muestras y detectar dirección real
  motionSamples: { x: number, z: number, time: number }[] = [];
  isGesturing: boolean = false;
  gestureStartTime: number = 0;
  lastGestureTime: number = 0; // Cooldown después de cada gesto
  
  // Indicador visual
  showMotionIndicator: boolean = false;
  motionIndicatorText: string = '';
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
    private route: ActivatedRoute,
    private authService: AuthService,
    private feedback: FeedbackService
  ) { }

  async ngOnInit() {
    // Verificar si es pedido delivery
    this.route.queryParams.subscribe(params => {
      this.esDelivery = params['tipo'] === 'delivery';
    });

    if (!this.esDelivery) {
      await this.verificarMesaAsignada();
    }
    await this.cargarBebidas();
    await this.cargarPlatos();
    await this.inicializarMotion();
  }

  ngOnDestroy() {
    this.detenerMotion();
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
      this.combinarProductos();
    }catch(error){
      console.log('error al traer los platos: ', error)
    }
  }

  async cargarBebidas(){ 
    try {
      this.bebidas = await this.supabaseService.getBebidas()
      console.log('bebidas obtenidas con exito: ', this.bebidas)
      this.combinarProductos();
    }catch(error){
      console.log('error al traer las bebidas: ', error)
    }
  }

  combinarProductos() {
    // Combinar platos y bebidas en un solo array para navegación
    this.todosLosProductos = [...this.platos, ...this.bebidas];
  }


  agregarAlCarrito(producto: any) {
    if (!this.esDelivery && !this.tieneMesaAsignada) {
      this.feedback.showToast('error', '⚠️ Necesitas tener una mesa asignada para agregar productos');
      return;
    }
    
    this.carritoService.agregarProducto(producto);
    console.log('✅ Producto agregado:', producto.nombre);
  }

  
  irAlCarrito() {
    if (this.esDelivery) {
      this.router.navigate(['/delivery']);
    } else {
      this.router.navigate(['/carrito']);
    }
  }

  obtenerCantidadProducto = (productoId: string) => {
  const items = this.carritoService.obtenerItems(); 
  const item = items.find(item => item.productoId === productoId);
  return item ? item.cantidad : 0;
}


  restarProducto(producto: any) {
    if (!this.esDelivery && !this.tieneMesaAsignada) {
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

  // ========================================
  // CONTROL POR MOVIMIENTO (PUNTO 31)
  // ========================================

  async inicializarMotion() {
    try {
      // Iniciar listener de motion
      this.motionListener = await Motion.addListener('accel', (event: MotionEventResult) => {
        this.handleMotion(event);
      });

      this.motionEnabled = true;
      this.mostrarIndicador('🎮 Control por movimiento activado', 3000);
      console.log('✅ Control por movimiento inicializado');
    } catch (error) {
      console.error('Error al inicializar motion:', error);
      this.feedback.showToast('error', 'Control por movimiento no disponible en este dispositivo');
    }
  }

  detenerMotion() {
    if (this.motionListener) {
      this.motionListener.remove();
    }
  }

  handleMotion(event: MotionEventResult) {
    const { x, y, z } = event.acceleration;
    const now = Date.now();
    const deltaTime = now - this.lastTime;


    // Calcular la diferencia de aceleración
    const deltaX = Math.abs(x - this.lastAcceleration.x);
    const deltaY = Math.abs(y - this.lastAcceleration.y);
    const deltaZ = Math.abs(z - this.lastAcceleration.z);

    // Detectar shake (movimiento repetido izquierda-derecha)
    if (deltaX > this.shakeThreshold) {
      console.log(`🔄 SHAKE detectado - deltaX: ${deltaX.toFixed(2)}`);
      const timeSinceLastShake = now - this.lastShakeTime;
      
      if (timeSinceLastShake < 500) {
        this.shakeCount++;
        console.log(`📈 Shake count: ${this.shakeCount}`);
        
        if (this.shakeCount >= 3) {
          console.log(`🏠 VOLVIENDO AL INICIO por shake`);
          this.volverAlInicio();
          this.shakeCount = 0;
        }
      } else {
        this.shakeCount = 1;
      }
      
      this.lastShakeTime = now;
    }

    // Detectar inicio de gesto (aceleración significativa)
    const umbralInicio = 1.5;
    const cooldownTime = 600; // Ignorar movimientos por 600ms después de un gesto
    const hayMovimientoSignificativo = Math.abs(x) > umbralInicio || Math.abs(z) > umbralInicio;
    
    // Solo iniciar nuevo gesto si pasó el cooldown
    if (hayMovimientoSignificativo && !this.isGesturing && (now - this.lastGestureTime > cooldownTime)) {
      // Iniciar captura de gesto
      this.isGesturing = true;
      this.gestureStartTime = now;
      this.motionSamples = [];
    }
    
    // Acumular muestras durante el gesto
    if (this.isGesturing) {
      this.motionSamples.push({ x, z, time: now });
      
      // Después de 150ms, analizar el gesto completo
      if (now - this.gestureStartTime > 150 && deltaTime > 300) {
        // Calcular la aceleración promedio de las primeras muestras (inicio del movimiento)
        const primerasMuestras = this.motionSamples.slice(0, Math.min(5, this.motionSamples.length));
        const avgX = primerasMuestras.reduce((sum, s) => sum + s.x, 0) / primerasMuestras.length;
        const avgZ = primerasMuestras.reduce((sum, s) => sum + s.z, 0) / primerasMuestras.length;
        
        console.log(`📊 Gesto analizado - avgX: ${avgX.toFixed(2)}, avgZ: ${avgZ.toFixed(2)}, muestras: ${this.motionSamples.length}`);
        
        // Determinar dirección basada en el promedio de las primeras muestras
        const umbralDeteccion = 1.5;
        
        // Movimiento hacia la IZQUIERDA (foto SIGUIENTE)
        if (avgX < -umbralDeteccion && Math.abs(avgX) > Math.abs(avgZ)) {
          console.log(`⬅️ IZQUIERDA detectado - avgX: ${avgX.toFixed(2)} - Cambiando a foto SIGUIENTE`);
          this.cambiarFoto('next');
        }
        // Movimiento hacia la DERECHA (foto ANTERIOR)
        else if (avgX > umbralDeteccion && Math.abs(avgX) > Math.abs(avgZ)) {
          console.log(`➡️ DERECHA detectado - avgX: ${avgX.toFixed(2)} - Cambiando a foto ANTERIOR`);
          this.cambiarFoto('prev');
        }
        // Movimiento hacia ADELANTE (producto SIGUIENTE) - Z negativo
        else if (avgZ < -umbralDeteccion && Math.abs(avgZ) > Math.abs(avgX)) {
          console.log(`⬆️ ADELANTE detectado - avgZ: ${avgZ.toFixed(2)} - Cambiando a producto SIGUIENTE`);
          this.cambiarProducto('next');
        }
        // Movimiento hacia ATRÁS (producto ANTERIOR) - Z positivo
        else if (avgZ > umbralDeteccion && Math.abs(avgZ) > Math.abs(avgX)) {
          console.log(`⬇️ ATRÁS detectado - avgZ: ${avgZ.toFixed(2)} - Cambiando a producto ANTERIOR`);
          this.cambiarProducto('prev');
        }
        
        // Resetear gesto y activar cooldown
        this.isGesturing = false;
        this.motionSamples = [];
        this.lastTime = now;
        this.lastGestureTime = now; // Activar cooldown para ignorar el rebote
      }
    }
    
    // Timeout para gestos que no completan
    if (this.isGesturing && now - this.gestureStartTime > 500) {
      this.isGesturing = false;
      this.motionSamples = [];
    }

    // Actualizar última aceleración
    this.lastAcceleration = { x, y, z };
  }

  cambiarFoto(direction: 'prev' | 'next') {
    try {
      const swipers = this.swiperContainers?.toArray();
      if (!swipers || swipers.length === 0) return;

      const currentSwiper = swipers[this.productoActualIndex];
      if (!currentSwiper) return;

      const swiperElement = currentSwiper.nativeElement;
      
      if (direction === 'next') {
        swiperElement.swiper.slideNext();
        this.mostrarIndicador('📸 Foto siguiente →', 1000);
      } else {
        swiperElement.swiper.slidePrev();
        this.mostrarIndicador('📸 ← Foto anterior', 1000);
      }
    } catch (error) {
      console.error('Error al cambiar foto:', error);
    }
  }

  cambiarProducto(direction: 'prev' | 'next') {
    const totalProductos = this.todosLosProductos.length;
    if (totalProductos === 0) return;

    if (direction === 'next') {
      this.productoActualIndex = (this.productoActualIndex + 1) % totalProductos;
      this.mostrarIndicador('🍽️ Producto siguiente (atrás)', 1000);
    } else {
      this.productoActualIndex = (this.productoActualIndex - 1 + totalProductos) % totalProductos;
      this.mostrarIndicador('🍽️ Producto anterior (adelante)', 1000);
    }

    // Scroll al producto actual
    this.scrollAlProducto(this.productoActualIndex);
  }

  volverAlInicio() {
    this.productoActualIndex = 0;
    this.mostrarIndicador('🔄 Volviendo al inicio', 1500);
    this.scrollAlProducto(0);
  }

  scrollAlProducto(index: number) {
    setTimeout(() => {
      const cards = document.querySelectorAll('ion-card.container-plato');
      if (cards && cards[index]) {
        cards[index].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  }

  mostrarIndicador(texto: string, duracion: number = 2000) {
    this.motionIndicatorText = texto;
    this.showMotionIndicator = true;

    setTimeout(() => {
      this.showMotionIndicator = false;
    }, duracion);
  }

  toggleMotion() {
    if (this.motionEnabled) {
      this.detenerMotion();
      this.motionEnabled = false;
      this.feedback.showToast('exito', 'Control por movimiento desactivado');
    } else {
      this.inicializarMotion();
    }
  }

}
