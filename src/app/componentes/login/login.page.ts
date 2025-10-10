import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/servicios/auth.service';
import { LoadingService } from 'src/app/servicios/loading.service';
import { PushNotifications } from '@capacitor/push-notifications';
import { CustomLoader } from 'src/app/servicios/custom-loader.service';

import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonIcon,
  IonList,
  IonPopover
} from '@ionic/angular/standalone';
import { FeedbackService } from '../../servicios/feedback-service.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonIcon,
    IonPopover,
    IonList
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  correo: string = '';
  contrasenia: string = '';
  correoError: string = '';
  contraseniaError: string = '';
  showPassword: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private loadingService: LoadingService,
    private feedbackService: FeedbackService,
    private customLoader: CustomLoader
  ) {
    this.loginForm = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      contrasenia: ['', Validators.required],
    });
  }

  ngOnInit() {

    this.loginForm.get('correo')?.valueChanges.subscribe(() => {
      this.validarCampo('correo');
    });

    this.loginForm.get('contrasenia')?.valueChanges.subscribe(() => {
      this.validarCampo('contrasenia');
    });
  }

  validarCampo(campo: string) {
    const control = this.loginForm.get(campo);
    if (!control) return;

    this.errorMessage = '';

    if (campo === 'correo') {
      this.correoError = '';
    } else if (campo === 'contrasenia') {
      this.contraseniaError = '';
    }

    if (control.value || control.touched) {
      if (campo === 'correo') {
        if (control.errors?.['required']) {
          this.correoError = 'El correo electrónico es requerido';
        } else if (control.errors?.['email']) {
          this.correoError = 'Ingrese un correo electrónico válido';
        }
      } else if (campo === 'contrasenia') {
        if (control.errors?.['required']) {
          this.contraseniaError = 'La contraseña es requerida';
        }
      }
    }
  }

  limpiarErrores() {
    this.errorMessage = '';
    this.correoError = '';
    this.contraseniaError = '';
  }

  async ingresar() {
    this.limpiarErrores();

    this.validarCampo('correo');
    this.validarCampo('contrasenia');

    if (this.correoError || this.contraseniaError) {
      return;
    }
    //this.feedbackService.showLoading()
    //this.loadingService.show();
    //this.feedbackService.mostrarLoaderPolloFrito();
    this.customLoader.show();

    try {
      const correo = this.loginForm.get('correo')?.value;
      const contrasenia = this.loginForm.get('contrasenia')?.value;

      if (!correo || !contrasenia) {
        throw new Error('Debe completar todos los campos');
      }

      if (contrasenia.length < 6) {
        this.contraseniaError = 'La contraseña debe tener al menos 6 caracteres';
        //this.loadingService.hide();
        setTimeout(async () => {
           this.customLoader.hide();
        }, 2000);
        return;
      }

      let usuario;
      try {
        usuario = await this.authService.logIn(correo, contrasenia);
      } catch (error: any) {
        if (error?.message === 'Invalid login credentials') {
          this.errorMessage = 'Correo electrónico o contraseña inválidos';
        } else if (error?.message) {
          if (error.message.includes('correo') || error.message.includes('email')) {
            this.correoError = error.message;
          } else if (error.message.includes('contraseña') || error.message.includes('password')) {
            this.contraseniaError = error.message;
          } else {
            this.errorMessage = error.message;
          }
        } else {
          this.errorMessage = 'Correo electrónico o contraseña inválidos';
        }
        //this.loadingService.hide();
        setTimeout(async () => {
           this.customLoader.hide(); 
        }, 2000);
        return;
      }

      if (!usuario) {
        this.errorMessage = 'Correo electrónico o contraseña inválidos';
        setTimeout(async () => {
           this.customLoader.hide();
        }, 2000);
        return;
      }

      // try {
      //   await this.registrarPushToken(usuario.id);
      // } catch (error) {
      //   console.error('Error al registrar push token:', error);
      // }

      this.loginForm.reset();
      this.router.navigate(['/home']);
      setTimeout(async () => {
         this.customLoader.hide();
      }, 2000);
    } catch (e: any) {
      this.errorMessage = e.message || 'Ocurrió un error al iniciar sesión';
      setTimeout(async () => {
         this.customLoader.hide();
      }, 2000);
    }
  }

  async goToRegister() {
    this.customLoader.show();
    this.router.navigateByUrl('/registro');
    setTimeout(async () => {
         this.customLoader.hide();
      }, 2000);
  }

  accesoRapido(type: string) {
    const presets: { [key: string]: { correo: string; contrasenia: string } } = {
      supervisor: { correo: 'supervisor-uno@gmail.com', contrasenia: '123456' },
      dueno: { correo: 'tomasbehrens0@gmail.com', contrasenia: '123456' },
      maitre: { correo: 'lucas-2@gmail.com', contrasenia: '123456' },
      mozo: { correo: 'felix@gmail.com', contrasenia: '123456' },
      cocinero: { correo: 'catriel@gmail.com', contrasenia: '123456' },
      bartender: { correo: 'robertin@gmail.com', contrasenia: '123456' },
      cliente: { correo: 'tomasbehrens4@gmail.com', contrasenia: '123456' },
    };

    if (presets[type]) {
      this.loginForm.patchValue({
        correo: presets[type].correo,
        contrasenia: presets[type].contrasenia
      });
    }
  }

  async registrarPushToken(userId: string) {
    try {
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          await this.authService.guardarPushToken(userId, token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

      } else {
        console.warn('Push notifications permission not granted');
      }
    } catch (error) {
      console.error('Error en registrarPushToken:', error);
    }
  }

}
