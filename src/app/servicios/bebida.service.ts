import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class BebidaService {
  
  sb = inject(SupabaseService);

  constructor() {}

  async uploadFoto(file: File, prefix: string): Promise<string> 
  {
    const filePath = `bebidas/${prefix}_${Date.now()}_${file.name}`;
    const { error } = await this.sb.supabase
      .storage
      .from('bebidas-fotos')
      .upload(filePath, file, { upsert: false });

    if (error) throw error;

    const { data } = this.sb.supabase
      .storage
      .from('bebidas-fotos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }


  async agregarBebida(bebida: {
    nombre: string;
    descripcion: string;
    tiempoElaboracion: number;
    precio: number;
    foto1: string;
    foto2: string;
    foto3: string;
  }) {
    const { data, error } = await this.sb.supabase
      .from('bebidas')
      .insert([bebida]);

    if (error) throw error;
    return data;
  }

  async existeBebida(nombre: string): Promise<boolean> {
    const { data, error } = await this.sb.supabase
      .from('bebidas')
      .select('id')
      .eq('nombre', nombre)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

}
