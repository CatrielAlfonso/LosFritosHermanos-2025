import { inject, Injectable, signal, WritableSignal, OnInit} from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AudioService } from './audio.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnInit {
  sb = inject(SupabaseService);
  router = inject(Router);
  audio = inject(AudioService);
  
  // Exponer supabase para acceso externo si es necesario
  get supabase() {
    return this.sb.supabase;
  }
  usuarioActual: User | null = null;
  esAdmin: boolean = false;
  esMaitre: boolean = false;
  perfilUsuario: string = '';
  esCocinero: boolean = false;
esBartender: boolean = false;
esMozo: boolean = false;

  async ngOnInit(): Promise<void> {
    //t//his.setupAuthListener();
    await this.audio.preload();
  }
  private perfilUsuarioSubject = new BehaviorSubject<string | null>(null);
perfilUsuario$ = this.perfilUsuarioSubject.asObservable();
  public userActual: WritableSignal<User | null> = signal<User | null>(null);

  constructor(
  ) { 
    this.setupAuthListener()
  }

  private setupAuthListener() {

    this.sb.supabase.auth.onAuthStateChange((event, session) => {
      console.log(event);
      console.log(session);
      this.userActual.set(session !== null ? session.user : null);
    });
  }

  async logIn(correo: string, contrasenia: string) {
    const { data, error } = await this.sb.supabase.auth.signInWithPassword({
      email: correo,
      password: contrasenia
    });

    console.log('Login data:', data);
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
    this.setPerfil('maitre');
    } else if (supervisor) {
      this.setPerfil('supervisor');
    } else if (empleado) {
      this.setPerfil(empleado.perfil);
    } else if (cliente) {
      this.setPerfil('cliente');
    }

    return this.usuarioActual;
  }

  async cargarPerfilUsuario() {
  const { data } = await this.sb.supabase.auth.getUser();
  const email = data?.user?.email;
  if (email) {
    await this.asignarPerfilDesdeBD(email);
  } else {
    console.warn('No se pudo obtener el email del usuario autenticado');
  }
}


  async obtenerIdUsuarioActual(): Promise<string | null> {
    try {
      const { data, error } = await this.sb.supabase.auth.getUser();
      if (error) {
        console.error('Error obteniendo usuario actual:', error);
        return null;
      }
      return data.user ? data.user.id : null;
    } catch (error) {
      console.error('Error inesperado obteniendo usuario actual:', error);
      return null;
    }
  }


  async logearse(correo: string, contrasenia: string)
  {

    // 1. Autenticación
    const { data, error } = await this.sb.supabase.auth.signInWithPassword({
      email: correo,
      password: contrasenia
    });

    if (error) throw error;

    this.usuarioActual = data?.user || null;

  // 2. Buscar perfil
    const { data: supervisor } = await this.sb.supabase
      .from('supervisores')
      .select('*')
      .eq('correo', correo)
      .maybeSingle();

    if (supervisor) {
      this.setPerfil('supervisor');
      return this.usuarioActual;
    }

    const { data: empleado } = await this.sb.supabase
      .from('empleados')
      .select('*')
      .eq('correo', correo)
      .maybeSingle();

    if (empleado) {
      this.setPerfil(empleado.perfil);
      return this.usuarioActual;
    }

    const { data: cliente } = await this.sb.supabase
      .from('clientes')
      .select('id, validado, aceptado')
      .eq('correo', correo)
      .maybeSingle();

    if (cliente) {
      if (cliente.validado === null) {
        await this.sb.supabase.auth.signOut();
        throw new Error('Tu cuenta está pendiente de aprobación. Por favor, espera a que un administrador la revise.');
      }
      if (cliente.validado === false) {
        await this.sb.supabase.auth.signOut();
        throw new Error('Tu cuenta fue rechazada. Por favor, contacta al administrador.');
      }
      this.setPerfil('cliente');
      return this.usuarioActual;
    }

    // Buscar en repartidores
    const { data: repartidor } = await this.sb.supabase
      .from('repartidores')
      .select('id, activo')
      .eq('correo', correo)
      .maybeSingle();

    if (repartidor) {
      if (!repartidor.activo) {
        await this.sb.supabase.auth.signOut();
        throw new Error('Tu cuenta de repartidor está desactivada. Contacta al administrador.');
      }
      this.setPerfil('repartidor');
      return this.usuarioActual;
    }

  // 3. Si no encontró nada
    await this.sb.supabase.auth.signOut();
    throw new Error('No se encontró un perfil asociado a este correo.');

  }

  async registro(correo: string, contrasenia: string, tipoUsuario : string, nombre : string) {
    const { data, error } = await this.sb.supabase.auth.signUp({
      email: correo,
      password: contrasenia,
      options: {
        data: {
          display_name: nombre,
          tipoUsuario: tipoUsuario
        }
      }
    });

    if (error) {
      return null;
    }

    this.usuarioActual = data?.user || null;
    return this.usuarioActual;
  }

 

  // setPerfil(perfil: string) {
  //   this.perfilUsuarioSubject.next(perfil);
  // }

  async asignarPerfilDesdeBD(email: string) {
  try {
    // Buscar en supervisores
    const { data: supervisor } = await this.sb.supabase
      .from('supervisores')
      .select('perfil')
      .eq('correo', email)
      .single();

    if (supervisor?.perfil) {
      this.setPerfil(supervisor.perfil);
      return;
    }

    // Buscar en empleados
    const { data: empleado } = await this.sb.supabase
      .from('empleados')
      .select('perfil')
      .eq('correo', email)
      .single();

    if (empleado?.perfil) {
      this.setPerfil(empleado.perfil);
      return;
    }

    // Buscar en clientes
    const { data: cliente } = await this.sb.supabase
      .from('clientes')
      .select('perfil')
      .eq('correo', email)
      .single();

    if (cliente?.perfil) {
      this.setPerfil(cliente.perfil);
      return;
    }

    // Buscar en repartidores
    const { data: repartidor } = await this.sb.supabase
      .from('repartidores')
      .select('id')
      .eq('correo', email)
      .single();

    if (repartidor) {
      this.setPerfil('repartidor');
      return;
    }

    // Si no se encontró en ninguna tabla
    this.setPerfil('');
    console.warn('Usuario no encontrado en ninguna tabla.');

  } catch (error) {
    console.error('Error asignando perfil desde BD:', error);
    this.setPerfil('');
  }
}

 setPerfil(perfil: string) {
  this.perfilUsuario = perfil;
  this.perfilUsuarioSubject.next(perfil);
  console.log('Perfil asignado:', perfil);
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

  async signOut() 
  {
    try {
      const { data: user } = await this.sb.supabase.auth.getUser();
      const email = user?.user?.email;

      if (email) {
        try {
          //const { PushNotificationService } = await import('./push-notification.service');
          //const pushService = new PushNotificationService();
          //await pushService.borrarFcmToken(email);
        } catch (error) {
          console.error('Error al borrar FCM token:', error);
          
        }
      }
    } catch (error) {
      console.error('Error al obtener usuario para borrar token:', error);
    }
    
    // Reproducir audio sin bloquear el cierre de sesión
    this.audio.playSalida().catch(err => console.error('Error al reproducir audio de salida:', err));
    
    await this.sb.supabase.auth.signOut();
    this.usuarioActual = null;
    this.esAdmin = false;
    this.esMaitre = false;
    this.perfilUsuario = '';
  }

  /**
   * Inicia sesión con Google OAuth
   */
  async signInWithGoogle() {
    try {
      // Para aplicaciones móviles, usar deep link específico
      // El formato debe ser: scheme://host/path
      const redirectUrl = 'com.fritoshermanos.app://login-callback';
      
      const { data, error } = await this.sb.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: false
        }
      });

      if (error) {
        console.error('Error en signInWithGoogle:', error);
        throw error;
      }

      console.log('OAuth iniciado correctamente', data);
      return data;
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      throw error;
    }
  }

  /**
   * Maneja el callback de OAuth después de que el usuario se autentica
   * Verifica en qué tabla está el usuario y asigna el perfil correspondiente
   */
  async handleOAuthCallback() {
    try {
      const { data: { session }, error } = await this.sb.supabase.auth.getSession();
      
      if (error) {
        console.error('Error obteniendo sesión OAuth:', error);
        return null;
      }

      if (!session || !session.user) {
        console.log('No hay sesión activa');
        return null;
      }

      const email = session.user.email;
      if (!email) {
        console.error('No se pudo obtener el email del usuario OAuth');
        await this.sb.supabase.auth.signOut();
        throw new Error('No se pudo obtener el email de la cuenta de Google');
      }

      console.log('Usuario autenticado con OAuth:', email);

      // Verificar en qué tabla está el usuario
      const { data: cliente } = await this.sb.supabase
        .from('clientes')
        .select('id, validado, aceptado')
        .eq('correo', email)
        .maybeSingle();

      if (cliente) {
        // Verificar si el cliente está validado
        if (cliente.validado === null) {
          await this.sb.supabase.auth.signOut();
          throw new Error('Tu cuenta está pendiente de aprobación. Por favor, espera a que un administrador la revise.');
        } else if (cliente.validado === false) {
          await this.sb.supabase.auth.signOut();
          throw new Error('Tu cuenta fue rechazada. Por favor, contacta al administrador para más información.');
        }
        this.setPerfil('cliente');
        this.usuarioActual = session.user;
        return session.user;
      }

      // Verificar si es empleado
      const { data: empleado } = await this.sb.supabase
        .from('empleados')
        .select('*')
        .eq('correo', email)
        .maybeSingle();

      if (empleado) {
        this.esAdmin = false;
        if (empleado.perfil === 'maitre') {
          this.setPerfil('maitre');
          this.esMaitre = true;
        } else {
          this.setPerfil(empleado.perfil);
        }
        this.usuarioActual = session.user;
        return session.user;
      }

      // Verificar si es supervisor
      const { data: supervisor } = await this.sb.supabase
        .from('supervisores')
        .select('id, perfil')
        .eq('correo', email)
        .maybeSingle();

      if (supervisor) {
        this.esAdmin = true;
        this.setPerfil('supervisor');
        this.usuarioActual = session.user;
        return session.user;
      }

      // Verificar si es repartidor
      const { data: repartidor } = await this.sb.supabase
        .from('repartidores')
        .select('id, activo')
        .eq('correo', email)
        .maybeSingle();

      if (repartidor) {
        if (!repartidor.activo) {
          await this.sb.supabase.auth.signOut();
          throw new Error('Tu cuenta de repartidor está desactivada. Contacta al administrador.');
        }
        this.setPerfil('repartidor');
        this.usuarioActual = session.user;
        return session.user;
      }

      // Si no se encontró en ninguna tabla
      await this.sb.supabase.auth.signOut();
      throw new Error('No se encontró un perfil asociado a este correo. Por favor, regístrate primero o contacta al administrador.');

    } catch (error: any) {
      console.error('Error en handleOAuthCallback:', error);
      throw error;
    }
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