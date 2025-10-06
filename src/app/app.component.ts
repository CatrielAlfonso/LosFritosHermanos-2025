import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private platform: Platform) {}

  async ngOnInit() {
    // Asegurarse de que la plataforma esté lista
    if (this.platform.is('capacitor')) {
      await this.initializeApp();
    }
  }

  async initializeApp() {
    // CLAVE: Establecer un estilo que garantice que la barra se muestre
    // y que los elementos debajo no la cubran (aunque Ionic lo maneja por defecto).
    try {
      await StatusBar.setStyle({ style: Style.Default });
      
      // Opcional: Si quieres que el fondo de la barra sea transparente, 
      // y que el contenido comience debajo de ella, descomenta estas líneas.
      // Pero si quieres que el header de Ionic no se superponga, 
      // asegúrate de que el plugin no esté en modo overlay/transparente si no lo necesitas.

      // Lo más importante es que las variables CSS de Ionic se establezcan.

    } catch (e) {
      console.warn('Status Bar plugin not available:', e);
    }
  }
}
