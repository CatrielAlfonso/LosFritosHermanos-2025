import { Component, computed, OnInit } from '@angular/core';
import { AuthService } from '../servicios/auth.service';
import { Router,RouterLink } from '@angular/router';
import { UserService } from '../servicios/user';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../servicios/supabase.service';
import { ResultadoJuego } from '../games/atrapa-el-pollo/atrapa-el-pollo.component';
import { JuegosService } from '../servicios/juegos.service';
import { FeedbackService } from '../servicios/feedback-service.service';
import { CustomLoader } from '../servicios/custom-loader.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { isPlatform } from '@ionic/angular/standalone'; 
import { PushNotifications } from '@capacitor/push-notifications';
import { SweetAlertService } from '../servicios/sweet-alert.service';
import { PushNotificationService } from '../servicios/push-notification.service';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  esAdmin: boolean = false;
  esMaitre: boolean = false;
  usuario: any = null;
  esCocinero: boolean = false;
  esBartender: boolean = false;
  esMozo: boolean = false;
  perfilUsuario: string | null = null;
  nombreUsuario: string = '';
  userData : any | null = null
  tipoUsuario : string | null = null
  isLoading = true;
  mesaAsignada: number | null = null; // Número de mesa asignada al cliente
  yaEnListaEspera: boolean = false;
  clienteInfo: any = null;
  mostrarBotonEscanearMesa: boolean = false;
  mostrarBotonHacerPedido: boolean = false;
  mesaAsignadaAnterior: any = null;
  clienteSentado: boolean = false;
  mostrarBotonVerEstadoPedido: boolean = false;
  pedidoActualCliente: any = null;
  qrEnProceso: boolean = false;



  pedidoHecho: boolean = true;

  authUser = computed(() => this.authService.userActual());
  // userDataAuth = computed(() => {
  //   const user = this.authUser()
  //   if(!user) return null
  //   return {
  //     email: user.email,
  //     //tipo: user.user_metadata?.tipo || 'cliente',
  //     //nombre: user.user_metadata?.nombre || 'Usuario'
  //   };
  // })

  constructor(
    private authService: AuthService,
    private router: Router,
    private userService : UserService,
    private supabase : SupabaseService,
    private juegosService: JuegosService,
    private feedback: FeedbackService,
    private swal:SweetAlertService,
    private customLoader: CustomLoader,
    private pushNotificationService: PushNotificationService
  ) {
      
  }

  ngOnInit() {
    this.verificarUsuario();

    const user = this.authService.usuarioActual;
    if (user) {
     // o traer el nombre desde DB

    // Levanto los flags desde el servicio
    this.perfilUsuario = this.authService.perfilUsuario;
    this.esAdmin = this.authService.esAdmin;
    this.esMaitre = this.authService.esMaitre;
    this.esCocinero = this.authService.perfilUsuario === 'cocinero';
    this.esBartender = this.authService.perfilUsuario === 'bartender';
    this.esMozo = this.authService.perfilUsuario === 'mozo';
  }
  this.authService.perfilUsuario$.subscribe(perfil => {
    this.perfilUsuario = perfil ?? '';
    this.esAdmin = perfil === 'supervisor';
    this.esMaitre = perfil === 'maitre';
    this.esCocinero = perfil === 'cocinero';
    this.esBartender = perfil === 'bartender';  
    this.esMozo = perfil === 'mozo';
  });
  console.log('Perfil usuario en HomePage:', this.perfilUsuario);

    this.loadUserData();
    console.log('se ejecuta el on init')
  }


   async loadUserData() {
    this.isLoading = true;
    
    const user = await this.userService.loadCurrentUser();
    this.tipoUsuario = user?.tipo || null;
    this.userData = user || null;
    this.nombreUsuario = user?.datos.nombre
    this.perfilUsuario = user?.tipo || null
    console.log('user: ', user)
    console.log('userData: ', this.userData)
    this.isLoading = false;
  }

   async cargarUsuario() {
    try {
      const { data, error } = await this.authService.getCurrentUser();
      
      if (error) {
        return;
      }
      
      this.usuario = data?.user;

      if (!this.usuario) {
        this.router.navigateByUrl('/login');
      } else {
        if (this.perfilUsuario === 'cliente') {
          await this.verificarMesaAsignada();
          await this.cargarClienteInfo();
        }
      }
    } catch (error) {
      this.router.navigateByUrl('/login');
    }
  }


   async cargarClienteInfo() {
    if (!this.usuario || this.perfilUsuario !== 'cliente') return;
    
    try {
      const { data, error } = await this.supabase.supabase
        .from('clientes')
        .select('*')
        .eq('correo', this.usuario.email)
        .single();
      
      if (!error && data) {
        this.clienteInfo = data;
      }
    } catch (error) {
    }
  }



  


    async verEncuestasPrevias() {
    this.customLoader.show();
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        if (codigoEscaneado === 'verEncuestas') {
          await this.router.navigate(['/encuestas'], { queryParams: { modo: 'ver' } });
        } else {
          //await this.mostrarNotificacion('El QR no es válido para ver encuestas previas.', 'error');
          await this.swal.showTemporaryAlert('Error', 'El QR no es válido para ver encuestas previas.', 'error');
        }
      } else {
        //await this.mostrarNotificacion('No se detectó ningún código QR.', 'error');
        await this.swal.showTemporaryAlert('Error', 'No se detectó ningún código QR.', 'error');
      }
    } catch (error) {
      //await this.mostrarNotificacion('Error al escanear el QR.', 'error');
      await this.swal.showTemporaryAlert('Error', 'Error al escanear el QR.', 'error');
    } finally {
      this.customLoader.hide();
    }
  }

    async verificarMesaAsignada() {
    try {
      const { data: lista, error: errorLista } = await this.supabase.supabase
        .from('lista_espera')
        .select('*')
        .eq('correo', this.usuario.email);
      this.yaEnListaEspera = Array.isArray(lista) && lista.length > 0;

      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', this.usuario.email)
        .not('mesa_asignada', 'is', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

      const nuevaMesaAsignada = clienteEnLista?.mesa_asignada || null;

      if (nuevaMesaAsignada !== this.mesaAsignadaAnterior) {
        //this.loadingService.show();
        this.customLoader.show();
        setTimeout(() => {
          this.customLoader.hide();
        }, 1000);
      }

      this.mesaAsignada = nuevaMesaAsignada;
      this.mostrarBotonEscanearMesa = !!nuevaMesaAsignada;
      this.mesaAsignadaAnterior = nuevaMesaAsignada;

      if (nuevaMesaAsignada) {
        await this.verificarClienteSentado();
        await this.verificarPedidoExistente();
      } else {
        this.clienteSentado = false;
        this.mostrarBotonHacerPedido = false;
        this.mostrarBotonVerEstadoPedido = false;
      }
    } catch (error) {
      return;
    }
  }

  async verificarClienteSentado() {
    try {
      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('clientes')
        .select('sentado')
        .eq('correo', this.usuario.email)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

      const sentado = clienteEnLista?.sentado || false;

      this.clienteSentado = sentado;
    } catch (error) {
      return;
    }
  }

   async verificarPedidoExistente() {
    if (!this.mesaAsignada || this.perfilUsuario !== 'cliente') {
      this.mostrarBotonVerEstadoPedido = false;
      this.pedidoActualCliente = null;
      return;
    }
    const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .select('*')
      .eq('mesa', this.mesaAsignada)
      .order('id', { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      this.mostrarBotonVerEstadoPedido = true;
      this.pedidoActualCliente = data[0];
      this.mostrarBotonHacerPedido = false;
    } else {
      this.mostrarBotonVerEstadoPedido = false;
      this.pedidoActualCliente = null;
      this.mostrarBotonHacerPedido = this.clienteSentado;
    }

    await this.cargarClienteInfo();
  }

  async verificarUsuario() {
    try {
      const { data: user } = await this.authService.getCurrentUser();
      if (!user?.user?.email) {
        this.router.navigate(['/login']);
        return;
      }

      const email = user.user.email;
      
      // Verificar si es supervisor
      const { data: supervisor } = await this.supabase.supabase
        .from('supervisores')
        .select('nombre, apellido')
        .eq('correo', email)
        .single();

      if (supervisor) {
        this.esAdmin = true;
        this.nombreUsuario = `${supervisor.nombre} ${supervisor.apellido}`;
        this.authService.setPerfil('supervisor');
        return;
      }

      // Verificar si es empleado
      const { data: empleado } = await this.supabase.supabase
        .from('empleados')
        .select('nombre, apellido, perfil')
        .eq('correo', email)
        .single();

      if (empleado) {
        this.nombreUsuario = `${empleado.nombre} ${empleado.apellido}`;
        if (empleado.perfil === 'maitre') {
          this.esMaitre = true;
        } else if (empleado.perfil === 'cocinero') {
          this.esCocinero = true;
        } else if (empleado.perfil === 'bartender') {
          this.esBartender = true;
        }
        else if (empleado.perfil === 'mozo') {
          this.esMozo = true;
        }
        this.authService.setPerfil(empleado.perfil);
        return;
      }

      // Verificar si es cliente
      const { data: cliente } = await this.supabase.supabase
        .from('clientes')
        .select('nombre, apellido, validado')
        .eq('correo', email)
        .single();

      if (cliente) {
        if (cliente.validado === null || cliente.validado === false) {
          await this.authService.signOut();
          this.router.navigate(['/login']);
          return;
        }
        this.nombreUsuario = `${cliente.nombre} ${cliente.apellido}`;
        this.authService.setPerfil('cliente');
        return;
      }

      // Si no se encontró ningún perfil
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al verificar usuario:', error);
      this.router.navigate(['/login']);
    }
  }

  async obtenerNombreUsuario(email: string) {
    try {
      if (this.esAdmin) {
        const { data: supervisor } = await this.authService['sb'].supabase
          .from('supervisores')
          .select('nombre, apellido')
          .eq('correo', email)
          .single();
        
        if (supervisor) {
          this.nombreUsuario = `${supervisor.nombre} ${supervisor.apellido}`;
        }
      } else if (this.esMaitre || this.esCocinero || this.esBartender) {
        const { data: empleado } = await this.authService['sb'].supabase
          .from('empleados')
          .select('nombre, apellido')
          .eq('correo', email)
          .single();
        
        if (empleado) {
          this.nombreUsuario = `${empleado.nombre} ${empleado.apellido}`;
        }
      }
    } catch (error) {
      console.error('Error al obtener nombre del usuario:', error);
    }
  }

  irARegistro(ruta?: string) {
    this.router.navigate([ruta]);
  }

  irARegistroBebidas(tipoRegistro?: string) {
    if (tipoRegistro) {
      this.router.navigate(['/bebidas']);
    } else {
      this.router.navigate(['/bebidas']);
    }
  }

  async cerrarSesion() {
    await this.authService.signOut();
    this.router.navigate(['/bienvenida']);
  }

   async escanearQR() {
    this.qrEnProceso = true;
    this.customLoader.show();
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.procesarCodigoEscaneado(codigoEscaneado);
      } else {
        //await this.mostrarNotificacion('No se detectó ningún código QR.', 'info');
        await this.swal.showTemporaryAlert('Info', 'No se detectó ningún código QR.', 'info');
      }
    } catch (error) {
      //await this.mostrarNotificacion('Error al escanear el código QR.', 'error');
      await this.swal.showTemporaryAlert('Error', 'Error al escanear el código QR.', 'error');
    } finally {
        // this.loadingService.hide();
        this.customLoader.hide();
      this.qrEnProceso = false;
    }
  }

  async escanearQRParaMenu() {
    this.customLoader.show();
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        if (codigoEscaneado === 'irAMenu') {
          //this.abrirModalProductosMesa();
          await this.router.navigate(['/menu']);
        } else {
          //await this.mostrarNotificacion('El QR no es válido para hacer el pedido.', 'error');
          await this.swal.showTemporaryAlert('Error','El QR no es válido para hacer el pedido.', 'error');

        }
      } else {
        //
        await this.swal.showTemporaryAlert('Error','No se detectó ningún código QR.', 'error');
      }
    } catch (error) {
      //await this.mostrarNotificacion('Error al escanear el QR.', 'error');
      await this.swal.showTemporaryAlert('Error', 'Error al escanear el QR.', 'error');
    } finally {
      this.customLoader.hide();
    }
  }

  async procesarCodigoEscaneado(codigo: string) {
    const codigoEsperado = 'b71c9d3a4e1f5a62c3340b87df0e8a129cab6e3d';
    
    if (codigo === codigoEsperado) {
      await this.agregarAListaEspera();
    } else {
      //await this.mostrarNotificacion('Código inválido', 'error');
      await this.swal.showTemporaryAlert('Error', 'Código inválido', 'error');
    }
  }


  async agregarAListaEspera() {
    try {
      if (!this.usuario) {
        //await this.mostrarNotificacion('No se pudo obtener la información del usuario.', 'error');
        await this.swal.showTemporaryAlert('Error', 'No se pudo obtener la información del usuario.', 'error');
        return;
      }

      const { data: clienteEnLista } = await this.supabase.supabase
        .from('lista_espera')
        .select('*')
        .eq('correo', this.usuario.email)
        .single();

      if (clienteEnLista) {
        //await this.mostrarNotificacion('Ya en Lista', 'exito');
        await this.swal.showTemporaryAlert('Info', 'Ya te encuentras en la lista de espera.', 'info');
        return;
      }

      const { data: cliente, error: errorCliente } = await this.supabase.supabase
        .from('clientes')
        .select('nombre, apellido, correo')
        .eq('correo', this.usuario.email)
        .single();

      if (errorCliente || !cliente) {
        //await this.mostrarNotificacion('No se pudo obtener la información del cliente.', 'error');
        await this.swal.showTemporaryAlert('Error', 'No se pudo obtener la información del cliente.', 'error');
        return;
      }

      const ahora = new Date();
      const fechaFormateada = ahora.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      });

      const [fecha, hora] = fechaFormateada.replace(',', '').split(' ');
      const [dia, mes, anio] = fecha.split('/');
      const fechaFinal = `${anio}-${mes}-${dia} ${hora}:00`;

      const { error: errorInsert } = await this.supabase.supabase
        .from('lista_espera')
        .insert([{
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          correo: cliente.correo,
          fecha_ingreso: fechaFinal
        }]);

      if (errorInsert) {
        //await this.mostrarNotificacion('No se pudo agregar a la lista de espera: ' + errorInsert.message, 'error');
        await this.swal.showTemporaryAlert('Error', 'No se pudo agregar a la lista de espera: ' + errorInsert.message, 'error');
        return;
      }

      try {
        await this.pushNotificationService.notificarMaitreNuevoCliente(
          cliente.nombre,
          cliente.apellido
        );
      } catch (error) {
      }

      //await this.mostrarNotificacion('Has sido agregado exitosamente a la lista de espera.', 'exito');
      await this.swal.showTemporaryAlert('¡Éxito!', 'Has sido agregado exitosamente a la lista de espera.', 'success');
      
    } catch (error) {

      //await this.mostrarNotificacion('Error inesperado al agregar a la lista de espera.', 'error');
      await this.swal.showTemporaryAlert('Error', 'Error inesperado al agregar a la lista de espera.', 'error');
    }
  }

   async escanearMesaAsignada() {
    //this.loadingService.show();
    this.customLoader.show();

    try {
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        await this.validarMesaEscaneada(codigoEscaneado);
      } else {
        //this.mostrarMensajeError('QR inválido, escanea el QR de tu mesa');
        this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');
      }
    } catch (error) {
    //  this.mostrarMensajeError('QR inválido, escanea el QR de tu mesa');
        this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');

    } finally {
      //this.loadingService.hide();
      this.customLoader.hide();
    }
  }

  async validarMesaEscaneada(codigoEscaneado: string) {
    
    let qrValido = false;
    try {
      const datosQR = JSON.parse(codigoEscaneado);

      const numeroMesaQR = String(datosQR.numeroMesa);
      const mesaAsignadaStr = String(this.mesaAsignada);
      
      if (numeroMesaQR === mesaAsignadaStr) {
        qrValido = true;
      }
    } catch (e) {
      const patronEsperado = `numeroMesa: ${this.mesaAsignada}`;
      
      if (codigoEscaneado.includes(patronEsperado)) {
        qrValido = true;
      }
    }
    
    if (!qrValido) {
      this.customLoader.hide();
      
      this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');
      //this.mostrarMensajeError('QR inválido, escanea el QR de tu mesa');
      

    } else {
      await this.marcarClienteSentado();
    }
  }


  async marcarClienteSentado() {
    try {
      const { error } = await this.supabase.supabase
        .from('clientes')
        .update({
          sentado: true
        })
        .eq('correo', this.usuario.email);

      if (error) {
        //this.mostrarNotificacion('No se pudo marcar el cliente como sentado.', 'error');
        this.swal.showTemporaryAlert('Error', 'No se pudo marcar el cliente como sentado.', 'error');
      } else {

        //this.mostrarNotificacion('¡Bienvenido!', 'exito');
        this.swal.showTemporaryAlert('¡Bienvenido!', '¡Ya puedes hacer tu pedido!', 'success');
        this.clienteSentado = true;
        this.mostrarBotonHacerPedido = false;
        await this.verificarPedidoExistente();
      }
    } catch (error) {
      //this.mostrarNotificacion('Error al marcar el cliente como sentado.', 'error');
      this.swal.showTemporaryAlert('Error', 'Error al marcar el cliente como sentado.', 'error');
    }
  }

  irAAprobacionClientes(){
    this.router.navigate(['/aprobacion-clientes'])
  }

  irAMaitreMesas(){
    this.router.navigate(['/maitre'])
  }

  irAListaEspera()
  {
    this.router.navigate(['/lista-espera']);
  }
  
  irAJuegos()
  {
    this.router.navigate(['/atrapa-el-pollo']);
  }

  irAEncuestas()
  {
    this.router.navigate(['/encuestas']);
  }
  //**JUEGOS */

  manejarResultadoDescuento(resultado: ResultadoJuego) {
  // 1. Mostrar mensaje de descuento
  this.feedback.showToast('exito', `¡Ganaste un ${resultado.porcentaje}% de descuento!`);

  // 2. Llamar al servicio para actualizar Supabase y marcar descuento_ganado = true
  this.juegosService.registrarResultadoDescuento(this.userData.id, resultado.porcentaje, 'atrapa_pollo');

  // 3. Redirigir o cambiar la vista para desbloquear los otros juegos.
  }


}

