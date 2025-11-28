import { Injectable } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics'; 

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  
  // URL del logo de la empresa
  private readonly LOGO_URL = 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png';
  
  constructor(
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    this.injectSpinnerStyles();
  }

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
      await this.vibrarSuave();
    }

    await toast.present();
  }

  async showLoading(textoPersonalizado?: string) {
    const texto = textoPersonalizado || this.mensajesGraciosos.loading[
      Math.floor(Math.random() * this.mensajesGraciosos.loading.length)
    ];

    const loading = await this.loadingCtrl.create({
      message: `
        <div class="fritos-feedback-spinner">
          <div class="fritos-feedback-ring"></div>
          <div class="fritos-feedback-ring fritos-feedback-ring-2"></div>
          <img src="${this.LOGO_URL}" alt="Cargando..." class="fritos-feedback-logo" />
        </div>
        <p class="fritos-feedback-text">${texto}</p>
      `,
      spinner: null,
      cssClass: 'fritos-feedback-loading'
    });

    await loading.present();
    return loading;
  }

  hide() {
    this.loadingCtrl.dismiss();
  }

  async vibrarFuerte() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy }); // Vibración fuerte 💥
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

  async mostrarLoaderPolloFrito() {
    const loading = await this.loadingCtrl.create({
      spinner: null,
      message: `
        <div class="fritos-feedback-spinner fritos-large">
          <div class="fritos-feedback-ring"></div>
          <div class="fritos-feedback-ring fritos-feedback-ring-2"></div>
          <img src="${this.LOGO_URL}" alt="Cargando..." class="fritos-feedback-logo" />
        </div>
        <p class="fritos-feedback-text">Preparando tu pedido...</p>
      `,
      cssClass: 'fritos-feedback-loading',
      backdropDismiss: false
    });
    await loading.present();
    return loading;
  }

  private injectSpinnerStyles() {
    if (document.getElementById('fritos-feedback-spinner-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'fritos-feedback-spinner-styles';
    style.textContent = `
      .fritos-feedback-loading .loading-wrapper {
        background: rgba(0, 0, 0, 0.9) !important;
        border-radius: 16px !important;
        padding: 24px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }
      
      .fritos-feedback-spinner {
        position: relative;
        width: 80px;
        height: 80px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .fritos-feedback-spinner.fritos-large {
        width: 100px;
        height: 100px;
      }
      
      .fritos-feedback-logo {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        object-fit: cover;
        z-index: 2;
        animation: fritos-fb-pulse 1.5s ease-in-out infinite;
        box-shadow: 0 0 15px rgba(255, 193, 7, 0.4);
      }
      
      .fritos-large .fritos-feedback-logo {
        width: 60px;
        height: 60px;
      }
      
      @keyframes fritos-fb-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      .fritos-feedback-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 3px solid transparent;
        border-top-color: #FFC107;
        border-right-color: #E53E3E;
        border-radius: 50%;
        animation: fritos-fb-spin 1.2s linear infinite;
      }
      
      .fritos-large .fritos-feedback-ring {
        border-width: 4px;
      }
      
      .fritos-feedback-ring-2 {
        width: 85%;
        height: 85%;
        border-top-color: #E53E3E;
        border-right-color: #FFC107;
        animation: fritos-fb-spin-reverse 1s linear infinite;
      }
      
      @keyframes fritos-fb-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes fritos-fb-spin-reverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
      }
      
      .fritos-feedback-text {
        margin-top: 16px;
        color: #FFC107;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        letter-spacing: 0.5px;
      }
    `;
    document.head.appendChild(style);
  }
}
