import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Mensaje {
  id: number;
  consulta_id: number;
  contenido: string;
  remitente_tipo: 'cliente' | 'mozo';
  remitente_email: string;
  remitente_nombre?: string;
  fecha: string;
  leido: boolean;
}

export interface Consulta {
  id: number;
  mesa: number;
  cliente_email: string;
  cliente_nombre?: string;
  estado: 'pendiente' | 'respondida' | 'cerrada';
  fecha_creacion: string;
  mozo_email?: string;
  mozo_nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private mensajesSubject = new BehaviorSubject<Mensaje[]>([]);
  public mensajes$ = this.mensajesSubject.asObservable();

  private consultaActualSubject = new BehaviorSubject<Consulta | null>(null);
  public consultaActual$ = this.consultaActualSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  // Crear una nueva consulta
  async crearConsulta(mesa: number, clienteEmail: string, clienteNombre: string): Promise<Consulta | null> {
    console.log('💬 [ChatService] Creando consulta para mesa', mesa);
    
    try {
      // Verificar si ya existe una consulta activa para esta mesa
      const { data: consultaExistente } = await this.supabase.supabase
        .from('consultas_mozo')
        .select('*')
        .eq('mesa', mesa)
        .eq('estado', 'pendiente')
        .single();

      if (consultaExistente) {
        console.log('⚠️ [ChatService] Ya existe una consulta activa');
        this.consultaActualSubject.next(consultaExistente);
        await this.cargarMensajes(consultaExistente.id);
        return consultaExistente;
      }

      // Crear nueva consulta
      const { data, error } = await this.supabase.supabase
        .from('consultas_mozo')
        .insert([{
          mesa,
          cliente_email: clienteEmail,
          cliente_nombre: clienteNombre,
          estado: 'pendiente',
          fecha_creacion: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [ChatService] Consulta creada:', data);
      this.consultaActualSubject.next(data);
      return data;
    } catch (error) {
      console.error('💥 [ChatService] Error al crear consulta:', error);
      return null;
    }
  }

  // Enviar un mensaje
  async enviarMensaje(
    consultaId: number,
    contenido: string,
    remitenteTipo: 'cliente' | 'mozo',
    remitenteEmail: string,
    remitenteNombre: string
  ): Promise<boolean> {
    console.log('📤 [ChatService] Enviando mensaje');
    
    try {
      const { data, error } = await this.supabase.supabase
        .from('mensajes_consulta')
        .insert([{
          consulta_id: consultaId,
          contenido,
          remitente_tipo: remitenteTipo,
          remitente_email: remitenteEmail,
          remitente_nombre: remitenteNombre,
          fecha: new Date().toISOString(),
          leido: false
        }])
        .select();

      if (error) throw error;

      console.log('✅ [ChatService] Mensaje enviado');
      
      // Si es un mozo respondiendo, actualizar el estado de la consulta
      if (remitenteTipo === 'mozo') {
        await this.actualizarEstadoConsulta(consultaId, 'respondida', remitenteEmail, remitenteNombre);
      }

      return true;
    } catch (error) {
      console.error('💥 [ChatService] Error al enviar mensaje:', error);
      return false;
    }
  }

  // Cargar mensajes de una consulta
  async cargarMensajes(consultaId: number): Promise<void> {
    console.log('📥 [ChatService] Cargando mensajes de consulta', consultaId);
    
    try {
      const { data, error } = await this.supabase.supabase
        .from('mensajes_consulta')
        .select('*')
        .eq('consulta_id', consultaId)
        .order('fecha', { ascending: true });

      if (error) throw error;

      this.mensajesSubject.next(data || []);
      console.log('✅ [ChatService] Mensajes cargados:', data?.length);
    } catch (error) {
      console.error('💥 [ChatService] Error al cargar mensajes:', error);
    }
  }

  // Suscribirse a mensajes en tiempo real
  suscribirMensajes(consultaId: number): void {
    console.log('🔔 [ChatService] Suscribiendo a mensajes en tiempo real para consulta:', consultaId);
    
    const channel = this.supabase.supabase
      .channel(`consulta-${consultaId}`, {
        config: {
          broadcast: { self: false }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_consulta',
          filter: `consulta_id=eq.${consultaId}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Nuevo mensaje recibido en tiempo real:', payload.new);
          const mensajesActuales = this.mensajesSubject.value;
          
          // Verificar que el mensaje no esté duplicado
          const existeMensaje = mensajesActuales.some(m => 
            m.id === (payload.new as any).id || 
            (m.contenido === (payload.new as any).contenido && 
             m.remitente_email === (payload.new as any).remitente_email &&
             Math.abs(new Date(m.fecha).getTime() - new Date((payload.new as any).fecha).getTime()) < 1000)
          );
          
          if (!existeMensaje) {
            console.log('✅ [REALTIME] Agregando mensaje a la lista');
            this.mensajesSubject.next([...mensajesActuales, payload.new as Mensaje]);
          } else {
            console.log('⚠️ [REALTIME] Mensaje duplicado, ignorando');
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Estado de suscripción:', status);
      });
  }

  // Obtener consulta por mesa
  async obtenerConsultaPorMesa(mesa: number): Promise<Consulta | null> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('consultas_mozo')
        .select('*')
        .eq('mesa', mesa)
        .in('estado', ['pendiente', 'respondida'])
        .order('fecha_creacion', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.consultaActualSubject.next(data);
      }

      return data;
    } catch (error) {
      console.error('Error al obtener consulta:', error);
      return null;
    }
  }

  // Actualizar estado de consulta
  async actualizarEstadoConsulta(
    consultaId: number,
    estado: 'pendiente' | 'respondida' | 'cerrada',
    mozoEmail?: string,
    mozoNombre?: string
  ): Promise<void> {
    try {
      const updateData: any = { estado };
      
      if (mozoEmail && mozoNombre) {
        updateData.mozo_email = mozoEmail;
        updateData.mozo_nombre = mozoNombre;
      }

      await this.supabase.supabase
        .from('consultas_mozo')
        .update(updateData)
        .eq('id', consultaId);
    } catch (error) {
      console.error('Error al actualizar consulta:', error);
    }
  }

  // Obtener todas las consultas pendientes (para mozos)
  async obtenerConsultasPendientes(): Promise<Consulta[]> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('consultas_mozo')
        .select('*')
        .eq('estado', 'pendiente')
        .order('fecha_creacion', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error al obtener consultas pendientes:', error);
      return [];
    }
  }

  // Suscribirse a nuevas consultas (para mozos)
  suscribirNuevasConsultas(callback: (consulta: Consulta) => void): void {
    console.log('🔔 [ChatService] Mozo suscribiéndose a nuevas consultas');
    
    this.supabase.supabase
      .channel('nuevas-consultas')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consultas_mozo'
        },
        (payload) => {
          console.log('🔔 Nueva consulta recibida:', payload.new);
          callback(payload.new as Consulta);
        }
      )
      .subscribe();
  }

  // Limpiar suscripciones
  limpiarSuscripciones(): void {
    this.mensajesSubject.next([]);
    this.consultaActualSubject.next(null);
    this.supabase.supabase.removeAllChannels();
  }
}

