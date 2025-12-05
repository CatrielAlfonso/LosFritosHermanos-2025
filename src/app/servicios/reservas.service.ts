import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface Reserva {
  id?: number;
  cliente_id: number;
  cliente_email: string;
  cliente_nombre: string;
  cliente_apellido?: string;
  fecha_reserva: string; // YYYY-MM-DD
  hora_reserva: string; // HH:MM
  cantidad_comensales: number;
  estado?: string;
  mesa_numero?: number;
  mesa_id?: number;
  hora_asignacion?: string;
  hora_limite?: string;
  cliente_llego?: boolean;
  hora_llegada?: string;
  notas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Mesa {
  id: number;
  numero: number;
  tipo: string;
  imagen?: string;
  qr?: string;
  comensales: number;
  ocupada: boolean;
  clienteAsignadoId?: number;
  pedido_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReservasService {

  constructor(
    private supabase: SupabaseService,
    private authService: AuthService
  ) { }

  /**
   * Crea una nueva reserva
   * Valida que:
   * - El usuario esté autenticado y sea cliente
   * - La fecha y hora sean futuras
   * - Haya mesas disponibles para la cantidad de comensales
   * Asigna automáticamente una mesa disponible
   */
  async crearReserva(reserva: Omit<Reserva, 'id' | 'created_at' | 'updated_at'>): Promise<Reserva> {
    // Verificar que el usuario esté autenticado
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user) {
      throw new Error('Debes estar autenticado para hacer una reserva');
    }

    // Verificar que el usuario sea cliente
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'cliente') {
      throw new Error('Solo los clientes registrados pueden hacer reservas');
    }

    // Validar que la fecha y hora sean futuras
    const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
    const ahora = new Date();
    
    if (fechaHoraReserva <= ahora) {
      throw new Error('La reserva debe ser en una fecha y hora futuras');
    }

    // Validar cantidad de comensales
    if (reserva.cantidad_comensales < 1) {
      throw new Error('La cantidad de comensales debe ser al menos 1');
    }

    // Preparar datos de la reserva SIN mesa asignada (pendiente de aprobación)
    const reservaPendiente = {
      ...reserva,
      mesa_id: null,
      mesa_numero: null,
      estado: 'pendiente', // Pendiente de aprobación del supervisor
      hora_asignacion: null,
      hora_limite: null,
      cliente_llego: false
    };

    // Insertar la reserva
    const { data, error } = await this.supabase.supabase
      .from('reservas')
      .insert([reservaPendiente])
      .select()
      .single();

    if (error) {
      console.error('Error al crear reserva:', error);
      throw new Error(`Error al crear la reserva: ${error.message}`);
    }

    // Notificar a dueños/supervisores sobre la nueva reserva
    try {
      await this.notificarNuevaReserva(data);
    } catch (notifError) {
      console.error('Error al notificar nueva reserva:', notifError);
      // No lanzamos error para no fallar la creación de la reserva
    }

    return data;
  }

  /**
   * Obtiene todas las reservas del cliente autenticado
   */
  async obtenerReservasCliente(): Promise<Reserva[]> {
    // Verificar que el usuario esté autenticado
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('Debes estar autenticado para ver tus reservas');
    }

    // Obtener reservas del cliente
    const { data, error } = await this.supabase.supabase
      .from('reservas')
      .select('*')
      .eq('cliente_email', user.email)
      .order('fecha_reserva', { ascending: true })
      .order('hora_reserva', { ascending: true });

    if (error) {
      console.error('Error al obtener reservas:', error);
      throw new Error(`Error al obtener las reservas: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtiene una reserva por ID
   */
  async obtenerReservaPorId(id: number): Promise<Reserva | null> {
    const { data, error } = await this.supabase.supabase
      .from('reservas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener reserva:', error);
      return null;
    }

    return data;
  }

  /**
   * Cancela una reserva
   */
  async cancelarReserva(id: number): Promise<void> {
    // Verificar que el usuario esté autenticado
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('Debes estar autenticado para cancelar una reserva');
    }

    // Verificar que la reserva pertenezca al cliente
    const reserva = await this.obtenerReservaPorId(id);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    if (reserva.cliente_email !== user.email) {
      throw new Error('No tienes permiso para cancelar esta reserva');
    }

    // Actualizar el estado a cancelada
    const { error } = await this.supabase.supabase
      .from('reservas')
      .update({ estado: 'cancelada' })
      .eq('id', id);

    if (error) {
      console.error('Error al cancelar reserva:', error);
      throw new Error(`Error al cancelar la reserva: ${error.message}`);
    }
  }

  /**
   * Verifica si el usuario puede hacer una reserva (es cliente registrado)
   */
  async puedeHacerReserva(): Promise<boolean> {
    try {
      const { data: { user }, error: authError } = await this.supabase.supabase.auth.getUser();
      
      if (authError) {
        console.error('Error al obtener usuario:', authError);
        return false;
      }

      if (!user || !user.email) {
        console.log('No hay usuario o email');
        return false;
      }

      const perfil = this.authService.getPerfilUsuario();
      if (perfil !== 'cliente') {
        console.log('Usuario no es cliente, perfil:', perfil);
        return false;
      }

      // Verificar que el cliente esté validado y aceptado
      const { data: cliente, error: clienteError } = await this.supabase.supabase
        .from('clientes')
        .select('validado, aceptado')
        .eq('correo', user.email)
        .single();

      if (clienteError) {
        console.error('Error al obtener datos del cliente:', clienteError);
        return false;
      }

      if (!cliente) {
        console.log('No se encontró el cliente en la BD');
        return false;
      }

      console.log('Estado del cliente - validado:', cliente.validado, 'aceptado:', cliente.aceptado);
      
      // El cliente debe estar validado y aceptado
      return cliente.validado === true && cliente.aceptado === true;
    } catch (error) {
      console.error('Error inesperado verificando si puede hacer reserva:', error);
      return false;
    }
  }

  /**
   * Obtiene información del cliente autenticado
   */
  async obtenerInfoCliente(): Promise<{ id: number; nombre: string; apellido: string; email: string; validado?: boolean; aceptado?: boolean } | null> {
    try {
      const { data: { user } } = await this.supabase.supabase.auth.getUser();
      if (!user || !user.email) {
        return null;
      }

      const { data: cliente } = await this.supabase.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, validado, aceptado')
        .eq('correo', user.email)
        .single();

      if (!cliente) {
        return null;
      }

      return {
        id: cliente.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido || '',
        email: cliente.correo,
        validado: cliente.validado,
        aceptado: cliente.aceptado
      };
    } catch (error) {
      console.error('Error obteniendo info del cliente:', error);
      return null;
    }
  }

  /**
   * Obtiene todas las reservas pendientes (para dueños/supervisores)
   */
  async obtenerReservasPendientes(): Promise<Reserva[]> {
    const { data, error } = await this.supabase.supabase
      .from('reservas')
      .select('*')
      .eq('estado', 'pendiente')
      .order('fecha_reserva', { ascending: true })
      .order('hora_reserva', { ascending: true });

    if (error) {
      console.error('Error al obtener reservas pendientes:', error);
      throw new Error(`Error al obtener las reservas: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Confirma una reserva pendiente (solo supervisores/dueños)
   * NO asigna mesa inmediatamente - la mesa se asigna a la hora de la reserva
   * La mesa se liberará automáticamente después de 45 minutos si el cliente no escanea el QR
   */
  async confirmarReserva(reservaId: number): Promise<void> {
    // Verificar permisos (supervisor o dueño)
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'supervisor' && perfil !== 'dueño') {
      throw new Error('No tienes permisos para confirmar reservas');
    }

    // Obtener la reserva
    const { data: reserva, error: errorReserva } = await this.supabase.supabase
      .from('reservas')
      .select('*')
      .eq('id', reservaId)
      .eq('estado', 'pendiente')
      .single();

    if (errorReserva || !reserva) {
      throw new Error('Reserva no encontrada o ya procesada');
    }

    // Verificar que haya mesas disponibles para esa cantidad (validación previa)
    const hayMesas = await this.hayMesasDisponiblesParaCapacidad(reserva.cantidad_comensales);
    if (!hayMesas) {
      throw new Error(`No hay mesas disponibles para ${reserva.cantidad_comensales} comensales. No se puede confirmar la reserva.`);
    }

    // Solo marcar como confirmada SIN asignar mesa
    // La mesa se asignará automáticamente cuando llegue la hora de la reserva
    const { error: errorUpdate } = await this.supabase.supabase
      .from('reservas')
      .update({
        estado: 'confirmada',
        mesa_id: null,
        mesa_numero: null,
        hora_asignacion: null,
        hora_limite: null
      })
      .eq('id', reservaId);

    if (errorUpdate) {
      console.error('Error al confirmar reserva:', errorUpdate);
      throw new Error(`Error al confirmar la reserva: ${errorUpdate.message}`);
    }

    // Notificar al cliente sobre la confirmación (sin número de mesa aún)
    try {
      await this.notificarReservaConfirmadaSinMesa(reserva);
    } catch (notifError) {
      console.error('Error al notificar confirmación:', notifError);
      // No lanzamos error para no fallar la confirmación
    }
  }

  /**
   * Notifica al cliente que su reserva fue confirmada (sin mesa asignada aún)
   */
  private async notificarReservaConfirmadaSinMesa(reserva: Reserva): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/enviar-correo-reserva-confirmada-sin-mesa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: reserva.cliente_email,
          nombre: reserva.cliente_nombre,
          apellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          cantidadComensales: reserva.cantidad_comensales
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error enviando notificación de reserva confirmada:', error);
      throw error;
    }
  }

  /**
   * Rechaza una reserva pendiente (solo supervisores/dueños)
   */
 
  /**
   * Obtiene todas las reservas (para dueños/supervisores)
   */
  async obtenerTodasLasReservas(): Promise<Reserva[]> {
    const { data, error } = await this.supabase.supabase
      .from('reservas')
      .select('*')
      .order('fecha_reserva', { ascending: true })
      .order('hora_reserva', { ascending: true });

    if (error) {
      console.error('Error al obtener todas las reservas:', error);
      throw new Error(`Error al obtener las reservas: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Aprueba una reserva (solo dueños/supervisores)
   */
  /**
   * Aprueba una reserva (solo dueños/supervisores)
   * NOTA: La mesa NO se asigna al aprobar. Se asigna automáticamente a la hora de la reserva.
   */
  async aprobarReserva(id: number, mesaNumero?: number): Promise<void> {
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'supervisor' && perfil !== 'dueño') {
      throw new Error('Solo dueños y supervisores pueden aprobar reservas');
    }

    // Solo marcar como confirmada, SIN asignar mesa
    // La mesa se asignará automáticamente cuando llegue la hora de la reserva
    const updateData: any = { 
      estado: 'confirmada',
      mesa_id: null,
      mesa_numero: null,
      hora_asignacion: null,
      hora_limite: null
    };

    const { error } = await this.supabase.supabase
      .from('reservas')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error al aprobar reserva:', error);
      throw new Error(`Error al aprobar la reserva: ${error.message}`);
    }
  }

  /**
   * Rechaza una reserva (solo dueños/supervisores)
   */
  async rechazarReserva(id: number, motivo: string): Promise<void> {
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'supervisor' && perfil !== 'dueño') {
      throw new Error('Solo dueños y supervisores pueden rechazar reservas');
    }

    if (!motivo || motivo.trim().length === 0) {
      throw new Error('El motivo del rechazo es requerido');
    }

    const { error } = await this.supabase.supabase
      .from('reservas')
      .update({ 
        estado: 'cancelada',
        notas: motivo // Guardamos el motivo en las notas
      })
      .eq('id', id);

    if (error) {
      console.error('Error al rechazar reserva:', error);
      throw new Error(`Error al rechazar la reserva: ${error.message}`);
    }
  }

  /**
   * Notifica a dueños/supervisores sobre una nueva reserva
   */
  private async notificarNuevaReserva(reserva: Reserva): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/notify-new-reservation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservaId: reserva.id,
          clienteNombre: reserva.cliente_nombre,
          clienteApellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          cantidadComensales: reserva.cantidad_comensales
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al notificar nueva reserva:', error);
      throw error;
    }
  }

  /**
   * Notifica al cliente que su reserva fue confirmada
   */
  private async notificarReservaConfirmada(reserva: Reserva, mesaNumero: number): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/enviar-correo-reserva-aprobada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: reserva.cliente_email,
          nombre: reserva.cliente_nombre,
          apellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          cantidadComensales: reserva.cantidad_comensales,
          mesaNumero: mesaNumero
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error enviando notificación de reserva confirmada:', error);
      throw error;
    }
  }

  /**
   * Notifica al cliente que su reserva fue rechazada
   */
  private async notificarReservaRechazada(reserva: Reserva, motivo: string): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/enviar-correo-reserva-rechazada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: reserva.cliente_email,
          nombre: reserva.cliente_nombre,
          apellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          motivo: motivo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error enviando notificación de reserva rechazada:', error);
      throw error;
    }
  }

  /**
   * Aprueba una reserva y envía correo de confirmación
   * NOTA: La mesa se asigna automáticamente a la hora de la reserva, no al aprobar
   */
  async aprobarReservaConCorreo(id: number, mesaNumero?: number): Promise<void> {
    // Primero aprobar la reserva (sin asignar mesa)
    await this.aprobarReserva(id, mesaNumero);
    
    // Obtener la reserva para enviar el correo
    const reserva = await this.obtenerReservaPorId(id);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    // Enviar correo de confirmación SIN mesa (la mesa se asigna a la hora de la reserva)
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/enviar-correo-reserva-confirmada-sin-mesa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: reserva.cliente_email,
          nombre: reserva.cliente_nombre,
          apellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          cantidadComensales: reserva.cantidad_comensales
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al enviar correo de confirmación:', error);
      // No lanzamos error para no fallar la aprobación
    }
  }

  /**
   * Rechaza una reserva y envía correo con motivo
   */
  async rechazarReservaConCorreo(id: number, motivo: string): Promise<void> {
    // Primero rechazar la reserva
    await this.rechazarReserva(id, motivo);
    
    // Obtener la reserva para enviar el correo
    const reserva = await this.obtenerReservaPorId(id);
    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    // Enviar correo de rechazo
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/enviar-correo-reserva-rechazada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: reserva.cliente_email,
          nombre: reserva.cliente_nombre,
          apellido: reserva.cliente_apellido,
          fechaReserva: reserva.fecha_reserva,
          horaReserva: reserva.hora_reserva,
          motivo: motivo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al enviar correo de rechazo:', error);
      // No lanzamos error para no fallar el rechazo
    }
  }

  /**
   * Verifica si una mesa tiene una reserva confirmada activa
   * @param mesaNumero Número de la mesa
   * @returns true si la mesa tiene una reserva confirmada que aún no ha expirado
   */
  async tieneReservaConfirmadaActiva(mesaNumero: number): Promise<boolean> {
    try {
      const ahora = new Date();
      const { data, error } = await this.supabase.supabase
        .from('reservas')
        .select('*')
        .eq('mesa_numero', mesaNumero)
        .eq('estado', 'confirmada')
        .gte('fecha_reserva', ahora.toISOString().split('T')[0]);

      if (error) {
        console.error('Error al verificar reserva activa:', error);
        return false;
      }

      if (!data || data.length === 0) {
        return false;
      }

      // Verificar que la reserva esté dentro del lapso válido (45 minutos antes y después)
      for (const reserva of data) {
        const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
        const tiempoDiferencia = fechaHoraReserva.getTime() - ahora.getTime();
        const minutosDiferencia = tiempoDiferencia / (1000 * 60);

        // Si la reserva está dentro del lapso válido (45 min antes hasta 45 min después)
        if (minutosDiferencia >= -45 && minutosDiferencia <= 45) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error al verificar reserva activa:', error);
      return false;
    }
  }

  /**
   * Obtiene la reserva confirmada activa de un cliente
   * Una reserva está activa si:
   * - Tiene mesa asignada: desde la hora de reserva hasta 45 min después
   * - No tiene mesa asignada: desde la hora de reserva (para asignar mesa) hasta 45 min después
   * @param clienteEmail Email del cliente
   * @returns Reserva activa o null
   */
  async obtenerReservaConfirmadaActiva(clienteEmail: string): Promise<Reserva | null> {
    try {
      const ahora = new Date();
      const hoy = ahora.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase.supabase
        .from('reservas')
        .select('*')
        .eq('cliente_email', clienteEmail)
        .eq('estado', 'confirmada')
        .eq('fecha_reserva', hoy)
        .order('hora_reserva', { ascending: true });

      if (error) {
        console.error('Error al obtener reserva activa:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Buscar una reserva que esté dentro del lapso válido
      for (const reserva of data) {
        const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
        const tiempoDiferencia = ahora.getTime() - fechaHoraReserva.getTime();
        const minutosDiferencia = tiempoDiferencia / (1000 * 60);

        // Reserva válida: desde la hora de reserva hasta 45 minutos después
        // (minutosDiferencia >= 0 significa que ya llegó la hora)
        // (minutosDiferencia <= 45 significa que no han pasado más de 45 min)
        if (minutosDiferencia >= 0 && minutosDiferencia <= 45) {
          return reserva;
        }
      }

      return null;
    } catch (error) {
      console.error('Error al obtener reserva activa:', error);
      return null;
    }
  }

  /**
   * Obtiene la reserva confirmada que está lista para asignar mesa
   * (la hora de la reserva ya llegó pero aún no tiene mesa asignada)
   * @param clienteEmail Email del cliente
   * @returns Reserva lista para asignar mesa o null
   */
  async obtenerReservaListaParaMesa(clienteEmail: string): Promise<Reserva | null> {
    try {
      const ahora = new Date();
      const hoy = ahora.toISOString().split('T')[0];
      
      const { data, error } = await this.supabase.supabase
        .from('reservas')
        .select('*')
        .eq('cliente_email', clienteEmail)
        .eq('estado', 'confirmada')
        .eq('fecha_reserva', hoy)
        .is('mesa_numero', null)
        .order('hora_reserva', { ascending: true });

      if (error) {
        console.error('Error al obtener reserva lista para mesa:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Buscar una reserva cuya hora ya llegó (o está por llegar en 5 min de tolerancia)
      for (const reserva of data) {
        const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
        const tiempoDiferencia = ahora.getTime() - fechaHoraReserva.getTime();
        const minutosDiferencia = tiempoDiferencia / (1000 * 60);

        // La hora de la reserva ya llegó (con 5 min de tolerancia antes) y no han pasado más de 45 min
        if (minutosDiferencia >= -5 && minutosDiferencia <= 45) {
          return reserva;
        }
      }

      return null;
    } catch (error) {
      console.error('Error al obtener reserva lista para mesa:', error);
      return null;
    }
  }

  /**
   * Asigna mesa a una reserva cuando llega su hora
   * @param reservaId ID de la reserva
   * @returns Mesa asignada o null si no hay disponibles
   */
  async asignarMesaAReserva(reservaId: number): Promise<Mesa | null> {
    try {
      const reserva = await this.obtenerReservaPorId(reservaId);
      if (!reserva) {
        console.error('Reserva no encontrada:', reservaId);
        return null;
      }

      if (reserva.mesa_numero) {
        console.log('La reserva ya tiene mesa asignada:', reserva.mesa_numero);
        // Retornar la mesa existente
        const { data: mesa } = await this.supabase.supabase
          .from('mesas')
          .select('*')
          .eq('numero', reserva.mesa_numero)
          .single();
        return mesa;
      }

      // Buscar mesa disponible para la cantidad de comensales
      const mesaDisponible = await this.asignarMesaAutomatica(reserva.cantidad_comensales);
      if (!mesaDisponible) {
        console.error('No hay mesas disponibles para', reserva.cantidad_comensales, 'comensales');
        return null;
      }

      // Calcular hora límite (45 minutos desde ahora)
      const ahora = new Date();
      const horaLimite = new Date(ahora.getTime() + 45 * 60 * 1000);

      // Actualizar la reserva con la mesa asignada
      const { error: errorReserva } = await this.supabase.supabase
        .from('reservas')
        .update({
          mesa_id: mesaDisponible.id,
          mesa_numero: mesaDisponible.numero,
          hora_asignacion: ahora.toISOString(),
          hora_limite: horaLimite.toISOString()
        })
        .eq('id', reservaId);

      if (errorReserva) {
        console.error('Error al asignar mesa a reserva:', errorReserva);
        return null;
      }

      // Marcar la mesa como ocupada
      const { error: errorMesa } = await this.supabase.supabase
        .from('mesas')
        .update({ ocupada: true })
        .eq('id', mesaDisponible.id);

      if (errorMesa) {
        console.error('Error al marcar mesa como ocupada:', errorMesa);
        // Intentar revertir la asignación en la reserva
        await this.supabase.supabase
          .from('reservas')
          .update({ mesa_id: null, mesa_numero: null, hora_asignacion: null, hora_limite: null })
          .eq('id', reservaId);
        return null;
      }

      console.log(`✅ Mesa ${mesaDisponible.numero} asignada a reserva ${reservaId}`);
      return mesaDisponible;
    } catch (error) {
      console.error('Error al asignar mesa a reserva:', error);
      return null;
    }
  }

  /**
   * Confirma la llegada del cliente con reserva (escaneo de QR de mesa)
   * @param reservaId ID de la reserva
   */
  async confirmarLlegadaClienteReserva(reservaId: number): Promise<void> {
    try {
      const { error } = await this.supabase.supabase
        .from('reservas')
        .update({
          cliente_llego: true,
          hora_llegada: new Date().toISOString()
        })
        .eq('id', reservaId);

      if (error) {
        console.error('Error al confirmar llegada del cliente:', error);
        throw new Error(`Error al confirmar llegada: ${error.message}`);
      }

      console.log(`✅ Cliente llegó a reserva ${reservaId}`);
    } catch (error) {
      console.error('Error al confirmar llegada del cliente:', error);
      throw error;
    }
  }

  /**
   * Verifica si una reserva confirmada ha expirado (más de 45 minutos después de la hora)
   * @param reservaId ID de la reserva
   * @returns true si la reserva ha expirado
   */
  async reservaExpirada(reservaId: number): Promise<boolean> {
    try {
      const reserva = await this.obtenerReservaPorId(reservaId);
      if (!reserva || reserva.estado !== 'confirmada') {
        return false;
      }

      const ahora = new Date();
      const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
      const tiempoDiferencia = ahora.getTime() - fechaHoraReserva.getTime();
      const minutosDiferencia = tiempoDiferencia / (1000 * 60);

      // Si han pasado más de 45 minutos desde la hora de reserva
      return minutosDiferencia > 45;
    } catch (error) {
      console.error('Error al verificar si reserva expiró:', error);
      return false;
    }
  }

  /**
   * Libera una mesa de una reserva expirada
   * @param reservaId ID de la reserva
   */
  async liberarMesaReservaExpirada(reservaId: number): Promise<void> {
    try {
      const reserva = await this.obtenerReservaPorId(reservaId);
      if (!reserva || !reserva.mesa_numero) {
        return;
      }

      const mesaNumero = reserva.mesa_numero;

      // Actualizar la reserva para quitar la mesa asignada
      const { error: errorReserva } = await this.supabase.supabase
        .from('reservas')
        .update({ mesa_numero: null })
        .eq('id', reservaId);

      if (errorReserva) {
        console.error('Error al liberar mesa de reserva expirada:', errorReserva);
        throw new Error(`Error al liberar la mesa: ${errorReserva.message}`);
      }

      // Verificar si hay clientes en lista_espera asignados a esta mesa
      const { data: clientesEnMesa, error: errorClientes } = await this.supabase.supabase
        .from('lista_espera')
        .select('id')
        .eq('mesa_asignada', mesaNumero);

      if (errorClientes) {
        console.error('Error al verificar clientes en mesa:', errorClientes);
      }

      // Si no hay clientes asignados a la mesa, marcarla como disponible
      if (!clientesEnMesa || clientesEnMesa.length === 0) {
        const { error: errorMesa } = await this.supabase.supabase
          .from('mesas')
          .update({ ocupada: false })
          .eq('numero', mesaNumero);

        if (errorMesa) {
          console.error('Error al marcar mesa como disponible:', errorMesa);
        }
      }
    } catch (error) {
      console.error('Error al liberar mesa de reserva expirada:', error);
      throw error;
    }
  }

  /**
   * Libera todas las mesas de reservas expiradas
   */
  async liberarMesasReservasExpiradas(): Promise<void> {
    try {
      const ahora = new Date();
      const hace45Minutos = new Date(ahora.getTime() - 45 * 60 * 1000);

      // Obtener todas las reservas confirmadas con mesa asignada
      const { data: reservas, error } = await this.supabase.supabase
        .from('reservas')
        .select('*')
        .eq('estado', 'confirmada')
        .not('mesa_numero', 'is', null);

      if (error) {
        console.error('Error al obtener reservas para liberar:', error);
        return;
      }

      if (!reservas || reservas.length === 0) {
        return;
      }

      // Liberar mesas de reservas expiradas
      for (const reserva of reservas) {
        const fechaHoraReserva = new Date(`${reserva.fecha_reserva}T${reserva.hora_reserva}`);
        
        // Si la reserva fue hace más de 45 minutos
        if (fechaHoraReserva.getTime() < hace45Minutos.getTime()) {
          await this.liberarMesaReservaExpirada(reserva.id!);
        }
      }
    } catch (error) {
      console.error('Error al liberar mesas de reservas expiradas:', error);
    }
  }

  /**
   * Obtiene todas las mesas disponibles
   */
  async obtenerMesasDisponibles(): Promise<Mesa[]> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('*')
        .eq('ocupada', false)
        .order('numero', { ascending: true });

      if (error) {
        console.error('Error al obtener mesas disponibles:', error);
        throw new Error(`Error al obtener mesas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener mesas disponibles:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las mesas
   */
  async obtenerTodasLasMesas(): Promise<Mesa[]> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('*')
        .order('numero', { ascending: true });

      if (error) {
        console.error('Error al obtener mesas:', error);
        throw new Error(`Error al obtener mesas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener mesas:', error);
      throw error;
    }
  }

  /**
   * Asigna una mesa a una reserva (llama a la función de Supabase)
   */
  async asignarMesaReserva(reservaId: number, mesaId: number): Promise<any> {
    try {
      const { data, error } = await this.supabase.supabase
        .rpc('asignar_mesa_reserva', {
          p_reserva_id: reservaId,
          p_mesa_id: mesaId
        });

      if (error) {
        console.error('Error al asignar mesa:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error al asignar mesa a reserva:', error);
      throw new Error(error.message || 'Error al asignar la mesa');
    }
  }

  /**
   * Confirma la llegada del cliente mediante escaneo de QR
   */
  async confirmarLlegadaCliente(mesaId: number, clienteId: number): Promise<any> {
    try {
      const { data, error } = await this.supabase.supabase
        .rpc('confirmar_llegada_cliente', {
          p_mesa_id: mesaId,
          p_cliente_id: clienteId
        });

      if (error) {
        console.error('Error al confirmar llegada:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error al confirmar llegada del cliente:', error);
      throw new Error(error.message || 'Error al confirmar la llegada');
    }
  }

  /**
   * Libera las mesas vencidas (llama a la función de Supabase)
   */
  async liberarMesasVencidas(): Promise<any> {
    try {
      const { data, error } = await this.supabase.supabase
        .rpc('liberar_mesas_vencidas');

      if (error) {
        console.error('Error al liberar mesas vencidas:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      console.error('Error al liberar mesas vencidas:', error);
      throw new Error(error.message || 'Error al liberar las mesas');
    }
  }

  /**
   * Obtiene mesas disponibles para una cantidad de comensales
   */
  async obtenerMesasDisponiblesParaComensales(cantidadComensales: number): Promise<Mesa[]> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('*')
        .eq('ocupada', false)
        .eq('comensales', cantidadComensales)
        .order('numero', { ascending: true });

      if (error) {
        console.error('Error al obtener mesas para comensales:', error);
        throw new Error(`Error al obtener mesas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener mesas para comensales:', error);
      throw error;
    }
  }

  /**
   * Obtiene las capacidades de mesas disponibles (cantidades únicas)
   * Solo retorna capacidades para las cuales hay al menos una mesa disponible
   */
  async obtenerCapacidadesDisponibles(): Promise<number[]> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('comensales')
        .eq('ocupada', false)
        .order('comensales', { ascending: true });

      if (error) {
        console.error('Error al obtener capacidades:', error);
        throw new Error(`Error al obtener capacidades: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Obtener capacidades únicas
      const capacidades = [...new Set(data.map(m => m.comensales))];
      return capacidades.sort((a, b) => a - b);
    } catch (error) {
      console.error('Error al obtener capacidades disponibles:', error);
      throw error;
    }
  }

  /**
   * Verifica si hay mesas disponibles para una cantidad de comensales
   */
  async hayMesasDisponiblesParaCapacidad(cantidadComensales: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('mesas')
        .select('id')
        .eq('ocupada', false)
        .eq('comensales', cantidadComensales)
        .limit(1);

      if (error) {
        console.error('Error al verificar mesas disponibles:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar mesas disponibles:', error);
      return false;
    }
  }

  /**
   * Asigna automáticamente una mesa disponible para la cantidad de comensales
   */
  async asignarMesaAutomatica(cantidadComensales: number): Promise<Mesa | null> {
    try {
      // Obtener mesas disponibles para esa capacidad exacta
      const mesasDisponibles = await this.obtenerMesasDisponiblesParaComensales(cantidadComensales);

      if (mesasDisponibles.length === 0) {
        throw new Error(`No hay mesas disponibles para ${cantidadComensales} comensales`);
      }

      // Retornar la primera mesa disponible
      return mesasDisponibles[0];
    } catch (error) {
      console.error('Error al asignar mesa automática:', error);
      throw error;
    }
  }
}

