import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class SweetAlertService {

  constructor() { }


  async showAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' | 'question') {

    let alertConfirmado = false;

    const result = await Swal.fire({
      
      title: title,
      text: text,
      icon: icon,
      //confirmButtonText: 'OK',
      position: "bottom-end"
     
    });

    return result.isConfirmed;
  }

  async mostrarAlertaTemp(title: string,icon: 'success' | 'error' | 'warning' | 'info' | 'question') {
    Swal.fire({
      title: title,
      icon: icon,
      position: "top-end",
      showConfirmButton: false,
      timer: 1500
    });
  }

  async showToast(title: string, icon: 'success' | 'error' | 'warning' | 'info' | 'question')
  {
    const Toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      }
    });
    Toast.fire({
      icon: icon,
      title: title
    });
  }

  /*hacer un alert que me muestre una rueda cargando por un segundo */
  async showLoadingAlertForOneSecond(title: string, text: string) {
    Swal.fire({
      title: title,
      text: text,
      didOpen: () => {
        Swal.showLoading();
      },
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        Swal.close();
        resolve();
      }, 1000);
    });
  }
  // async showLoading(title: string, text: string) {
  //   Swal.fire({
  //     title: title,
  //     text: text,
  //     didOpen: () => {
  //       Swal.showLoading();

  //     },
  //     allowOutsideClick: false,
  //     allowEscapeKey: false,
  //     showConfirmButton: false
      
  //   });
  // }



  async showTemporaryAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' | 'question') {

    let timerInterval:any;

    Swal.fire({
      title: title,
      html: "I will close in <b></b> milliseconds.",
      timer: 1000,
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
        const timer = Swal.getPopup()?.querySelector("b");
        if (timer) {
          timerInterval = setInterval(() => {
            timer.textContent = `${Swal.getTimerLeft()}`;
          }, 100);
        }
      },
      willClose: () => {
        clearInterval(timerInterval);
      }
    }).then((result) => {
      /* Read more about handling dismissals below */
      if (result.dismiss === Swal.DismissReason.timer) {
        console.log("I was closed by the timer");
      }
    });
  }


  async showLoadingAlert(title: string, text: string) {
    Swal.fire({
      title: "Let´s play!",
      text: title,
      imageUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzJtemxhNGF3N3ZydGU1eDVkZzFlY2wwNDRhYXVtMXRvb3B4a2RtZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gR2QsBTCO5DhwIm3cr/giphy.gif",
      imageWidth: 200,
      imageHeight: 200,
      imageAlt: "Custom image"
    });

  }


}
