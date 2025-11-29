import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CustomLoader {
  private loaderElement?: HTMLElement;
  private styleElement?: HTMLStyleElement;
  
  // URL del logo de la empresa
  private readonly LOGO_URL = 'https://jpwlvaprtxszeimmimlq.supabase.co/storage/v1/object/public/FritosHermanos/crispy2.png';

  show(mensaje: string = 'Cargando...') {
    // Evita duplicados
    if (this.loaderElement) return;

    // Limpiar estilos duplicados antes de inyectar
    this.cleanupDuplicateStyles();
    
    // Inyectar estilos si no existen
    this.injectStyles();

    const overlay = document.createElement('div');
    overlay.classList.add('fritos-loader-overlay');
    overlay.innerHTML = `
      <div class="fritos-loader-container">
        <div class="fritos-loader-ring"></div>
        <div class="fritos-loader-ring fritos-loader-ring-2"></div>
        <img src="${this.LOGO_URL}" alt="Cargando..." class="fritos-loader-logo" />
      </div>
      <p class="fritos-loader-text">${mensaje}</p>
    `;
    document.body.appendChild(overlay);
    this.loaderElement = overlay;
  }

  private cleanupDuplicateStyles() {
    // Eliminar estilos duplicados de servicios anteriores
    const oldStyles = [
      'fritos-loading-styles',
      'fritos-feedback-spinner-styles'
    ];
    
    oldStyles.forEach(id => {
      const existingStyle = document.getElementById(id);
      if (existingStyle) {
        existingStyle.remove();
      }
    });
  }

  hide() {
    if (this.loaderElement) {
      this.loaderElement.classList.add('fritos-loader-fade-out');
      setTimeout(() => {
        if (this.loaderElement) {
          this.loaderElement.remove();
          this.loaderElement = undefined;
        }
      }, 300);
    }
  }

  private injectStyles() {
    // Verificar si ya existen los estilos en el DOM
    if (this.styleElement || document.getElementById('fritos-loader-styles')) return;

    const style = document.createElement('style');
    style.id = 'fritos-loader-styles';
    style.textContent = `
      .fritos-loader-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 99999;
        animation: fritos-loader-fade-in 0.3s ease;
      }

      .fritos-loader-fade-out {
        animation: fritos-loader-fade-out 0.3s ease forwards;
      }

      @keyframes fritos-loader-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fritos-loader-fade-out {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .fritos-loader-container {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .fritos-loader-logo {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        object-fit: cover;
        z-index: 2;
        animation: fritos-loader-pulse 1.5s ease-in-out infinite;
        box-shadow: 0 0 20px rgba(255, 193, 7, 0.5);
      }

      @keyframes fritos-loader-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .fritos-loader-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 4px solid transparent;
        border-top-color: #FFC107;
        border-right-color: #E53E3E;
        border-radius: 50%;
        animation: fritos-loader-spin 1.2s linear infinite;
      }

      .fritos-loader-ring-2 {
        width: 90%;
        height: 90%;
        border-top-color: #E53E3E;
        border-right-color: #FFC107;
        animation: fritos-loader-spin-reverse 1s linear infinite;
      }

      @keyframes fritos-loader-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes fritos-loader-spin-reverse {
        0% { transform: rotate(360deg); }
        100% { transform: rotate(0deg); }
      }

      .fritos-loader-text {
        margin-top: 24px;
        color: #FFC107;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        letter-spacing: 1px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        animation: fritos-loader-text-pulse 1.5s ease-in-out infinite;
      }

      @keyframes fritos-loader-text-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);
    this.styleElement = style;
  }
}
