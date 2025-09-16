import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private _loading = new BehaviorSubject<boolean>(false);
  loading$ = this._loading.asObservable();
  private minLoadingTime = 1000;
  private loadingTimeout: any;

  show() {
    this._loading.next(true);
    clearTimeout(this.loadingTimeout);
  }

  hide() {
    this.loadingTimeout = setTimeout(() => {
      this._loading.next(false);
    }, this.minLoadingTime);
  }
}


