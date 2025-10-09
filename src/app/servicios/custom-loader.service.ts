import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CustomLoader {
  private loaderElement?: HTMLElement;

  show() {
    // Evita duplicados
    if (this.loaderElement) return;

    const overlay = document.createElement('div');
    overlay.classList.add('loader-overlay');
    overlay.innerHTML = `
      <img src="../../assets/imgs/loader.gif" alt="Cargando..." class="loader-gif" />
    `;
    document.body.appendChild(overlay);
    this.loaderElement = overlay;
  }

  hide() {
    if (this.loaderElement) {
      this.loaderElement.remove();
      this.loaderElement = undefined;
    }
  }
}
