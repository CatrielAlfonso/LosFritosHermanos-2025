import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

export interface DireccionDelivery {
  calle: string;
  numero: string;
  piso?: string;
  depto?: string;
  referencia?: string;
  direccionCompleta: string;
  latitud?: number;
  longitud?: number;
}

export interface PedidoDelivery {
  id?: number;
  cliente_id: number;
  cliente_email: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  
  // Dirección
  direccion_calle: string;
  direccion_numero: string;
  direccion_piso?: string;
  direccion_depto?: string;
  direccion_referencia?: string;
  direccion_completa: string;
  latitud?: number;
  longitud?: number;
  
  // Productos
  comidas: any[];
  bebidas: any[];
  postres: any[];
  productos?: any[]; // Array combinado de todos los productos (para compatibilidad)
  precio_productos: number;
  precio_envio: number;
  precio_total: number;
  propina?: number; // Propina del cliente
  
  // Estado
  estado?: string;
  estado_comida?: string;
  estado_bebida?: string;
  estado_postre?: string;
  
  tiempo_estimado?: number;
  observaciones_generales?: string;
  
  // Repartidor
  repartidor_id?: number;
  repartidor_nombre?: string;
  
  // Pago
  metodo_pago?: string;
  pagado?: boolean;
  
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DeliveryService {

  constructor(
    private supabase: SupabaseService,
    private authService: AuthService
  ) { }

  /**
   * Crea un nuevo pedido delivery
   */
  async crearPedidoDelivery(pedido: Omit<PedidoDelivery, 'id' | 'created_at' | 'updated_at'>): Promise<PedidoDelivery> {
    // Verificar que el usuario esté autenticado
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user) {
      throw new Error('Debes estar autenticado para hacer un pedido delivery');
    }

    // Verificar que el usuario sea cliente
    const perfil = this.authService.getPerfilUsuario();
    if (perfil !== 'cliente') {
      throw new Error('Solo los clientes registrados pueden hacer pedidos delivery');
    }

    // Insertar el pedido
    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .insert([pedido])
      .select()
      .single();

    if (error) {
      console.error('Error al crear pedido delivery:', error);
      throw new Error(`Error al crear el pedido: ${error.message}`);
    }

    // Notificar al restaurante sobre el nuevo pedido
    try {
      await this.notificarNuevoPedidoDelivery(data);
    } catch (notifError) {
      console.error('Error al notificar nuevo pedido delivery:', notifError);
      // No lanzamos error para no fallar la creación del pedido
    }

    return data;
  }

  /**
   * Obtiene los pedidos delivery del cliente autenticado
   */
  async obtenerPedidosCliente(): Promise<PedidoDelivery[]> {
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('Debes estar autenticado para ver tus pedidos');
    }

    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .select('*')
      .eq('cliente_email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener pedidos delivery:', error);
      throw new Error(`Error al obtener los pedidos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtiene un pedido por ID
   */
  async obtenerPedidoPorId(id: number): Promise<PedidoDelivery | null> {
    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error al obtener pedido:', error);
      return null;
    }

    return data;
  }

  /**
   * Calcula el precio de envío basado en coordenadas
   */
  calcularPrecioEnvio(latitud?: number, longitud?: number): number {
    // Precio base de envío
    const precioBase = 500;
    
    if (!latitud || !longitud) {
      return precioBase;
    }

    // Coordenadas del restaurante (ejemplo, ajustar según ubicación real)
    const latRestaurante = -34.6037;
    const lngRestaurante = -58.3816;

    // Calcular distancia aproximada en km
    const distanciaKm = this.calcularDistancia(
      latRestaurante, 
      lngRestaurante, 
      latitud, 
      longitud
    );

    // Precio por km
    const precioPorKm = 100;
    
    // Calcular precio total
    const precioEnvio = precioBase + (Math.ceil(distanciaKm) * precioPorKm);
    
    return precioEnvio;
  }

  /**
   * Calcula la distancia entre dos puntos usando fórmula de Haversine
   */
  private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c;
    
    return distancia;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Notifica al restaurante sobre un nuevo pedido delivery
   */
  private async notificarNuevoPedidoDelivery(pedido: PedidoDelivery): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/notify-new-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pedidoId: pedido.id,
          clienteNombre: pedido.cliente_nombre,
          direccion: pedido.direccion_completa,
          precioTotal: pedido.precio_total
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error al notificar nuevo pedido delivery:', error);
      throw error;
    }
  }

  /**
   * Cancela un pedido delivery (solo si está pendiente)
   */
  async cancelarPedido(id: number): Promise<void> {
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('Debes estar autenticado para cancelar un pedido');
    }

    // Verificar que el pedido pertenezca al cliente
    const pedido = await this.obtenerPedidoPorId(id);
    if (!pedido) {
      throw new Error('Pedido no encontrado');
    }

    if (pedido.cliente_email !== user.email) {
      throw new Error('No tienes permiso para cancelar este pedido');
    }

    if (pedido.estado !== 'pendiente' && pedido.estado !== 'confirmado') {
      throw new Error('Solo puedes cancelar pedidos pendientes o confirmados');
    }

    // Actualizar el estado a cancelado
    const { error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (error) {
      console.error('Error al cancelar pedido:', error);
      throw new Error(`Error al cancelar el pedido: ${error.message}`);
    }
  }

  /**
   * Obtiene información del cliente autenticado
   */
  async obtenerInfoCliente(): Promise<{ id: number; nombre: string; apellido: string; email: string; telefono?: string } | null> {
    try {
      const { data: { user } } = await this.supabase.supabase.auth.getUser();
      if (!user || !user.email) {
        return null;
      }

      const { data: cliente } = await this.supabase.supabase
        .from('clientes')
        .select('id, nombre, apellido, correo, telefono')
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
        telefono: cliente.telefono
      };
    } catch (error) {
      console.error('Error obteniendo info del cliente:', error);
      return null;
    }
  }

  /**
   * Obtiene TODOS los pedidos delivery (para dueños/supervisores)
   */
  async obtenerTodosPedidosDelivery(): Promise<PedidoDelivery[]> {
    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener todos los pedidos delivery:', error);
      throw new Error(`Error al obtener los pedidos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Confirma un pedido delivery y notifica al cliente
   */
  async confirmarPedidoDelivery(id: number, tiempoEstimado: number): Promise<void> {
    // Actualizar el estado a confirmado
    const { data: pedido, error: updateError } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ 
        estado: 'confirmado',
        tiempo_estimado: tiempoEstimado,
        hora_confirmacion: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error al confirmar pedido:', updateError);
      throw new Error(`Error al confirmar el pedido: ${updateError.message}`);
    }

    // Asignar repartidor disponible automáticamente
    const { data: repartidor, error: repartidorError } = await this.supabase.supabase
      .rpc('asignar_repartidor_disponible', { pedido_id_param: id });

    if (repartidorError) {
      console.error('Error al asignar repartidor:', repartidorError);
    } else if (repartidor) {
      console.log('Repartidor asignado:', repartidor);
      // Enviar notificación al repartidor
      await this.notificarRepartidorPedido(repartidor.correo, id, 
        pedido.cliente_nombre, pedido.direccion_completa);
    }

    // Notificar al cliente
    try {
      await this.notificarClienteEstadoPedido(pedido, 'confirmado', tiempoEstimado);
    } catch (notifError) {
      console.error('Error al notificar al cliente:', notifError);
      // No lanzamos error para no bloquear la confirmación
    }
  }

  /**
   * Rechaza un pedido delivery y notifica al cliente
   */
  async rechazarPedidoDelivery(id: number, motivo: string): Promise<void> {
    // Actualizar el estado a cancelado
    const { data: pedido, error: updateError } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ 
        estado: 'cancelado',
        motivo_rechazo: motivo
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error al rechazar pedido:', updateError);
      throw new Error(`Error al rechazar el pedido: ${updateError.message}`);
    }

    // Notificar al cliente
    try {
      await this.notificarClienteEstadoPedido(pedido, 'rechazado', 0, motivo);
    } catch (notifError) {
      console.error('Error al notificar al cliente:', notifError);
      // No lanzamos error para no bloquear el rechazo
    }
  }

  /**
   * Notifica al cliente sobre el cambio de estado de su pedido
   */
  private async notificarClienteEstadoPedido(
    pedido: PedidoDelivery, 
    nuevoEstado: string, 
    tiempoEstimado?: number,
    motivo?: string
  ): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080';

      const response = await fetch(`${backendUrl}/notify-client-delivery-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clienteEmail: pedido.cliente_email,
          pedidoId: pedido.id,
          estado: nuevoEstado,
          tiempoEstimado: tiempoEstimado,
          motivo: motivo
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('✅ Cliente notificado sobre cambio de estado del pedido');
    } catch (error) {
      console.error('Error al notificar al cliente:', error);
      throw error;
    }
  }

  /**
   * Crea un pedido en la tabla pedidos (para derivar a cocina/bar)
   */
  async crearPedidoRestaurante(pedido: any): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('pedidos')
      .insert([pedido])
      .select()
      .single();

    if (error) {
      console.error('Error al crear pedido en restaurante:', error);
      throw new Error(`Error al crear el pedido: ${error.message}`);
    }

    return data;
  }

  // ========================================
  // MÉTODOS PARA REPARTIDORES
  // ========================================

  /**
   * Obtiene información del repartidor autenticado
   */
  async obtenerInfoRepartidor(email: string): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .from('repartidores')
      .select('*')
      .eq('correo', email)
      .single();

    if (error) {
      console.error('Error al obtener info del repartidor:', error);
      throw new Error(`Error al obtener información: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtiene los pedidos asignados a un repartidor
   */
  async obtenerPedidosRepartidor(repartidorId: number): Promise<PedidoDelivery[]> {
    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .select('*')
      .eq('repartidor_id', repartidorId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener pedidos del repartidor:', error);
      throw new Error(`Error al obtener pedidos: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Confirma que el repartidor ha recibido el pedido
   */
  async confirmarRecepcionRepartidor(pedidoId: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ 
        estado: 'preparando',
        updated_at: new Date().toISOString()
      })
      .eq('id', pedidoId);

    if (error) {
      console.error('Error al confirmar recepción:', error);
      throw new Error(`Error al confirmar: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de un pedido delivery
   */
  async actualizarEstadoPedidoDelivery(pedidoId: number, nuevoEstado: string): Promise<void> {
    const updateData: any = { 
      estado: nuevoEstado,
      updated_at: new Date().toISOString()
    };

    // Agregar timestamp específico según el estado
    if (nuevoEstado === 'en_camino') {
      updateData.hora_en_camino = new Date().toISOString();
    }

    const { error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update(updateData)
      .eq('id', pedidoId);

    if (error) {
      console.error('Error al actualizar estado:', error);
      throw new Error(`Error al actualizar: ${error.message}`);
    }

    // Notificar al cliente
    try {
      const pedido = await this.obtenerPedidoPorId(pedidoId);
      if (pedido) {
        await this.notificarClienteEstadoPedido(pedido, nuevoEstado);
      }
    } catch (notifError) {
      console.error('Error al notificar cliente:', notifError);
    }
  }

  /**
   * Marca un pedido como entregado
   */
  async marcarPedidoEntregado(pedidoId: number): Promise<void> {
    const { data: pedido, error: updateError } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ 
        estado: 'entregado',
        hora_entrega: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', pedidoId)
      .select()
      .single();

    if (updateError) {
      console.error('Error al marcar como entregado:', updateError);
      throw new Error(`Error al actualizar: ${updateError.message}`);
    }

    // Liberar repartidor (marcarlo como disponible nuevamente)
    if (pedido.repartidor_id) {
      const { error: repartidorError } = await this.supabase.supabase
        .from('repartidores')
        .update({ 
          disponible: true,
          // Incrementar pedidos completados se manejará con un trigger en BD o manualmente
        })
        .eq('id', pedido.repartidor_id);

      if (repartidorError) {
        console.error('Error al actualizar repartidor:', repartidorError);
      }
    }

    // Notificar al cliente
    try {
      await this.notificarClienteEstadoPedido(pedido, 'entregado');
    } catch (notifError) {
      console.error('Error al notificar cliente:', notifError);
    }
  }

  /**
   * Notifica al repartidor sobre un nuevo pedido asignado
   */
  private async notificarRepartidorPedido(
    repartidorEmail: string, 
    pedidoId: number, 
    clienteNombre: string, 
    direccion: string
  ): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/notify-repartidor-pedido`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repartidorEmail,
          pedidoId,
          clienteNombre,
          direccion
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Notificación enviada al repartidor exitosamente');
    } catch (error) {
      console.error('Error al notificar al repartidor:', error);
      // No lanzar error para no afectar el flujo principal
    }
  }

  // NOTA: obtenerInfoCliente ya está implementado arriba (línea ~270)

  /**
   * Guarda una encuesta de satisfacción de delivery
   */
  async guardarEncuestaDelivery(encuesta: any): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('encuestas_delivery')
      .insert([encuesta]);

    if (error) {
      console.error('Error al guardar encuesta:', error);
      throw new Error(`Error al guardar la encuesta: ${error.message}`);
    }
  }

  /**
   * Actualiza la propina de un pedido delivery
   */
  async actualizarPropinaDelivery(pedidoId: number, propina: number): Promise<void> {
    const { error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .update({ propina })
      .eq('id', pedidoId);

    if (error) {
      console.error('Error al actualizar propina:', error);
      throw new Error(`Error al actualizar la propina: ${error.message}`);
    }
  }

  /**
   * Genera y envía la boleta de delivery en PDF por correo
   */
  async generarYEnviarBoletaDelivery(pedidoId: number, propina: number): Promise<void> {
    try {
      const backendUrl = 'https://los-fritos-hermanos-backend.onrender.com';
      // const backendUrl = 'http://localhost:8080'; // Para desarrollo local
      
      const response = await fetch(`${backendUrl}/generar-boleta-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pedidoId,
          propina
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Boleta generada y enviada:', result);
    } catch (error) {
      console.error('Error al generar y enviar boleta:', error);
      throw error;
    }
  }

  /**
   * Obtiene las encuestas de un cliente
   */
  async obtenerEncuestasCliente(): Promise<any[]> {
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('No hay usuario autenticado');
    }

    const cliente = await this.obtenerInfoCliente();
    
    if (!cliente) {
      throw new Error('No se pudo obtener información del cliente');
    }

    const { data, error } = await this.supabase.supabase
      .from('encuestas_delivery')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener encuestas:', error);
      throw new Error(`Error al obtener las encuestas: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Obtiene estadísticas de encuestas (para gráficos)
   */
  async obtenerEstadisticasEncuestas(): Promise<any> {
    const { data, error } = await this.supabase.supabase
      .rpc('obtener_estadisticas_encuestas_delivery');

    if (error) {
      console.error('Error al obtener estadísticas:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  }

  /**
   * Obtiene pedidos de delivery del cliente actual
   */
  async obtenerPedidosClienteActual(): Promise<PedidoDelivery[]> {
    const { data: { user } } = await this.supabase.supabase.auth.getUser();
    if (!user || !user.email) {
      throw new Error('No hay usuario autenticado');
    }

    const { data, error } = await this.supabase.supabase
      .from('pedidos_delivery')
      .select('*')
      .eq('cliente_email', user.email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener pedidos del cliente:', error);
      throw new Error(`Error al obtener los pedidos: ${error.message}`);
    }

    return data || [];
  }
}

