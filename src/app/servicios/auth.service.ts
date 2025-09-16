import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { User } from '@supabase/supabase-js';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  sb = inject(SupabaseService);
  router = inject(Router);
  usuarioActual: User | null = null;
  esAdmin: boolean = false;
  esMaitre: boolean = false;
  perfilUsuario: string = '';

  constructor(
  ) { }

  async logIn(correo: string, contrasenia: string) {
    const { data, error } = await this.sb.supabase.auth.signInWithPassword({
      email: correo,
      password: contrasenia
    });

    if (error) throw error;

    const { data: cliente } = await this.sb.supabase
      .from('clientes')
      .select('id, validado, aceptado')
      .eq('correo', correo)
      .single();

    if (cliente) {
      if (cliente.validado === null) {
        await this.sb.supabase.auth.signOut();
        throw new Error('Tu cuenta está pendiente de aprobación. Por favor, espera a que un administrador la revise.');
      } else if (cliente.validado === false) {
        await this.sb.supabase.auth.signOut();
        throw new Error('Tu cuenta fue rechazada. Por favor, contacta al administrador para más información.');
      }
    }

    this.usuarioActual = data?.user || null;

    const { data: empleado } = await this.sb.supabase
      .from('empleados')
      .select('*')
      .eq('correo', correo)
      .single();

    const { data: supervisor } = await this.sb.supabase
      .from('supervisores')
      .select('id')
      .eq('correo', correo)
      .single();

    this.esAdmin = !!supervisor;
    
    if (empleado && empleado.perfil === 'maitre') {
      this.esMaitre = true;
      this.perfilUsuario = 'maitre';
    } else if (supervisor) {
      this.perfilUsuario = 'supervisor';
    } else if (empleado) {
      this.perfilUsuario = empleado.perfil;
    } else if (cliente) {
      this.perfilUsuario = 'cliente';
    }

    return this.usuarioActual;
  }

  async registro(correo: string, contrasenia: string) {
    const { data, error } = await this.sb.supabase.auth.signUp({
      email: correo,
      password: contrasenia
    });

    if (error) {
      return null;
    }

    this.usuarioActual = data?.user || null;
    return this.usuarioActual;
  }

  esUsuarioAdmin() {
    return this.esAdmin;
  }

  esUsuarioMaitre() {
    return this.esMaitre;
  }

  esUsuarioBartender() {
    return this.perfilUsuario === 'bartender';
  }

  esUsuarioCocinero() {
    return this.perfilUsuario === 'cocinero';
  }

  puedeAccederARegistro() {
    return this.esAdmin || this.esMaitre || this.esUsuarioBartender() || this.esUsuarioCocinero();
  }

  getPerfilUsuario() {
    return this.perfilUsuario;
  }

  estaAutenticado() {
    return this.usuarioActual !== null;
  }

  async signOut() {
    try {
      const { data: user } = await this.sb.supabase.auth.getUser();
      const email = user?.user?.email;

      if (email) {
        try {
          const { PushNotificationService } = await import('./push-notification.service');
          const pushService = new PushNotificationService();
          await pushService.borrarFcmToken(email);
        } catch (error) {
          console.error('Error al borrar FCM token:', error);
        }
      }
    } catch (error) {
      console.error('Error al obtener usuario para borrar token:', error);
    }
    
    await this.sb.supabase.auth.signOut();
    this.usuarioActual = null;
    this.esAdmin = false;
    this.esMaitre = false;
    this.perfilUsuario = '';
  }

  async getCurrentUser() {
    try {
      return await this.sb.supabase.auth.getUser();
    } catch (error) {
      await this.clearAuthAndRedirect();
      return { data: { user: null }, error };
    }
  }

  async clearAuthAndRedirect() {
    try {
      const { data: user } = await this.sb.supabase.auth.getUser();
      const email = user?.user?.email;

      if (email) {
        try {
          const { PushNotificationService } = await import('./push-notification.service');
          const pushService = new PushNotificationService();
          await pushService.borrarFcmToken(email);
        } catch (error) {
          console.error('Error al borrar FCM token:', error);
        }
      }
    } catch (error) {
      console.error('Error al obtener usuario para borrar token:', error);
    }

    await this.sb.supabase.auth.signOut();
    
    this.usuarioActual = null;
    this.esAdmin = false;
    this.esMaitre = false;
    this.perfilUsuario = '';

    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async guardarPushToken(userId: string, token: string) {
    try {
      const { data: user } = await this.sb.supabase.auth.getUser();
      
      if (!user?.user) {
        console.log('No hay usuario autenticado');
        return;
      }

      const email = user.user.email;

      const { data: supervisor } = await this.sb.supabase
        .from('supervisores')
        .select('id')
        .eq('correo', email)
        .single();

      const { data: empleado } = await this.sb.supabase
        .from('empleados')
        .select('id')
        .eq('correo', email)
        .single();

      const { data: cliente } = await this.sb.supabase
        .from('clientes')
        .select('id')
        .eq('correo', email)
        .single();

      let tableName = '';
      let updateData = { fcm_token: token };

      if (supervisor) {
        tableName = 'supervisores';
      } else if (empleado) {
        tableName = 'empleados';
      } else if (cliente) {
        tableName = 'clientes';
      } else {
        console.log('Usuario no encontrado en ninguna tabla');
        return;
      }

      const { error } = await this.sb.supabase
        .from(tableName)
        .update(updateData)
        .eq('correo', email);

      if (error) {
        console.error('Error al guardar FCM token:', error);
      } else {
        console.log('FCM token guardado exitosamente en', tableName);
      }

    } catch (error) {
      console.error('Error al guardar token en base de datos:', error);
    }
  }

}