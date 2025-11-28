import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { CustomLoader } from './custom-loader.service';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loading: HTMLIonLoadingElement | null = null;
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();
  private minLoadingTime = 1000;
  private loadingTimeout: any;
  
  constructor(
    private loadingCtrl: LoadingController,
    private customLoader: CustomLoader
  ) {}
  
  async present(message: string = 'Por favor espere...') {
    // Usar el CustomLoader con el logo de la empresa
    this.customLoader.show(message);
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
    this.customLoader.hide();
    if (this.loading) {
      await this.loading.dismiss();
      this.loading = null;
    }
  }
}





