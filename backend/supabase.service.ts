import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  public supabase: SupabaseClient;

  constructor() { 
    this.supabase = createClient(
      environment.supabaseUrl, 
      environment.supabaseKey
    );
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
}
