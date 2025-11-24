import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface UserData {
  id: string;
  email: string;
  tipo: 'cliente' | 'maitre' | 'supervisor' | 'dueño' | 'mozo' | 'bartender' | 'cocinero' | 'repartidor';
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
      console.log('🔍 [UserService] Cargando usuario actual...');
      // Obtener usuario autenticado
      const { data: { user } } = await this.auth.getCurrentUser();
      if (!user) {
        console.log('❌ [UserService] No hay usuario autenticado');
        return null;
      }

      console.log('🔍 [UserService] Usuario autenticado:', user.email);

      // Buscar en todas las tablas
      const [clienteData, empleadoData, repartidorData] = await Promise.all([
        this.supabase.supabase
          .from('clientes')
          .select('*')
          .eq('correo', user.email)
          .maybeSingle(),
        
        this.supabase.supabase
          .from('empleados')
          .select('*')
          .eq('correo', user.email)
          .maybeSingle(),
        
        this.supabase.supabase
          .from('repartidores')
          .select('*')
          .eq('correo', user.email)
          .maybeSingle()
      ]);

      console.log('🔍 [UserService] Resultados búsqueda:', {
        cliente: !!clienteData.data,
        empleado: !!empleadoData.data,
        repartidor: !!repartidorData.data
      });

      // Determinar tipo de usuario
      if (clienteData.data) {
        console.log('✅ [UserService] Usuario es cliente');
        this.currentUser = {
          id: user.id,
          email: clienteData.data.correo,
          tipo: 'cliente',
          datos: clienteData.data
        };
      } else if (empleadoData.data) {
        console.log('✅ [UserService] Usuario es empleado:', empleadoData.data.perfil);
        this.currentUser = {
          id: user.id,
          email: empleadoData.data.correo,
          tipo: empleadoData.data.perfil,
          datos: empleadoData.data
        };
      } else if (repartidorData.data) {
        console.log('✅ [UserService] Usuario es repartidor');
        this.currentUser = {
          id: user.id,
          email: repartidorData.data.correo,
          tipo: 'repartidor',
          datos: repartidorData.data
        };
      } else {
        console.log('❌ [UserService] Usuario no encontrado en ninguna tabla');
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