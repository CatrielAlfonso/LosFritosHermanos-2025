import { Injectable } from '@angular/core';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'; 
import { CustomLoader } from './custom-loader.service';
import { Vibration } from '@awesome-cordova-plugins/vibration/ngx';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  
  private currentLoading: any = null;
  
  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private customLoader: CustomLoader,
    private vibration: Vibration,
    private customLoader: CustomLoader,
    private alertCtrl: AlertController
  ) {}

  private mensajesGraciosos = {
    exito: [
      "✅ ¡De una, capo! La bebida quedó cargada como piña 🍹",
      "🎉 ¡Listo el pollo y pelada la gallina! Tu bebida ya está en el menú 🐔",
      "👌 Tranqui mostro, la bebida entró derechita al sistema"
    ],
    error: [
      "❌ Uy no... se nos quemó el pollo 😅",
      "🚨 ¡Apa! Algo salió torcido, fijate de nuevo",
      "💥 Bomba atómica: no se pudo guardar la bebida"
    ],
    loading: [
      "🔥 Estamos cocinando tu bebida, bancá un toque...",
      "🍟 Friendo las papas... ya sale tu pedido",
      "🍺 Tirando la birra... aguantá unos segundos"
    ]
  };

  async showToast(tipo: 'exito' | 'error', mensaje?: string) {
    const textos = this.mensajesGraciosos[tipo];
    const texto = mensaje || textos[Math.floor(Math.random() * textos.length)];

    const toast = await this.toastCtrl.create({
      message: texto,
      duration: 2500,
      position: 'top',
      color: tipo === 'exito' ? 'success' : 'danger',
      cssClass: 'custom-toast'
    });

    if (tipo === 'error') {
      await this.vibrarFuerte(); 
    } else if (tipo === 'exito') {
      this.vibration.vibrate(100);
      await this.vibrarSuave();
    }

    await toast.present();
  }

  async showLoading(textoPersonalizado?: string) {
    const texto = textoPersonalizado || this.mensajesGraciosos.loading[
      Math.floor(Math.random() * this.mensajesGraciosos.loading.length)
    ];

    // Usar CustomLoader con el logo de la empresa
    this.customLoader.show(texto);
    
    // Retornar un objeto compatible con la API anterior
    return {
      dismiss: () => {
        this.customLoader.hide();
        return Promise.resolve();
      }
    };
  }

  hide() {
    this.customLoader.hide();
  }

  async vibrarFuerte() {
    try {
      // Vibración de error: patrón largo y fuerte
      await Haptics.vibrate({ duration: 500 });
    } catch (err) {
      console.warn('No se pudo vibrar (no es un dispositivo móvil)');
    }
  }

  async vibrarSuave() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light }); // Vibración leve ✨
    } catch (err) {
      console.warn('No se pudo vibrar (no es un dispositivo móvil)');
    }
  }

  async vibrarError() {
    try {
      // Patrón de vibración para errores: 3 vibraciones cortas
      await Haptics.vibrate({ duration: 200 });
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.vibrate({ duration: 200 });
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.vibrate({ duration: 200 });
    } catch (err) {
      console.warn('No se pudo vibrar (no es un dispositivo móvil)');
    }
  }

  async vibrarNotificacion() {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (err) {
      // Fallback a vibración simple
      try {
        await Haptics.vibrate({ duration: 300 });
      } catch (e) {
        console.warn('No se pudo vibrar (no es un dispositivo móvil)');
      }
    }
  }

  // Método para mostrar alertas de error con vibración
  async showErrorAlert(titulo: string, mensaje: string) {
    await this.vibrarError();
    
    const alert = await this.alertCtrl.create({
      header: titulo,
      message: mensaje,
      buttons: ['OK'],
      cssClass: 'error-alert'
    });
    
    await alert.present();
  }

  async mostrarLoaderPolloFrito() {
    // Usar CustomLoader con el logo de la empresa
    this.customLoader.show('Preparando tu pedido...');
    
    // Retornar un objeto compatible con la API anterior
    return {
      dismiss: () => {
        this.customLoader.hide();
        return Promise.resolve();
      }
    };
  }
}
