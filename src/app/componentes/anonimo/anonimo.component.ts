import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { SupabaseService } from '../../servicios/supabase.service';
import { FeedbackService } from '../../servicios/feedback-service.service';
import { IonContent, IonItem, IonLabel, IonIcon, IonButton,IonInput} from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-anonimo',
  templateUrl: './anonimo.component.html',
  styleUrls: ['./anonimo.component.scss'],
  imports: [IonContent, ReactiveFormsModule, IonItem, IonLabel, IonContent, IonIcon, IonButton, IonInput ,CommonModule]
})
export class AnonimoComponent  {

  anonimoForm = this.fb.group({
    nombre: ['', Validators.required],
    imagen: [null as File | null, Validators.required]
  });

  clienteAnonimo = { nombre: '', foto: '' };
   imagenURL: string | null = "";
  manualQrText = '';
  mensajeInfo = '';

  constructor(
    private fb: FormBuilder,
    private sb: SupabaseService,
    private feedback: FeedbackService,
    private router: Router,
    private alertCtrl: AlertController
  ) {}

  tomarFoto() {
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

      // Insertar en lista_espera
      await this.sb.supabase.from('lista_espera').insert([
        {
          correo: `anonimo-${cliente.id}@fritos.com`,
          nombre: cliente.nombre,
          fecha_ingreso: new Date()
        }
      ]);

      await loading.dismiss();
      this.feedback.showToast('exito', '🙌 Ya estás en la lista de espera, capo!');
      this.anonimoForm.reset();
      this.imagenURL = null;

    } catch (e: any) {
      await loading.dismiss();
      this.feedback.showToast('error', '❌ Error: ' + e.message);
    }
  }


  // ---------- ESCANEAR QR ----------
 async escanearQR() {
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length === 0) return;

      const qrText = barcodes[0].rawValue;
      console.log('QR leído:', qrText);

      if (qrText.startsWith('ENCUESTA:')) {
        // 👉 ir a la página de encuestas
        this.router.navigate(['/encuestas']);
      } else if (qrText.startsWith('ENTRADA:')) {
        // 👉 registrar en lista de espera
        await this.agregarAListaEspera();
      } else {
        const alert = await this.alertCtrl.create({
          header: 'QR inválido',
          message: `Este código no corresponde a ninguna acción válida.`,
          buttons: ['OK']
        });
        await alert.present();
      }
    } catch (err) {
      console.error('Error al escanear QR:', err);
    }
  }

  async agregarAListaEspera() {
    try {
      const { error } = await this.sb.supabase
        .from('lista_espera')
        .insert([
          {
            nombre: this.clienteAnonimo.nombre,
            foto: this.clienteAnonimo.foto,
            estado: 'esperando'
          }
        ]);

      if (error) throw error;

      const alert = await this.alertCtrl.create({
        header: 'Registrado en lista de espera',
        message: `¡Listo ${this.clienteAnonimo.nombre}! El maître te asignará una mesa pronto.`,
        buttons: ['OK']
      });
      await alert.present();
    } catch (err: any) {
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: `No se pudo registrar: ${err.message}`,
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  // ---------- Ver encuestas ----------
  verEncuestas() {
    // Navegar a ruta encuestas, se puede pasar id del restaurante o mostrar públicas
    this.router.navigate(['/encuestas']);
  }

  volverBienvenida()
  {
    this.router.navigate(['/bienvenida']);
  }

}
