import { Component, OnInit } from '@angular/core';
import { AuthService } from '../servicios/auth.service';
import { Router } from '@angular/router';

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
    private router: Router
  ) {}

  ngOnInit() {
    this.verificarUsuario();
  }

  async verificarUsuario() {
    try {
      const { data: user } = await this.authService.getCurrentUser();
      if (user?.user?.email) {
        this.esAdmin = this.authService.esUsuarioAdmin();
        this.esMaitre = this.authService.esUsuarioMaitre();
        this.esCocinero = this.authService.esUsuarioCocinero();
        this.perfilUsuario = this.authService.getPerfilUsuario();
        
        await this.obtenerNombreUsuario(user.user.email);
      }
    } catch (error) {
      console.error('Error al verificar usuario:', error);
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

  async cerrarSesion() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }
}


