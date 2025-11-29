import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  
  private audioInicio: HTMLAudioElement | null = null;
  private audioSalida: HTMLAudioElement | null = null;
  private isLoaded = false;

  async preload() {
    if (this.isLoaded) return;

    try {
      // Crear elementos de audio para reproducir desde URLs
      this.audioInicio = new Audio('https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/sonidos/InicioLosFritos.mp3');
      this.audioSalida = new Audio('https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/sonidos/SalirFrito.mp3');
      
      // Precargar los audios
      this.audioInicio.load();
      this.audioSalida.load();
      
      console.log('✅ Sonidos precargados desde Supabase');
      this.isLoaded = true;
    } catch (err) {
      console.error('❌ Error al precargar sonidos desde Supabase', err);
    }
  }

  async playInicio() {
    try {
      if (!this.audioInicio) {
        await this.preload();
      }
      if (this.audioInicio) {
        this.audioInicio.currentTime = 0; // Reiniciar al inicio
        await this.audioInicio.play();
      }
    } catch (error) {
      console.error('Error al reproducir audio de inicio:', error);
    }
  }

  async playSalida() {
    try {
      if (!this.audioSalida) {
        await this.preload();
      }
      if (this.audioSalida) {
        this.audioSalida.currentTime = 0; // Reiniciar al inicio
        await this.audioSalida.play();
      }
    } catch (error) {
      console.error('Error al reproducir audio de salida:', error);
    }
  }
}
