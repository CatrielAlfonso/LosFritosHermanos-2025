import { Component, computed, OnInit, OnDestroy } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
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
import { NotificationsService } from '../servicios/notifications.service';
import { ReservasService } from '../servicios/reservas.service';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, ViewWillEnter {
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
  clienteEsperandoPedido: boolean = false;

  qrEnProceso: boolean = false;
  esClienteAnonimo: boolean = false;
  clienteAnonimo: any = null;
  mostrarMensajeListaEspera: boolean = true; // Control para mostrar/ocultar el mensaje
  qrMesaEscaneado: boolean = false; // Se activa cuando el cliente escanea el QR de su mesa
  
  // Variables para Delivery
  qrDeliveryEscaneado: boolean = false; // Se activa cuando el cliente escanea el QR DELIVERY
  tienePedidoDeliveryConfirmado: boolean = false; // Indica si tiene un pedido de delivery confirmado

  mesaSeleccionada='12';

    mostrarModalConsultaMozo: boolean = false;
  consultaMozo: string = '';
  mostrarErrorConsultaMozo: boolean = false;
  animandoSalidaModalConsultaMozo: boolean = false;
  mostrarModalConsultasMozo: boolean = false;
  consultasMozo: any[] = [];
  cargandoConsultasMozo: boolean = false;
  respuestaMozoPorId: { [id: string]: string } = {};
  errorRespuestaMozoPorId: { [id: string]: string } = {};
  mostrarRespuestaId: number | null = null;
  mostrarModalConsultasCliente: boolean = false;
  consultasCliente: any[] = [];
  cargandoConsultasCliente: boolean = false;
  consultaClienteTexto: string = '';
  errorConsultaCliente: string = '';
  intervaloConsultasMozo: any = null;
  intervaloVerificarMesa: any = null;


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
    private pushNotificationService: PushNotificationService,
    private notificationsService: NotificationsService,
    private reservasService: ReservasService,
    //private cdr: ChangeDetectorRef
  ) {
      
  }

  async ngOnInit() 
  {
      this.authService.perfilUsuario$.subscribe(perfil => {
      console.log('Perfil usuario en HomePage:', perfil);
      this.perfilUsuario = perfil ?? '';
      this.esAdmin = perfil === 'supervisor';
      this.esMaitre = perfil === 'maitre';
      this.esCocinero = perfil === 'cocinero';
      this.esBartender = perfil === 'bartender';  
      this.esMozo = perfil === 'mozo';
      
      // Redirigir repartidores a su panel
      if (perfil === 'repartidor') {
        this.router.navigate(['/panel-repartidor']);
      }
    });

    // El QR Delivery debe escanearse cada vez que se inicia la app
    this.qrDeliveryEscaneado = false;
    
    await this.loadUserData(); // Esperamos a que cargue el usuario
    
    // Iniciar verificación periódica de mesa asignada para clientes
    this.iniciarVerificacionMesaAsignada();
    
    // Verificar pedidos de delivery inmediatamente después de cargar usuario
    await this.verificarPedidoDeliveryConfirmado();

    console.log('Perfil usuario en HomePage:', this.perfilUsuario);

    //   const user = this.authService.usuarioActual;
    //   if (user) {
    //    // o traer el nombre desde DB

    //   // Levanto los flags desde el servicio
    //   this.perfilUsuario = this.authService.perfilUsuario;
    //   this.esAdmin = this.authService.esAdmin;
    //   this.esMaitre = this.authService.esMaitre;
    //   this.esCocinero = this.authService.perfilUsuario === 'cocinero';
    //   this.esBartender = this.authService.perfilUsuario === 'bartender';
    //   this.esMozo = this.authService.perfilUsuario === 'mozo';
    // }
    // this.authService.perfilUsuario$.subscribe(perfil => {
    //   this.perfilUsuario = perfil ?? '';
    //   this.esAdmin = perfil === 'supervisor';
    //   this.esMaitre = perfil === 'maitre';
    //   this.esCocinero = perfil === 'cocinero';
    //   this.esBartender = perfil === 'bartender';  
    //   this.esMozo = perfil === 'mozo';
    // });
    // console.log('Perfil usuario en HomePage:', this.perfilUsuario);

    //   this.loadUserData();
    //   console.log('se ejecuta el on init')
    }

  /**
   * Se ejecuta cada vez que la vista está por mostrarse
   * Recarga la info del cliente para reflejar cambios (ej: encuesta completada, mesa asignada)
   */
  async ionViewWillEnter() {
    console.log('🔄 [ionViewWillEnter] Recargando estado del cliente...');
    console.log('🔄 [ionViewWillEnter] esClienteAnonimo:', this.esClienteAnonimo);
    console.log('🔄 [ionViewWillEnter] perfilUsuario:', this.perfilUsuario);
    
    // Recargar info para clientes anónimos
    if (this.esClienteAnonimo && this.clienteAnonimo) {
      console.log('🔄 [ionViewWillEnter] Verificando estado cliente anónimo...');
      await this.verificarEstadoClienteAnonimo();
      await this.verificarPedidoDeliveryConfirmado();
    }
    // Recargar info para clientes autenticados
    else if (this.perfilUsuario === 'cliente' && this.usuario) {
      console.log('🔄 [ionViewWillEnter] Verificando mesa para cliente autenticado...');
      await this.cargarClienteInfo();
      await this.verificarMesaAsignada();
      await this.verificarPedidoDeliveryConfirmado();
    }
  }

   async loadUserData() {
    this.isLoading = true;
    
    // PRIMERO: Verificar si hay un usuario autenticado
    const user = await this.userService.loadCurrentUser();
    
    // Si hay usuario autenticado, limpiar cliente anónimo del localStorage y usar el usuario autenticado
    if (user) {
      // Limpiar cliente anónimo si existe
      localStorage.removeItem('clienteAnonimo');
      this.esClienteAnonimo = false;
      this.clienteAnonimo = null;
      
    this.tipoUsuario = user?.tipo || null;
    this.userData = user || null;
      this.nombreUsuario = user?.datos.nombre;
      this.perfilUsuario = user?.tipo || null;
      console.log('user: ', user);
      console.log('userData: ', this.userData);
      
      // Si es cliente autenticado, cargar this.usuario y verificar mesa asignada
      if (this.perfilUsuario === 'cliente') {
        // Cargar this.usuario desde authService para que verificarMesaAsignada() funcione
        const { data: authData } = await this.authService.getCurrentUser();
        if (authData?.user) {
          this.usuario = authData.user;
          console.log('👤 [loadUserData] Usuario autenticado cargado:', this.usuario.email);
          // Verificar si tiene mesa asignada
          await this.verificarMesaAsignada();
          await this.cargarClienteInfo();
          // Verificar pedidos de delivery inmediatamente
          await this.verificarPedidoDeliveryConfirmado();
        }
      }
      
      this.isLoading = false;
      return;
    }
    
    // SEGUNDO: Solo si NO hay usuario autenticado, verificar si es cliente anónimo
    const clienteAnonimoStr = localStorage.getItem('clienteAnonimo');
    if (clienteAnonimoStr) {
      try {
        this.clienteAnonimo = JSON.parse(clienteAnonimoStr);
        this.esClienteAnonimo = true;
        this.tipoUsuario = 'cliente';
        this.perfilUsuario = 'cliente';
        this.nombreUsuario = this.clienteAnonimo.nombre;
        this.clienteInfo = this.clienteAnonimo;
        
        // Limpiar flags de empleados para clientes anónimos
        this.esAdmin = false;
        this.esMaitre = false;
        this.esCocinero = false;
        this.esBartender = false;
        this.esMozo = false;
        
        // Verificar si tiene mesa asignada o está en lista de espera
        await this.verificarEstadoClienteAnonimo();
        // Verificar pedidos de delivery inmediatamente
        await this.verificarPedidoDeliveryConfirmado();
        
        this.isLoading = false;
        return;
      } catch (error) {
        console.error('Error al parsear cliente anónimo:', error);
        // Si hay error, limpiar el localStorage corrupto
        localStorage.removeItem('clienteAnonimo');
      }
    }
    
    // Si no hay ni usuario autenticado ni cliente anónimo
    this.tipoUsuario = null;
    this.userData = null;
    this.perfilUsuario = null;
    this.isLoading = false;
  }

   async cargarUsuario() {
    console.log('🔄 [cargarUsuario] Cargando usuario actual');
    try {
      const { data, error } = await this.authService.getCurrentUser();
      console.log('🔄 [cargarUsuario] Data:', data);
      console.log('🔄 [cargarUsuario] Error:', error);
      
      if (error) {
        console.log('❌ [cargarUsuario] Error al obtener usuario, saliendo');
        return;
      }
      
      this.usuario = data?.user;
      console.log('👤 [cargarUsuario] Usuario asignado:', this.usuario);

      if (!this.usuario) {
        console.log('⚠️ [cargarUsuario] No hay usuario, redirigiendo a login');
        this.router.navigateByUrl('/login');
      } else {
        console.log('✅ [cargarUsuario] Usuario existe, perfil:', this.perfilUsuario);
        if (this.perfilUsuario === 'cliente') {
          console.log('👥 [cargarUsuario] Es cliente, verificando mesa y cargando info');
          await this.verificarMesaAsignada();
          await this.cargarClienteInfo();
        }
      }
    } catch (error) {
      console.log('💥 [cargarUsuario] Error inesperado:', error);
      this.router.navigateByUrl('/login');
    }
  }


  private aplicarPerfil() {
  this.perfilUsuario = this.authService.perfilUsuario;
  this.esAdmin = this.perfilUsuario === 'supervisor';
  this.esMaitre = this.perfilUsuario === 'maitre';
  this.esCocinero = this.perfilUsuario === 'cocinero';
  this.esBartender = this.perfilUsuario === 'bartender';
  this.esMozo = this.perfilUsuario === 'mozo';
  
  console.log('🔍 [aplicarPerfil] Perfil aplicado:', this.perfilUsuario);
  
  // Redirigir repartidores a su panel
  if (this.perfilUsuario === 'repartidor') {
    console.log('🚚 [aplicarPerfil] Es repartidor, redirigiendo a panel...');
    this.router.navigate(['/panel-repartidor']);
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

  async verificarEstadoClienteAnonimo() {
    console.log('🔍 [verificarEstadoClienteAnonimo] Iniciando...');
    console.log('🔍 [verificarEstadoClienteAnonimo] clienteAnonimo:', this.clienteAnonimo);
    console.log('🔍 [verificarEstadoClienteAnonimo] esClienteAnonimo:', this.esClienteAnonimo);
    
    if (!this.clienteAnonimo || !this.esClienteAnonimo) {
      console.log('❌ [verificarEstadoClienteAnonimo] No hay cliente anónimo, saliendo');
      return;
    }

    try {
      // Verificar si está en lista de espera
      const correoAnonimo = `anonimo-${this.clienteAnonimo.id}@fritos.com`;
      console.log('🔍 [verificarEstadoClienteAnonimo] Buscando con correo:', correoAnonimo);
      
      const { data: listaEspera, error: errorLista } = await this.supabase.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', correoAnonimo)
        .maybeSingle();

      console.log('🔍 [verificarEstadoClienteAnonimo] Resultado lista_espera:', listaEspera, 'Error:', errorLista);

      if (listaEspera?.mesa_asignada) {
        console.log('✅ [verificarEstadoClienteAnonimo] Mesa asignada encontrada:', listaEspera.mesa_asignada);
        this.mesaAsignada = listaEspera.mesa_asignada;
        this.mostrarBotonEscanearMesa = true;
        this.yaEnListaEspera = false; // Ya tiene mesa, no necesita mostrar mensaje
        this.mostrarMensajeListaEspera = false;
        console.log('✅ [verificarEstadoClienteAnonimo] mostrarBotonEscanearMesa:', this.mostrarBotonEscanearMesa);
        
        // Detener verificación periódica ya que encontró la mesa
        if (this.intervaloVerificarMesa) {
          clearInterval(this.intervaloVerificarMesa);
          this.intervaloVerificarMesa = null;
          console.log('✅ [verificarEstadoClienteAnonimo] Verificación periódica detenida, mesa encontrada');
        }
        await this.verificarClienteSentado();
        if (this.clienteSentado) {
          await this.verificarPedidoExistente();
        }
      } else {
        console.log('⏳ [verificarEstadoClienteAnonimo] No tiene mesa asignada aún');
        // Verificar si está en lista de espera sin mesa
        const { data: enLista } = await this.supabase.supabase
          .from('lista_espera')
          .select('id')
          .eq('correo', correoAnonimo)
          .maybeSingle();
        
        this.yaEnListaEspera = !!enLista;
        console.log('🔍 [verificarEstadoClienteAnonimo] yaEnListaEspera:', this.yaEnListaEspera);
        
        // Si está en lista de espera, mostrar el mensaje inicialmente
        if (this.yaEnListaEspera) {
          this.mostrarMensajeListaEspera = true;
          // Ocultar el mensaje automáticamente después de 5 segundos
          setTimeout(() => {
            this.mostrarMensajeListaEspera = false;
          }, 5000);
        }
      }
    } catch (error) {
      console.error('❌ [verificarEstadoClienteAnonimo] Error:', error);
    }
  }

  ocultarMensajeListaEspera() {
    this.mostrarMensajeListaEspera = false;
  }

  async escanearQRParaVerEncuestas() {
    try {
      this.customLoader.show();
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].rawValue || barcodes[0].displayValue;
        
        // Verificar si es el QR de entrada al local
        if (codigoEscaneado.startsWith('ENTRADA:') || 
            codigoEscaneado.startsWith('RESTAURANT_CHECKIN_') ||
            codigoEscaneado === 'verEncuestas') {
          // Navegar a la pantalla de encuestas en modo visualización
          await this.router.navigate(['/encuestas'], { queryParams: { modo: 'ver' } });
        } else {
          await this.swal.showTemporaryAlert('Error', 'QR inválido. Escaneá el código QR de entrada al local.', 'error');
        }
      } else {
        await this.swal.showTemporaryAlert('Error', 'No se detectó ningún código QR', 'error');
      }
    } catch (error: any) {
      console.error('Error al escanear QR:', error);
      if (!error.message?.includes('cancelled') && !error.message?.includes('cancelado')) {
        await this.swal.showTemporaryAlert('Error', 'Error al escanear el código QR', 'error');
      }
    } finally {
      this.customLoader.hide();
    }
  }

  async procesarQRMesaAnonimo(codigoEscaneado: string) {
    try {
      let datosQR: any = {};
      
      try {
        datosQR = JSON.parse(codigoEscaneado);
      } catch {
        // Si no es JSON, intentar otros formatos
        if (codigoEscaneado.includes('mesa') || codigoEscaneado.includes('MESA')) {
          const match = codigoEscaneado.match(/(\d+)/);
          if (match) {
            datosQR.numeroMesa = match[1];
          }
        } else {
          throw new Error('QR no válido');
        }
      }

      const correoAnonimo = `anonimo-${this.clienteAnonimo.id}@fritos.com`;

      // Si el QR tiene número de mesa, asignar directamente
      if (datosQR.numeroMesa) {
        const numeroMesa = parseInt(datosQR.numeroMesa);
        
        // Verificar si ya está en lista de espera
        const { data: enLista } = await this.supabase.supabase
          .from('lista_espera')
          .select('id')
          .eq('correo', correoAnonimo)
          .maybeSingle();

        if (!enLista) {
          // Agregar a lista de espera
          await this.supabase.supabase.from('lista_espera').insert([
            {
              correo: correoAnonimo,
              nombre: this.clienteAnonimo.nombre,
              fecha_ingreso: new Date(),
              mesa_asignada: numeroMesa
            }
          ]);

          // Notificar al maître
          try {
            await this.pushNotificationService.notificarMaitreNuevoCliente(
              this.clienteAnonimo.nombre,
              ''
            );
          } catch (error) {
            console.error('Error al notificar maître:', error);
          }
        } else {
          // Actualizar mesa asignada
          await this.supabase.supabase
            .from('lista_espera')
            .update({ mesa_asignada: numeroMesa })
            .eq('correo', correoAnonimo);
        }

        this.mesaAsignada = numeroMesa;
        this.mostrarBotonEscanearMesa = true;
        await this.swal.showTemporaryAlert('Éxito', `Mesa ${numeroMesa} asignada. Ahora podés escanear el QR de la mesa para sentarte`, 'success');
        
      } else {
        // Si no tiene mesa, agregar a lista de espera
        const { data: enLista } = await this.supabase.supabase
          .from('lista_espera')
          .select('id')
          .eq('correo', correoAnonimo)
          .maybeSingle();

        if (!enLista) {
          await this.supabase.supabase.from('lista_espera').insert([
            {
              correo: correoAnonimo,
              nombre: this.clienteAnonimo.nombre,
              fecha_ingreso: new Date()
            }
          ]);

          // Notificar al maître
          try {
            await this.pushNotificationService.notificarMaitreNuevoCliente(
              this.clienteAnonimo.nombre,
              ''
            );
          } catch (error) {
            console.error('Error al notificar maître:', error);
          }

          await this.swal.showTemporaryAlert('Éxito', 'Te agregamos a la lista de espera. El maître te asignará una mesa pronto', 'success');
          this.yaEnListaEspera = true;
        } else {
          await this.swal.showTemporaryAlert('Info', 'Ya estás en la lista de espera. El maître te asignará una mesa pronto', 'info');
        }
      }

      await this.verificarEstadoClienteAnonimo();
      
    } catch (error: any) {
      console.error('Error al procesar QR:', error);
      await this.swal.showTemporaryAlert('Error', error.message || 'Error al procesar el código QR', 'error');
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
      // Verificar que this.usuario esté disponible
      if (!this.usuario || !this.usuario.email) {
        console.log('⚠️ [verificarMesaAsignada] this.usuario no está disponible');
        // Intentar cargar desde authService
        const { data: authData } = await this.authService.getCurrentUser();
        if (authData?.user) {
          this.usuario = authData.user;
          console.log('✅ [verificarMesaAsignada] Usuario cargado desde authService:', this.usuario.email);
        } else {
          console.log('❌ [verificarMesaAsignada] No se pudo obtener usuario');
          return;
        }
      }

      console.log('🔍 [verificarMesaAsignada] Verificando mesa para:', this.usuario.email);

      const { data: lista, error: errorLista } = await this.supabase.supabase
        .from('lista_espera')
        .select('*')
        .eq('correo', this.usuario.email);
      
      this.yaEnListaEspera = Array.isArray(lista) && lista.length > 0;
      console.log('📋 [verificarMesaAsignada] Ya en lista de espera:', this.yaEnListaEspera);

      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('lista_espera')
        .select('mesa_asignada')
        .eq('correo', this.usuario.email)
        .not('mesa_asignada', 'is', null)
        .single();

      console.log('🔍 [verificarMesaAsignada] Cliente en lista:', clienteEnLista);
      console.log('🔍 [verificarMesaAsignada] Error (si existe):', error);

      if (error && error.code !== 'PGRST116') {
        console.log('⚠️ [verificarMesaAsignada] Error al buscar cliente:', error);
        return;
      }

      const nuevaMesaAsignada = clienteEnLista?.mesa_asignada || null;
      console.log('🪑 [verificarMesaAsignada] Mesa asignada encontrada:', nuevaMesaAsignada);

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

      console.log('🔘 [verificarMesaAsignada] mostrarBotonEscanearMesa:', this.mostrarBotonEscanearMesa);

      if (nuevaMesaAsignada) {
        // Detener la verificación periódica ya que encontró la mesa
        if (this.intervaloVerificarMesa) {
          clearInterval(this.intervaloVerificarMesa);
          this.intervaloVerificarMesa = null;
          console.log('✅ [verificarMesaAsignada] Verificación periódica detenida, mesa encontrada');
        }
        await this.verificarClienteSentado();
        await this.verificarPedidoExistente();
      } else {
        // Si no hay mesa asignada, asegurarse de que la verificación periódica esté activa
        this.iniciarVerificacionMesaAsignada();
        this.clienteSentado = false;
        this.mostrarBotonHacerPedido = false;
        this.mostrarBotonVerEstadoPedido = false;
      }
    } catch (error) {
      console.error('💥 [verificarMesaAsignada] Error inesperado:', error);
      return;
    }
  }

  iniciarVerificacionMesaAsignada() {
    // Limpiar intervalo anterior si existe
    if (this.intervaloVerificarMesa) {
      clearInterval(this.intervaloVerificarMesa);
      this.intervaloVerificarMesa = null;
    }

    // Solo verificar periódicamente si es cliente (autenticado o anónimo) y no tiene mesa asignada aún
    const esCliente = this.perfilUsuario === 'cliente' || this.tipoUsuario === 'cliente';
    const debeVerificar = esCliente && !this.mesaAsignada && !this.clienteSentado;
    
    if (debeVerificar) {
      console.log('🔄 [iniciarVerificacionMesaAsignada] Iniciando verificación periódica de mesa');
      this.intervaloVerificarMesa = setInterval(async () => {
        const sigueSiendoCliente = this.perfilUsuario === 'cliente' || this.tipoUsuario === 'cliente';
        const sigueSinMesa = !this.mesaAsignada && !this.clienteSentado;
        
        // Solo verificar si sigue siendo cliente y no tiene mesa asignada
        if (sigueSiendoCliente && sigueSinMesa) {
          // Verificar mesa según tipo de cliente
          if (this.esClienteAnonimo) {
            await this.verificarEstadoClienteAnonimo();
          } else {
            await this.verificarMesaAsignada();
          }
        } else {
          // Si ya tiene mesa o está sentado, detener la verificación
          if (this.intervaloVerificarMesa) {
            clearInterval(this.intervaloVerificarMesa);
            this.intervaloVerificarMesa = null;
            console.log('🛑 [iniciarVerificacionMesaAsignada] Verificación periódica detenida');
          }
        }
      }, 3000); // Verificar cada 3 segundos
    }
  }

  async verificarClienteSentado() {
    try {
      let sentado = false;

      if (this.esClienteAnonimo && this.clienteAnonimo) {
        // Para cliente anónimo, buscar por ID
        const { data: clienteEnLista, error } = await this.supabase.supabase
          .from('clientes')
          .select('sentado')
          .eq('id', this.clienteAnonimo.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          return;
        }

        sentado = clienteEnLista?.sentado || false;
      } else if (this.usuario?.email) {
        // Para cliente registrado, buscar por correo
      const { data: clienteEnLista, error } = await this.supabase.supabase
        .from('clientes')
        .select('sentado')
        .eq('correo', this.usuario.email)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

        sentado = clienteEnLista?.sentado || false;
      }

      this.clienteSentado = sentado;
      if (sentado) {
        this.mostrarBotonHacerPedido = true;
      }
    } catch (error) {
      return;
    }
  }

   async verificarPedidoExistente() {
    // También permitir para clientes anónimos
    const esCliente = this.perfilUsuario === 'cliente' || this.esClienteAnonimo;
    if (!this.mesaAsignada || !esCliente) {
      this.mostrarBotonVerEstadoPedido = false;
      this.pedidoActualCliente = null;
      return;
    }
    
    const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .select('*')
      .eq('mesa', String(this.mesaAsignada))
      .order('id', { ascending: false })
      .limit(1);
    
    if (!error && data && data.length > 0) {
      const pedido = data[0];
      console.log('Pedido existente encontrado para la mesa:', this.mesaAsignada);
      console.log('Datos del pedido:', pedido);
      
      // Mostrar botón de estado si el pedido existe (pendiente o confirmado)
      this.mostrarBotonVerEstadoPedido = true;
      this.pedidoActualCliente = pedido;
      
      // Solo ocultar botón de hacer pedido si el pedido está pendiente o en preparación
      // Si está entregado o finalizado, permitir hacer nuevo pedido
      if (pedido.estado === 'pendiente' || pedido.estado === 'en preparacion') {
        this.mostrarBotonHacerPedido = false;
      } else {                                                                                   
        this.mostrarBotonHacerPedido = this.clienteSentado;
      }
    } else {
      this.mostrarBotonVerEstadoPedido = false;
      this.pedidoActualCliente = null;
      this.mostrarBotonHacerPedido = this.clienteSentado;
    }

    await this.cargarClienteInfo();
  }

  async verificarUsuario() {
    console.log('🔍 [verificarUsuario] Iniciando verificación de usuario');
    try {
      const { data: user } = await this.authService.getCurrentUser();
      console.log('🔍 [verificarUsuario] User obtenido:', user);
      
      if (!user?.user?.email) {
        console.log('❌ [verificarUsuario] No hay email, redirigiendo a login');
        this.router.navigate(['/login']);
        return;
      }

      const email = user.user.email;
      console.log('📧 [verificarUsuario] Email del usuario:', email);
      
      // IMPORTANTE: Asignar this.usuario aquí
      this.usuario = user.user;
      console.log('👤 [verificarUsuario] this.usuario asignado:', this.usuario);
      
      // Verificar si es supervisor
      const { data: supervisor } = await this.supabase.supabase
        .from('supervisores')
        .select('nombre, apellido')
        .eq('correo', email)
        .single();

      if (supervisor) {
        console.log('👔 [verificarUsuario] Es SUPERVISOR');
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
        console.log('👨‍💼 [verificarUsuario] Es EMPLEADO, perfil:', empleado.perfil);
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

      console.log('👥 [verificarUsuario] Datos del cliente:', cliente);

      if (cliente) {
        if (cliente.validado === null || cliente.validado === false) {
          console.log('⚠️ [verificarUsuario] Cliente no validado, cerrando sesión');
          await this.authService.signOut();
          this.router.navigate(['/login']);
          return;
        }
        console.log('✅ [verificarUsuario] Es CLIENTE validado');
        this.nombreUsuario = `${cliente.nombre} ${cliente.apellido}`;
        this.authService.setPerfil('cliente');
        return;
      }

      // Si no se encontró ningún perfil
      console.log('❌ [verificarUsuario] No se encontró perfil, cerrando sesión');
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('💥 [verificarUsuario] Error al verificar usuario:', error);
      this.router.navigate(['/login']);
    }
  }

  async obtenerNombreUsuario(email: string) 
  {
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


  // cerrarSesion()
  // {
  //   this.authService.signOut();
  //   this.router.navigate(['/login']);
  // }

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
    this.customLoader.show();
    await this.authService.signOut();
    
    // Limpiar cliente anónimo del localStorage al cerrar sesión
    localStorage.removeItem('clienteAnonimo');
    this.esClienteAnonimo = false;
    this.clienteAnonimo = null;
    
    this.customLoader.hide();
    this.nombreUsuario = '';
    this.usuario = null;
    this.router.navigate(['/login']);
    this.feedback.showToast('exito', 'Has cerrado sesión correctamente.');
  }

   async escanearQR() {
    console.log('📷 [escanearQR] INICIANDO escaneo QR');
    this.qrEnProceso = true;
    this.customLoader.show();
    try {
      const { barcodes } = await BarcodeScanner.scan();
      console.log('📷 [escanearQR] Barcodes escaneados:', barcodes);
      console.log('📷 [escanearQR] Cantidad de barcodes:', barcodes.length);
      
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].rawValue;
        console.log('📷 [escanearQR] Código escaneado (rawValue):', codigoEscaneado);
        console.log('📷 [escanearQR] displayValue:', barcodes[0].displayValue);
        console.log('📷 [escanearQR] Llamando a procesarCodigoEscaneado...');
        await this.procesarCodigoEscaneado(codigoEscaneado);
      } else {
        console.log('⚠️ [escanearQR] No se detectó ningún código QR');
        await this.swal.showTemporaryAlert('Info', 'No se detectó ningún código QR.', 'info');
      }
    } catch (error) {
      console.log('❌ [escanearQR] Error al escanear:', error);
      await this.swal.showTemporaryAlert('Error', 'Error al escanear el código QR.', 'error');
    } finally {
        // this.loadingService.hide();
        this.customLoader.hide();
      this.qrEnProceso = false;
      console.log('✅ [escanearQR] Proceso de escaneo finalizado');
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
    console.log('🔐 [procesarCodigoEscaneado] Código recibido:', codigo);
    const codigoEsperado = 'b71c9d3a4e1f5a62c3340b87df0e8a129cab6e3d';
    
    console.log('🔐 [procesarCodigoEscaneado] ¿Es código esperado?:', codigo === codigoEsperado);
    console.log('🔐 [procesarCodigoEscaneado] ¿Empieza con ENTRADA:?:', codigo.startsWith('ENTRADA:'));
    
    // Aceptar tanto el código legacy como el nuevo formato ENTRADA:
    if (codigo === codigoEsperado || codigo.startsWith('ENTRADA:')) {
      console.log('✅ [procesarCodigoEscaneado] Código válido, llamando a agregarAListaEspera');
      await this.agregarAListaEspera();
    } else {
      console.log('❌ [procesarCodigoEscaneado] Código inválido');
      await this.swal.showTemporaryAlert('Error', 'Código inválido', 'error');
    }
  }

   abrirConsultaMozo() {
    this.mostrarModalConsultaMozo = true;
    this.consultaMozo = '';
    this.mostrarErrorConsultaMozo = false;
  }

  cerrarConsultaMozo(animar: boolean = false) {
    if (animar) {
      this.animandoSalidaModalConsultaMozo = true;
      setTimeout(() => {
        this.mostrarModalConsultaMozo = false;
        this.animandoSalidaModalConsultaMozo = false;
        this.consultaMozo = '';
        this.mostrarErrorConsultaMozo = false;
      }, 250);
    } else {
      this.mostrarModalConsultaMozo = false;
      this.animandoSalidaModalConsultaMozo = false;
      this.consultaMozo = '';
      this.mostrarErrorConsultaMozo = false;
    }
  }

  async confirmarConsultaMozo() {
    if (!this.consultaMozo.trim() || this.consultaMozo.trim().length < 10) {
      this.mostrarErrorConsultaMozo = true;
      return;
    }
    this.mostrarErrorConsultaMozo = false;
    try {
      const ahora = new Date();
      const fechaFormateada = ahora.toLocaleString('es-AR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Argentina/Buenos_Aires'
      });
      const [fecha, hora] = fechaFormateada.replace(',', '').split(' ');
      const [dia, mes, anio] = fecha.split('/');
      const horaFinal = `${anio}-${mes}-${dia} ${hora}`;
      const mesa = this.mesaAsignada ? String(this.mesaAsignada) : '';
      const { error } = await this.supabase.supabase
        .from('consultas_a_mozo')
        .insert([
          {
            consulta: this.consultaMozo.trim(),
            hora: horaFinal,
            mesa: mesa
          }
        ]);
      if (error) {
        //this.mostrarNotificacion('No se pudo enviar la consulta.', 'error');
        //await this.swal.showTemporaryAlert('Error', 'No se pudo enviar la consulta.', 'error');
        this.feedback.showToast('error', 'No se pudo enviar la consulta.');
      } else {
        this.feedback.showToast('exito', 'Su consulta fue enviada al mozo.');
        //this.mostrarNotificacion('Su consulta fue enviada al mozo.', 'exito');
        this.cerrarConsultaMozo(true);
      }
    } catch (e) {
      //this.mostrarNotificacion('No se pudo enviar la consulta.', 'error');
      this.feedback.showToast('error', 'No se pudo enviar la consulta.');
    }
  }

  abrirModalConsultasMozo() {
    this.mostrarModalConsultasMozo = true;
    this.cargarConsultasMozo();
    if (this.intervaloConsultasMozo) {
      clearInterval(this.intervaloConsultasMozo);
    }
    this.intervaloConsultasMozo = setInterval(() => this.cargarConsultasMozo(true), 5000);
  }

  cerrarModalConsultasMozo() {
    this.mostrarModalConsultasMozo = false;
    this.respuestaMozoPorId = {};
    this.errorRespuestaMozoPorId = {};
    if (this.intervaloConsultasMozo) {
      clearInterval(this.intervaloConsultasMozo);
      this.intervaloConsultasMozo = null;
    }
  }

  async cargarConsultasMozo(polling: boolean = false) {
    let mostrarLoading = !polling;
    let prevIds = this.consultasMozo?.map(c => c.id).join(',') || '';
    const { data, error } = await this.supabase.supabase
      .from('consultas_a_mozo')
      .select('*')
      .order('hora', { ascending: false });
    if (!error) {
      const newIds = data?.map((c: any) => c.id).join(',') || '';
      if (polling && (newIds !== prevIds || data.length !== this.consultasMozo.length)) {
        mostrarLoading = true;
      }
      if (mostrarLoading) this.cargandoConsultasMozo = true;
      this.consultasMozo = data;
      if (mostrarLoading) setTimeout(() => { this.cargandoConsultasMozo = false; }, 600);
    }
    if (!mostrarLoading) this.cargandoConsultasMozo = false;
  }

  async enviarRespuestaMozo(consulta: any) {
    const id = consulta.id;
    const respuesta = this.respuestaMozoPorId[id]?.trim() || '';
    if (!respuesta) {
      this.errorRespuestaMozoPorId[id] = 'Debe ingresar una respuesta.';
      return;
    }
    this.errorRespuestaMozoPorId[id] = '';
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
    const horaFinal = `${anio}-${mes}-${dia} ${hora}`;
    const usuario = this.usuario;
    let nombreMozo = '';
    if (usuario && usuario.email) {
      const { data: mozo } = await this.supabase.supabase
        .from('empleados')
        .select('nombre,apellido')
        .eq('correo', usuario.email)
        .single();
      if (mozo) {
        nombreMozo = mozo.nombre + ' ' + mozo.apellido;
      }
    }
    const { error } = await this.supabase.supabase
      .from('consultas_a_mozo')
      .update({
        respuesta: respuesta,
        hora_respuesta: horaFinal,
        mozo: nombreMozo
      })
      .eq('id', id);
    if (!error) {
      // Enviar notificación push al cliente
      if (consulta.correo && consulta.mesa && nombreMozo) {
        try {
          await this.pushNotificationService.notificarClienteRespuestaMozo(
            consulta.correo,
            nombreMozo,
            parseInt(consulta.mesa)
          );
          console.log('✅ [enviarRespuestaMozo] Notificación enviada al cliente');
        } catch (notifError) {
          console.error('⚠️ [enviarRespuestaMozo] Error al enviar notificación:', notifError);
          // No fallar la operación si falla la notificación
        }
      }
      
      this.cargarConsultasMozo();
      this.respuestaMozoPorId[id] = '';
      this.errorRespuestaMozoPorId[id] = '';
      this.mostrarRespuestaId = null;
    } else {
      this.errorRespuestaMozoPorId[id] = 'Error al enviar la respuesta.';
    }
  }

  formatearHoraConsulta(fecha: string): string {
    if (!fecha) return '';
    try {
      const d = new Date(fecha);
      const dia = d.getDate().toString().padStart(2, '0');
      const mes = (d.getMonth() + 1).toString().padStart(2, '0');
      const hora = d.getHours().toString().padStart(2, '0');
      const minuto = d.getMinutes().toString().padStart(2, '0');
      return `${dia}/${mes} ${hora}:${minuto}`;
    } catch {
      return fecha;
    }
  }

  abrirModalConsultasCliente() {
    this.mostrarModalConsultasCliente = true;
    this.cargarConsultasCliente();
    this.consultaClienteTexto = '';
    this.errorConsultaCliente = '';
  }

  cerrarModalConsultasCliente() {
    this.mostrarModalConsultasCliente = false;
    this.consultaClienteTexto = '';
    this.errorConsultaCliente = '';
  }

  async cargarConsultasCliente() {
    this.cargandoConsultasCliente = true;
    const correo = this.usuario?.email;
    let consultas: any[] = [];
    if (correo) {
      const { data, error } = await this.supabase.supabase
        .from('consultas_a_mozo')
        .select('*')
        .eq('correo', correo)
        .order('hora', { ascending: false });
      if (!error) {
        consultas = data;
      }
    }
    this.consultasCliente = consultas;
    this.cargandoConsultasCliente = false;
  }

  async enviarConsultaCliente() {
    if (!this.consultaClienteTexto.trim() || this.consultaClienteTexto.trim().length < 10) {
      this.errorConsultaCliente = 'La consulta debe tener al menos 10 caracteres.';
      return;
    }
    this.errorConsultaCliente = '';
    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Argentina/Buenos_Aires'
    });
    const [fecha, hora] = fechaFormateada.replace(',', '').split(' ');
    const [dia, mes, anio] = fecha.split('/');
    const horaFinal = `${anio}-${mes}-${dia} ${hora}`;
    const mesa = this.mesaAsignada ? String(this.mesaAsignada) : '';
    const correo = this.usuario?.email || '';
    
    const { error } = await this.supabase.supabase
      .from('consultas_a_mozo')
      .insert([
        {
          consulta: this.consultaClienteTexto.trim(),
          hora: horaFinal,
          mesa: mesa,
          correo: correo
        }
      ]);
    
    if (error) {
      this.errorConsultaCliente = 'No se pudo enviar la consulta.';
    } else {
      try {
        const clienteNombre = this.clienteInfo?.nombre || this.usuario?.email?.split('@')[0] || 'Cliente';
        const clienteApellido = this.clienteInfo?.apellido || '';
        
        await this.pushNotificationService.notificarMozosConsultaCliente(
          clienteNombre,
          clienteApellido,
          mesa,
          this.consultaClienteTexto.trim()
        );
      } catch (error) {
      }
      
      this.consultaClienteTexto = '';
      this.cargarConsultasCliente();
    }
  }



  async agregarAListaEspera() {
    console.log('🔍 [agregarAListaEspera] INICIANDO método');
    console.log('🔍 [agregarAListaEspera] esClienteAnonimo:', this.esClienteAnonimo);
    console.log('🔍 [agregarAListaEspera] clienteAnonimo:', this.clienteAnonimo);
    
    try {
      let cliente: any = null;
      let correo: string = '';
      let nombre: string = '';
      let apellido: string | null = null;

      // Verificar si es cliente anónimo (también verificar localStorage por si acaso)
      let esAnonimo = this.esClienteAnonimo && this.clienteAnonimo;
      if (!esAnonimo) {
        const clienteAnonimoStr = localStorage.getItem('clienteAnonimo');
        if (clienteAnonimoStr) {
          try {
            this.clienteAnonimo = JSON.parse(clienteAnonimoStr);
            this.esClienteAnonimo = true;
            esAnonimo = true;
            console.log('🔍 [agregarAListaEspera] Cliente anónimo recuperado de localStorage');
          } catch (e) {
            console.log('🔍 [agregarAListaEspera] Error al parsear clienteAnonimo de localStorage');
          }
        }
      }

      if (esAnonimo) {
        console.log('👤 [agregarAListaEspera] Cliente anónimo detectado');
        cliente = this.clienteAnonimo;
        correo = `anonimo-${cliente.id}@fritos.com`;
        nombre = cliente.nombre;
        apellido = null; // Clientes anónimos no tienen apellido
      } else {
        // Obtener usuario autenticado si no está en this.usuario
        let usuarioActual = this.usuario;
        if (!usuarioActual || !usuarioActual.email) {
          console.log('🔍 [agregarAListaEspera] Usuario no disponible en this.usuario, obteniendo desde authService...');
          const { data, error } = await this.authService.getCurrentUser();
          if (error || !data?.user) {
            console.log('❌ [agregarAListaEspera] No se pudo obtener usuario autenticado');
            await this.swal.showTemporaryAlert('Error', 'No se pudo obtener la información del usuario.', 'error');
            return;
          }
          usuarioActual = data.user;
          this.usuario = usuarioActual; // Actualizar this.usuario para futuras referencias
        }

        if (!usuarioActual || !usuarioActual.email) {
          console.log('❌ [agregarAListaEspera] No hay usuario autenticado ni cliente anónimo');
          await this.swal.showTemporaryAlert('Error', 'No se pudo obtener la información del usuario.', 'error');
          return;
        }

        console.log('👤 [agregarAListaEspera] Usuario autenticado:', usuarioActual);
        correo = usuarioActual.email;
        
        // Obtener datos del cliente desde tabla clientes
      console.log('🔎 [agregarAListaEspera] Obteniendo datos del cliente desde tabla clientes');
        const { data: clienteData, error: errorCliente } = await this.supabase.supabase
        .from('clientes')
          .select('nombre, apellido, correo, anonimo')
          .eq('correo', correo)
        .single();

        if (errorCliente || !clienteData) {
        console.log('❌ [agregarAListaEspera] No se pudo obtener información del cliente');
        await this.swal.showTemporaryAlert('Error', 'No se pudo obtener la información del cliente.', 'error');
          return;
        }

        // Si es anónimo, usar información del localStorage si está disponible
        if (clienteData.anonimo && this.clienteAnonimo) {
          cliente = this.clienteAnonimo;
          nombre = cliente.nombre;
          apellido = null;
        } else {
          cliente = clienteData;
          nombre = cliente.nombre;
          apellido = cliente.apellido || null;
        }
      }

      console.log('📧 [agregarAListaEspera] Buscando cliente en lista con correo:', correo);
      const { data: clienteEnLista } = await this.supabase.supabase
        .from('lista_espera')
        .select('*')
        .eq('correo', correo)
        .maybeSingle();

      console.log('📋 [agregarAListaEspera] Cliente ya en lista?:', clienteEnLista);
      
      if (clienteEnLista) {
        console.log('⚠️ [agregarAListaEspera] Cliente ya está en la lista de espera');
        await this.swal.showTemporaryAlert('Info', 'Ya te encuentras en la lista de espera.', 'info');
        this.yaEnListaEspera = true;
        this.mostrarMensajeListaEspera = true; // Mostrar el mensaje
        // Ocultar el mensaje automáticamente después de 5 segundos
        setTimeout(() => {
          this.mostrarMensajeListaEspera = false;
        }, 5000);
        return;
      }

      const ahora = new Date();
      console.log('⏰ [agregarAListaEspera] Fecha/hora actual:', ahora);
      
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
      
      console.log('📅 [agregarAListaEspera] Fecha formateada final:', fechaFinal);

      const datosAInsertar: any = {
        nombre: nombre,
        correo: correo,
        fecha_ingreso: fechaFinal
      };

      if (apellido) {
        datosAInsertar.apellido = apellido;
      }
      
      console.log('💾 [agregarAListaEspera] Intentando insertar en lista_espera:', datosAInsertar);

      const { error: errorInsert } = await this.supabase.supabase
        .from('lista_espera')
        .insert([datosAInsertar]);

      console.log('❓ [agregarAListaEspera] Error al insertar?:', errorInsert);

      if (errorInsert) {
        console.log('❌ [agregarAListaEspera] Error al insertar:', errorInsert.message);
        await this.swal.showTemporaryAlert('Error', 'No se pudo agregar a la lista de espera: ' + errorInsert.message, 'error');
        return;
      }

      console.log('✅ [agregarAListaEspera] Cliente agregado exitosamente a la lista de espera');
      this.yaEnListaEspera = true;
      this.mostrarMensajeListaEspera = true; // Mostrar el mensaje cuando se agrega a la lista

      // Ocultar el mensaje automáticamente después de 5 segundos
      setTimeout(() => {
        this.mostrarMensajeListaEspera = false;
      }, 5000);

      try {
        console.log('🔔 [agregarAListaEspera] Enviando notificación al maître');
        await this.pushNotificationService.notificarMaitreNuevoCliente(
          nombre,
          apellido || ''
        );
        console.log('✅ [agregarAListaEspera] Notificación enviada');
      } catch (error) {
        console.log('⚠️ [agregarAListaEspera] Error al enviar notificación:', error);
      }

      await this.swal.showTemporaryAlert('¡Éxito!', 'Has sido agregado exitosamente a la lista de espera.', 'success');
      console.log('🎉 [agregarAListaEspera] Proceso completado exitosamente');
      
    } catch (error) {
      console.log('💥 [agregarAListaEspera] Error inesperado:', error);
      await this.swal.showTemporaryAlert('Error', 'Error inesperado al agregar a la lista de espera.', 'error');
    }
  }

   async escanearMesaAsignada() {
    console.log('🎯 [escanearMesaAsignada] INICIANDO ESCANEO DE MESA');
    console.log('🎯 [escanearMesaAsignada] Estado actual:');
    console.log('   - usuario:', this.usuario);
    console.log('   - usuario.email:', this.usuario?.email);
    console.log('   - esClienteAnonimo:', this.esClienteAnonimo);
    console.log('   - clienteAnonimo:', this.clienteAnonimo);
    console.log('   - mesaAsignada:', this.mesaAsignada);
    console.log('   - clienteSentado:', this.clienteSentado);
    
    this.customLoader.show();

    try {
      const { barcodes } = await BarcodeScanner.scan();
      console.log('🎯 [escanearMesaAsignada] Barcodes escaneados:', barcodes);
      
      if (barcodes.length > 0) {
        const codigoEscaneado = barcodes[0].displayValue;
        console.log('🎯 [escanearMesaAsignada] Código escaneado:', codigoEscaneado);
        await this.validarMesaEscaneada(codigoEscaneado);
      } else {
        console.log('❌ [escanearMesaAsignada] No se detectó ningún código');
        this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');
      }
    } catch (error) {
      console.error('💥 [escanearMesaAsignada] Error al escanear:', error);
        this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');

    } finally {
      this.customLoader.hide();
    }
  }

  async validarMesaEscaneada(codigoEscaneado: string) {
    console.log('🔍 [validarMesaEscaneada] INICIANDO VALIDACIÓN');
    console.log('🔍 [validarMesaEscaneada] Código escaneado RAW:', codigoEscaneado);
    
    let qrValido = false;
    let numeroMesaQR: string | null = null;
    
    try {
      const datosQR = JSON.parse(codigoEscaneado);
      console.log('🔍 [validarMesaEscaneada] Datos QR parseados:', datosQR);
      numeroMesaQR = String(datosQR.numeroMesa);
    } catch (e) {
      console.log('🔍 [validarMesaEscaneada] No es JSON, intentando regex...');
      // Intentar extraer el número de mesa del formato alternativo
      const match = codigoEscaneado.match(/numeroMesa[:\s]+(\d+)/);
      if (match) {
        numeroMesaQR = match[1];
        console.log('🔍 [validarMesaEscaneada] Número extraído por regex:', numeroMesaQR);
      }
    }

    if (!numeroMesaQR) {
      console.log('❌ [validarMesaEscaneada] No se pudo extraer número de mesa del QR');
      this.customLoader.hide();
      this.swal.showTemporaryAlert('Error', 'QR inválido, escanea el QR de tu mesa', 'error');
      return;
    }

    const numeroMesa = parseInt(numeroMesaQR, 10);
    
    console.log('🔍 [validarMesaEscaneada] Validando mesa:', numeroMesa);
    console.log('🔍 [validarMesaEscaneada] mesaAsignada actual:', this.mesaAsignada);
    console.log('🔍 [validarMesaEscaneada] esClienteAnonimo:', this.esClienteAnonimo);
    console.log('🔍 [validarMesaEscaneada] usuario:', this.usuario?.email);

    // Verificar si el cliente tiene una mesa asignada en lista de espera
    if (this.mesaAsignada && numeroMesa === this.mesaAsignada) {
      qrValido = true;
      console.log('✅ [validarMesaEscaneada] QR válido por mesaAsignada');
    } else {
      console.log('🔍 [validarMesaEscaneada] mesaAsignada no coincide o es null, verificando en BD...');
      // Verificar si el cliente tiene una reserva confirmada activa para esta mesa
      if (this.esClienteAnonimo) {
        // Para clientes anónimos, verificar en lista_espera
        const correoAnonimo = `anonimo-${this.clienteAnonimo.id}@fritos.com`;
        console.log('🔍 [validarMesaEscaneada] Buscando cliente anónimo con correo:', correoAnonimo);
        const { data: listaEspera, error: errorLista } = await this.supabase.supabase
          .from('lista_espera')
          .select('mesa_asignada')
          .eq('correo', correoAnonimo)
          .eq('mesa_asignada', numeroMesa)
          .maybeSingle();
        
        console.log('🔍 [validarMesaEscaneada] Resultado lista_espera (anónimo):', listaEspera, 'Error:', errorLista);
        
        if (listaEspera) {
          qrValido = true;
          this.mesaAsignada = numeroMesa;
          console.log('✅ [validarMesaEscaneada] QR válido por lista_espera (anónimo)');
        }
      } else if (this.usuario && this.usuario.email) {
        // Primero verificar en lista_espera para clientes registrados
        console.log('🔍 [validarMesaEscaneada] Buscando cliente registrado con correo:', this.usuario.email);
        
        // Primero veamos TODOS los registros en lista_espera para este usuario
        const { data: todosRegistros, error: errorTodos } = await this.supabase.supabase
          .from('lista_espera')
          .select('*')
          .eq('correo', this.usuario.email);
        console.log('🔍 [validarMesaEscaneada] TODOS los registros en lista_espera para este email:', todosRegistros, 'Error:', errorTodos);
        
        const { data: listaEspera, error: errorLista } = await this.supabase.supabase
          .from('lista_espera')
          .select('mesa_asignada')
          .eq('correo', this.usuario.email)
          .eq('mesa_asignada', numeroMesa)
          .maybeSingle();
        
        console.log('🔍 [validarMesaEscaneada] Resultado lista_espera (registrado):', listaEspera, 'Error:', errorLista);
        
        if (listaEspera) {
          qrValido = true;
          this.mesaAsignada = numeroMesa;
          console.log('✅ [validarMesaEscaneada] QR válido por lista_espera (registrado)');
        } else {
          // Si no está en lista_espera, verificar reservas
          console.log('🔍 [validarMesaEscaneada] No encontrado en lista_espera, verificando reservas...');
          const reservaActiva = await this.reservasService.obtenerReservaConfirmadaActiva(this.usuario.email);
          console.log('🔍 [validarMesaEscaneada] Reserva activa encontrada:', reservaActiva);
          
          if (reservaActiva && reservaActiva.mesa_numero === numeroMesa) {
            qrValido = true;
            // Asignar la mesa al cliente si no estaba asignada
            if (!this.mesaAsignada) {
              this.mesaAsignada = numeroMesa;
            }
            console.log('✅ [validarMesaEscaneada] QR válido por reserva activa');
          }
        }
      } else {
        console.log('❌ [validarMesaEscaneada] No hay usuario ni cliente anónimo definido');
      }
    }
    
    console.log('🔍 [validarMesaEscaneada] qrValido final:', qrValido);
    
    if (!qrValido) {
      console.log('❌ [validarMesaEscaneada] QR NO VÁLIDO - mostrando error');
      this.qrMesaEscaneado = false;
      this.customLoader.hide();
      
      // Mostrar mensaje con la mesa correcta si tiene una asignada
      if (this.mesaAsignada) {
        this.feedback.showToast('error', `❌ Mesa incorrecta. Tu mesa asignada es la N° ${this.mesaAsignada}`);
    } else {
        this.feedback.showToast('error', '❌ No tenés una mesa asignada. Esperá a que el maître te asigne una.');
      }
    } else {
      console.log('✅ [validarMesaEscaneada] QR VÁLIDO - procediendo...');
      // Activar flag de QR escaneado para mostrar botones
      this.qrMesaEscaneado = true;
      console.log('🔍 [validarMesaEscaneada] qrMesaEscaneado activado:', this.qrMesaEscaneado);
      
      // Si el cliente ya está sentado, solo verificar pedido existente y mostrar botones
      if (this.clienteSentado) {
        console.log('🔍 [validarMesaEscaneada] Cliente ya sentado, verificando pedido y mostrando opciones');
        await this.verificarPedidoExistente();
        this.customLoader.hide();
        this.swal.showTemporaryAlert('Éxito', '¡Opciones actualizadas!', 'success');
      } else {
        console.log('🔍 [validarMesaEscaneada] Cliente NO sentado, llamando a marcarClienteSentado...');
        await this.marcarClienteSentado();
      }
    }
  }


  async marcarClienteSentado() {
    console.log('🚀 [marcarClienteSentado] Iniciando...');
    console.log('🚀 [marcarClienteSentado] esClienteAnonimo:', this.esClienteAnonimo);
    console.log('🚀 [marcarClienteSentado] clienteAnonimo:', this.clienteAnonimo);
    console.log('🚀 [marcarClienteSentado] usuario email:', this.usuario?.email);
    console.log('🚀 [marcarClienteSentado] mesaAsignada:', this.mesaAsignada);
    
    try {
      let error: any = null;
      let clienteId: number | null = null;

      // Primero obtener el ID del cliente y marcarlo como sentado
      if (this.esClienteAnonimo && this.clienteAnonimo) {
        // Para cliente anónimo, actualizar por ID
        clienteId = this.clienteAnonimo.id;
        console.log('📝 [marcarClienteSentado] Actualizando cliente anónimo ID:', clienteId);
        const { error: updateError } = await this.supabase.supabase
        .from('clientes')
        .update({
          sentado: true
        })
          .eq('id', clienteId);
        error = updateError;
        if (updateError) console.error('❌ [marcarClienteSentado] Error actualizando cliente anónimo:', updateError);
      } else if (this.usuario?.email) {
        // Para cliente registrado, obtener ID primero y luego actualizar
        console.log('📝 [marcarClienteSentado] Buscando cliente registrado por correo:', this.usuario.email);
        const { data: clienteData, error: clienteError } = await this.supabase.supabase
          .from('clientes')
          .select('id')
          .eq('correo', this.usuario.email)
          .single();
        
        console.log('📝 [marcarClienteSentado] Resultado búsqueda cliente:', clienteData, clienteError);
        
        if (clienteError || !clienteData) {
          error = clienteError;
          console.error('❌ [marcarClienteSentado] Cliente no encontrado en tabla clientes');
        } else {
          clienteId = clienteData.id;
          console.log('📝 [marcarClienteSentado] Cliente encontrado, ID:', clienteId);
          const { error: updateError } = await this.supabase.supabase
            .from('clientes')
            .update({
              sentado: true
            })
            .eq('id', clienteId);
          error = updateError;
          if (updateError) console.error('❌ [marcarClienteSentado] Error actualizando sentado:', updateError);
          else console.log('✅ [marcarClienteSentado] Cliente marcado como sentado');
        }
      } else {
        console.error('❌ [marcarClienteSentado] No hay usuario ni cliente anónimo definido');
      }

      if (error) {
        console.error('❌ [marcarClienteSentado] Error final:', error);
        this.swal.showTemporaryAlert('Error', 'No se pudo marcar el cliente como sentado.', 'error');
        this.customLoader.hide();
        return;
      }

      // Actualizar la tabla mesas: marcar como ocupada y asignar cliente
      if (this.mesaAsignada && clienteId) {
        const { error: errorMesa } = await this.supabase.supabase
          .from('mesas')
          .update({
            ocupada: true,
            clienteAsignadoId: clienteId
          })
          .eq('numero', this.mesaAsignada);

        if (errorMesa) {
          console.error('⚠️ [marcarClienteSentado] Error al actualizar mesa:', errorMesa);
          // No fallar la operación completa si solo falla la actualización de mesa
      } else {
          console.log(`✅ [marcarClienteSentado] Mesa ${this.mesaAsignada} marcada como ocupada y cliente ${clienteId} asignado`);
        }
      }

      this.swal.showTemporaryAlert('¡Bienvenido!', '¡Ya puedes hacer tu pedido!', 'success');
      this.clienteSentado = true;
      this.mostrarBotonHacerPedido = true;
      await this.verificarPedidoExistente();
      console.log('✅ [marcarClienteSentado] Proceso completado exitosamente');
    } catch (error) {
      console.error('💥 [marcarClienteSentado] Error inesperado:', error);
      this.swal.showTemporaryAlert('Error', 'Error al marcar el cliente como sentado.', 'error');
    } finally {
      this.customLoader.hide();
    }
  }

  irAAprobacionClientes(){
    this.router.navigate(['/aprobacion-clientes'])
  }

  irAMaitreMesas(){
    this.router.navigate(['/maitre'])
  }

  irAVerPedidosCocina(){
    this.router.navigate(['/cocina'])
  }

  irAVerPedidosBar(){
    this.router.navigate(['/bar'])
  }

  irAVerEstadoPedido() {
    this.router.navigate(['/pedidos']);
  }

  irAListaEspera()
  {
    this.router.navigate(['/lista-espera']);
  }
  
  irAJuegos()
  {
    this.router.navigate(['/game-selector']);
  }

  irAEncuestas()
  {
    this.router.navigate(['/encuestas']);
  }

  verResultadosEncuestas()
  {
    this.router.navigate(['/encuestas'], { queryParams: { modo: 'ver' } });
  }

  irAPedidosMozo()
  {
    this.router.navigate(['/pedidos-mozo']);
  }

  irAConsultasMozo()
  {
    this.router.navigate(['/consultas-lista']);
  }

  //**JUEGOS */
  // La lógica de descuentos ahora se maneja directamente en cada juego
  // usando juegosService.registrarResultadoJuego()

  // ========== DELIVERY ==========
  
  /**
   * Verifica si el cliente tiene un pedido de delivery confirmado (estado: confirmado o preparando)
   */
  async verificarPedidoDeliveryConfirmado() {
    try {
      let email = '';
      
      if (this.esClienteAnonimo && this.clienteAnonimo) {
        email = `anonimo-${this.clienteAnonimo.id}@fritos.com`;
      } else if (this.usuario?.email) {
        email = this.usuario.email;
      }
      
      if (!email) {
        this.tienePedidoDeliveryConfirmado = false;
        return;
      }
      
      const { data, error } = await this.supabase.supabase
        .from('pedidos_delivery')
        .select('id, estado')
        .eq('cliente_email', email)
        .in('estado', ['confirmado', 'preparando', 'en_camino'])
        .limit(1);
      
      if (!error && data && data.length > 0) {
        this.tienePedidoDeliveryConfirmado = true;
        console.log('📦 [verificarPedidoDeliveryConfirmado] Tiene pedido delivery confirmado:', data[0]);
      } else {
        this.tienePedidoDeliveryConfirmado = false;
        console.log('📦 [verificarPedidoDeliveryConfirmado] No tiene pedidos delivery confirmados');
      }
    } catch (error) {
      console.error('❌ [verificarPedidoDeliveryConfirmado] Error:', error);
      this.tienePedidoDeliveryConfirmado = false;
    }
  }
  
  /**
   * Escanea el QR DELIVERY para acceder a juegos y mis pedidos
   */
  async escanearQRDelivery() {
    console.log('📷 [escanearQRDelivery] Iniciando escaneo...');
    this.customLoader.show();
    
    try {
      const { barcodes } = await BarcodeScanner.scan();
      
      if (barcodes.length > 0) {
        const qrContent = barcodes[0].rawValue?.trim().toUpperCase() || '';
        console.log('📷 [escanearQRDelivery] Código escaneado:', qrContent);
        
        // Verificar que sea el QR DELIVERY (acepta "DELIVERY" o "QR DELIVERY")
        if (qrContent === 'DELIVERY' || qrContent === 'QR DELIVERY') {
          this.qrDeliveryEscaneado = true;
          // NO guardamos en localStorage - el cliente debe escanear cada vez que inicia la app
          this.feedback.showToast('exito', '✅ QR escaneado correctamente. ¡Ya podés acceder a los juegos y tus pedidos!');
        } else {
          this.feedback.showToast('error', '❌ QR inválido. Escaneá el código QR DELIVERY');
        }
      } else {
        this.feedback.showToast('error', '❌ No se detectó ningún código QR');
      }
    } catch (error: any) {
      console.error('❌ [escanearQRDelivery] Error:', error);
      if (!error.message?.includes('cancelled') && !error.message?.includes('cancelado')) {
        this.feedback.showToast('error', '❌ Error al escanear el QR');
      }
    } finally {
      this.customLoader.hide();
    }
  }
  
  /**
   * Navega a Mis Pedidos Delivery
   */
  irAMisPedidosDelivery() {
    this.router.navigate(['/mis-pedidos-delivery']);
  }

}

