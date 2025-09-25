import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, LoadingController } from '@ionic/angular';
import { LoadingService } from 'src/app/servicios/loading.service';
import { SupabaseService } from 'src/app/servicios/supabase.service';

@Component({
  selector: 'app-platos',
  templateUrl: './platos.component.html',
  styleUrls: ['./platos.component.scss'],
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule],
})
export class PlatosComponent  implements OnInit {

  productoNombreError: string = '';
  productoDescripcionError: string = '';
  productoTiempoError: string = '';
  productoPrecioError: string = '';
  productoImagenesError: string = '';
  imagenesProductoURLs: string[] = [];
  imagenesProductoArchivos: File[] = [];
  productoForm: FormGroup;
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private loadingService: LoadingService,
    private sb: SupabaseService,
  ) { 
      this.productoForm = this.fb.group({
        nombre: ['', [Validators.required, Validators.pattern(/^[A-Za-zÀ-ÿ0-9\s]+$/)]],
        descripcion: ['', [Validators.required, Validators.minLength(10)]],
        tiempoElaboracion: ['', [Validators.required, Validators.min(1), Validators.max(60)]],
        precio: ['', [Validators.required, Validators.min(0.01)]],
        tipo: ['comida']
      });
  }

  ngOnInit() {}


  // validarTresImagenes(control: any) {
  //   const imagenes = control.value;
  //   if (imagenes && imagenes.length !== 3) {
  //     return { validarTresImagenes: true };
  //   }
  //   return null;
  // }

  async registrarProducto() {
    if (this.productoForm.invalid || this.imagenesProductoArchivos.length !== 3) {
      this.mensajeError = 'Por favor completa todos los campos y selecciona 3 imágenes';
      return;
    }

    this.mensajeError = ''
    this.mensajeExito = ''
    this.loadingService.show();
    try {
      const { nombre, descripcion, tiempoElaboracion, precio, tipo } = this.productoForm.value;

      const nombreLimpio = nombre
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')  // Reemplazar caracteres especiales con -
      .replace(/-+/g, '-')         // Evitar múltiples - seguidos
      .substring(0, 50);
      

      const imagenesURLs: string[] = [];
      for (let i = 0; i < 3; i++) {

        const archivo = this.imagenesProductoArchivos[i];

        const timestamp = Date.now();
        const extension = archivo.name.split('.').pop() || 'jpg';
        const fileName = `producto-${nombreLimpio}-${i}-${timestamp}.${extension}`;

        const { data, error } = await this.sb.supabase.storage.from('imagenes').upload(fileName, archivo, { upsert: true });
        if (error) throw new Error(error.message);
        imagenesURLs.push(this.sb.supabase.storage.from('imagenes').getPublicUrl(data.path).data.publicUrl);
      }
      const { error } = await this.sb.supabase.from('productos').insert([{ nombre, descripcion, tiempo_elaboracion: tiempoElaboracion, precio: parseFloat(precio), tipo, imagenes: imagenesURLs }]);
      if (error) throw new Error(error.message);
      this.mensajeExito = 'Producto registrado exitosamente!';
      this.productoForm.reset();
      this.imagenesProductoURLs = [];
      this.imagenesProductoArchivos = [];
      this.loadingService.hide();
    } catch (e) {
      this.mensajeError = 'Error: ' + (e as Error).message;
      this.loadingService.hide();
    }
  }

  tomarFoto() {
    console.log('se ejecuta el tomar foto')
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;

    input.onchange = (event: any) => {
      const files = event.target.files;
        for (let i = 0; i < files.length && this.imagenesProductoArchivos.length < 3; i++) {
          this.agregarFotoProducto(files[i]);
        }
    };

    input.click();
  }
  


  agregarFotoProducto(archivo: File) {
    if (this.imagenesProductoArchivos.length >= 3) {
      this.mensajeError = 'Ya tienes 3 imágenes seleccionadas';
      return;
    }
    this.imagenesProductoArchivos.push(archivo);
    this.actualizarPreviewProducto();
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



}
