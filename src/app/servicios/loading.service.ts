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
  constructor(private loadingCtrl: LoadingController) {}
  
  async present(message: string = 'Por favor espere...') {
    this.loading = await this.loadingCtrl.create({
      message,
      spinner: 'crescent'
    });
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
}





