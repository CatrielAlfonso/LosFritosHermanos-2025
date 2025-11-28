import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loading: HTMLIonLoadingElement | null = null;
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();
  private minLoadingTime = 1000;
  private loadingTimeout: any;
  
  // URL del logo de la empresa
  private readonly LOGO_URL = 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png';
  
  constructor(private loadingCtrl: LoadingController) {}
  
  async present(message: string = 'Por favor espere...') {
    // Usar spinner personalizado con el logo de la empresa
    this.loading = await this.loadingCtrl.create({
      message: `
        <div class="fritos-loading-content">
          <div class="fritos-loading-spinner">
            <div class="fritos-loading-ring"></div>
            <div class="fritos-loading-ring fritos-loading-ring-2"></div>
            <img src="${this.LOGO_URL}" alt="Cargando..." class="fritos-loading-logo" />
          </div>
          <p class="fritos-loading-text">${message}</p>
        </div>
      `,
      cssClass: 'fritos-custom-loading',
      spinner: null
    });
    
    // Inyectar estilos si no existen
    this.injectLoadingStyles();
    
    await this.loading.present();
  }
  
  show() {
    this._loading.next(true);
    clearTimeout(this.loadingTimeout);
  }

  hide() {
    this.loadingTimeout = setTimeout(() => {
      this._loading.next(false);
    }, this.minLoadingTime);
  }
  
  async dismiss() {
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }
  
  private injectLoadingStyles() {
    if (document.getElementById('fritos-loading-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'fritos-loading-styles';
    style.textContent = `
      .fritos-custom-loading .loading-wrapper {
        background: rgba(0, 0, 0, 0.9) !important;
        border-radius: 16px !important;
        padding: 24px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
      }
      
      .fritos-loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .fritos-loading-spinner {
        position: relative;
        width: 80px;
        height: 80px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .fritos-loading-logo {
        width: 45px;
        height: 45px;
        border-radius: 50%;
        object-fit: cover;
        z-index: 2;
        animation: fritos-loading-pulse 1.5s ease-in-out infinite;
        box-shadow: 0 0 15px rgba(255, 193, 7, 0.4);
      }
      
      @keyframes fritos-loading-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      .fritos-loading-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 3px solid transparent;
        border-top-color: #FFC107;
        border-right-color: #E53E3E;
        border-radius: 50%;
        animation: fritos-loading-spin 1.2s linear infinite;
      }
      
      .fritos-loading-ring-2 {
        width: 85%;
        height: 85%;
        border-top-color: #E53E3E;
        border-right-color: #FFC107;
        animation: fritos-loading-spin-reverse 1s linear infinite;
      }
      
      @keyframes fritos-loading-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      @keyframes fritos-loading-spin-reverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
      }
      
      .fritos-loading-text {
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





