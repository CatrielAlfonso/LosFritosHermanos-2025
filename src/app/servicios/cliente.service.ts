import { Injectable,inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  
   private sb = inject(SupabaseService);

  async checkIn(clienteId: number): Promise<void> {
    
    // 1. Verificar si el cliente ya está en la lista de espera
    const { data: existing, error: searchError } = await this.sb.supabase
      .from('lista_espera')
      .select('id')
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (searchError) throw searchError;

    if (existing) {
      // El cliente ya está en la lista de espera
      throw new Error('Ya estás registrado en la lista de espera.');
    }

    // 2. Obtener los datos necesarios de la tabla 'clientes' para la lista de espera
    const { data: clienteInfo, error: infoError } = await this.sb.supabase
      .from('clientes')
      .select('nombre, correo') // Campos necesarios para la lista
      .eq('id', clienteId)
      .single();

    if (infoError || !clienteInfo) throw new Error('No se pudo obtener la información del cliente.');


    // 3. Insertar el nuevo registro en la lista de espera
    const { error: insertError } = await this.sb.supabase
      .from('lista_espera')
      .insert({
        cliente_id: clienteId, // Clave foránea al cliente principal
        nombre: clienteInfo.nombre,
        correo: clienteInfo.correo,
        fecha_ingreso: new Date().toISOString(), // Usar hora actual del servidor/app
        // mesa_asignada: null (Esto se establece por defecto en la BD)
      });

    if (insertError) throw insertError;
  }

}
