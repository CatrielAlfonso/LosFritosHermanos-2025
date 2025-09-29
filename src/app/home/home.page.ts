import { Component, computed, OnInit } from '@angular/core';
import { AuthService } from '../servicios/auth.service';
import { Router,RouterLink } from '@angular/router';
import { UserService } from '../servicios/user';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  esAdmin: boolean = false;
  esMaitre: boolean = false;
  esCocinero: boolean = false;
  esBartender: boolean = false;
  perfilUsuario: string | null = null;
  nombreUsuario: string = '';
  userData : any | null = null
  tipoUsuario : string | null = null
  isLoading = true;
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
    private userService : UserService
  ) {
      
  }

  ngOnInit() {
  //   this.verificarUsuario();

  //   const user = this.authService.usuarioActual;

  //   if (user) {
  //    // o traer el nombre desde DB

  //   // Levanto los flags desde el servicio
  //   this.perfilUsuario = this.authService.perfilUsuario;
  //   this.esAdmin = this.authService.esAdmin;
  //   this.esMaitre = this.authService.esMaitre;
  //   this.esCocinero = this.authService.perfilUsuario === 'cocinero';
  //   this.esBartender = this.authService.perfilUsuario === 'bartender';
  // }
  // this.authService.perfilUsuario$.subscribe(perfil => {
  //   this.perfilUsuario = perfil ?? '';
  //   this.esAdmin = perfil === 'supervisor';
  //   this.esMaitre = perfil === 'maitre';
  //   this.esCocinero = perfil === 'cocinero';
  //   this.esBartender = perfil === 'bartender';
  // });
  // console.log('Perfil usuario en HomePage:', this.perfilUsuario);

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

  irARegistro(tipoRegistro?: string) {
    if (tipoRegistro) {
      this.router.navigate(['/registro'], { queryParams: { tipo: tipoRegistro } });
    } else {
      this.router.navigate(['/registro']);
    }
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

  
}

