import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { FritosSpinnerComponent } from '../fritos-spinner/fritos-spinner.component';

@Component({
  selector: 'app-pagos',
  templateUrl: './pagos.component.html',
  styleUrls: ['./pagos.component.scss'],
  imports: [IonicModule, CommonModule, FritosSpinnerComponent]
})
export class PagosComponent  implements OnInit {

  numeroMesa: string = ''; 
  pedido = signal<any>(null);
  loading = signal(true);
  error = signal('');
  propinaSeleccionada = 10; 
  opcionesPropina = [0, 5, 10, 15, 20];

  constructor(
    private router : Router,
    private supabaseService : SupabaseService,
    private route : ActivatedRoute,
    private alertController : AlertController,
    private toastController : ToastController,
    private pushNotificationService : PushNotificationService
  ) { }

  async ngOnInit() {
    this.numeroMesa = this.route.snapshot.paramMap.get('mesa') || ''
     if (!this.numeroMesa) {
      this.error.set('Número de mesa no especificado');
      this.loading.set(false);
      return;
    }

    await this.verificarPedidoMesa();
  }

  async verificarPedidoMesa() {
    try {
      this.loading.set(true);
      
      const mesa = await this.supabaseService.getMesa(parseInt(this.numeroMesa));
      console.log('🔍 Mesa obtenida:', mesa);
      console.log('🔍 Mesa.pedido:', mesa?.pedido_id);
      
      if (!mesa) {
        this.error.set(`Mesa ${this.numeroMesa} no encontrada`);
        this.loading.set(false);
        return;
      }

      if (!mesa.pedido_id) {
        this.error.set('No hay pedido asociado a esta mesa');
        this.loading.set(false);
        return;
      }

      const pedidoCompleto = await this.supabaseService.getPedido(mesa.pedido_id);
      
      if (!pedidoCompleto) {
        this.error.set('Pedido no encontrado');
        this.loading.set(false);
        return;
      }

      if (!pedidoCompleto.cuenta_habilitada) {
        this.error.set('La cuenta no está habilitada para pago');
        this.loading.set(false);
        return;
      }

      this.pedido.set(pedidoCompleto);
      
    } catch (error) {
      console.error('Error verificando pedido:', error);
      this.error.set('Error al cargar la información de la mesa');
    } finally {
      this.loading.set(false);
    }
  }


  volverAHome() {
    this.router.navigate(['/home']);
  }

  solicitarCuentaAlMozo() {
    this.router.navigateByUrl('/pedidos')
  }

  async reintentar() {
    await this.verificarPedidoMesa();
  }

  calcularSubtotal(): number {
    const pedido = this.pedido();
    if (!pedido) return 0;

    let subtotal = 0;

    // Sumar comidas
    if (pedido.comidas && Array.isArray(pedido.comidas)) {
      subtotal += pedido.comidas.reduce((sum: number, comida: any) => sum + (comida.precioTotal || 0), 0);
    }

    // Sumar bebidas
    if (pedido.bebidas && Array.isArray(pedido.bebidas)) {
      subtotal += pedido.bebidas.reduce((sum: number, bebida: any) => sum + (bebida.precioTotal || 0), 0);
    }

    // Sumar postres
    if (pedido.postres && Array.isArray(pedido.postres)) {
      subtotal += pedido.postres.reduce((sum: number, postre: any) => sum + (postre.precioTotal || 0), 0);
    }

    return subtotal;
  }

  calcularDescuento(): number {
    const pedido = this.pedido();
    if (!pedido || !pedido.descuento) return 0;

    const subtotal = this.calcularSubtotal();
    return (subtotal * pedido.descuento) / 100;
  }

  calcularPropina(): number {
    const subtotal = this.calcularSubtotal();
    const descuento = this.calcularDescuento();
    const basePropina = subtotal - descuento;
    
    return (basePropina * this.propinaSeleccionada) / 100;
  }

  calcularTotal(): number {
    const subtotal = this.calcularSubtotal();
    const descuento = this.calcularDescuento();
    const propina = this.calcularPropina();
    
    return subtotal - descuento + propina;
  }

  // INTERACCIÓN DEL USUARIO

  seleccionarPropina(porcentaje: number) {
    this.propinaSeleccionada = porcentaje;
  }

  async procesarPago() {
    try{
      const {data, error} = await this.supabaseService.actualizarPedido(this.pedido().id, {pagado: this.calcularTotal()})
      if(error) throw error
      this.pushNotificationService.notificarPagoExitoso(this.numeroMesa, this.calcularTotal())
      const toast = await this.toastController.create({ 
          message: `Pago exitoso`,
          duration: 3000,
          color: 'success',
          position: 'top'
        });
      await toast.present();
  
      this.volverAHome();
      return data[0] || null
    }catch(error){
      console.log('error en el pago: ', error)
    }
    

    
  }

}
