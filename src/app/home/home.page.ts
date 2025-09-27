import { Component, OnInit } from '@angular/core';
import { AuthService } from '../servicios/auth.service';
import { Router,RouterLink } from '@angular/router';
import { SupabaseService } from '../servicios/supabase.service';
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
  esCocinero: boolean = false;
  esBartender: boolean = false;
  perfilUsuario: string = '';
  nombreUsuario: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private supabase: SupabaseService,
    private pushNotificationService: PushNotificationService
  ) {}

  async ngOnInit() {
    const { data: { user } } = await this.authService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    await this.verificarUsuario();
    
    this.authService.perfilUsuario$.subscribe(perfil => {
      console.log('Perfil recibido:', perfil);
      this.perfilUsuario = perfil ?? '';
      this.esAdmin = perfil === 'supervisor';
      this.esMaitre = perfil === 'maitre';
      this.esCocinero = perfil === 'cocinero';
      this.esBartender = perfil === 'bartender';
      
    });
    console.log('Perfil usuario en HomePage:', this.perfilUsuario);

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
    this.router.navigate(['/login']);
  }

  irAAprobacionClientes() {
    this.router.navigate(['/aprobacion-clientes']);
  }
}

