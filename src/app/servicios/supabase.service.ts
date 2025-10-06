import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Pedido } from './carrito.service';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  public supabase: SupabaseClient;
  private todosLosPedidos = signal<any[]>([]);
  pedidosPendientes = computed(() => 
    this.todosLosPedidos().filter(p => p.estado === 'pendiente')
  );

  constructor() { 
    this.supabase = createClient(
      environment.supabaseUrl, 
      environment.supabaseKey
    );
    this.inicializarRealtime();
  }

  async subirImagenPerfil(archivo: File): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('usuarios.img')
      .upload(`perfil-${archivo.name}`, archivo, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw new Error(`Error al subir la imagen: ${error.message}`);
    }

    return data.path;
  }

  async subirImagenEncuesta(archivo: File, emailCliente: string, index: number): Promise<string> {
    try {
      if (!archivo) {
        throw new Error('Archivo no válido');
      }

      if (!emailCliente) {
        throw new Error('Email del cliente no válido');
      }

      const timestamp = new Date().getTime();
      const fileName = `encuesta_${emailCliente.replace('@', '_at_')}_${timestamp}_${index}.jpg`;
      
      const { data, error } = await this.supabase.storage
        .from('encuestas.img')
        .upload(fileName, archivo, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Error al subir la imagen de encuesta: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se recibieron datos del upload');
      }

      const { data: urlData } = this.supabase.storage
        .from('encuestas.img')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen');
      }

      return urlData.publicUrl;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error al subir imagen de encuesta: ${error.message}`);
      } else {
        throw new Error('Error desconocido al subir imagen de encuesta');
      }
    }
  }

  async getPlatos(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('productos')
        .select('*')
        .eq('tipo', 'comida')
        .order('nombre', { ascending: true });
      if (error) {
        throw new Error(`Error al obtener los platos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error en getPlatos:', error);
      throw error;
    }
  }


  async getBebidas(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('bebidas')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) {
        throw new Error(`Error al obtener las bebidas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error en getBebidas:', error);
      throw error;
    }
  }

  async getPedidos(){
    try {
      const { data, error } = await this.supabase
        .from('pedidos')
        .select('*')
        .order('fecha_pedido', { ascending: true });
      if (error) {
        throw new Error(`Error al obtener los pedidos: ${error.message}`);
      }

      const pedidosParseados = (data || []).map(pedido => ({
      ...pedido,
      comidas: this.parseJsonSafe(pedido.comidas),
      bebidas: this.parseJsonSafe(pedido.bebidas), 
      postres: this.parseJsonSafe(pedido.postres)
    }));

      this.todosLosPedidos.set(pedidosParseados)

    } catch (error) {
      console.error('Error en get pedidos:', error);
      throw error;
    }
  }

  private parseJsonSafe(jsonString: any): any[] {
    try {
      if (typeof jsonString === 'string') {
        return JSON.parse(jsonString);
      }
      return jsonString || [];
    } catch {
      return [];
    }
  }

  private inicializarRealtime() {
    console.log('🔄 Inicializando realtime...');
    
    this.supabase
      .channel('pedidos-cambios')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'pedidos'
        },
        (payload) => {
          console.log('📦 Cambio detectado en BD:', payload);
          // Cuando hay cualquier cambio, recargamos los pedidos
          this.getPedidos();
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado del canal:', status);
      });
  }
  

}