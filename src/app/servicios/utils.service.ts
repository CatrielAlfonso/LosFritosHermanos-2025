import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController, ToastOptions } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  loadingCrtl = inject(LoadingController);
  toastCrtl = inject(ToastController);
  router = inject(Router)


  loading()
  {
    return this.loadingCrtl.create({spinner: 'bubbles'});
  }

  async presentToast(opts?: ToastOptions) {
    const toast = await this.toastCrtl.create(opts);
    toast.present();
  }

  routerLink(url:string)
  {
    return this.router.navigateByUrl(url);
  }

  //Guarda el elemento en el Local Storage
  saveInLocalStorage(key:string,value:any)
  {
    return localStorage.setItem(key, JSON.stringify(value));
  }

  // Obtiene el elemento del Local Storage
  getFromLocalStorage(key:string)
  {
    return JSON.parse(localStorage.getItem(key) || 'null');
  }
  
}
