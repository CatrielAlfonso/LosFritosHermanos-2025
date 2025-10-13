import { Injectable } from '@angular/core';
import { NativeAudio } from '@capacitor-community/native-audio';
//import { Assets } from '@capacitor/assets';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  

  private isLoaded = false;
  // async preload() {
  //   await NativeAudio.preload({
  //     assetId: 'inicio',
  //     assetPath: '../../assets/sounds/InicioLosFritos.mp3',
  //   });
  //   await NativeAudio.preload({
  //     assetId: 'salida',
  //     assetPath: '../../assets/sounds/SalirFrito.mp3',
  //   });
  // }

  async preload() {

    if (this.isLoaded) return;

    try {
      await NativeAudio.preload({
      assetId: 'inicio',
      assetPath: '../../assets/sounds/InicioLosFritos.mp3',
      });
      await NativeAudio.preload({
        assetId: 'salida',
        assetPath: '../../assets/sounds/SalirFrito.mp3',
      });
      console.log('✅ Sonidos precargados');
      this.isLoaded = true;
    } catch (err) {
      console.error('❌ Error al precargar sonidos', err);
    }
    
    
  }

  async playInicio() {
    await NativeAudio.play({ assetId: 'inicio' });
  }

  async playSalida() {
    await NativeAudio.play({ assetId: 'salida' });
  }


}
