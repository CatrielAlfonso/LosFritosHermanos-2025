import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { FeedbackService } from './feedback-service.service';
import { CustomLoader } from './custom-loader.service';

interface Cliente {
  id: number;
  descuento_ganado: boolean;
  porcentaje_desc: number;
  
}


@Injectable({
  providedIn: 'root'
})
export class JuegosService {
  
  private sb = inject(SupabaseService);
  private feedback = inject(FeedbackService);

  // --- REGLAS DE NEGOCIO ---
  private readonly REGLAS = {
    MAX_INTENTOS_DESCUENTO: 1,
    JUEGO_DEL_DESCUENTO: 'atrapa_pollo' // Identificador del juego que da el descuento
  };

  /**
   * 1. Verifica si el cliente ya ha usado su intento para ganar el descuento.
   * @param clienteId ID del cliente autenticado.
   * @returns El estado del cliente (si ya ganó y el porcentaje).
   */
  async verificarEstadoDescuento(clienteId: number): Promise<Cliente> {
    const { data, error } = await this.sb.supabase
      .from('clientes')
      .select('id, descuento_ganado, porcentaje_desc')
      .eq('id', clienteId)
      .single();

    if (error) {
      throw new Error(`Error al verificar el estado del cliente: ${error.message}`);
    }

    return data as Cliente;
  }

  /**
   * 2. Registra el resultado del intento único de descuento en Supabase.
   *
   * @param clienteId ID del cliente.
   * @param porcentaje Porcentaje de descuento ganado (0, 5, 10, 15).
   * @param juego Tipo de juego jugado (debería ser 'atrapa_pollo' para el intento).
   */
  async registrarResultadoDescuento(clienteId: number, porcentaje: number, juego: string): Promise<boolean> {
    
    // Paso de seguridad: Verificar si el cliente ya usó su intento (Doble chequeo)
    const estadoActual = await this.verificarEstadoDescuento(clienteId);
    
    if (estadoActual.descuento_ganado) {
      this.feedback.showToast('error', 'El intento de descuento ya fue consumido.');
      return false; 
    }

    const { error } = await this.sb.supabase
      .from('clientes')
      .update({
        // Se marca como true, independientemente si ganó 0% o 15%
        descuento_ganado: true,
        // Solo actualiza el porcentaje si es mayor a cero, pero si el 
        // cliente ya tenía un 0% marcado, esta línea actualizará con el nuevo porcentaje (0 o > 0).
        porcentaje_desc: porcentaje 
      })
      .eq('id', clienteId);

    if (error) {
      console.error('Error al registrar resultado del juego:', error);
      throw new Error(`Fallo al registrar el descuento: ${error.message}`);
    }
    
    this.feedback.showToast('exito', `Descuento de ${porcentaje}% registrado con éxito.`);
    return true;
  }


  


}
