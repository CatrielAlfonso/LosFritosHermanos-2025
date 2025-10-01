import { Injectable } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';


@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  
  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
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

    await toast.present();
  }

  async showLoading(textoPersonalizado?: string) {


    if (textoPersonalizado) {
      const loading = await this.loadingCtrl.create({
        message: textoPersonalizado,
        spinner: 'crescent',
        cssClass: 'custom-loading'
        });
      await loading.present();
      return loading;
    }
    else {
      const texto = this.mensajesGraciosos.loading[
      Math.floor(Math.random() * this.mensajesGraciosos.loading.length)
      ];

      const loading = await this.loadingCtrl.create({
        message: texto,
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });

      await loading.present();
      return loading;
    }
    

  }

  hide() {
    this.loadingCtrl.dismiss();
  }


}
