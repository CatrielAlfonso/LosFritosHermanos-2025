import { IonContent, IonItem, IonLabel, IonIcon, IonButton, IonInput, AlertController, ToastController } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Capacitor  } from '@capacitor/core';
import { isPlatform } from '@ionic/angular/standalone'; 
// Usaremos tu plugin actual
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
// Importamos Browser y Clipboard, asumiendo que ya los instalaste
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from 'src/app/servicios/supabase.service';
import { FeedbackService } from 'src/app/servicios/feedback-service.service';
import { PushNotificationService } from 'src/app/servicios/push-notification.service';

@Component({
  selector: 'app-anonimo',
  templateUrl: './anonimo.component.html',
  styleUrls: ['./anonimo.component.scss'],
  imports: [IonContent, ReactiveFormsModule, IonItem, IonLabel, IonContent, IonIcon, IonButton, IonInput, CommonModule]
})
export class AnonimoComponent  {

  anonimoForm = this.fb.group({
    nombre: ['', Validators.required],
    imagen: [null as File | null, Validators.required]
  });

  clienteAnonimo = { nombre: '', foto: '' };
  imagenURL: string | null = null;
  manualQrText = '';
  mensajeInfo = '';
  
  // Nuevo: Estado de la cámara y resultado del escaneo
  isScanning: boolean = false;
  scanResult: string | null = null;

  constructor(
    private fb: FormBuilder,
    private sb: SupabaseService,
    private feedback: FeedbackService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private pushNotificationService: PushNotificationService
  ) {}

  async ngOnInit() {
    if (isPlatform('capacitor')) {
      await this.checkCameraPermission();
    }
  }

  ngOnDestroy(): void {
    // Es buena práctica detener el escaneo si el componente se destruye
    this.stopScan(); 
  }

  // --- Lógica de Fotos Existente ---

  tomarFoto() {
    // ... tu lógica de tomar foto con input file ...
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = (e: any) => {
      const archivo = e.target.files[0];
      if (archivo) {
        this.anonimoForm.patchValue({ imagen: archivo });
        this.subirPreview(archivo);
      }
    };

    input.click();
  }

  async subirPreview(file: File) {
    const reader = new FileReader();
    reader.onload = () => (this.imagenURL = reader.result as string);
    reader.readAsDataURL(file);
  }

  // ... tu lógica de registro 'registrarAnonimo' ...
  async registrarAnonimo() {
    if (this.anonimoForm.invalid) {
      this.feedback.showToast('error', '⚠️ Completá los datos');
      return;
    }

    const loading = await this.feedback.showLoading();

    try {
      const { nombre, imagen } = this.anonimoForm.value;

      // Subir foto a bucket
      let fotoUrl = '';
      if (imagen) {
        const fileName = `anonimos/${Date.now()}-${(imagen as File).name}`;
        const { data, error } = await this.sb.supabase.storage
          .from('imagenes')
          .upload(fileName, imagen as File, { upsert: true });

        if (error) throw error;

        fotoUrl = this.sb.supabase.storage
          .from('imagenes')
          .getPublicUrl(data.path).data.publicUrl;
      }

      // Insertar cliente en tabla clientes
      const { data: cliente, error: errorCliente } = await this.sb.supabase
        .from('clientes')
        .insert([
          {
            nombre,
            imagenPerfil: fotoUrl,
            anonimo: true,
            validado: true,
            aceptado: true,
            sentado: false
          }
        ])
        .select()
        .single();

      if (errorCliente) throw errorCliente;

      // Guardar cliente anónimo en localStorage para mantener sesión
      localStorage.setItem('clienteAnonimo', JSON.stringify({
        id: cliente.id,
          nombre: cliente.nombre,
        imagenPerfil: cliente.imagenPerfil,
        anonimo: true
      }));

      await loading.dismiss();

      this.feedback.showToast('exito', '¡Bienvenido a Los Fritos Hermanos!');
      this.anonimoForm.reset();
      this.imagenURL = null;

      // Navegar directamente al home
      this.router.navigate(['/home']);

    } catch (e: any) {
      await loading.dismiss();
      this.feedback.showToast('error', '❌ Error: ' + e.message);
    }
  }


  // ---------- ESCANEO QR INTEGRADO (Nuevo) ----------

  async checkCameraPermission() {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera !== 'granted') {
      await BarcodeScanner.requestPermissions();
    }
  }

  async startScan() {
    if (!isPlatform('capacitor')) {
        this.feedback.showToast('error', 'El escaneo QR solo funciona en dispositivos móviles.');
        return;
    }

    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera !== 'granted') {
        this.feedback.showToast('error', 'Permiso de cámara denegado. Es necesario para escanear.');
        return;
    }

    this.scanResult = null;
    this.isScanning = true;

    try {
        // Clase global para hacer transparente el fondo de la app (requerido por Capacitor)
        document.querySelector('body')?.classList.add('scanner-active');

        // Usamos el método scan de tu plugin mlkit
        const { barcodes } = await BarcodeScanner.scan();
        
        // Retiramos la clase de transparencia
        document.querySelector('body')?.classList.remove('scanner-active');

        if (barcodes.length > 0) {
            const qrText = barcodes[0].rawValue;
            this.scanResult = qrText;
            this.handleScanResult(qrText); // Procesar el resultado
        }
    } catch (error) {
        document.querySelector('body')?.classList.remove('scanner-active');
        console.error('Error al escanear QR:', error);
        this.feedback.showToast('error', 'Error al iniciar el escaneo.');
    } finally {
        this.isScanning = false;
    }
  }

  stopScan() {
    if (this.isScanning) {
      BarcodeScanner.stopScan();
      document.querySelector('body')?.classList.remove('scanner-active');
      this.isScanning = false;
    }
  }

  async handleScanResult(qrText: string) {
    if (qrText.startsWith('ENCUESTA:')) {
      // Usamos el ID de mesa/encuesta para navegar
      this.router.navigate(['/encuestas', qrText.split(':')[1]]); 
    } else if (qrText.startsWith('ENTRADA:')) {
      // El QR de entrada es lo que pide el Punto 9.
      await this.agregarAListaEsperaAnonima();
    } else if (this.isURL(qrText)) {
      // Si es una URL, ofrecer abrirla
      this.showUrlConfirmation(qrText);
    } else {
      this.feedback.showToast('exito', 'QR escaneado: ' + qrText);
    }
  }
  
  // Tu lógica de agregarAListaEspera ligeramente modificada para ser 'anónima' si viene de QR.
  async agregarAListaEsperaAnonima() {
    // Si viene de QR de ENTRADA, registramos con un nombre temporal o el nombre del formulario si ya lo puso.
    const loading = await this.feedback.showLoading();
    
    // Aquí puedes decidir si pides el nombre antes o lo dejas temporal
    const nombreAnonimo = this.anonimoForm.get('nombre')?.value || 'Anónimo QR';

    try {
      // Simulación de registro en lista de espera sin foto, solo con nombre
      await this.sb.supabase.from('lista_espera').insert([
        {
          correo: `anonimo-qr-${Date.now()}@fritos.com`, // Correo único
          nombre: nombreAnonimo,
          fecha_ingreso: new Date()
        }
      ]);
      
      await loading.dismiss();

      // Notificar al maître
      try {
        await this.pushNotificationService.notificarMaitreNuevoCliente(
          nombreAnonimo,
          '' // Sin apellido para anónimos
        );
      } catch (error) {
        console.error('Error al notificar al maître:', error);
        // No lanzamos el error para no interrumpir el flujo del usuario
      }

      this.feedback.showToast('exito', `¡Listo ${nombreAnonimo}! Registrado por QR. El maître te asignará una mesa pronto.`);
      this.scanResult = null;

    } catch (err: any) {
      await loading.dismiss();
      this.feedback.showToast('error', '❌ Error al registrar por QR: ' + err.message);
    }
  }

  // --- Funcionalidades Adicionales (Copia y URL) ---
  
  isURL(str: string): boolean {
    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' + 
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)*[a-z]{2,}|' + 
      '((\\d{1,3}\\.){3}\\d{1,3}))' + 
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + 
      '(\\?[;&a-z\\d%_.~+=-]*)?' + 
      '(\\#[-a-z\\d_]*)?$', 
      'i'
    );
    return !!urlPattern.test(str);
  }

  async copyToClipboard() {
    if (this.scanResult) {
      await Clipboard.write({
        string: this.scanResult,
      });
      this.presentToast('Resultado copiado al portapapeles', 'success');
    }
  }

  async showUrlConfirmation(qrText: string) {
    const alert = await this.alertCtrl.create({
      header: 'Abrir Enlace',
      message: `¿Quieres abrir este enlace en el navegador?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Abrir', handler: () => this.openURL(qrText) },
      ],
    });
    await alert.present();
  }

  async openURL(url: string) {
    let urlToOpen = url;
    if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
      urlToOpen = 'https://' + urlToOpen;
    }
    
    try {
        await Browser.open({ url: urlToOpen });
    } catch (e) {
        this.presentToast('Error al abrir el navegador.', 'danger');
    }
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 2000,
      color: color,
    });
    toast.present();
  }

  volverBienvenida() {
    this.router.navigate(['/bienvenida']);
  }

}
