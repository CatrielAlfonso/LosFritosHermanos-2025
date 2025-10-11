//import { Component, OnInit } from '@angular/core';
import { Component, inject, OnInit } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { ClienteService } from '../../servicios/cliente.service'; 
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { AuthService } from 'src/app/servicios/auth.service';
import { Router } from '@angular/router';

// interface ScanResult {
//   barcodes: Barcode[]; // Un array de códigos de barras encontrados
// }

@Component({
  selector: 'app-escaner',
  templateUrl: './escaner.component.html',
  styleUrls: ['./escaner.component.scss'],
})
export class EscanerComponent  implements OnInit {

  private clienteService = inject(ClienteService);
  private feedback = inject(FeedbackService);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.checkPermissions();
  }

  ionViewWillEnter() {
    // Este hook se ejecuta cuando la página está a punto de aparecer
    this.startScan();
  }

  ionViewWillLeave() {
      // Es una buena práctica detener el escáner cuando el usuario sale de la vista
      BarcodeScanner.stopScan();
  }

 async checkPermissions(): Promise<boolean> {
  const { camera } = await BarcodeScanner.checkPermissions();
  
  if (camera === 'granted') {
    return true;
  }
  
  // Si no está granted, intenta solicitarlo
  const { camera: newCameraStatus } = await BarcodeScanner.requestPermissions();
  
  if (newCameraStatus === 'denied') {
    this.feedback.showToast('error', '❌ Necesitas permisos de cámara para escanear el QR.');
    return false;
  }
  
  return newCameraStatus === 'granted';
}

async startScan() {
    const hasPermission = await this.checkPermissions();
    
    if (hasPermission) {
        this.scanAndCheckIn();
    } else {
        // Podrías redirigir al home o mostrar un mensaje permanente.
    }
}

  async scanAndCheckIn() {
  
  // Opcional: Asegúrate de que el body de la app no se cubra al iniciar el escaneo
    document.body.classList.add('barcode-scanner-active'); 

    try {
        const result = await BarcodeScanner.scan();
        
        // Detiene la cámara tan pronto como obtienes el resultado o si el usuario sale.
        await BarcodeScanner.stopScan(); 
        document.body.classList.remove('barcode-scanner-active');

        if (result.barcodes.length > 0) 
        {
          const qrContent = result.barcodes[0].rawValue;
          
          if (qrContent && qrContent.startsWith('RESTAURANT_CHECKIN_')) {
              this.feedback.showLoading('Confirmando tu llegada...');
            
            try {
              // **CLAVE:** Reemplaza el ID fijo por el ID real del usuario logueado
              // Puedes obtenerlo desde tu AuthService o similar
              let loggedInClienteId = await this.authService.obtenerIdUsuarioActual();
              console.log('ID del cliente logueado:', loggedInClienteId);
              //const loggedInClienteId = 12345; // <-- ¡CÁMBIAME! (usa tu AuthService)
              //parsear a number el loggedInClienteId
              if (!loggedInClienteId) throw new Error('No se pudo obtener tu ID de usuario. ¿Estás logueado?');
              const loggedInClienteIdNumber = parseInt(loggedInClienteId, 10);
              
              await this.clienteService.checkIn(loggedInClienteIdNumber);
              
              this.feedback.showToast('exito', '✅ ¡Has sido añadido a la lista de espera!');
              // Puedes usar Router.navigate para ir a la página de estado
              
            } catch (e: any) {
              this.feedback.showToast('error', `Error al hacer check-in: ${e.message}`);
            } finally {
              this.feedback.hide();
              this.router.navigate(['/home']);
            }
          } else {
            this.feedback.showToast('error', 'Código QR no reconocido.');
          }
        } else {
            // Esto puede pasar si el escaneo se detiene sin encontrar un código
            // this.feedback.showToast('alerta', 'Escaneo cancelado o sin resultados.');
        }
    } catch (err) {
        // Manejo de errores de la cámara o permisos
        await BarcodeScanner.stopScan(); 
        document.body.classList.remove('barcode-scanner-active');
        this.feedback.showToast('error', 'Error al iniciar escáner.');
    }
  }

}
