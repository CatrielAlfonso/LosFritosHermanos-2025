import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AudioService } from './servicios/audio.service';
import { PushNotificationService } from './servicios/push-notification.service';
import { App } from '@capacitor/app';
import { Router } from '@angular/router';
import { AuthService } from './servicios/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform, 
    private audio: AudioService, 
    private pushNotificationService: PushNotificationService,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Asegurarse de que la plataforma esté lista
    await this.audio.preload();
    if (this.platform.is('capacitor')) {
      await this.initializeApp();
      this.setupAuthStateListener();
    }
  }

  async initializeApp() {
    // CLAVE: Establecer un estilo que garantice que la barra se muestre
    // y que los elementos debajo no la cubran (aunque Ionic lo maneja por defecto).
    try {
      await StatusBar.setStyle({ style: Style.Default });
      this.pushNotificationService.inicializarListeners();
      
      // Opcional: Si quieres que el fondo de la barra sea transparente, 
      // y que el contenido comience debajo de ella, descomenta estas líneas.
      // Pero si quieres que el header de Ionic no se superponga, 
      // asegúrate de que el plugin no esté en modo overlay/transparente si no lo necesitas.

      // Lo más importante es que las variables CSS de Ionic se establezcan.

    } catch (e) {
      console.warn('Status Bar plugin not available:', e);
    }
  }

  setupAuthStateListener() {
    // Escuchar cuando se abre la app con un deep link (OAuth callback)
    App.addListener('appUrlOpen', async (event) => {
      console.log('Deep link recibido:', event.url);
      
      // Verificar si es el callback de OAuth
      if (event.url.includes('login-callback')) {
        console.log('Callback de OAuth detectado en deep link');
        
        try {
          // Extraer el hash que contiene los tokens de OAuth
          const url = event.url;
          const hashIndex = url.indexOf('#');
          
          if (hashIndex !== -1) {
            const hash = url.substring(hashIndex);
            console.log('Hash encontrado (primeros 100 chars):', hash.substring(0, 100));
            
            // Extraer los tokens del hash
            const accessToken = this.extractParam(hash, 'access_token');
            const refreshToken = this.extractParam(hash, 'refresh_token');
            
            console.log('Access token extraído:', accessToken ? 'Sí' : 'No');
            console.log('Refresh token extraído:', refreshToken ? 'Sí' : 'No');
            
            if (accessToken && refreshToken) {
              console.log('Estableciendo sesión con tokens...');
              
              try {
                // Establecer la sesión manualmente con los tokens
                const { data, error } = await this.authService.supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                
                if (error) {
                  console.error('Error estableciendo sesión:', error);
                  this.router.navigate(['/login'], { replaceUrl: true });
                  return;
                }
                
                if (data.session && data.user) {
                  console.log('Sesión OAuth establecida correctamente:', data.user.email);
                  
                  // Procesar el callback
                  try {
                    const usuario = await this.authService.handleOAuthCallback();
                    
                    if (usuario) {
                      console.log('Usuario autenticado correctamente, redirigiendo a home');
                      this.router.navigate(['/home'], { replaceUrl: true });
                    } else {
                      console.error('No se pudo obtener el usuario');
                      this.router.navigate(['/login'], { replaceUrl: true });
                    }
                  } catch (error: any) {
                    console.error('Error en handleOAuthCallback:', error.message);
                    this.router.navigate(['/login'], { replaceUrl: true });
                  }
                } else {
                  console.error('No se pudo establecer la sesión');
                  this.router.navigate(['/login'], { replaceUrl: true });
                }
              } catch (error) {
                console.error('Error al establecer sesión:', error);
                this.router.navigate(['/login'], { replaceUrl: true });
              }
            } else {
              console.error('No se pudieron extraer los tokens del hash');
              this.router.navigate(['/login'], { replaceUrl: true });
            }
          }
        } catch (error) {
          console.error('Error procesando deep link:', error);
          this.router.navigate(['/login'], { replaceUrl: true });
        }
      }
    });
    
    // También escuchar cuando la app vuelve al primer plano
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        console.log('App volvió al primer plano, estado activo:', isActive);
      }
    });
  }

  // Helper para extraer parámetros del hash
  private extractParam(hash: string, param: string): string {
    const regex = new RegExp(`[#&]${param}=([^&]*)`);
    const match = hash.match(regex);
    return match ? decodeURIComponent(match[1]) : '';
  }
}
