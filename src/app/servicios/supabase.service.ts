import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Pedido } from './carrito.service';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  public supabase: SupabaseClient;
  todosLosPedidos = signal<any[]>([]);
  pedidosPendientes = computed(() => 
    this.todosLosPedidos().filter(p => p.estado === 'pendiente')
  );
  pedidosDelCliente = (clienteId: string) => computed(() => 
    this.todosLosPedidos().filter(pedido => pedido.cliente_id === clienteId)
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
        .from('productos')
        .select('*')
        .eq('tipo', 'bebida')
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

  async getPostres(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('productos')
        .select('*')
        .eq('tipo', 'postre')
        .order('nombre', { ascending: true });
      if (error) {
        throw new Error(`Error al obtener las bebidas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error en getPostre:', error);
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
        return null
      }

      const pedidosParseados = (data || []).map(pedido => ({
        ...pedido,
        comidas: this.parseJsonSafe(pedido.comidas),
        bebidas: this.parseJsonSafe(pedido.bebidas), 
        postres: this.parseJsonSafe(pedido.postres)
      }));

      this.todosLosPedidos.set(pedidosParseados)
      return data

    } catch (error) {
      console.error('Error en get pedidos:', error);
      throw error;
    }
  }

  async getPedido(pedidoId: string) {
    try {
      const { data, error } = await this.supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error obteniendo pedido:', error);
      throw error;
    }
  }

  async getMesa(numeroMesa: number) {
    try {
      const { data, error } = await this.supabase
        .from('mesas')
        .select('*')
        .eq('numero', numeroMesa)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error obteniendo mesa:', error);
      throw error;
    }
  }

  async getPedidosCliente(idCliente : string){
    try{
      const { data, error } = await this.supabase
      .from('pedidos')
      .select('*')
      .eq('cliente_id', idCliente)

      if (error) {
        console.log('Error al traer los pedidos del cliente:', error);
        return null;
      }
      return data;

    }catch(error){
      console.log(`error nal traer los pedidos del cliente`, error)
      return null
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

  async cargarPedidos() {
    const data = await this.getPedidos()
    if(data) this.todosLosPedidos.set(data)
  }

  async actualizarPedido(pedidoId: number, updates: Partial<Pedido>) {
    try {
      const { data, error } = await this.supabase
        .from('pedidos')
        .update(updates)
        .eq('id', pedidoId)
        .select();

      if (error) {
        throw new Error(`Error al actualizar pedido: ${error.message}`);
      }

      console.log('✅ Pedido actualizado:', data);
      return data?.[0] || null;
      
    } catch (error) {
      console.error('Error en actualizarPedido:', error);
      throw error;
    }
  }

  async actualizarMesa(numeroMesa : number, updates : any){
    try{
      const { data, error } = await this.supabase
        .from('mesas')
        .update(updates)
        .eq('numero', numeroMesa)
        .select();

      if (error) {
        throw new Error(`Error al actualizar pedido: ${error.message}`);
      }

      console.log('✅ mesa actualizada:', data);
      return data?.[0] || null;
      
    }catch(error){
      console.log(error)
    }
  }

  async eliminarPedido(pedidoId : string){
    try{
      const { data, error } = await this.supabase
      .from('pedidos')
      .delete()
      .eq('id', pedidoId)
      
      if (error) {
        throw new Error(`Error al eliminar pedido: ${error.message}`);
      }

    }catch(error){
      console.error('Error en actualizarPedido:', error);
      throw error;
    }
  }
  

}