import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface UserData {
  id: string;
  email: string;
  tipo: 'cliente' | 'maitre' | 'supervisor' | 'dueño' | 'mozo' | 'bartender' | 'cocinero';
  datos: any; 
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private currentUser: UserData | null = null;

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService
  ) {}

  async loadCurrentUser(): Promise<UserData | null> {
    try {
      // Obtener usuario autenticado
      const { data: { user } } = await this.auth.getCurrentUser();
      if (!user) return null;

      // Buscar en ambas tablas
      const [clienteData, empleadoData] = await Promise.all([
        this.supabase.supabase
          .from('clientes')
          .select('*')
          .eq('correo', user.email)
          .single(),
        
        this.supabase.supabase
          .from('empleados')
          .select('*')
          .eq('correo', user.email)
          .single()
      ]);

      // Determinar tipo de usuario
      if (clienteData.data) {
        this.currentUser = {
          id: user.id,
          email: clienteData.data.correo,
          tipo: 'cliente',
          datos: clienteData.data
        };
      } else if (empleadoData.data) {
        this.currentUser = {
          id: user.id,
          email: empleadoData.data.correo,
          tipo: empleadoData.data.perfil,
          datos: empleadoData.data
        };
      }

      return this.currentUser;
    } catch (error) {
      console.error('Error cargando usuario:', error);
      return null;
    }
  }

  getCurrentUser(): UserData | null {
    return this.currentUser;
  }

  getUserTipo(): string | null {
    return this.currentUser?.tipo || null;
  }

  isCliente(): boolean {
    return this.currentUser?.tipo === 'cliente';
  }

  // isEmpleado(): boolean {
  //   return this.currentUser?.tipo === 'empleado';
  // }

  // isAdmin(): boolean {
  //   return this.currentUser?.tipo === 'admin';
  // }

  clearUser(): void {
    this.currentUser = null;
  }
}