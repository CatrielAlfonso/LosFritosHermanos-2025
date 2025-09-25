import { Component} from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { toDataURL } from 'qrcode';
//import { dataURLtoBlob } from '../utils/blob-utils'; // tu helper
import { SupabaseService } from '../../servicios/supabase.service';
import { LoadingService } from '../../servicios/loading.service';
import { IonIcon,IonItem,IonLabel, IonButton,IonInput,IonSelect,IonSelectOption, IonContent } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-registro-mesa',
  templateUrl: './registro-mesa.component.html',
  styleUrls: ['./registro-mesa.component.scss'],
  imports: [IonContent, ReactiveFormsModule,IonIcon,IonItem,IonInput,IonLabel, IonButton,IonSelectOption,IonSelect,CommonModule]
})
export class RegistroMesaComponent {

  mesaForm = this.fb.group({
    numero: ['', [Validators.required, Validators.min(1)]],
    comensales: ['', [Validators.required, Validators.min(1), Validators.max(20)]],
    tipo: ['', Validators.required],
    imagen: [null as File | null,Validators.required]
  });
  
    imagenEmpleadoURL: string | null = null;
  imagenSupervisorURL: string | null = null;
  imagenMesaURL: string | null = null;
  imagenClienteURL: string | null = null;
  imagenesProductoURLs: string[] = [];
  imagenesBebidaURLs: string[] = [];
  imagenesProductoArchivos: File[] = [];
  imagenesBebidaArchivos: File[] = [];

  tipoRegistro: 'mesa' | 'producto' | 'bebida' = 'mesa'; // Nuevo
  qrMesaURL: string | null = null;
  mensajeError = '';
  mensajeExito = '';

  constructor(
    private fb: FormBuilder,
    private sb: SupabaseService,
    private loadingService: LoadingService
  ) {}

  async registrarMesa() {
    if (this.mesaForm.invalid) {
      this.mensajeError = 'Por favor completa todos los campos correctamente';
      return;
    }

    this.loadingService.show();
    try {
      const { numero, comensales, tipo, imagen } = this.mesaForm.value;

      // Verificar si existe
      const { data: mesaExistente } = await this.sb.supabase
        .from('mesas')
        .select('id')
        .eq('numero', numero)
        .maybeSingle();

      if (mesaExistente) {
        this.mensajeError = 'Esta mesa ya existe';
        this.loadingService.hide();
        return;
      }

      // Subir imagen
      let imagenMesa = '';
      if (imagen) {
        const { data, error } = await this.sb.supabase.storage
          .from('imagenes')
          .upload(`mesa-${numero}-${imagen.name}`, imagen, { upsert: true });
        if (error) throw error;

        imagenMesa = this.sb.supabase.storage.from('imagenes').getPublicUrl(data.path).data.publicUrl;
        this.imagenMesaURL = imagenMesa;
      }

      // Generar QR
      const qrData = JSON.stringify({ numeroMesa: numero });
      const qrDataUrl = await toDataURL(qrData, { width: 512 });
      const qrBlob = this.dataURLtoBlob(qrDataUrl);
      const qrFileName = `mesa-${numero}-qr.png`;

      const { error: qrError } = await this.sb.supabase.storage
        .from('qrs')
        .upload(qrFileName, qrBlob, { upsert: true });
      if (qrError) throw qrError;

      const qrUrl = this.sb.supabase.storage.from('qrs').getPublicUrl(qrFileName).data.publicUrl;
      this.qrMesaURL = qrUrl;

      // Insertar mesa
      const { error } = await this.sb.supabase.from('mesas').insert([
        { numero, comensales, tipo, imagen: imagenMesa, qr: qrUrl, ocupada: false }
      ]);
      if (error) throw error;

      this.mensajeExito = 'Mesa registrada exitosamente!';
      this.mesaForm.reset();
    } catch (e: any) {
      this.mensajeError = 'Error: ' + e.message;
    } finally {
      this.loadingService.hide();
    }
  }


 tomarFoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment'; // Usa cámara trasera en móviles

  input.onchange = (event: any) => {
    const archivo = event.target.files[0];
    if (archivo) {
      if (this.tipoRegistro === 'mesa') {
        this.procesarImagenMesa(archivo);  // 👈 llamada nueva
      } else if (this.tipoRegistro === 'producto') {
        for (let i = 0; i < event.target.files.length && this.imagenesProductoArchivos.length < 3; i++) {
          this.agregarFotoProducto(event.target.files[i]);
        }
      } else if (this.tipoRegistro === 'bebida') {
        for (let i = 0; i < event.target.files.length && this.imagenesBebidaArchivos.length < 3; i++) {
          this.agregarFotoBebida(event.target.files[i]);
        }
      }
    }
  };

  input.click();
}

procesarImagenMesa(archivo: File) {
  // Guardamos el archivo en el formControl
  this.mesaForm.patchValue({ imagen: archivo });
  this.mesaForm.get('imagen')?.updateValueAndValidity();

  // Generamos una vista previa
  const reader = new FileReader();
  reader.onload = () => {
    this.imagenMesaURL = reader.result as string; // variable que ya usás en el form
  };
  reader.readAsDataURL(archivo);
}

  agregarFotoProducto(archivo: File) {
    if (this.imagenesProductoArchivos.length >= 3) {
      this.mensajeError = 'Ya tienes 3 imágenes seleccionadas';
      return;
    }
    this.imagenesProductoArchivos.push(archivo);
    this.actualizarPreviewProducto();
  }

  agregarFotoBebida(archivo: File) {
    if (this.imagenesBebidaArchivos.length >= 3) {
      this.mensajeError = 'Ya tienes 3 imágenes seleccionadas';
      return;
    }
    this.imagenesBebidaArchivos.push(archivo);
    this.actualizarPreviewBebida();
  }

  actualizarPreviewProducto() {
    this.imagenesProductoURLs = [];
    this.imagenesProductoArchivos.forEach((archivo, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenesProductoURLs[index] = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    });
  }

  actualizarPreviewBebida() {
    this.imagenesBebidaURLs = [];
    this.imagenesBebidaArchivos.forEach((archivo, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagenesBebidaURLs[index] = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    });
  }


   dataURLtoBlob(dataurl: string) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

}
