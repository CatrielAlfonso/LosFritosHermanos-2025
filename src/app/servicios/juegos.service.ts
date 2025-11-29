import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { FeedbackService } from './feedback-service.service';
import { AuthService } from './auth.service';

export interface EstadoDescuentoCliente {
  id: number;
  descuento_ganado: boolean;
  porcentaje_desc: number;
  esAnonimo: boolean;
}

export interface ResultadoJuego {
  exito: boolean;
  porcentaje: number;
  mensaje: string;
  descuentoAplicado: boolean;
}

// Configuración de descuentos por juego
export const JUEGOS_CONFIG = {
  'atrapa-el-pollo': { descuento: 10, nombre: 'Atrapa el Pollo' },
  'mozo-equilibrio': { descuento: 5, nombre: 'Mozo Equilibrio' },
  'mayor-menor': { descuento: 15, nombre: 'Mayor o Menor' },
  'memoria-de-sabores': { descuento: 20, nombre: 'Memoria de Sabores' }
} as const;

export type JuegoId = keyof typeof JUEGOS_CONFIG;

@Injectable({
  providedIn: 'root'
})
export class JuegosService {
  
  private sb = inject(SupabaseService);
  private feedback = inject(FeedbackService);
  private authService = inject(AuthService);

  /**
   * Verifica si el cliente puede obtener descuento (no anónimo y no ha usado su intento)
   */
  async verificarEstadoDescuento(clienteId: number): Promise<EstadoDescuentoCliente | null> {
    try {
      const { data, error } = await this.sb.supabase
        .from('clientes')
        .select('id, descuento_ganado, porcentaje_desc, nombre')
        .eq('id', clienteId)
        .single();

      if (error) {
        console.error('Error al verificar estado del cliente:', error);
        return null;
      }

      // Verificar si es cliente anónimo (nombre empieza con "Anónimo" o correo tiene "anonimo")
      const esAnonimo = data.nombre?.toLowerCase().startsWith('anónimo') || 
                        data.nombre?.toLowerCase().startsWith('anonimo');

      return {
        id: data.id,
        descuento_ganado: data.descuento_ganado || false,
        porcentaje_desc: data.porcentaje_desc || 0,
        esAnonimo
      };
    } catch (error) {
      console.error('Error en verificarEstadoDescuento:', error);
      return null;
    }
  }

  /**
   * Obtiene el cliente actual logueado
   */
  async obtenerClienteActual(): Promise<{ id: number; esAnonimo: boolean } | null> {
    try {
      const { data: authData } = await this.authService.getCurrentUser();
      
      if (!authData?.user?.email) {
        console.log('No hay usuario logueado');
        return null;
      }

      const { data: cliente, error } = await this.sb.supabase
        .from('clientes')
        .select('id, nombre')
        .eq('correo', authData.user.email)
        .single();

      if (error || !cliente) {
        console.error('Cliente no encontrado:', error);
        return null;
      }

      const esAnonimo = cliente.nombre?.toLowerCase().startsWith('anónimo') || 
                        cliente.nombre?.toLowerCase().startsWith('anonimo');

      return { id: cliente.id, esAnonimo };
    } catch (error) {
      console.error('Error obteniendo cliente actual:', error);
      return null;
    }
  }

  /**
   * Obtiene el pedido actual del cliente (en preparación o pendiente)
   */
  async obtenerPedidoActual(clienteUid: string): Promise<number | null> {
    try {
      const { data, error } = await this.sb.supabase
        .from('pedidos')
        .select('id')
        .eq('cliente_id', clienteUid)
        .in('estado', ['pendiente', 'en preparacion', 'listo'])
        .order('fecha_pedido', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error al obtener pedido actual:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('Error en obtenerPedidoActual:', error);
      return null;
    }
  }

  /**
   * Verifica si el cliente puede jugar por descuento
   * Retorna: { puedeJugarPorDescuento, yaUsoIntento, esAnonimo, descuentoActual }
   */
  async verificarElegibilidadDescuento(): Promise<{
    puedeJugarPorDescuento: boolean;
    yaUsoIntento: boolean;
    esAnonimo: boolean;
    descuentoActual: number;
    clienteId: number | null;
  }> {
    const cliente = await this.obtenerClienteActual();
    
    if (!cliente) {
      return {
        puedeJugarPorDescuento: false,
        yaUsoIntento: false,
        esAnonimo: true,
        descuentoActual: 0,
        clienteId: null
      };
    }

    // Clientes anónimos NO pueden obtener descuento
    if (cliente.esAnonimo) {
      return {
        puedeJugarPorDescuento: false,
        yaUsoIntento: false,
        esAnonimo: true,
        descuentoActual: 0,
        clienteId: cliente.id
      };
    }

    const estado = await this.verificarEstadoDescuento(cliente.id);
    
    if (!estado) {
      return {
        puedeJugarPorDescuento: false,
        yaUsoIntento: false,
        esAnonimo: false,
        descuentoActual: 0,
        clienteId: cliente.id
      };
    }

    return {
      puedeJugarPorDescuento: !estado.descuento_ganado, // Solo si NO ha usado su intento
      yaUsoIntento: estado.descuento_ganado,
      esAnonimo: false,
      descuentoActual: estado.porcentaje_desc,
      clienteId: cliente.id
    };
  }

  /**
   * Registra el resultado del juego y aplica descuento si corresponde
   * Solo funciona en el PRIMER intento y si el cliente GANA
   */
  async registrarResultadoJuego(
    juegoId: JuegoId, 
    gano: boolean
  ): Promise<ResultadoJuego> {
    const elegibilidad = await this.verificarElegibilidadDescuento();

    // Si es anónimo, puede jugar pero sin descuento
    if (elegibilidad.esAnonimo) {
      return {
        exito: gano,
        porcentaje: 0,
        mensaje: gano ? '¡Ganaste! Los clientes registrados pueden obtener descuentos.' : '¡Buen intento!',
        descuentoAplicado: false
      };
    }

    // Si ya usó su intento, puede jugar libremente pero sin más descuentos
    if (elegibilidad.yaUsoIntento) {
      return {
        exito: gano,
        porcentaje: 0,
        mensaje: gano ? '¡Ganaste! Ya tienes un descuento aplicado.' : '¡Buen intento!',
        descuentoAplicado: false
      };
    }

    // PRIMER INTENTO - Marcar como usado independientemente del resultado
    const porcentajeJuego = JUEGOS_CONFIG[juegoId].descuento;
    const porcentajeFinal = gano ? porcentajeJuego : 0;

    console.log('🎮 [registrarResultadoJuego] ====== INICIO ======');
    console.log('🎮 [registrarResultadoJuego] Juego:', juegoId);
    console.log('🎮 [registrarResultadoJuego] Ganó:', gano);
    console.log('🎮 [registrarResultadoJuego] Porcentaje del juego:', porcentajeJuego);
    console.log('🎮 [registrarResultadoJuego] Porcentaje final:', porcentajeFinal);
    console.log('🎮 [registrarResultadoJuego] Cliente ID:', elegibilidad.clienteId);

    try {
      // 1. Marcar que ya usó su intento en la tabla clientes
      console.log('🎮 [registrarResultadoJuego] Paso 1: Actualizando tabla clientes...');
      const { error: errorCliente } = await this.sb.supabase
        .from('clientes')
        .update({
          descuento_ganado: true,
          porcentaje_desc: porcentajeFinal
        })
        .eq('id', elegibilidad.clienteId);

      if (errorCliente) {
        console.error('❌ [registrarResultadoJuego] Error al actualizar cliente:', errorCliente);
        throw errorCliente;
      }
      console.log('✅ [registrarResultadoJuego] Cliente actualizado correctamente');

      // 2. Si ganó, aplicar el descuento al pedido actual
      if (gano) {
        console.log('🎮 [registrarResultadoJuego] Paso 2: Aplicando descuento al pedido...');
        const { data: authData } = await this.authService.getCurrentUser();
        console.log('🎮 [registrarResultadoJuego] Auth data:', authData);
        console.log('🎮 [registrarResultadoJuego] User ID (uid):', authData?.user?.id);
        
        if (authData?.user?.id) {
          const clienteUid = authData.user.id;
          console.log('🎮 [registrarResultadoJuego] Buscando pedido para cliente_id (uid):', clienteUid);
          
          // Buscar pedido activo del cliente
          const { data: pedidoData, error: errorBusqueda } = await this.sb.supabase
            .from('pedidos')
            .select('id, mesa, estado, descuento')
            .eq('cliente_id', clienteUid)
            .in('estado', ['pendiente', 'en preparacion', 'listo'])
            .order('fecha_pedido', { ascending: false })
            .limit(1);
          
          console.log('🎮 [registrarResultadoJuego] Resultado búsqueda pedido:', pedidoData);
          console.log('🎮 [registrarResultadoJuego] Error búsqueda:', errorBusqueda);
          
          if (pedidoData && pedidoData.length > 0) {
            const pedidoId = pedidoData[0].id;
            console.log('🎮 [registrarResultadoJuego] Pedido encontrado ID:', pedidoId);
            console.log('🎮 [registrarResultadoJuego] Pedido actual:', pedidoData[0]);
            
            const { data: updateData, error: errorPedido } = await this.sb.supabase
              .from('pedidos')
              .update({ descuento: porcentajeFinal })
              .eq('id', pedidoId)
              .select();

            console.log('🎮 [registrarResultadoJuego] Resultado update:', updateData);
            
            if (errorPedido) {
              console.error('❌ [registrarResultadoJuego] Error al aplicar descuento al pedido:', errorPedido);
            } else {
              console.log(`✅ [registrarResultadoJuego] Descuento de ${porcentajeFinal}% aplicado al pedido ${pedidoId}`);
            }
          } else {
            console.log('⚠️ [registrarResultadoJuego] No se encontró pedido activo para el cliente');
          }
        } else {
          console.log('⚠️ [registrarResultadoJuego] No hay authData.user.id disponible');
        }

        this.feedback.showToast('exito', `🎉 ¡Ganaste ${porcentajeFinal}% de descuento!`);
        
        console.log('🎮 [registrarResultadoJuego] ====== FIN (GANÓ) ======');
        return {
          exito: true,
          porcentaje: porcentajeFinal,
          mensaje: `🎉 ¡Felicitaciones! Ganaste ${porcentajeFinal}% de descuento en tu pedido.`,
          descuentoAplicado: true
        };
      } else {
        this.feedback.showToast('exito', 'No ganaste descuento. ¡Pero podés seguir jugando!');
        
        console.log('🎮 [registrarResultadoJuego] ====== FIN (PERDIÓ) ======');
        return {
          exito: false,
          porcentaje: 0,
          mensaje: '¡Buen intento! No obtuviste descuento, pero podés seguir jugando libremente.',
          descuentoAplicado: false
        };
      }
    } catch (error) {
      console.error('💥 [registrarResultadoJuego] Error general:', error);
      return {
        exito: gano,
        porcentaje: 0,
        mensaje: 'Error al procesar el resultado. Intentá nuevamente.',
        descuentoAplicado: false
      };
    }
  }

  /**
   * Obtiene el descuento disponible para un juego específico
   */
  getDescuentoJuego(juegoId: JuegoId): number {
    return JUEGOS_CONFIG[juegoId]?.descuento || 0;
  }
}
